/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { ipcRenderer } from '../../../../../../base/parts/sandbox/electron-browser/globals.js';
import { IVoidRuntimeService } from '../../../../voidRuntime/common/voidRuntimeService.js';
import { diagnoseQwenFailure, formatQwenFailureForUser } from '../../../common/qwenDiagnostics.js';

export enum QwenMessageType {
	SYSTEM = 'system',
	USER = 'user',
	ASSISTANT = 'assistant',
	TOOL_CALL = 'tool-call',
	TOOL_RESULT = 'tool-result',
	RESULT = 'result',
}

export interface IQwenMessage {
	id: string;
	type: QwenMessageType;
	content: string;
	timestamp: number;
	metadata?: any;
}

/**
 * Qwen Chat Service - integrates with void-ai-chat.js via IPC
 */
export class QwenChatService extends Disposable {
	private static readonly MAX_QUERY_CHARS = 160_000;
	private static readonly QUERY_CHUNK_SIZE = 24_000;
	private static readonly MAX_SYSTEM_PAYLOAD_CHARS = 220_000;
	private static readonly MAX_EVENT_TEXT_CHARS = 240_000;
	private static readonly MAX_RETRY_ATTEMPTS = 1;
	private static readonly RETRYABLE_EXIT_PATTERN = /process exited with code 1/i;

	private processing = false;
	private workspacePath: string | undefined;
	private dispatchStreamEvents = true;
	private readonly runtimeService: IVoidRuntimeService | undefined;

	private readonly _onMessage = this._register(new Emitter<IQwenMessage>());
	readonly onMessage: Event<IQwenMessage> = this._onMessage.event;

	private readonly _onEvent = this._register(new Emitter<any>());
	readonly onEvent: Event<any> = this._onEvent.event;

	private readonly _onComplete = this._register(new Emitter<void>());
	readonly onComplete: Event<void> = this._onComplete.event;

	private readonly _onError = this._register(new Emitter<Error>());
	readonly onError: Event<Error> = this._onError.event;

	constructor(runtimeService?: IVoidRuntimeService) {
		super();
		this.runtimeService = runtimeService;

		ipcRenderer.on('vscode:qwenStreamEvent', (_event: any, qwenEvent: any) => {
			if (!this.dispatchStreamEvents) {
				return;
			}
			const message = this.parseEvent(qwenEvent);
			if (!message) {
				return;
			}
			this.runtimeService?.publish('ai', `stream.${message.type}`, {
				id: message.id,
				timestamp: message.timestamp
			});
			this._onMessage.fire(message);
			this._onEvent.fire({ type: message.type, message });
		});

		ipcRenderer.on('vscode:qwenRequestDiagnostics', async (_event: any, ...args: unknown[]) => {
			try {
				const filePaths = args[0] as string[];
				const diagnostics = await this.getDiagnostics(filePaths);
				ipcRenderer.send('vscode:qwenDiagnosticsResponse', diagnostics);
			} catch (error: any) {
				ipcRenderer.send('vscode:qwenDiagnosticsResponse', { error: error.message });
			}
		});
	}

	private async getDiagnostics(filePaths: string[]): Promise<any> {
		const diagnostics: any = {};
		for (const filePath of filePaths) {
			diagnostics[filePath] = [];
		}
		return { diagnostics };
	}

	setWorkspacePath(path: string | undefined): void {
		this.workspacePath = path;
		console.log('[Qwen] Workspace path set:', path);
		if (path) {
			this.runtimeService?.transition('open', { workspacePath: path });
			this.runtimeService?.publish('ai', 'workspace.updated', { workspacePath: path });
		}
	}

	private getMoscowTime(): string {
		return new Date().toLocaleString('ru-RU', {
			timeZone: 'Europe/Moscow',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	private buildSystemContext(query: string, attachedFiles: string[] = []): string {
		const now = this.getMoscowTime();
		const workspace = this.workspacePath ?? 'unknown';
		const filesBlock = attachedFiles.length
			? `\n[ATTACHED FILE PATHS]\n${attachedFiles.map(path => `- ${path}`).join('\n')}`
			: '';

		return [
			'[SYSTEM CONTEXT]',
			`Current Moscow time: ${now}`,
			`Workspace: ${workspace}`,
			'',
			'[CORE RULES]',
			'- Reply in Russian.',
			'- Keep tool usage minimal and grouped.',
			'- Use only verified facts from files and tool outputs.',
			'- If workspace is known, do not operate outside it.',
			'- For almost every non-trivial coding task, internally run Planner -> Researcher -> Implementer -> Verifier -> Critic before final response.',
			'- For trivial requests, skip delegation and answer directly.',
			'- Keep user-visible flow seamless: never mention internal agents, delegation, or orchestration.',
			'- Never expose agent names in the final answer.',
			'- Keep patches small and deterministic; avoid broad rewrites unless explicitly asked.',
			'',
			'[USER MESSAGE]',
			query,
			filesBlock
		].join('\n');
	}

	async sendMessage(
		query: string,
		attachedFiles?: string[],
		options?: { dispatchEvents?: boolean }
	): Promise<{ assistantText: string; events: any[] }> {
		if (this.processing) {
			throw new Error('Another message is already being processed');
		}

		this.processing = true;
		this.dispatchStreamEvents = options?.dispatchEvents !== false;
		const normalized = this.normalizeQueryPayload(query);
		let enhancedQuery = this.buildSystemContext(normalized.payload, attachedFiles ?? []);
		if (enhancedQuery.length > QwenChatService.MAX_SYSTEM_PAYLOAD_CHARS) {
			enhancedQuery = `${enhancedQuery.slice(0, QwenChatService.MAX_SYSTEM_PAYLOAD_CHARS)}\n\n[PAYLOAD TRUNCATED]\nThe request envelope exceeded the safe payload limit and was truncated.`;
		}
		const startedAt = Date.now();
		this.runtimeService?.publish('ai', 'request.started', {
			workspacePath: this.workspacePath,
			queryChars: query.length,
			attachedFiles: attachedFiles?.length ?? 0,
			chunks: normalized.chunkCount,
			truncated: normalized.truncated
		});
		this.runtimeService?.log('info', 'AI request started', {
			channel: 'ai',
			type: 'request.started',
			payload: {
				queryChars: query.length,
				attachedFiles: attachedFiles?.length ?? 0,
				chunks: normalized.chunkCount,
				truncated: normalized.truncated
			}
		});

		console.log('[Qwen] Sending message via IPC, payload chars:', enhancedQuery.length);

		try {
			let result: any | undefined;
			let lastError: Error | undefined;
			let attemptPayload = enhancedQuery;

			for (let attempt = 0; attempt <= QwenChatService.MAX_RETRY_ATTEMPTS; attempt++) {
				try {
					result = await ipcRenderer.invoke('vscode:qwenSendMessage', attemptPayload, this.workspacePath);
					if (result?.error) {
						throw new Error(String(result.error));
					}
					break;
				} catch (attemptError: any) {
					const errorMessage = attemptError instanceof Error ? attemptError.message : String(attemptError);
					lastError = attemptError instanceof Error ? attemptError : new Error(errorMessage);
					const canRetry = attempt < QwenChatService.MAX_RETRY_ATTEMPTS && this.isRetryableIpcFailure(errorMessage);
					if (!canRetry) {
						throw lastError;
					}
					this.runtimeService?.publish('ai', 'request.retry', {
						workspacePath: this.workspacePath,
						attempt: attempt + 2,
						reason: errorMessage
					});
					this.runtimeService?.log('warn', `AI request retry scheduled: ${errorMessage}`, {
						channel: 'ai',
						type: 'request.retry'
					});
					attemptPayload = this.buildRetryPayload(normalized.payload);
				}
			}

			if (!result) {
				throw lastError ?? new Error('No response from Qwen IPC');
			}

			if (this.dispatchStreamEvents) {
				this.triggerFileSystemRefresh();
				this._onComplete.fire();
			}

			this.runtimeService?.publish('ai', 'request.completed', {
				workspacePath: this.workspacePath,
				durationMs: Date.now() - startedAt,
				events: result.events?.length ?? 0
			});
			this.runtimeService?.log('info', 'AI request completed', {
				channel: 'ai',
				type: 'request.completed',
				payload: { durationMs: Date.now() - startedAt, events: result.events?.length ?? 0 }
			});

			return {
				assistantText: this.extractAssistantTextFromRawEvents(result.events ?? []),
				events: result.events ?? []
			};
		} catch (error: any) {
			const normalizedError = error instanceof Error ? error : new Error(String(error));
			console.error('[Qwen] IPC Error:', normalizedError);
			const errorMessage = normalizedError.message;
			const diagnosis = diagnoseQwenFailure(errorMessage);
			const surfacedError = new Error(formatQwenFailureForUser(errorMessage));
			this.runtimeService?.publish('ai', 'request.failed', {
				workspacePath: this.workspacePath,
				durationMs: Date.now() - startedAt,
				error: errorMessage,
				title: diagnosis.title
			});
			this.runtimeService?.publish('ai', 'request.failed.diagnostic', {
				workspacePath: this.workspacePath,
				durationMs: Date.now() - startedAt,
				diagnosis
			});
			this.runtimeService?.log('error', `AI request failed: ${errorMessage}`, {
				channel: 'ai',
				type: 'request.failed',
				payload: diagnosis
			});
			this.runtimeService?.createCrashReport('ai-ipc-request-failed', {
				workspacePath: this.workspacePath,
				error: errorMessage
			});
			this._onError.fire(surfacedError);
			throw surfacedError;
		} finally {
			this.processing = false;
			this.dispatchStreamEvents = true;
		}
	}

	private triggerFileSystemRefresh(): void {
		setTimeout(() => {
			window.dispatchEvent(new CustomEvent('qwen-files-changed'));
			console.log('[Qwen] File system refresh event dispatched');
		}, 100);
	}

	private extractAssistantTextFromRawEvents(events: any[]): string {
		const chunks: string[] = [];
		for (const event of events) {
			if (event?.type !== 'assistant') {
				continue;
			}
			const content = event?.message?.content?.[0];
			if (content?.type === 'text' && typeof content.text === 'string') {
				chunks.push(content.text);
			}
		}
		return chunks.join('\n').trim();
	}

	private parseEvent(event: any): IQwenMessage | null {
		if (!event || typeof event !== 'object') {
			return null;
		}
		const id = typeof event?.uuid === 'string' && event.uuid.length > 0
			? event.uuid
			: `msg-${Date.now()}-${Math.random()}`;
		const timestamp = Date.now();

		switch (event.type) {
			case 'system':
				if (event.subtype === 'init') {
					return {
						id,
						type: QwenMessageType.SYSTEM,
						content: `Initialized with model: ${event.model}`,
						timestamp,
						metadata: {
							model: event.model,
							tools: event.tools,
							sessionId: event.session_id,
						},
					};
				}
				break;

			case 'assistant': {
				const content = event.message?.content?.[0];
				if (!content) {
					return null;
				}

				if (content.type === 'tool_use') {
					const toolName = typeof content.name === 'string' && content.name.trim().length > 0 ? content.name : 'tool';
					const toolInput = this.normalizeToolPayload(content.input);
					const toolCallId = typeof content.id === 'string' && content.id.length > 0
						? content.id
						: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
					return {
						id,
						type: QwenMessageType.TOOL_CALL,
						content: this.limitEventText(JSON.stringify({ name: toolName, input: toolInput }, null, 2)),
						timestamp,
						metadata: {
							toolName,
							toolInput,
							toolCallId
						},
					};
				}

				if (content.type === 'text') {
					return {
						id,
						type: QwenMessageType.ASSISTANT,
						content: this.limitEventText(typeof content.text === 'string' ? content.text : ''),
						timestamp,
						metadata: {
							usage: event.message.usage,
						},
					};
				}
				break;
			}

			case 'user': {
				const toolResult = event.message?.content?.[0];
				if (toolResult?.type === 'tool_result') {
					const rawContent = typeof toolResult.content === 'string'
						? toolResult.content
						: JSON.stringify(this.normalizeToolPayload(toolResult.content));
					return {
						id,
						type: QwenMessageType.TOOL_RESULT,
						content: this.limitEventText(rawContent),
						timestamp,
						metadata: {
							isError: toolResult.is_error,
							toolUseId: typeof toolResult.tool_use_id === 'string' ? toolResult.tool_use_id : undefined,
						},
					};
				}
				break;
			}

			case 'result':
				return {
					id,
					type: QwenMessageType.RESULT,
					content: this.limitEventText(`Completed in ${event.duration}ms`),
					timestamp,
					metadata: {
						duration: event.duration,
						numTurns: event.num_turns,
					},
				};
		}

		return null;
	}

	isProcessing(): boolean {
		return this.processing;
	}

	abort(): void {
		this.processing = false;
	}

	private normalizeQueryPayload(query: string): { payload: string; chunkCount: number; truncated: boolean } {
		const sanitized = (query ?? '').replace(/\r\n/g, '\n').trim();
		const trimmed = sanitized.length > QwenChatService.MAX_QUERY_CHARS
			? sanitized.slice(0, QwenChatService.MAX_QUERY_CHARS)
			: sanitized;
		const truncated = trimmed.length < sanitized.length;
		const chunks = this.splitIntoChunks(trimmed, QwenChatService.QUERY_CHUNK_SIZE);
		if (chunks.length <= 1) {
			return {
				payload: truncated ? `${trimmed}\n\n[TRUNCATED]\nInput was truncated to fit the payload safety limit.` : trimmed,
				chunkCount: 1,
				truncated
			};
		}
		const chunked = chunks
			.map((chunk, index) => `[USER MESSAGE CHUNK ${index + 1}/${chunks.length}]\n${chunk}`)
			.join('\n\n');
		return {
			payload: truncated ? `${chunked}\n\n[TRUNCATED]\nInput was truncated to fit the payload safety limit.` : chunked,
			chunkCount: chunks.length,
			truncated
		};
	}

	private splitIntoChunks(text: string, targetSize: number): string[] {
		if (!text.length) {
			return [''];
		}
		const paragraphs = text.split(/\n{2,}/);
		const chunks: string[] = [];
		let current = '';
		for (const paragraph of paragraphs) {
			const candidate = current.length ? `${current}\n\n${paragraph}` : paragraph;
			if (candidate.length <= targetSize) {
				current = candidate;
				continue;
			}
			if (current.length) {
				chunks.push(current);
				current = '';
			}
			if (paragraph.length <= targetSize) {
				current = paragraph;
				continue;
			}
			let cursor = 0;
			while (cursor < paragraph.length) {
				const slice = paragraph.slice(cursor, cursor + targetSize);
				chunks.push(slice);
				cursor += targetSize;
			}
		}
		if (current.length) {
			chunks.push(current);
		}
		return chunks.length > 0 ? chunks : [text];
	}

	private isRetryableIpcFailure(message: string): boolean {
		return QwenChatService.RETRYABLE_EXIT_PATTERN.test(message);
	}

	private buildRetryPayload(payload: string): string {
		const shortened = payload.length > 12000 ? `${payload.slice(0, 12000)}\n\n[RETRY PAYLOAD TRUNCATED]` : payload;
		return this.buildSystemContext(`${shortened}\n\n[RETRY MODE]\nPrevious attempt failed with exit code 1. Use minimal toolset and deterministic output.`, []);
	}

	private normalizeToolPayload(payload: unknown): unknown {
		if (payload === null || payload === undefined) {
			return {};
		}
		if (Array.isArray(payload)) {
			return payload.map(item => this.normalizeToolPayload(item)).slice(0, 80);
		}
		if (typeof payload === 'object') {
			const normalized: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
				normalized[key] = this.normalizeToolPayload(value);
			}
			return normalized;
		}
		if (typeof payload === 'string') {
			return this.limitEventText(payload);
		}
		return payload;
	}

	private limitEventText(value: string): string {
		if (value.length <= QwenChatService.MAX_EVENT_TEXT_CHARS) {
			return value;
		}
		return `${value.slice(0, QwenChatService.MAX_EVENT_TEXT_CHARS)}\n...[truncated]`;
	}
}

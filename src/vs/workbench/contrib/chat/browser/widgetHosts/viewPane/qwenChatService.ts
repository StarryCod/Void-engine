/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { ipcRenderer } from '../../../../../../base/parts/sandbox/electron-browser/globals.js';

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
	private processing = false;
	private workspacePath: string | undefined;
	private dispatchStreamEvents = true;

	private readonly _onMessage = this._register(new Emitter<IQwenMessage>());
	readonly onMessage: Event<IQwenMessage> = this._onMessage.event;

	private readonly _onEvent = this._register(new Emitter<any>());
	readonly onEvent: Event<any> = this._onEvent.event;

	private readonly _onComplete = this._register(new Emitter<void>());
	readonly onComplete: Event<void> = this._onComplete.event;

	private readonly _onError = this._register(new Emitter<Error>());
	readonly onError: Event<Error> = this._onError.event;

	constructor() {
		super();

		ipcRenderer.on('vscode:qwenStreamEvent', (_event: any, qwenEvent: any) => {
			if (!this.dispatchStreamEvents) {
				return;
			}
			const message = this.parseEvent(qwenEvent);
			if (!message) {
				return;
			}
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
		const enhancedQuery = this.buildSystemContext(query, attachedFiles ?? []);

		console.log('[Qwen] Sending message via IPC, payload chars:', enhancedQuery.length);

		try {
			const result: any = await ipcRenderer.invoke('vscode:qwenSendMessage', enhancedQuery, this.workspacePath);
			if (result.error) {
				throw new Error(result.error);
			}

			if (this.dispatchStreamEvents) {
				this.triggerFileSystemRefresh();
				this._onComplete.fire();
			}

			return {
				assistantText: this.extractAssistantTextFromRawEvents(result.events ?? []),
				events: result.events ?? []
			};
		} catch (error: any) {
			console.error('[Qwen] IPC Error:', error);
			this._onError.fire(error);
			throw error;
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
		const id = event.uuid || `msg-${Date.now()}-${Math.random()}`;
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
					return {
						id,
						type: QwenMessageType.TOOL_CALL,
						content: JSON.stringify({ name: content.name, input: content.input }, null, 2),
						timestamp,
						metadata: {
							toolName: content.name,
							toolInput: content.input,
							toolCallId: content.id,
						},
					};
				}

				if (content.type === 'text') {
					return {
						id,
						type: QwenMessageType.ASSISTANT,
						content: content.text,
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
					return {
						id,
						type: QwenMessageType.TOOL_RESULT,
						content: typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content),
						timestamp,
						metadata: {
							isError: toolResult.is_error,
							toolUseId: toolResult.tool_use_id,
						},
					};
				}
				break;
			}

			case 'result':
				return {
					id,
					type: QwenMessageType.RESULT,
					content: `Completed in ${event.duration}ms`,
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
}

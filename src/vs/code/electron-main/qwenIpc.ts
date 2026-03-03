/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { ILogService } from '../../platform/log/common/log.js';

export interface IQwenEvent {
	type: string;
	uuid?: string;
	message?: any;
	[key: string]: any;
}

export interface IQwenChatResult {
	events: IQwenEvent[];
	error?: string;
}

export class QwenIPCHandler {
	private currentProcess: ChildProcess | undefined;
	private readonly qwenScriptPath: string;

	constructor(
		private readonly logService: ILogService,
		workspaceRoot?: string
	) {
		// Get current file path in ES modules
		const currentFilePath = fileURLToPath(import.meta.url);
		const currentDir = dirname(currentFilePath);

		// Resolve script path from several common layouts (dev/build/package).
		this.qwenScriptPath = this.resolveQwenScriptPath(currentDir);

		this.logService.info('[Qwen IPC] Initialized with script path:', this.qwenScriptPath);
		if (!existsSync(this.qwenScriptPath)) {
			this.logService.warn('[Qwen IPC] Script file does not exist:', this.qwenScriptPath);
		}
	}

	private resolveQwenScriptPath(currentDir: string): string {
		const envPath = process.env.VOID_QWEN_SCRIPT;
		if (envPath && existsSync(envPath)) {
			return envPath;
		}

		const candidates = [
			join(currentDir, '..', '..', '..', '..', '..', 'qwen-code-clean', 'void-ai-chat.js'),
			join(currentDir, '..', '..', '..', '..', '..', '..', 'qwen-code-clean', 'void-ai-chat.js'),
			join(process.cwd(), 'qwen-code-clean', 'void-ai-chat.js'),
			join(process.cwd(), '..', 'qwen-code-clean', 'void-ai-chat.js'),
		];

		for (const candidate of candidates) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}

		return candidates[0];
	}

	async sendMessage(query: string, workspacePath?: string, onEvent?: (event: IQwenEvent) => void): Promise<IQwenChatResult> {
		this.logService.info('[Qwen IPC] Sending message:', query.substring(0, 50));
		if (workspacePath) {
			this.logService.info('[Qwen IPC] Working directory:', workspacePath);
		}

		return new Promise((resolve, reject) => {
			const events: IQwenEvent[] = [];
			let errorOutput = '';
			const nonJsonStdoutLines: string[] = [];
			const spawnCwd = workspacePath && existsSync(workspacePath) ? workspacePath : process.cwd();
			const nodeBinary = process.execPath || 'node';
			if (workspacePath && spawnCwd !== workspacePath) {
				this.logService.warn('[Qwen IPC] Workspace path does not exist, falling back to cwd:', workspacePath);
			}

			try {
				// Spawn void-ai-chat.js process in workspace directory
				this.currentProcess = spawn(nodeBinary, [this.qwenScriptPath, query], {
					stdio: ['ignore', 'pipe', 'pipe'],
					shell: false,
					cwd: spawnCwd,
					env: {
						...process.env,
						QWEN_WORKSPACE_PATH: workspacePath || process.cwd(),
					},
				});
				this.logService.info('[Qwen IPC] Spawned process pid:', this.currentProcess.pid ?? 'unknown');

				// Parse stdout line by line
				const rl = createInterface({
					input: this.currentProcess.stdout!,
					crlfDelay: Infinity,
				});

				rl.on('line', (line: string) => {
					if (!line.trim()) {
						return;
					}

					try {
						const event = JSON.parse(line);
						events.push(event);
						this.logService.trace('[Qwen IPC] Event:', event.type);

						if (onEvent) {
							onEvent(event);
						}
					} catch {
						const trimmed = line.trim();
						if (trimmed) {
							nonJsonStdoutLines.push(trimmed);
							if (nonJsonStdoutLines.length > 12) {
								nonJsonStdoutLines.shift();
							}
						}
						this.logService.trace('[Qwen IPC] Ignored non-JSON line');
					}
				});

				// Capture stderr
				this.currentProcess.stderr?.on('data', (data: Buffer) => {
					errorOutput += data.toString();
				});

				// Handle process completion
				this.currentProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
					this.currentProcess = undefined;

					if (code === 0) {
						this.logService.info('[Qwen IPC] Process completed successfully, events:', events.length);
						resolve({ events });
					} else {
						const stderrText = errorOutput.trim();
						const stdoutText = nonJsonStdoutLines.join('\n').trim();
						const diagnostics = stderrText || stdoutText;
						const exitSuffix = signal ? ` (signal: ${signal})` : '';
						const error = diagnostics
							? `Process exited with code ${code}${exitSuffix}: ${diagnostics}`
							: `Process exited with code ${code}${exitSuffix}: no stderr/stdout diagnostics (script: ${this.qwenScriptPath}, cwd: ${spawnCwd})`;
						this.logService.error('[Qwen IPC] Process failed:', error);
						resolve({ events, error });
					}
				});

				// Handle process errors
				this.currentProcess.on('error', (error: Error) => {
					this.currentProcess = undefined;
					this.logService.error('[Qwen IPC] Process error:', error);
					reject(error);
				});

			} catch (error) {
				this.logService.error('[Qwen IPC] Failed to spawn process:', error);
				reject(error);
			}
		});
	}

	abort(): void {
		if (this.currentProcess) {
			this.logService.info('[Qwen IPC] Aborting current process');
			this.currentProcess.kill();
			this.currentProcess = undefined;
		}
	}

	dispose(): void {
		this.abort();
	}
}

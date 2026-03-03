/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ICargoService, IBuildProgress } from '../common/cargoService.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ipcRenderer } from '../../../../base/parts/sandbox/electron-browser/globals.js';

export class CargoService extends Disposable implements ICargoService {
	declare readonly _serviceBrand: undefined;

	private readonly _onBuildProgress = this._register(new Emitter<IBuildProgress>());
	readonly onBuildProgress: Event<IBuildProgress> = this._onBuildProgress.event;

	private windowId: number;

	constructor(
		@INativeHostService private readonly nativeHostService: INativeHostService,
		@ILogService private readonly logService: ILogService
	) {
		super();
		this.windowId = this.nativeHostService.windowId;

		// Listen for build progress events from main process
		ipcRenderer.on('vscode:cargo-build-progress', (_event: any, ...args: unknown[]) => {
			const progress = args[0] as IBuildProgress;
			this._onBuildProgress.fire(progress);
		});
	}

	async isCargoAvailable(): Promise<boolean> {
		try {
			const result = await ipcRenderer.invoke('vscode:cargo-check-available') as boolean;
			return result;
		} catch (error) {
			this.logService.error('[Cargo Service] Failed to check cargo availability:', error);
			return false;
		}
	}

	async runRelease(workspacePath: string): Promise<boolean> {
		this.logService.info(`[Cargo Service] Running cargo run (debug) at: ${workspacePath}`);

		this._onBuildProgress.fire({
			stage: 'compiling',
			message: 'Starting cargo run (debug mode)...',
			progress: 0
		});

		try {
			const result = await ipcRenderer.invoke('vscode:cargo-run-release', {
				windowId: this.windowId,
				workspacePath
			}) as { success: boolean; error?: string };

			if (result.success) {
				this._onBuildProgress.fire({
					stage: 'finished',
					message: 'Running in release mode',
					progress: 100
				});
			} else {
				this._onBuildProgress.fire({
					stage: 'error',
					message: result.error || 'Failed to run',
					progress: 0
				});
			}

			return result.success;
		} catch (error) {
			this.logService.error('[Cargo Service] Run release failed:', error);
			this._onBuildProgress.fire({
				stage: 'error',
				message: `Error: ${error}`,
				progress: 0
			});
			return false;
		}
	}

	async buildProject(workspacePath: string): Promise<boolean> {
		this.logService.info(`[Cargo Service] Starting cargo build at: ${workspacePath}`);

		this._onBuildProgress.fire({
			stage: 'compiling',
			message: 'Starting cargo build...',
			progress: 0
		});

		try {
			const result = await ipcRenderer.invoke('vscode:cargo-build', {
				windowId: this.windowId,
				workspacePath
			}) as { success: boolean; error?: string };

			if (result.success) {
				this._onBuildProgress.fire({
					stage: 'finished',
					message: 'Build completed',
					progress: 100
				});
			} else {
				this._onBuildProgress.fire({
					stage: 'error',
					message: result.error || 'Failed to build',
					progress: 0
				});
			}

			return result.success;
		} catch (error) {
			this.logService.error('[Cargo Service] Build failed:', error);
			this._onBuildProgress.fire({
				stage: 'error',
				message: `Error: ${error}`,
				progress: 0
			});
			return false;
		}
	}

	async startWatch(workspacePath: string): Promise<boolean> {
		// Legacy alias for old command path.
		return this.buildProject(workspacePath);
	}

	async stop(): Promise<void> {
		try {
			await ipcRenderer.invoke('vscode:cargo-stop', { windowId: this.windowId });
			this.logService.info('[Cargo Service] Stopped successfully');
		} catch (error) {
			this.logService.error('[Cargo Service] Failed to stop:', error);
		}
	}

	override dispose(): void {
		this.stop();
		
		// Cleanup on dispose
		ipcRenderer.send('vscode:cargo-cleanup', { windowId: this.windowId });
		
		super.dispose();
	}
}

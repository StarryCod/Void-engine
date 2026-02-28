/*---------------------------------------------------------------------------------------------
 *  Void Engine - Game Window Service Implementation (Electron Sandbox)
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IGameWindowService } from '../common/gameWindowService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ipcRenderer } from '../../../../base/parts/sandbox/electron-browser/globals.js';

export class GameWindowService extends Disposable implements IGameWindowService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@ILogService private readonly logService: ILogService
	) {
		super();
	}

	async createGameWindow(workspacePath: string): Promise<{ success: boolean; processId?: number; error?: string }> {
		try {
			this.logService.info('[Game Window Service] Creating game window for:', workspacePath);
			const result = await ipcRenderer.invoke('vscode:void-create-game-window', { workspacePath }) as { success: boolean; processId?: number; error?: string };
			return result;
		} catch (error) {
			this.logService.error('[Game Window Service] Failed to create game window:', error);
			return { success: false, error: String(error) };
		}
	}

	async forwardProgress(processId: number, progress: any): Promise<{ success: boolean; error?: string }> {
		try {
			const result = await ipcRenderer.invoke('vscode:void-forward-progress', { processId, progress }) as { success: boolean; error?: string };
			return result;
		} catch (error) {
			this.logService.error('[Game Window Service] Failed to forward progress:', error);
			return { success: false, error: String(error) };
		}
	}

	async closeGameWindow(processId: number): Promise<{ success: boolean; error?: string }> {
		try {
			const result = await ipcRenderer.invoke('vscode:void-close-game-window', { processId }) as { success: boolean; error?: string };
			return result;
		} catch (error) {
			this.logService.error('[Game Window Service] Failed to close game window:', error);
			return { success: false, error: String(error) };
		}
	}
}

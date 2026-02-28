/*---------------------------------------------------------------------------------------------
 *  Void Engine - Game Window Service Interface
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IGameWindowService = createDecorator<IGameWindowService>('gameWindowService');

export interface IGameWindowService {
	readonly _serviceBrand: undefined;

	/**
	 * Create a new game window
	 */
	createGameWindow(workspacePath: string): Promise<{ success: boolean; processId?: number; error?: string }>;

	/**
	 * Forward compilation progress to game window
	 */
	forwardProgress(processId: number, progress: any): Promise<{ success: boolean; error?: string }>;

	/**
	 * Close game window
	 */
	closeGameWindow(processId: number): Promise<{ success: boolean; error?: string }>;
}

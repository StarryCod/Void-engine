/*---------------------------------------------------------------------------------------------
 *  Void Engine - Cargo Build Service
 *  Simple cargo integration: F5 = cargo run (debug), F6 = cargo watch
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../base/common/event.js';

export const ICargoService = createDecorator<ICargoService>('cargoService');

export interface IBuildProgress {
	stage: 'compiling' | 'linking' | 'finished' | 'error';
	message: string;
	progress: number; // 0-100
	currentCrate?: string;
	totalCrates?: number;
	completedCrates?: number;
}

export interface ICargoService {
	readonly _serviceBrand: undefined;

	/**
	 * Event fired when build progress updates
	 */
	readonly onBuildProgress: Event<IBuildProgress>;

	/**
	 * Run cargo run (debug mode for faster compilation) (F5)
	 * @param workspacePath Path to workspace
	 */
	runRelease(workspacePath: string): Promise<boolean>;

	/**
	 * Start cargo watch (F6)
	 * @param workspacePath Path to workspace
	 */
	startWatch(workspacePath: string): Promise<boolean>;

	/**
	 * Stop all cargo processes
	 */
	stop(): Promise<void>;

	/**
	 * Check if cargo is available
	 */
	isCargoAvailable(): Promise<boolean>;
}

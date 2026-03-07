/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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

export interface ICargoPreflightResult {
	cargoAvailable: boolean;
	rustcAvailable: boolean;
	cargoWatchAvailable: boolean;
	workspaceExists: boolean;
	cargoTomlExists: boolean;
	hasVoidSceneLoaderDependency: boolean;
	voidSceneLoaderUsesPathDependency: boolean;
	recommendedVoidSceneLoaderPath?: string;
	diagnostics: string[];
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
	 * Build project once (F6)
	 * @param workspacePath Path to workspace
	 */
	buildProject(workspacePath: string): Promise<boolean>;

	/**
	 * Validate local toolchain and project before running build/run commands.
	 */
	preflight(workspacePath: string): Promise<ICargoPreflightResult>;

	/**
	 * Legacy alias for old command wiring.
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

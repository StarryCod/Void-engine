/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { ICargoService, ICargoPreflightResult } from '../common/cargoService.js';
import { CargoService } from '../electron-sandbox/cargoService.js';
import { IGameWindowService } from '../common/gameWindowService.js';
import { GameWindowService } from '../electron-sandbox/gameWindowService.js';
import { VoidGameRunnerToolbar } from './voidGameRunnerToolbar.js';
import { VoidGameWindow } from './voidGameWindow.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IVoidRuntimeService } from '../../voidRuntime/common/voidRuntimeService.js';

// Register services
registerSingleton(ICargoService, CargoService, InstantiationType.Delayed);
registerSingleton(IGameWindowService, GameWindowService, InstantiationType.Delayed);

interface BuildHistoryEntry {
	id: string;
	kind: 'build' | 'run';
	mode: 'release' | 'debug' | 'build';
	workspacePath: string;
	startedAt: number;
	finishedAt: number;
	durationMs: number;
	status: 'success' | 'error';
	error?: string;
	preflight: Pick<ICargoPreflightResult, 'cargoWatchAvailable' | 'hasVoidSceneLoaderDependency' | 'voidSceneLoaderUsesPathDependency'>;
}

class VoidGameRunnerContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.voidGameRunner';
	private static readonly MAX_BUILD_HISTORY = 60;

	private static instance: VoidGameRunnerContribution | null = null;
	private toolbar: VoidGameRunnerToolbar | null = null;
	private gameWindow: VoidGameWindow | null = null;
	private isRunning = false;
	private readonly buildHistory: BuildHistoryEntry[] = [];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@ICargoService private readonly cargoService: ICargoService,
		@IVoidRuntimeService private readonly runtimeService: IVoidRuntimeService
	) {
		super();
		
		// Prevent multiple instances
		if (VoidGameRunnerContribution.instance) {
			return VoidGameRunnerContribution.instance;
		}
		VoidGameRunnerContribution.instance = this;
		
		console.log('[Void Game Runner] Contribution initialized');
		this.initialize();
	}

	private initialize(): void {
		// Listen for build progress and forward to game window
		this._register(this.cargoService.onBuildProgress(progress => {
			console.log(`[Void Game Runner] ${progress.stage}: ${progress.message} (${progress.progress}%)`);
			this.runtimeService.publish('runtime', 'cargo.progress', progress);
			if (progress.stage === 'error') {
				this.runtimeService.log('error', progress.message, { channel: 'runtime', type: 'cargo.progress.error' });
			}
			
			// Forward to game window if it exists
			if (this.gameWindow) {
				this.gameWindow.updateCompilationProgress(progress.progress, progress.message);
			}
		}));

		// Create toolbar after a short delay to ensure DOM is ready
		setTimeout(() => {
			if (!this.toolbar) {
				this.toolbar = this.instantiationService.createInstance(VoidGameRunnerToolbar);
				this._register(this.toolbar);
			}
		}, 100);
	}
	
	static getInstance(instantiationService: IInstantiationService): VoidGameRunnerContribution {
		if (!VoidGameRunnerContribution.instance) {
			VoidGameRunnerContribution.instance = instantiationService.createInstance(VoidGameRunnerContribution);
		}
		return VoidGameRunnerContribution.instance;
	}

	async buildAndRun(options: { mode: 'release' | 'debug' }): Promise<void> {
		if (this.isRunning) {
			console.log('[Void Game Runner] Already running');
			return;
		}
		
		console.log('[Void Game Runner] Build & Run', options.mode);
		
		const workspace = this.workspaceService.getWorkspace();
		if (!workspace.folders.length) {
			console.error('[Void Game Runner] No workspace');
			return;
		}

		const workspacePath = workspace.folders[0].uri.fsPath;
		const startedAt = Date.now();
		let preflight: ICargoPreflightResult | undefined;
		let status: 'success' | 'error' = 'error';
		let failureReason: string | undefined;
		this.runtimeService.transition('open', { workspacePath });
		this.runtimeService.transition('load', { workspacePath });
		this.runtimeService.publish('runtime', 'run.requested', { mode: options.mode, workspacePath });
		this.isRunning = true;

		try {
			preflight = await this.runPreflight(workspacePath, 'run');
			if (!this.preflightAllowsBuild(preflight)) {
				throw new Error(this.composePreflightFailureMessage(preflight));
			}

			if (!this.gameWindow) {
				this.gameWindow = this.instantiationService.createInstance(VoidGameWindow, {
					workspacePath,
					mode: options.mode,
					buildRequired: true
				});
				this._register(this.gameWindow);
				
				this._register(this.gameWindow.onDidClose(() => {
					this.gameWindow = null;
					this.isRunning = false;
					this.runtimeService.transition('stop', { workspacePath });
					this.runtimeService.publish('runtime', 'run.stopped', { workspacePath });
				}));
			}

			this.runtimeService.transition('run', { workspacePath });
			const result = await this.cargoService.runRelease(workspacePath);
			
			if (result) {
				this.runtimeService.publish('runtime', 'run.succeeded', { workspacePath, mode: options.mode });
				status = 'success';
				if (this.gameWindow) {
					this.gameWindow.dispose();
					this.gameWindow = null;
				}
			} else {
				const errorMessage = 'Compilation failed. Check logs above.';
				failureReason = errorMessage;
				this.runtimeService.transition('fail', { workspacePath, error: errorMessage });
				this.runtimeService.publish('runtime', 'run.failed', { workspacePath, mode: options.mode, error: errorMessage });
				if (this.gameWindow) {
					this.gameWindow.showError(errorMessage);
				}
			}
			
			this.isRunning = false;
		} catch (error) {
			console.error('[Void Game Runner] Build failed:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			failureReason = errorMessage;
			this.runtimeService.transition('fail', { workspacePath, error: errorMessage });
			this.runtimeService.publish('runtime', 'run.failed', { workspacePath, mode: options.mode, error: errorMessage });
			if (this.gameWindow) {
				this.gameWindow.showError(errorMessage);
			}
			this.isRunning = false;
		} finally {
			this.recordBuildHistory({
				kind: 'run',
				mode: options.mode,
				workspacePath,
				startedAt,
				status,
				error: failureReason,
				preflight
			});
		}
	}

	async buildProject(): Promise<void> {
		console.log('[Void Game Runner] Build project');
		
		const workspace = this.workspaceService.getWorkspace();
		if (!workspace.folders.length) {
			console.error('[Void Game Runner] No workspace folder');
			return;
		}

		const workspacePath = workspace.folders[0].uri.fsPath;
		const startedAt = Date.now();
		let preflight: ICargoPreflightResult | undefined;
		let status: 'success' | 'error' = 'error';
		let failureReason: string | undefined;
		this.runtimeService.transition('open', { workspacePath });
		this.runtimeService.transition('reload', { workspacePath });

		try {
			preflight = await this.runPreflight(workspacePath, 'build');
			if (!this.preflightAllowsBuild(preflight)) {
				throw new Error(this.composePreflightFailureMessage(preflight));
			}

			const success = await this.cargoService.buildProject(workspacePath);
			if (success) {
				this.runtimeService.transition('load', { workspacePath });
				this.runtimeService.publish('runtime', 'build.succeeded', { workspacePath });
				status = 'success';
			} else {
				const errorMessage = 'Build failed';
				failureReason = errorMessage;
				this.runtimeService.transition('fail', { workspacePath, error: errorMessage });
				this.runtimeService.publish('runtime', 'build.failed', { workspacePath, error: errorMessage });
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			failureReason = errorMessage;
			this.runtimeService.transition('fail', { workspacePath, error: errorMessage });
			this.runtimeService.publish('runtime', 'build.failed', { workspacePath, error: errorMessage });
		} finally {
			this.recordBuildHistory({
				kind: 'build',
				mode: 'build',
				workspacePath,
				startedAt,
				status,
				error: failureReason,
				preflight
			});
		}
	}

	async startWatch(): Promise<void> {
		console.log('[Void Game Runner] Start Watch requested');
		const workspace = this.workspaceService.getWorkspace();
		const workspacePath = workspace.folders[0]?.uri.fsPath;
		if (!workspacePath) {
			console.error('[Void Game Runner] No workspace folder');
			return;
		}
		const preflight = await this.runPreflight(workspacePath, 'build');
		if (!preflight.cargoWatchAvailable) {
			const message = 'cargo watch is not installed. Falling back to cargo build (F6). Install with: cargo install cargo-watch';
			this.runtimeService.log('warn', message, { channel: 'runtime', type: 'build.preflight.watchFallback' });
			this.runtimeService.publish('runtime', 'build.watch.fallback', { workspacePath, suggestion: 'cargo install cargo-watch' });
		}
		await this.buildProject();
	}

	private async runPreflight(workspacePath: string, trigger: 'build' | 'run'): Promise<ICargoPreflightResult> {
		const preflight = await this.cargoService.preflight(workspacePath);
		this.runtimeService.publish('runtime', 'build.preflight', {
			trigger,
			workspacePath,
			...preflight
		});
		if (preflight.diagnostics.length > 0) {
			for (const item of preflight.diagnostics) {
				const level: 'warn' | 'error' = item.includes('not installed') || item.includes('Recommended dependency')
					? 'warn'
					: 'error';
				this.runtimeService.log(level, item, {
					channel: 'runtime',
					type: 'build.preflight.diagnostic',
					payload: { trigger }
				});
			}
		}
		return preflight;
	}

	private preflightAllowsBuild(preflight: ICargoPreflightResult): boolean {
		return preflight.workspaceExists
			&& preflight.cargoTomlExists
			&& preflight.cargoAvailable
			&& preflight.rustcAvailable;
	}

	private composePreflightFailureMessage(preflight: ICargoPreflightResult): string {
		if (preflight.diagnostics.length > 0) {
			return `Preflight failed: ${preflight.diagnostics.join(' | ')}`;
		}
		return 'Preflight failed: toolchain or workspace checks did not pass';
	}

	private recordBuildHistory(entry: {
		kind: 'build' | 'run';
		mode: 'release' | 'debug' | 'build';
		workspacePath: string;
		startedAt: number;
		status: 'success' | 'error';
		error?: string;
		preflight?: ICargoPreflightResult;
	}): void {
		const finishedAt = Date.now();
		const payload: BuildHistoryEntry = {
			id: `${finishedAt}-${Math.random().toString(36).slice(2, 8)}`,
			kind: entry.kind,
			mode: entry.mode,
			workspacePath: entry.workspacePath,
			startedAt: entry.startedAt,
			finishedAt,
			durationMs: Math.max(0, finishedAt - entry.startedAt),
			status: entry.status,
			error: entry.error,
			preflight: {
				cargoWatchAvailable: entry.preflight?.cargoWatchAvailable ?? false,
				hasVoidSceneLoaderDependency: entry.preflight?.hasVoidSceneLoaderDependency ?? false,
				voidSceneLoaderUsesPathDependency: entry.preflight?.voidSceneLoaderUsesPathDependency ?? false
			}
		};
		this.buildHistory.unshift(payload);
		if (this.buildHistory.length > VoidGameRunnerContribution.MAX_BUILD_HISTORY) {
			this.buildHistory.length = VoidGameRunnerContribution.MAX_BUILD_HISTORY;
		}
		this.runtimeService.publish('runtime', 'build.history.updated', {
			entry: payload,
			size: this.buildHistory.length
		});
		this.runtimeService.publish('system', 'metric.buildLatency', {
			kind: payload.kind,
			mode: payload.mode,
			workspacePath: payload.workspacePath,
			durationMs: payload.durationMs,
			status: payload.status
		});
		this.runtimeService.log(
			payload.status === 'success' ? 'info' : 'error',
			`${payload.kind} ${payload.status} (${payload.durationMs}ms)`,
			{
				channel: 'runtime',
				type: 'build.history'
			}
		);
	}
}

// Register contribution
registerWorkbenchContribution2(
	VoidGameRunnerContribution.ID,
	VoidGameRunnerContribution,
	WorkbenchPhase.BlockRestore
);

// Register F5 command - Build & Run (Release)
class BuildAndRunAction extends Action2 {
	constructor() {
		super({
			id: 'voidGameRunner.buildAndRun',
			title: { value: 'Build & Run Game (Release)', original: 'Build & Run Game (Release)' },
			keybinding: {
				primary: KeyCode.F5,
				weight: KeybindingWeight.WorkbenchContrib + 300
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		console.log('[Void Game Runner] Build & Run triggered');
		const instantiationService = accessor.get(IInstantiationService);
		const contribution = VoidGameRunnerContribution.getInstance(instantiationService);
		await contribution.buildAndRun({ mode: 'release' });
	}
}

// Register F6 command - Build Project
class BuildProjectAction extends Action2 {
	constructor() {
		super({
			id: 'voidGameRunner.buildProject',
			title: { value: 'Build Project', original: 'Build Project' },
			keybinding: {
				primary: KeyCode.F6,
				weight: KeybindingWeight.WorkbenchContrib + 300
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		console.log('[Void Game Runner] Build project triggered');
		const instantiationService = accessor.get(IInstantiationService);
		const contribution = VoidGameRunnerContribution.getInstance(instantiationService);
		await contribution.buildProject();
	}
}

// Legacy alias action for compatibility with existing toolbar wiring.
class StartWatchAction extends Action2 {
	constructor() {
		super({
			id: 'voidGameRunner.startWatch',
			title: { value: 'Build Project (Legacy Alias)', original: 'Build Project (Legacy Alias)' }
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService);
		const contribution = VoidGameRunnerContribution.getInstance(instantiationService);
		await contribution.startWatch();
	}
}

registerAction2(BuildAndRunAction);
registerAction2(BuildProjectAction);
registerAction2(StartWatchAction);

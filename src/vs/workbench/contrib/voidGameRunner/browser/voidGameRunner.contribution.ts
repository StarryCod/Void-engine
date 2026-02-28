/*---------------------------------------------------------------------------------------------
 *  Void Engine - Game Runner Contribution
 *  Registers commands and services for running Rust/Bevy games
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { ICargoService } from '../common/cargoService.js';
import { CargoService } from '../electron-sandbox/cargoService.js';
import { IGameWindowService } from '../common/gameWindowService.js';
import { GameWindowService } from '../electron-sandbox/gameWindowService.js';
import { VoidGameRunnerToolbar } from './voidGameRunnerToolbar.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { VoidGameWindow } from './voidGameWindow.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';

// Register services
registerSingleton(ICargoService, CargoService, InstantiationType.Delayed);
registerSingleton(IGameWindowService, GameWindowService, InstantiationType.Delayed);

class VoidGameRunnerContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.voidGameRunner';

	private static instance: VoidGameRunnerContribution | null = null;
	private toolbar: VoidGameRunnerToolbar | null = null;
	private gameWindow: VoidGameWindow | null = null;
	private isRunning = false;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@ICargoService private readonly cargoService: ICargoService
	) {
		super();
		
		// Prevent multiple instances
		if (VoidGameRunnerContribution.instance) {
			return VoidGameRunnerContribution.instance as any;
		}
		VoidGameRunnerContribution.instance = this;
		
		console.log('[Void Game Runner] Contribution initialized');
		this.initialize();
	}

	private initialize(): void {
		// Listen for build progress and forward to game window
		this._register(this.cargoService.onBuildProgress(progress => {
			console.log(`[Void Game Runner] ${progress.stage}: ${progress.message} (${progress.progress}%)`);
			
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
		this.isRunning = true;

		try {
			// Показываем компактное окно с камином
			if (!this.gameWindow) {
				this.gameWindow = this.instantiationService.createInstance(VoidGameWindow, {
					workspacePath,
					mode: options.mode,
					buildRequired: true
				});
				this._register(this.gameWindow);
				
				// Когда окно закрывается
				this._register(this.gameWindow.onDidClose(() => {
					this.gameWindow = null;
					this.isRunning = false;
				}));
			}

			// Начинаем компиляцию
			const result = await this.cargoService.runRelease(workspacePath);
			
			if (result) {
				// Успех - закрываем окно, игра запустится в Bevy
				if (this.gameWindow) {
					this.gameWindow.dispose();
					this.gameWindow = null;
				}
			} else {
				// Ошибка - окно покажет логи
				if (this.gameWindow) {
					this.gameWindow.showError('Compilation failed. Check logs above.');
				}
			}
			
			this.isRunning = false;
		} catch (error) {
			console.error('[Void Game Runner] Build failed:', error);
			if (this.gameWindow) {
				this.gameWindow.showError(String(error));
			}
			this.isRunning = false;
		}
	}

	async startWatch(): Promise<void> {
		console.log('[Void Game Runner] Starting cargo watch');
		
		const workspace = this.workspaceService.getWorkspace();
		if (!workspace.folders.length) {
			console.error('[Void Game Runner] No workspace folder');
			return;
		}

		const workspacePath = workspace.folders[0].uri.fsPath;
		await this.cargoService.startWatch(workspacePath);
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

// Register F6 command - Start Cargo Watch
class StartWatchAction extends Action2 {
	constructor() {
		super({
			id: 'voidGameRunner.startWatch',
			title: { value: 'Start Cargo Watch', original: 'Start Cargo Watch' },
			keybinding: {
				primary: KeyCode.F6,
				weight: KeybindingWeight.WorkbenchContrib + 300
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		console.log('[Void Game Runner] Start Watch triggered');
		const instantiationService = accessor.get(IInstantiationService);
		const contribution = VoidGameRunnerContribution.getInstance(instantiationService);
		await contribution.startWatch();
	}
}

registerAction2(BuildAndRunAction);
registerAction2(StartWatchAction);

/*---------------------------------------------------------------------------------------------
 *  Void Scene Editor - Contribution (Godot-style Layout)
 *  Integrates: SceneTree, FileSystem, Viewport2D/3D, Inspector
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import * as DOM from '../../../../base/browser/dom.js';
import { VoidSceneEditorToolbar } from './voidSceneEditorToolbar.js';
import { SceneEditorMode } from '../common/voidSceneEditor.js';
import { ThreeViewport } from './threeViewport.js';
import { sceneBridge } from '../common/voidSceneBridge.js';
import { SceneEditorContainer } from './views/sceneEditorContainer.js';
import { VecnParser } from '../common/vecnParser.js';

class VoidSceneEditorContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.voidSceneEditor';

	private toolbar: VoidSceneEditorToolbar | null = null;
	private viewport: ThreeViewport | null = null;
	
	// NEW: Godot-style container
	private sceneEditorContainer: SceneEditorContainer | null = null;

	private layoutContainer: HTMLElement | null = null;

	private modelListener: IDisposable | null = null;
	private fileWatcher: IDisposable | null = null;
	private suppressModelUntil: number = 0;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEditorService private readonly editorService: IEditorService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
	) {
		super();

		// 1. Toolbar
		this.toolbar = this.instantiationService.createInstance(VoidSceneEditorToolbar);
		this._register(this.toolbar);
		this._register(this.toolbar.onModeChanged(m => this.handleModeChange(m)));

		// 2. Bridge -> Disk (save handler)
		this._register(sceneBridge.onNeedsSave(e => this.saveToDisk(e.uri, e.content)));

		// 3. Editor changes
		this._register(this.editorService.onDidActiveEditorChange(() => this.onEditorChanged()));

		// 4. Early discovery
		this.earlyDiscovery();
	}

	// ════════════════════════════════════════════════════════════════
	// EARLY DISCOVERY — find .vecn, load into bridge, setup watcher
	// ════════════════════════════════════════════════════════════════

	private async earlyDiscovery(): Promise<void> {
		console.log('[VoidSceneEditor] Starting early discovery...');
		
		const delays = [
			50, 100, 150, 200, 250, 300, 350, 400, 450, 500,
			600, 700, 800, 900, 1000,
			1200, 1500, 2000, 3000
		];
		
		for (const delay of delays) {
			await new Promise(r => setTimeout(r, delay));
			if (sceneBridge.hasScene()) {
				console.log('[VoidSceneEditor] Scene already loaded, stopping discovery');
				return;
			}

			const uri = await this.findVecnUri();
			if (!uri) {
				console.log('[VoidSceneEditor] No .vecn found yet, retrying...');
				continue;
			}

			try {
				const file = await this.fileService.readFile(uri);
				const content = file.value.toString();
				if (!content.trim()) {
					console.log('[VoidSceneEditor] .vecn file empty, retrying...');
					continue;
				}

				sceneBridge.setUri(uri);
				const success = sceneBridge.loadFromText(content, 'init');
				if (success) {
					this.setupFileWatcher(uri);
					console.log('[VoidSceneEditor] ✓ Scene loaded successfully:', uri.toString());
					console.log('[VoidSceneEditor] Entities:', sceneBridge.getEntities().length);
					return;
				} else {
					console.log('[VoidSceneEditor] Failed to parse scene, retrying...');
				}
			} catch (err) {
				console.log('[VoidSceneEditor] Error reading file:', err);
			}
		}
		
		console.log('[VoidSceneEditor] Early discovery completed without finding scene');
	}

	// ════════════════════════════════════════════════════════════════
	// FIND .vecn FILE
	// ════════════════════════════════════════════════════════════════

	private async findVecnUri(): Promise<URI | null> {
		const active = this.editorService.activeEditor;
		if (active?.resource?.path?.endsWith('.vecn')) return active.resource;

		for (const ctrl of this.editorService.visibleTextEditorControls) {
			const m = (ctrl as any)?.getModel?.();
			if (m?.uri?.path?.endsWith('.vecn')) return m.uri;
		}

		const folders = this.workspaceService.getWorkspace().folders;
		for (const folder of folders) {
			const found = await this.searchFolder(folder.uri, 0);
			if (found) return found;
		}
		return null;
	}

	private async searchFolder(uri: URI, depth: number): Promise<URI | null> {
		if (depth > 4) return null;
		try {
			const stat = await this.fileService.resolve(uri);
			if (!stat.children) return null;
			const skip = new Set(['node_modules', '.git', '.vscode', 'out', 'dist', 'build', '.void']);
			for (const c of stat.children)
				if (!c.isDirectory && c.name.endsWith('.vecn')) return c.resource;
			for (const c of stat.children)
				if (c.isDirectory && !skip.has(c.name)) {
					const f = await this.searchFolder(c.resource, depth + 1);
					if (f) return f;
				}
		} catch { /* ignore */ }
		return null;
	}

	// ════════════════════════════════════════════════════════════════
	// EDITOR MODEL LISTENER
	// ════════════════════════════════════════════════════════════════

	private onEditorChanged(): void {
		this.attachModelListener();
	}

	private attachModelListener(): void {
		const model = this.findVecnModel();
		if (!model) return;

		if (this.modelListener && (this.modelListener as any).__uri === model.uri.toString()) return;

		this.disposeModelListener();

		if (!sceneBridge.hasScene()) {
			sceneBridge.setUri(model.uri);
			sceneBridge.loadFromText(model.getValue(), 'init');
			this.setupFileWatcher(model.uri);
		}

		const disp = model.onDidChangeContent(() => {
			if (Date.now() < this.suppressModelUntil) return;
			sceneBridge.loadFromText(model.getValue(), 'editor');
		});

		this.modelListener = disp;
		(this.modelListener as any).__uri = model.uri.toString();
	}

	private findVecnModel(): any {
		for (const ctrl of this.editorService.visibleTextEditorControls) {
			const m = (ctrl as any)?.getModel?.();
			if (m?.uri?.path?.endsWith('.vecn')) return m;
		}
		return null;
	}

	private disposeModelListener(): void {
		if (this.modelListener) { this.modelListener.dispose(); this.modelListener = null; }
	}

	// ════════════════════════════════════════════════════════════════
	// FILE WATCHER
	// ════════════════════════════════════════════════════════════════

	private setupFileWatcher(uri: URI): void {
		if (this.fileWatcher) { this.fileWatcher.dispose(); this.fileWatcher = null; }

		const w = this.fileService.watch(uri);
		const l = this.fileService.onDidFilesChange(async e => {
			if (Date.now() < this.suppressModelUntil) return;
			if (!e.contains(uri)) return;
			try {
				const f = await this.fileService.readFile(uri);
				sceneBridge.loadFromText(f.value.toString(), 'disk');
			} catch { /* ignore */ }
		});
		this.fileWatcher = { dispose: () => { w.dispose(); l.dispose(); } };
	}

	// ════════════════════════════════════════════════════════════════
	// SAVE TO DISK
	// ════════════════════════════════════════════════════════════════

	private async saveToDisk(uri: URI, content: string): Promise<void> {
		this.suppressModelUntil = Date.now() + 300;

		const model = this.findVecnModel();
		if (model && model.uri.toString() === uri.toString()) {
			if (model.getValue() !== content) {
				model.setValue(content);
			}
		}

		try {
			await this.fileService.writeFile(uri, VSBuffer.fromString(content));
		} catch (err) {
			console.error('[VoidSceneEditor] Save failed:', err);
		}
	}

	// ════════════════════════════════════════════════════════════════
	// MODE SWITCHING (Godot-style 2D/3D/Script)
	// ════════════════════════════════════════════════════════════════

	private async handleModeChange(mode: SceneEditorMode): Promise<void> {
		
		const editorPart = document.querySelector('.part.editor') as HTMLElement | null;
		if (!editorPart) return;

		const monacoEditor = editorPart.querySelector('.monaco-editor') as HTMLElement | null;
		const editorContainer = editorPart.querySelector('.editor-container') as HTMLElement | null;

		// Hide everything first
		if (monacoEditor) monacoEditor.style.display = 'none';
		if (this.layoutContainer) this.layoutContainer.style.display = 'none';

		if (mode === SceneEditorMode.Script) {
			if (monacoEditor) monacoEditor.style.display = '';
			if (this.viewport) this.viewport.stopRendering();
			return;
		}

		if (mode === SceneEditorMode.Scene2D) {
			await this.activate2D(editorContainer);
			return;
		}

		if (mode === SceneEditorMode.Scene3D) {
			await this.activate3D(editorContainer);
			return;
		}
	}

	// ════════════════════════════════════════════════════════════════
	// 2D MODE ACTIVATION (NEW Godot-style Container)
	// ════════════════════════════════════════════════════════════════

	private async activate2D(editorContainer: HTMLElement | null): Promise<void> {
		// Ensure we have a scene
		if (!sceneBridge.hasScene()) {
			const uri = await this.findVecnUri();
			if (uri) {
				try {
					sceneBridge.setUri(uri);
					const f = await this.fileService.readFile(uri);
					sceneBridge.loadFromText(f.value.toString(), 'init');
					this.setupFileWatcher(uri);
				} catch { /* */ }
			}
		}

		// Create Godot-style layout once
		if (!this.layoutContainer && editorContainer) {
			this.createGodotLayout(editorContainer);
		}

		if (this.layoutContainer) this.layoutContainer.style.display = 'flex';
		
		// Load scene into new container
		if (this.sceneEditorContainer) {
			const raw = sceneBridge.getRaw();
			if (raw) {
				try {
					const scene = VecnParser.parse(raw);
					if (scene) {
						this.sceneEditorContainer.loadScene(scene);
					}
				} catch (e) {
					console.error('[VoidSceneEditor] Failed to parse scene:', e);
				}
			}
			this.sceneEditorContainer.switchMode('2D');
		}
		
		this.attachModelListener();
	}

	// ════════════════════════════════════════════════════════════════
	// 3D MODE ACTIVATION (Legacy for now)
	// ════════════════════════════════════════════════════════════════

	private async activate3D(editorContainer: HTMLElement | null): Promise<void> {
		// Ensure we have a scene
		if (!sceneBridge.hasScene()) {
			const uri = await this.findVecnUri();
			if (uri) {
				try {
					sceneBridge.setUri(uri);
					const f = await this.fileService.readFile(uri);
					sceneBridge.loadFromText(f.value.toString(), 'init');
					this.setupFileWatcher(uri);
				} catch { /* */ }
			}
		}

		// Use Godot-style container for 3D too
		if (!this.layoutContainer && editorContainer) {
			this.createGodotLayout(editorContainer);
		}

		if (this.layoutContainer) this.layoutContainer.style.display = 'flex';
		
		// Load scene into container
		if (this.sceneEditorContainer) {
			const raw = sceneBridge.getRaw();
			if (raw) {
				try {
					const scene = VecnParser.parse(raw);
					if (scene) {
						this.sceneEditorContainer.loadScene(scene);
					}
				} catch (e) {
					console.error('[VoidSceneEditor] Failed to parse scene:', e);
				}
			}
			this.sceneEditorContainer.switchMode('3D');
		}
		
		this.attachModelListener();
	}

	// ════════════════════════════════════════════════════════════════
	// GODOT-STYLE LAYOUT CREATION
	// ════════════════════════════════════════════════════════════════

	private createGodotLayout(editorContainer: HTMLElement): void {
		// Main container
		this.layoutContainer = DOM.append(editorContainer, DOM.$('.void-scene-layout-godot'));
		this.layoutContainer.style.cssText = `
			position:absolute;top:32px;left:0;right:0;bottom:0;
			background:#1e1e1e;z-index:50;overflow:hidden;
			display:flex;flex-direction:row;
		`;

		// Create the new Godot-style SceneEditorContainer
		this.sceneEditorContainer = new SceneEditorContainer(this.layoutContainer);
		this._register(this.sceneEditorContainer);

		// Wire up events
		this._register(this.sceneEditorContainer.onModeChanged((mode) => {
			console.log('[VoidSceneEditor] Mode changed to:', mode);
		}));

		// Bridge -> Container (scene updates)
		this._register(sceneBridge.onSceneUpdated(u => {
			if (this.sceneEditorContainer) {
				try {
					const scene = VecnParser.parse(u.raw);
					if (scene) {
						this.sceneEditorContainer.loadScene(scene);
					}
				} catch (e) {
					console.error('[VoidSceneEditor] Failed to update scene:', e);
				}
			}
		}));

		console.log('[VoidSceneEditor] Godot-style layout created');
	}


	override dispose(): void {
		this.disposeModelListener();
		if (this.fileWatcher) { this.fileWatcher.dispose(); this.fileWatcher = null; }
		super.dispose();
	}
}

registerWorkbenchContribution2(
	VoidSceneEditorContribution.ID,
	VoidSceneEditorContribution,
	WorkbenchPhase.BlockRestore
);

// Register scene context menu actions
import './sceneActions.js';

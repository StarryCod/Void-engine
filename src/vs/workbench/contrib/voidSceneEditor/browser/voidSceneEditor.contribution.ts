/*---------------------------------------------------------------------------------------------
 *  Void Scene Editor - Contribution
 *  Simple mode switching: 3D / 2D / Script
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import * as DOM from '../../../../base/browser/dom.js';
import { ThreeViewport } from './threeViewport.js';
import { Viewport2D } from './viewport2D.js';
import { InspectorView } from './inspectorView.js';
import { sceneBridge } from '../common/voidSceneBridge.js';

type EditorMode = '3D' | '2D' | 'Script';

class VoidSceneEditorContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.voidSceneEditor';

	private currentMode: EditorMode = 'Script';
	private toolbar: HTMLElement | null = null;
	
	// Container for viewport (3D or 2D)
	private viewportContainer: HTMLElement | null = null;
	private inspectorContainer: HTMLElement | null = null;
	
	// Viewports
	private viewport3D: ThreeViewport | null = null;
	private viewport2D: Viewport2D | null = null;
	private inspector: InspectorView | null = null;
	
	private modelListener: IDisposable | null = null;
	private fileWatcher: IDisposable | null = null;
	private suppressModelUntil: number = 0;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
	) {
		super();
		
		// Wait for DOM ready, then create toolbar
		this.initWhenReady();
		
		// Bridge save handler
		this._register(sceneBridge.onNeedsSave(e => this.saveToDisk(e.uri, e.content)));
		
		// Editor changes
		this._register(this.editorService.onDidActiveEditorChange(() => this.attachModelListener()));
		
		// Load scene
		this.loadScene();
	}

	private initWhenReady(): void {
		const check = () => {
			const editorPart = document.querySelector('.part.editor');
			if (editorPart) {
				this.createToolbar(editorPart as HTMLElement);
				this.createViewportContainer(editorPart as HTMLElement);
			} else {
				setTimeout(check, 50);
			}
		};
		setTimeout(check, 100);
	}

	// ════════════════════════════════════════════════════════════════
	// TOOLBAR
	// ════════════════════════════════════════════════════════════════

	private createToolbar(editorPart: HTMLElement): void {
		// Remove old toolbar if exists
		const oldToolbar = editorPart.querySelector('.void-editor-toolbar');
		if (oldToolbar) oldToolbar.remove();

		this.toolbar = document.createElement('div');
		this.toolbar.className = 'void-editor-toolbar';
		this.toolbar.style.cssText = `
			position: absolute; top: 0; left: 0; right: 0; height: 32px;
			background: #222225; border-bottom: 1px solid #2a2a2e;
			display: flex; align-items: center; padding: 0 8px; gap: 2px;
			z-index: 100; font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 12px;
		`;

		// Create buttons
		const modes: EditorMode[] = ['3D', '2D', 'Script'];
		modes.forEach(mode => {
			const btn = document.createElement('button');
			btn.textContent = mode;
			btn.dataset.mode = mode;
			this.updateButtonStyle(btn, mode === this.currentMode);
			btn.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.switchMode(mode);
			};
			this.toolbar!.appendChild(btn);
		});

		editorPart.insertBefore(this.toolbar, editorPart.firstChild);

		// Adjust editor container
		const editorContainer = editorPart.querySelector('.editor-container');
		if (editorContainer) {
			(editorContainer as HTMLElement).style.paddingTop = '32px';
		}
	}

	private updateButtonStyle(btn: HTMLButtonElement, isActive: boolean): void {
		btn.style.cssText = `
			padding: 3px 14px;
			border: 1px solid ${isActive ? '#E67E22' : 'transparent'};
			border-radius: 3px;
			background: ${isActive ? '#E67E22' : 'transparent'};
			color: ${isActive ? '#fff' : '#777'};
			font-size: 11px;
			font-weight: ${isActive ? '600' : '500'};
			cursor: pointer;
			transition: all 0.1s ease;
			outline: none;
		`;
	}

	// ════════════════════════════════════════════════════════════════
	// VIEWPORT CONTAINER
	// ════════════════════════════════════════════════════════════════

	private createViewportContainer(editorPart: HTMLElement): void {
		const editorContainer = editorPart.querySelector('.editor-container');
		if (!editorContainer) return;

		// Create main container (hidden by default)
		this.viewportContainer = document.createElement('div');
		this.viewportContainer.className = 'void-viewport-wrapper';
		this.viewportContainer.style.cssText = `
			position: absolute;
			top: 32px; left: 0; right: 0; bottom: 0;
			display: none;
			background: #1a1a1e;
			z-index: 50;
		`;

		// Create viewport pane (left)
		const viewportPane = document.createElement('div');
		viewportPane.className = 'void-viewport-pane';
		viewportPane.style.cssText = `
			position: absolute;
			top: 0; left: 0; right: 280px; bottom: 0;
			background: #1a1a1e;
		`;
		viewportPane.id = 'void-viewport-pane';
		this.viewportContainer.appendChild(viewportPane);

		// Create inspector pane (right)
		this.inspectorContainer = document.createElement('div');
		this.inspectorContainer.className = 'void-inspector-pane';
		this.inspectorContainer.style.cssText = `
			position: absolute;
			top: 0; right: 0; width: 280px; bottom: 0;
			background: #1e1e1e;
			border-left: 1px solid #2a2a2e;
		`;
		this.viewportContainer.appendChild(this.inspectorContainer);

		editorContainer.appendChild(this.viewportContainer);
	}

	// ════════════════════════════════════════════════════════════════
	// MODE SWITCHING - SIMPLE IF LOGIC
	// ════════════════════════════════════════════════════════════════

	private switchMode(mode: EditorMode): void {
		this.currentMode = mode;

		// Update toolbar buttons
		if (this.toolbar) {
			this.toolbar.querySelectorAll('button').forEach(btn => {
				const btnMode = (btn as HTMLButtonElement).dataset.mode as EditorMode;
				this.updateButtonStyle(btn as HTMLButtonElement, btnMode === mode);
			});
		}

		// Get editor elements
		const editorPart = document.querySelector('.part.editor');
		const monacoEditor = editorPart?.querySelector('.monaco-editor') as HTMLElement;

		// Stop all viewports
		if (this.viewport3D) this.viewport3D.stopRendering();
		if (this.viewport2D) this.viewport2D.stopRendering();

		// === SCRIPT MODE ===
		if (mode === 'Script') {
			// Show Monaco editor
			if (monacoEditor) monacoEditor.style.display = '';
			// Hide viewport container
			if (this.viewportContainer) this.viewportContainer.style.display = 'none';
			return;
		}

		// === 3D MODE ===
		if (mode === '3D') {
			// Hide Monaco editor
			if (monacoEditor) monacoEditor.style.display = 'none';
			// Show viewport container
			if (this.viewportContainer) this.viewportContainer.style.display = 'block';
			
			// Create 3D viewport if not exists
			const pane = document.getElementById('void-viewport-pane');
			if (pane && !this.viewport3D) {
				// Clear pane
				pane.innerHTML = '';
				this.viewport3D = new ThreeViewport(pane, sceneBridge.getRaw() || '');
				this._register(this.viewport3D);
				
				this.viewport3D.onTransformEditedTRS(e => {
					sceneBridge.updateTransform({
						entityId: e.entityId,
						translation: e.translation,
						rotation: e.rotation,
						scale: e.scale,
					});
				});
				
				this.viewport3D.onEntityPicked(id => {
					sceneBridge.selectEntity(id);
				});
			}
			
			// Create inspector if not exists
			if (this.inspectorContainer && !this.inspector) {
				this.inspectorContainer.innerHTML = '';
				this.inspector = new InspectorView(this.inspectorContainer);
				this._register(this.inspector);
			}
			
			// Update scene
			if (this.viewport3D) {
				this.viewport3D.updateScene(sceneBridge.getRaw() || '');
			}
			return;
		}

		// === 2D MODE ===
		if (mode === '2D') {
			// Hide Monaco editor
			if (monacoEditor) monacoEditor.style.display = 'none';
			// Show viewport container
			if (this.viewportContainer) this.viewportContainer.style.display = 'block';
			
			// Create 2D viewport if not exists
			const pane = document.getElementById('void-viewport-pane');
			if (pane && !this.viewport2D) {
				// Clear pane
				pane.innerHTML = '';
				this.viewport2D = new Viewport2D(pane);
				this._register(this.viewport2D);
				
				this.viewport2D.onEntitySelected(id => {
					sceneBridge.selectEntity(id);
				});
			}
			
			// Create inspector if not exists
			if (this.inspectorContainer && !this.inspector) {
				this.inspectorContainer.innerHTML = '';
				this.inspector = new InspectorView(this.inspectorContainer);
				this._register(this.inspector);
			}
			
			// Update entities
			if (this.viewport2D) {
				this.viewport2D.loadScene(this.convertEntities());
				this.viewport2D.resize();
			}
			return;
		}
	}

	private convertEntities(): any[] {
		const entities = sceneBridge.getEntities();
		return entities.map(e => {
			const result: any = {
				id: e.id,
				name: e.name,
				transform: { position: [0, 0] as [number, number], rotation: 0, scale: [1, 1] as [number, number] },
				visible: e.visible ?? true,
			};
			
			for (const comp of e.components || []) {
				if (comp.type === 'Transform') {
					result.transform.position = [comp.translation?.[0] || 0, comp.translation?.[1] || 0];
					result.transform.scale = [comp.scale?.[0] || 1, comp.scale?.[1] || 1];
				} else if (comp.type === 'Transform2D') {
					result.transform = {
						position: comp.position || [0, 0],
						rotation: comp.rotation || 0,
						scale: comp.scale || [1, 1],
					};
				} else if (comp.type === 'Sprite2D') {
					result.sprite = { size: [100, 100] };
				} else if (comp.type === 'CollisionShape2D') {
					result.collider = { type: comp.shape?.type || 'box', size: comp.shape?.size || [50, 50] };
				}
			}
			return result;
		});
	}

	// ════════════════════════════════════════════════════════════════
	// SCENE LOADING
	// ════════════════════════════════════════════════════════════════

	private async loadScene(): Promise<void> {
		const delays = [100, 300, 600, 1000, 2000];
		
		for (const delay of delays) {
			await new Promise(r => setTimeout(r, delay));
			if (sceneBridge.hasScene()) return;

			const uri = await this.findVecnUri();
			if (!uri) continue;

			try {
				const file = await this.fileService.readFile(uri);
				const content = file.value.toString();
				if (!content.trim()) continue;

				sceneBridge.setUri(uri);
				if (sceneBridge.loadFromText(content, 'init')) {
					this.setupFileWatcher(uri);
					return;
				}
			} catch { /* ignore */ }
		}
	}

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
			for (const c of stat.children) {
				if (!c.isDirectory && c.name.endsWith('.vecn')) return c.resource;
			}
			for (const c of stat.children) {
				if (c.isDirectory && !skip.has(c.name)) {
					const f = await this.searchFolder(c.resource, depth + 1);
					if (f) return f;
				}
			}
		} catch { /* ignore */ }
		return null;
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
		if (this.modelListener) {
			this.modelListener.dispose();
			this.modelListener = null;
		}
	}

	private setupFileWatcher(uri: URI): void {
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
			this.fileWatcher = null;
		}

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
		} catch { /* ignore */ }
	}

	override dispose(): void {
		this.disposeModelListener();
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
			this.fileWatcher = null;
		}
		if (this.toolbar) this.toolbar.remove();
		if (this.viewportContainer) this.viewportContainer.remove();
		super.dispose();
	}
}

registerWorkbenchContribution2(
	VoidSceneEditorContribution.ID,
	VoidSceneEditorContribution,
	WorkbenchPhase.BlockRestore
);

import './sceneActions.js';

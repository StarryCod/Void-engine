/*---------------------------------------------------------------------------------------------
 *  Void Scene Editor - Contribution
 *  Toolbar with 3D/2D/Script buttons + Viewport + Inspector
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
import { Emitter, Event } from '../../../../base/common/event.js';

// Editor modes
type EditorMode = '3D' | '2D' | 'Script';

class VoidSceneEditorContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.voidSceneEditor';

	private toolbar: HTMLElement | null = null;
	private layoutContainer: HTMLElement | null = null;
	private viewportPane: HTMLElement | null = null;
	private inspectorPane: HTMLElement | null = null;
	private splitter: HTMLElement | null = null;
	
	// Viewports
	private viewport3D: ThreeViewport | null = null;
	private viewport2D: Viewport2D | null = null;
	private inspector: InspectorView | null = null;
	
	private currentMode: EditorMode = 'Script';
	
	// Inspector width state
	private inspectorWidth: number = 280;
	private isDragging: boolean = false;

	private modelListener: IDisposable | null = null;
	private fileWatcher: IDisposable | null = null;
	private suppressModelUntil: number = 0;

	private readonly _onModeChanged = this._register(new Emitter<EditorMode>());
	public readonly onModeChanged: Event<EditorMode> = this._onModeChanged.event;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
	) {
		super();

		// Create toolbar
		this.createToolbar();

		// Bridge -> Disk (save handler)
		this._register(sceneBridge.onNeedsSave(e => this.saveToDisk(e.uri, e.content)));

		// Editor changes
		this._register(this.editorService.onDidActiveEditorChange(() => this.onEditorChanged()));

		// Early discovery
		this.earlyDiscovery();
	}

	// ════════════════════════════════════════════════════════════════
	// TOOLBAR
	// ════════════════════════════════════════════════════════════════

	private createToolbar(): void {
		const checkEditorPart = () => {
			const editorPart = document.querySelector('.part.editor');
			if (editorPart) {
				this.insertToolbar(editorPart as HTMLElement);
			} else {
				setTimeout(checkEditorPart, 100);
			}
		};
		checkEditorPart();
	}

	private insertToolbar(editorPart: HTMLElement): void {
		// Toolbar container
		this.toolbar = document.createElement('div');
		this.toolbar.className = 'void-editor-toolbar';
		this.toolbar.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			height: 32px;
			background: #222225;
			border-bottom: 1px solid #2a2a2e;
			display: flex;
			align-items: center;
			padding: 0 8px;
			gap: 2px;
			z-index: 100;
			font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
			font-size: 12px;
		`;

		// Button group
		const buttonGroup = document.createElement('div');
		buttonGroup.style.cssText = 'display: flex; gap: 1px;';

		const modes: EditorMode[] = ['3D', '2D', 'Script'];
		for (const mode of modes) {
			const btn = this.createModeButton(mode);
			buttonGroup.appendChild(btn);
		}

		this.toolbar.appendChild(buttonGroup);
		editorPart.insertBefore(this.toolbar, editorPart.firstChild);

		// Adjust editor container
		const editorContainer = editorPart.querySelector('.editor-container');
		if (editorContainer) {
			(editorContainer as HTMLElement).style.paddingTop = '32px';
		}
	}

	private createModeButton(mode: EditorMode): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.textContent = mode;
		btn.dataset.mode = mode;

		const isActive = this.currentMode === mode;
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

		btn.addEventListener('mouseenter', () => {
			if (this.currentMode !== mode) {
				btn.style.background = '#2d2d32';
				btn.style.color = '#E67E22';
			}
		});

		btn.addEventListener('mouseleave', () => {
			if (this.currentMode !== mode) {
				btn.style.background = 'transparent';
				btn.style.color = '#777';
			}
		});

		btn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.switchMode(mode);
		});

		return btn;
	}

	private switchMode(mode: EditorMode): void {
		if (this.currentMode === mode) return;
		this.currentMode = mode;

		// Update button states
		if (this.toolbar) {
			const buttons = this.toolbar.querySelectorAll('button');
			buttons.forEach(btn => {
				const btnMode = (btn as HTMLButtonElement).dataset.mode as EditorMode;
				if (btnMode === mode) {
					btn.style.background = '#E67E22';
					btn.style.color = '#fff';
					btn.style.borderColor = '#D35400';
					btn.style.fontWeight = '600';
				} else {
					btn.style.background = 'transparent';
					btn.style.color = '#777';
					btn.style.borderColor = 'transparent';
					btn.style.fontWeight = '500';
				}
			});
		}

		// Handle mode switch
		const editorPart = document.querySelector('.part.editor') as HTMLElement | null;
		if (!editorPart) return;

		const monacoEditor = editorPart.querySelector('.monaco-editor') as HTMLElement | null;
		const editorContainer = editorPart.querySelector('.editor-container') as HTMLElement | null;

		// Hide all first
		if (monacoEditor) monacoEditor.style.display = 'none';
		if (this.layoutContainer) this.layoutContainer.style.display = 'none';

		// Stop rendering on both viewports
		if (this.viewport3D) this.viewport3D.stopRendering();
		if (this.viewport2D) this.viewport2D.stopRendering();

		if (mode === 'Script') {
			if (monacoEditor) monacoEditor.style.display = '';
		} else {
			this.activateViewport(editorContainer, mode);
		}

		this._onModeChanged.fire(mode);
	}

	private activateViewport(editorContainer: HTMLElement | null, mode: '3D' | '2D'): void {
		if (!editorContainer) return;

		// Ensure scene is loaded
		this.ensureSceneLoaded();

		// Create layout container if not exists
		if (!this.layoutContainer) {
			this.createLayout(editorContainer);
		}

		this.layoutContainer!.style.display = 'flex';

		// Switch viewport visibility
		if (mode === '3D') {
			this.activate3DViewport();
		} else {
			this.activate2DViewport();
		}
	}

	// ════════════════════════════════════════════════════════════════
	// VIEWPORT SWITCHING
	// ════════════════════════════════════════════════════════════════

	private activate3DViewport(): void {
		// Hide 2D viewport
		if (this.viewport2D) {
			this.viewport2D.stopRendering();
		}

		// Show/create 3D viewport
		if (!this.viewport3D && this.viewportPane) {
			const content = sceneBridge.getRaw() || '';
			this.viewport3D = new ThreeViewport(this.viewportPane, content);
			this._register(this.viewport3D);

			// Wire up events
			this._register(this.viewport3D.onTransformEditedTRS(e => {
				sceneBridge.updateTransform({
					entityId: e.entityId,
					translation: e.translation,
					rotation: e.rotation,
					scale: e.scale,
				});
			}));

			this._register(this.viewport3D.onEntityPicked(id => {
				sceneBridge.selectEntity(id);
			}));
		}

		// Update scene
		if (this.viewport3D) {
			const raw = sceneBridge.getRaw();
			if (raw) this.viewport3D.updateScene(raw);
		}
	}

	private activate2DViewport(): void {
		// Hide 3D viewport
		if (this.viewport3D) {
			this.viewport3D.stopRendering();
		}

		// Show/create 2D viewport
		if (!this.viewport2D && this.viewportPane) {
			this.viewport2D = new Viewport2D(this.viewportPane);
			this._register(this.viewport2D);

			// Wire up events
			this._register(this.viewport2D.onEntitySelected(id => {
				sceneBridge.selectEntity(id);
			}));

			this._register(this.viewport2D.onTransformChanged(e => {
				sceneBridge.updateTransform({
					entityId: e.id,
					translation: [e.transform.position[0], e.transform.position[1], 0],
					rotation: [0, 0, e.transform.rotation / 180 * Math.PI, 1],
					scale: [e.transform.scale[0], e.transform.scale[1], 1],
				});
			}));
		}

		// Load entities
		if (this.viewport2D) {
			const entities = sceneBridge.getEntities();
			// Convert to 2D format
			const entities2D = entities.map(e => ({
				id: e.id,
				name: e.name,
				transform: {
					position: [0, 0] as [number, number],
					rotation: 0,
					scale: [1, 1] as [number, number],
				},
				visible: e.visible ?? true,
				// Extract 2D transform from components
				...this.extract2DData(e),
			}));
			this.viewport2D.loadScene(entities2D);
			this.viewport2D.resize();
		}
	}

	private extract2DData(entity: any): any {
		const result: any = {};
		
		for (const comp of entity.components || []) {
			if (comp.type === 'Transform2D') {
				result.transform = {
					position: comp.position || [0, 0],
					rotation: comp.rotation || 0,
					scale: comp.scale || [1, 1],
				};
			} else if (comp.type === 'Transform') {
				// Fall back to 3D transform X/Y
				result.transform = {
					position: [comp.translation?.[0] || 0, comp.translation?.[1] || 0],
					rotation: 0,
					scale: [comp.scale?.[0] || 1, comp.scale?.[1] || 1],
				};
			} else if (comp.type === 'Sprite2D') {
				result.sprite = {
					texture: comp.texture,
					size: [100, 100], // Default size
					offset: comp.offset || [0, 0],
				};
			} else if (comp.type === 'CollisionShape2D') {
				result.collider = {
					type: comp.shape?.type?.toLowerCase() || 'box',
					size: comp.shape?.size || [50, 50],
					radius: comp.shape?.radius,
				};
			}
		}

		return result;
	}

	// ════════════════════════════════════════════════════════════════
	// LAYOUT: Viewport (left) | Splitter | Inspector (right)
	// ════════════════════════════════════════════════════════════════

	private createLayout(editorContainer: HTMLElement): void {
		// Main layout container
		this.layoutContainer = DOM.append(editorContainer, DOM.$('.void-scene-layout'));
		this.layoutContainer.style.cssText = `
			position: absolute;
			top: 32px;
			left: 0;
			right: 0;
			bottom: 0;
			background: #1e1e1e;
			z-index: 50;
			display: flex;
			flex-direction: row;
			overflow: hidden;
		`;

		// Viewport pane (left side)
		this.viewportPane = DOM.append(this.layoutContainer, DOM.$('.void-viewport-pane'));
		this.viewportPane.style.cssText = `
			flex: 1;
			position: relative;
			min-width: 200px;
			background: #1e1e1e;
		`;

		// Splitter (resizable divider)
		this.splitter = DOM.append(this.layoutContainer, DOM.$('.void-splitter'));
		this.splitter.style.cssText = `
			width: 4px;
			background: #3c3c3c;
			cursor: col-resize;
			flex-shrink: 0;
			transition: background 0.15s;
		`;
		
		// Splitter drag handlers
		this.splitter.addEventListener('mousedown', (e) => {
			e.preventDefault();
			this.isDragging = true;
			this.splitter!.style.background = '#E67E22';
			document.body.style.cursor = 'col-resize';
		});

		document.addEventListener('mousemove', (e) => {
			if (!this.isDragging || !this.layoutContainer) return;
			
			const containerRect = this.layoutContainer.getBoundingClientRect();
			const newWidth = containerRect.right - e.clientX;
			
			// Clamp width
			if (newWidth >= 200 && newWidth <= containerRect.width - 200) {
				this.inspectorWidth = newWidth;
				this.inspectorPane!.style.width = `${newWidth}px`;
				// Resize 2D viewport if active
				if (this.viewport2D && this.currentMode === '2D') {
					this.viewport2D.resize();
				}
			}
		});

		document.addEventListener('mouseup', () => {
			if (this.isDragging) {
				this.isDragging = false;
				if (this.splitter) {
					this.splitter.style.background = '#3c3c3c';
				}
				document.body.style.cursor = '';
			}
		});

		// Inspector pane (right side)
		this.inspectorPane = DOM.append(this.layoutContainer, DOM.$('.void-inspector-pane'));
		this.inspectorPane.style.cssText = `
			width: ${this.inspectorWidth}px;
			min-width: 200px;
			max-width: 500px;
			background: #1e1e1e;
			border-left: 1px solid #2a2a2e;
			display: flex;
			flex-direction: column;
		`;

		// Create inspector
		this.inspector = new InspectorView(this.inspectorPane);
		this._register(this.inspector);

		// Wire up scene updates
		this._register(sceneBridge.onSceneUpdated(u => {
			if (u.source !== 'viewport') {
				if (this.viewport3D && this.currentMode === '3D') {
					this.viewport3D.updateScene(u.raw);
				}
				if (this.viewport2D && this.currentMode === '2D') {
					// Reload entities
					const entities = sceneBridge.getEntities();
					const entities2D = entities.map(e => ({
						id: e.id,
						name: e.name,
						transform: { position: [0, 0] as [number, number], rotation: 0, scale: [1, 1] as [number, number] },
						visible: e.visible ?? true,
						...this.extract2DData(e),
					}));
					this.viewport2D.loadScene(entities2D);
				}
			}
		}));

		this._register(sceneBridge.onEntitySelected(id => {
			if (this.viewport3D && this.currentMode === '3D') {
				this.viewport3D.selectEntityById(id);
			}
			if (this.viewport2D && this.currentMode === '2D') {
				this.viewport2D.selectEntity(id);
			}
		}));
	}

	private ensureSceneLoaded(): void {
		if (sceneBridge.hasScene()) return;

		this.findVecnUri().then(uri => {
			if (uri) {
				this.fileService.readFile(uri).then(file => {
					sceneBridge.setUri(uri);
					sceneBridge.loadFromText(file.value.toString(), 'init');
					this.setupFileWatcher(uri);
				}).catch(() => {});
			}
		});
	}

	// ════════════════════════════════════════════════════════════════
	// EARLY DISCOVERY
	// ════════════════════════════════════════════════════════════════

	private async earlyDiscovery(): Promise<void> {
		const delays = [100, 300, 600, 1000, 2000, 3000];

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
				const success = sceneBridge.loadFromText(content, 'init');
				if (success) {
					this.setupFileWatcher(uri);
					return;
				}
			} catch {
				// ignore
			}
		}
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
		} catch {
			// ignore
		}
	}

	// ════════════════════════════════════════════════════════════════

	override dispose(): void {
		this.disposeModelListener();
		if (this.fileWatcher) { this.fileWatcher.dispose(); this.fileWatcher = null; }
		if (this.toolbar && this.toolbar.parentElement) {
			this.toolbar.parentElement.removeChild(this.toolbar);
		}
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

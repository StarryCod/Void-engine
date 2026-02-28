/*---------------------------------------------------------------------------------------------
 *  Void Engine — Scene Editor Container (Godot-style Layout)
 *  Main container integrating all panels in Godot 4.x style
 *  Layout: Scene Tree + FileSystem (left) | Viewport (center) | Inspector (right)
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import * as DOM from '../../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Viewport2DWebGL } from '../viewport2DWebGL.js';
import { SceneTreePanel } from './sceneTreePanel.js';
import { FileSystemPanel } from './fileSystemPanel.js';
import { InspectorPanel } from './inspectorPanel.js';
import { VecnScene } from '../../common/vecnParser.js';
import { Entity } from '../../common/vecnTypes.js';

// ============================================================================
// DESIGN SYSTEM COLORS
// ============================================================================

const COLORS = {
	// Backgrounds
	panelBg: '#1e1e1e',
	panelBgLighter: '#252526',
	panelBorder: '#3c3c3c',
	
	// Accents (Orange AI-IDE style)
	accent: '#E67E22',
	accentHover: '#F39C12',
	
	// Selection (Blue Godot style)
	selection: '#3498DB',
	
	// Text
	textPrimary: '#cccccc',
	textSecondary: '#858585',
	
	// Mode buttons
	mode2D: '#478cbf',
	mode3D: '#6b9bd1',
	modeScript: '#85c1e9'
};

// ============================================================================
// EDITOR MODE
// ============================================================================

export type EditorMode = '2D' | '3D' | 'Script';

// ============================================================================
// SPLITTER (Resizable divider)
// ============================================================================

class Splitter extends Disposable {
	private element: HTMLElement;
	private isDragging: boolean = false;
	private startPos: number = 0;
	private direction: 'horizontal' | 'vertical';
	private onResize: (delta: number) => void;
	
	constructor(direction: 'horizontal' | 'vertical', onResize: (delta: number) => void) {
		super();
		this.direction = direction;
		this.onResize = onResize;
		
		this.element = document.createElement('div');
		this.element.className = 'void-splitter';
		this.element.style.cssText = `
			background: ${COLORS.panelBorder};
			cursor: ${direction === 'horizontal' ? 'col-resize' : 'row-resize'};
			flex-shrink: 0;
			${direction === 'horizontal' ? 'width: 4px;' : 'height: 4px;'}
			transition: background 0.15s;
		`;
		
		this.element.addEventListener('mousedown', this.onMouseDown.bind(this));
		document.addEventListener('mousemove', this.onMouseMove.bind(this));
		document.addEventListener('mouseup', this.onMouseUp.bind(this));
	}
	
	getElement(): HTMLElement {
		return this.element;
	}
	
	private onMouseDown(e: MouseEvent): void {
		e.preventDefault();
		this.isDragging = true;
		this.startPos = this.direction === 'horizontal' ? e.clientX : e.clientY;
		this.element.style.background = COLORS.accent;
	}
	
	private onMouseMove(e: MouseEvent): void {
		if (!this.isDragging) return;
		
		const currentPos = this.direction === 'horizontal' ? e.clientX : e.clientY;
		const delta = currentPos - this.startPos;
		this.onResize(delta);
		this.startPos = currentPos;
	}
	
	private onMouseUp(): void {
		this.isDragging = false;
		this.element.style.background = COLORS.panelBorder;
	}
	
	override dispose(): void {
		this.element.removeEventListener('mousedown', this.onMouseDown.bind(this));
		super.dispose();
	}
}

// ============================================================================
// MODE TOOLBAR (Top bar with 2D/3D/Script buttons)
// ============================================================================

class ModeToolbar extends Disposable {
	private element: HTMLElement;
	private modeButtons: Map<EditorMode, HTMLButtonElement> = new Map();
	private currentMode: EditorMode = '2D';
	
	private readonly _onModeChanged = new Emitter<EditorMode>();
	readonly onModeChanged: Event<EditorMode> = this._onModeChanged.event;
	
	constructor() {
		super();
		
		this.element = document.createElement('div');
		this.element.className = 'void-mode-toolbar';
		this.element.style.cssText = `
			display: flex;
			align-items: center;
			padding: 0 10px;
			height: 32px;
			background: ${COLORS.panelBgLighter};
			border-bottom: 1px solid ${COLORS.panelBorder};
		`;
		
		// Mode buttons
		const modes: { id: EditorMode; label: string; color: string }[] = [
			{ id: '2D', label: '2D', color: COLORS.mode2D },
			{ id: '3D', label: '3D', color: COLORS.mode3D },
			{ id: 'Script', label: 'Скрипт', color: COLORS.modeScript }
		];
		
		const buttonsContainer = document.createElement('div');
		buttonsContainer.style.cssText = `
			display: flex;
			gap: 4px;
			margin-right: 20px;
		`;
		
		for (const mode of modes) {
			const btn = document.createElement('button');
			btn.textContent = mode.label;
			btn.style.cssText = `
				padding: 4px 12px;
				background: ${this.currentMode === mode.id ? COLORS.accent : 'transparent'};
				border: 1px solid ${COLORS.panelBorder};
				border-radius: 3px;
				color: ${this.currentMode === mode.id ? '#fff' : COLORS.textSecondary};
				cursor: pointer;
				font-size: 11px;
				font-weight: 500;
				transition: all 0.15s;
			`;
			
			btn.addEventListener('click', () => {
				this.setMode(mode.id);
			});
			
			btn.addEventListener('mouseenter', () => {
				if (this.currentMode !== mode.id) {
					btn.style.background = COLORS.panelBgLighter;
					btn.style.color = COLORS.textPrimary;
				}
			});
			
			btn.addEventListener('mouseleave', () => {
				if (this.currentMode !== mode.id) {
					btn.style.background = 'transparent';
					btn.style.color = COLORS.textSecondary;
				}
			});
			
			this.modeButtons.set(mode.id, btn);
			buttonsContainer.appendChild(btn);
		}
		
		this.element.appendChild(buttonsContainer);
		
		// Scene name
		const sceneNameEl = document.createElement('div');
		sceneNameEl.className = 'void-scene-name';
		sceneNameEl.style.cssText = `
			color: ${COLORS.textSecondary};
			font-size: 11px;
		`;
		sceneNameEl.textContent = 'Новая сцена';
		this.element.appendChild(sceneNameEl);
	}
	
	getElement(): HTMLElement {
		return this.element;
	}
	
	setMode(mode: EditorMode): void {
		this.currentMode = mode;
		
		this.modeButtons.forEach((btn, id) => {
			if (id === mode) {
				btn.style.background = COLORS.accent;
				btn.style.color = '#fff';
			} else {
				btn.style.background = 'transparent';
				btn.style.color = COLORS.textSecondary;
			}
		});
		
		this._onModeChanged.fire(mode);
	}
	
	getMode(): EditorMode {
		return this.currentMode;
	}
	
	setSceneName(name: string): void {
		const el = this.element.querySelector('.void-scene-name');
		if (el) el.textContent = name;
	}
	
	override dispose(): void {
		this._onModeChanged.dispose();
		super.dispose();
	}
}

// ============================================================================
// PLAY CONTROLS (Run/Stop buttons)
// ============================================================================

class PlayControls extends Disposable {
	private element: HTMLElement;
	
	private readonly _onPlay = new Emitter<void>();
	readonly onPlay: Event<void> = this._onPlay.event;
	
	private readonly _onStop = new Emitter<void>();
	readonly onStop: Event<void> = this._onStop.event;
	
	private readonly _onPause = new Emitter<void>();
	readonly onPause: Event<void> = this._onPause.event;
	
	constructor() {
		super();
		
		this.element = document.createElement('div');
		this.element.className = 'void-play-controls';
		this.element.style.cssText = `
			display: flex;
			align-items: center;
			gap: 4px;
			margin-left: auto;
		`;
		
		// Play button
		const playBtn = this.createButton('▶', 'Запустить');
		playBtn.addEventListener('click', () => this._onPlay.fire());
		this.element.appendChild(playBtn);
		
		// Pause button
		const pauseBtn = this.createButton('⏸', 'Пауза');
		pauseBtn.addEventListener('click', () => this._onPause.fire());
		this.element.appendChild(pauseBtn);
		
		// Stop button
		const stopBtn = this.createButton('⏹', 'Остановить');
		stopBtn.addEventListener('click', () => this._onStop.fire());
		this.element.appendChild(stopBtn);
	}
	
	private createButton(icon: string, tooltip: string): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.innerHTML = icon;
		btn.title = tooltip;
		btn.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: center;
			width: 28px;
			height: 24px;
			background: transparent;
			border: 1px solid ${COLORS.panelBorder};
			border-radius: 3px;
			color: ${COLORS.textSecondary};
			cursor: pointer;
			font-size: 12px;
			transition: all 0.15s;
		`;
		
		btn.addEventListener('mouseenter', () => {
			btn.style.background = COLORS.accent;
			btn.style.color = '#fff';
		});
		btn.addEventListener('mouseleave', () => {
			btn.style.background = 'transparent';
			btn.style.color = COLORS.textSecondary;
		});
		
		return btn;
	}
	
	getElement(): HTMLElement {
		return this.element;
	}
	
	override dispose(): void {
		this._onPlay.dispose();
		this._onStop.dispose();
		this._onPause.dispose();
		super.dispose();
	}
}

// ============================================================================
// SCENE EDITOR CONTAINER
// ============================================================================

export class SceneEditorContainer extends Disposable {
	private container: HTMLElement;
	private topBar: HTMLElement;
	private modeToolbar: ModeToolbar;
	private playControls: PlayControls;
	
	private leftPanel: HTMLElement;
	private sceneTreePanel: SceneTreePanel;
	private fileSystemPanel: FileSystemPanel;
	
	private centerPanel: HTMLElement;
	private viewport2D: Viewport2DWebGL | null = null;
	
	private rightPanel: HTMLElement;
	private inspectorPanel: InspectorPanel;
	
	private splitters: Splitter[] = [];
	
	private currentScene: VecnScene | null = null;
	private currentMode: EditorMode = '2D';
	
	// Events
	private readonly _onModeChanged = new Emitter<EditorMode>();
	readonly onModeChanged: Event<EditorMode> = this._onModeChanged.event;
	
	constructor(parent: HTMLElement) {
		super();
		
		// Main container
		this.container = document.createElement('div');
		this.container.className = 'void-scene-editor-container';
		this.container.style.cssText = `
			display: flex;
			flex-direction: column;
			width: 100%;
			height: 100%;
			background: ${COLORS.panelBg};
			color: ${COLORS.textPrimary};
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			font-size: 12px;
			overflow: hidden;
		`;
		
		// Top bar (mode toolbar + play controls)
		this.topBar = document.createElement('div');
		this.topBar.style.cssText = `
			display: flex;
			align-items: center;
		`;
		
		this.modeToolbar = new ModeToolbar();
		this.topBar.appendChild(this.modeToolbar.getElement());
		this._register(this.modeToolbar);
		this._register(this.modeToolbar.onModeChanged((mode) => {
			this.switchMode(mode);
		}));
		
		this.playControls = new PlayControls();
		this.topBar.appendChild(this.playControls.getElement());
		this._register(this.playControls);
		
		this.container.appendChild(this.topBar);
		
		// Main content area (horizontal flex)
		const mainArea = document.createElement('div');
		mainArea.style.cssText = `
			display: flex;
			flex: 1;
			overflow: hidden;
		`;
		
		// Left panel (Scene Tree + FileSystem)
		this.leftPanel = document.createElement('div');
		this.leftPanel.className = 'void-left-panel';
		this.leftPanel.style.cssText = `
			display: flex;
			flex-direction: column;
			width: 250px;
			min-width: 150px;
			max-width: 400px;
			background: ${COLORS.panelBg};
			border-right: 1px solid ${COLORS.panelBorder};
		`;
		
		// Scene Tree (top half)
		const sceneTreeContainer = document.createElement('div');
		sceneTreeContainer.style.cssText = `
			flex: 1;
			overflow: hidden;
			border-bottom: 1px solid ${COLORS.panelBorder};
		`;
		this.sceneTreePanel = new SceneTreePanel(sceneTreeContainer);
		this._register(this.sceneTreePanel);
		this.leftPanel.appendChild(sceneTreeContainer);
		
		// FileSystem (bottom half)
		const fileSystemContainer = document.createElement('div');
		fileSystemContainer.style.cssText = `
			flex: 1;
			overflow: hidden;
		`;
		this.fileSystemPanel = new FileSystemPanel(fileSystemContainer);
		this._register(this.fileSystemPanel);
		this.leftPanel.appendChild(fileSystemContainer);
		
		mainArea.appendChild(this.leftPanel);
		
		// Left splitter
		const leftSplitter = new Splitter('horizontal', (delta) => {
			const newWidth = this.leftPanel.offsetWidth + delta;
			this.leftPanel.style.width = `${Math.max(150, Math.min(400, newWidth))}px`;
		});
		this._register(leftSplitter);
		mainArea.appendChild(leftSplitter.getElement());
		this.splitters.push(leftSplitter);
		
		// Center panel (Viewport)
		this.centerPanel = document.createElement('div');
		this.centerPanel.className = 'void-center-panel';
		this.centerPanel.style.cssText = `
			flex: 1;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		`;
		
		// Initialize 2D viewport
		this.viewport2D = new Viewport2DWebGL(this.centerPanel);
		this._register(this.viewport2D);
		
		mainArea.appendChild(this.centerPanel);
		
		// Right splitter
		const rightSplitter = new Splitter('horizontal', (delta) => {
			const newWidth = this.rightPanel.offsetWidth - delta;
			this.rightPanel.style.width = `${Math.max(200, Math.min(400, newWidth))}px`;
		});
		this._register(rightSplitter);
		mainArea.appendChild(rightSplitter.getElement());
		this.splitters.push(rightSplitter);
		
		// Right panel (Inspector)
		this.rightPanel = document.createElement('div');
		this.rightPanel.className = 'void-right-panel';
		this.rightPanel.style.cssText = `
			display: flex;
			flex-direction: column;
			width: 280px;
			min-width: 200px;
			max-width: 400px;
			background: ${COLORS.panelBg};
			border-left: 1px solid ${COLORS.panelBorder};
		`;
		
		this.inspectorPanel = new InspectorPanel(this.rightPanel);
		this._register(this.inspectorPanel);
		
		mainArea.appendChild(this.rightPanel);
		
		this.container.appendChild(mainArea);
		
		// Event wire-up
		this.setupEventHandlers();
		
		DOM.append(parent, this.container);
	}
	
	private setupEventHandlers(): void {
		// Scene Tree -> Inspector
		this._register(this.sceneTreePanel.onNodeSelected((id) => {
			if (id && this.currentScene) {
				const entity = this.findEntityById(this.currentScene.entities, id);
				if (entity) {
					this.inspectorPanel.setEntity(entity);
					if (this.viewport2D) {
						this.viewport2D.selectObject(id);
					}
				}
			} else {
				this.inspectorPanel.setEntity(null);
				if (this.viewport2D) {
					this.viewport2D.selectObject(null);
				}
			}
		}));
		
		// Scene Tree -> Viewport focus
		this._register(this.sceneTreePanel.onNodeDoubleClicked((id) => {
			// Focus on object in viewport
			console.log('Focus on:', id);
		}));
		
		// FileSystem -> Load file
		this._register(this.fileSystemPanel.onFileDoubleClicked((path) => {
			console.log('Open file:', path);
		}));
		
		// Inspector -> Update
		this._register(this.inspectorPanel.onPropertyChanged(({ key, value }) => {
			console.log('Property changed:', key, value);
		}));
	}
	
	private findEntityById(entities: Entity[], id: string): Entity | null {
		for (const entity of entities) {
			if (entity.id === id) return entity;
			const found = this.findEntityById(entity.children, id);
			if (found) return found;
		}
		return null;
	}
	
	public switchMode(mode: EditorMode): void {
		this.currentMode = mode;
		this.modeToolbar.setMode(mode);
		
		// Update visibility based on mode
		switch (mode) {
			case '2D':
				this.centerPanel.style.display = 'flex';
				break;
			case '3D':
				this.centerPanel.style.display = 'flex';
				break;
			case 'Script':
				// Hide viewport, show editor
				this.centerPanel.style.display = 'none';
				break;
		}
		
		this._onModeChanged.fire(mode);
	}
	
	public loadScene(scene: VecnScene): void {
		this.currentScene = scene;
		
		// Update Scene Tree
		this.sceneTreePanel.loadScene(scene.entities);
		
		// Update Viewport
		if (this.viewport2D) {
			this.viewport2D.loadScene(scene);
		}
		
		// Update scene name
		this.modeToolbar.setSceneName('Сцена загружена');
	}
	
	public getMode(): EditorMode {
		return this.currentMode;
	}
	
	public getViewport2D(): Viewport2DWebGL | null {
		return this.viewport2D;
	}
	
	public getSceneTree(): SceneTreePanel {
		return this.sceneTreePanel;
	}
	
	public getFileSystem(): FileSystemPanel {
		return this.fileSystemPanel;
	}
	
	public getInspector(): InspectorPanel {
		return this.inspectorPanel;
	}
	
	override dispose(): void {
		for (const splitter of this.splitters) {
			splitter.dispose();
		}
		super.dispose();
	}
}

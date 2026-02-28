/*---------------------------------------------------------------------------------------------
 *  Void Scene Editor - Top Toolbar (3D | 2D | Script)
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { SceneEditorMode } from '../common/voidSceneEditor.js';
import { Emitter, Event } from '../../../../base/common/event.js';

export class VoidSceneEditorToolbar extends Disposable {
	private container: HTMLElement | null = null;
	private currentMode: SceneEditorMode = SceneEditorMode.Script; // По умолчанию Script
	
	private readonly _onModeChanged = this._register(new Emitter<SceneEditorMode>());
	public readonly onModeChanged: Event<SceneEditorMode> = this._onModeChanged.event;

	constructor() {
		super();
		// Load saved mode from localStorage
		const savedMode = localStorage.getItem('voidSceneEditor.mode');
		if (savedMode && (savedMode === '3d' || savedMode === '2d' || savedMode === 'script')) {
			this.currentMode = savedMode as SceneEditorMode;
		}
		this.create();
	}

	private create(): void {
		// Wait for editor part to be ready
		const checkEditorPart = () => {
			const editorPart = document.querySelector('.part.editor');
			if (editorPart) {
				console.log('[Void Scene Editor] Found editor part');
				this.createToolbar(editorPart as HTMLElement);
			} else {
				setTimeout(checkEditorPart, 100);
			}
		};
		checkEditorPart();
	}

	private createToolbar(editorPart: HTMLElement): void {
		console.log('[Void Scene Editor] Creating toolbar...');

		// Create toolbar container
		this.container = document.createElement('div');
		this.container.className = 'void-scene-editor-toolbar';
		this.container.style.cssText = `
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
			user-select: none;
		`;

		// Mode buttons (left side)
		const modeGroup = document.createElement('div');
		modeGroup.style.cssText = 'display:flex; gap:1px; margin-right:12px;';

		const btn3D = this.createButton('3D', SceneEditorMode.Scene3D, this.currentMode === SceneEditorMode.Scene3D);
		const btn2D = this.createButton('2D', SceneEditorMode.Scene2D, this.currentMode === SceneEditorMode.Scene2D);
		const btnScript = this.createButton('Script', SceneEditorMode.Script, this.currentMode === SceneEditorMode.Script);

		modeGroup.appendChild(btn3D);
		modeGroup.appendChild(btn2D);
		modeGroup.appendChild(btnScript);
		this.container.appendChild(modeGroup);

		// Separator
		const sep = document.createElement('div');
		sep.style.cssText = 'width:1px; height:16px; background:#2d2d32; margin:0 6px;';
		this.container.appendChild(sep);

		// Spacer
		const spacer = document.createElement('div');
		spacer.style.flex = '1';
		this.container.appendChild(spacer);

		// Insert at the top of editor part
		editorPart.insertBefore(this.container, editorPart.firstChild);
		
		// Adjust editor part padding to make room for toolbar
		const editorContainer = editorPart.querySelector('.editor-container');
		if (editorContainer) {
			(editorContainer as HTMLElement).style.paddingTop = '32px';
		}
		
		console.log('[Void Scene Editor] Toolbar created and inserted into editor part');
		console.log('[Void Scene Editor] Toolbar visible:', this.container.offsetHeight > 0);
		
		// Trigger initial mode after a delay to ensure DOM is ready
		setTimeout(() => {
			console.log('[Void Scene Editor] Triggering initial mode:', this.currentMode);
			this._onModeChanged.fire(this.currentMode);
		}, 100);
	}

	private createButton(label: string, mode: SceneEditorMode, active: boolean): HTMLElement {
		const button = document.createElement('button');
		button.className = 'void-scene-editor-mode-btn';
		button.setAttribute('data-mode', mode);
		button.textContent = label;
		
		// Inline styles
		const activeCSS = active
			? 'background:#353538; color:#d0d0d0; border-color:#404045;'
			: 'background:transparent; color:#777; border-color:transparent;';

		button.style.cssText = `
			padding:3px 14px; border:1px solid transparent;
			border-radius:3px; cursor:pointer;
			font-size:11px; font-weight:500;
			letter-spacing:0.2px;
			transition:all 0.1s ease;
			outline:none; ${activeCSS}
		`;

		// Hover effect
		button.addEventListener('mouseenter', () => {
			if (this.currentMode !== mode) {
				button.style.background = '#2d2d32';
				button.style.color = '#aaa';
			}
		});
		button.addEventListener('mouseleave', () => {
			if (this.currentMode !== mode) {
				button.style.background = 'transparent';
				button.style.color = '#777';
			}
		});

		// Click handler
		button.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			console.log('[Void Scene Editor] Button clicked:', label, mode);
			this.switchMode(mode);
		});

		return button;
	}

	private switchMode(mode: SceneEditorMode): void {
		if (this.currentMode === mode) {
			return;
		}
		
		this.currentMode = mode;
		
		// Save to localStorage
		localStorage.setItem('voidSceneEditor.mode', mode);
		
		// Update button states
		if (this.container) {
			const buttons = this.container.querySelectorAll('button');
			buttons.forEach(btn => {
				const btnMode = btn.getAttribute('data-mode');
				if (btnMode === mode) {
					btn.style.background = '#353538';
					btn.style.color = '#d0d0d0';
					btn.style.border = '1px solid #404045';
					btn.style.fontWeight = '500';
				} else {
					btn.style.background = 'transparent';
					btn.style.color = '#777';
					btn.style.border = '1px solid transparent';
					btn.style.fontWeight = '500';
				}
			});
		}
		
		console.log(`[Void Scene Editor] Switched to ${mode} mode`);
		this._onModeChanged.fire(mode);
	}

	public getCurrentMode(): SceneEditorMode {
		return this.currentMode;
	}

	public setSceneName(name: string): void {
		if (this.container) {
			const sceneInfo = this.container.querySelector('span');
			if (sceneInfo) {
				sceneInfo.textContent = `Scene: ${name}`;
			}
		}
	}

	override dispose(): void {
		if (this.container && this.container.parentElement) {
			this.container.parentElement.removeChild(this.container);
		}
		super.dispose();
	}
}

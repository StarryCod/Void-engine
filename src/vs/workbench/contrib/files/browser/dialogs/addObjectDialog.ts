/*---------------------------------------------------------------------------------------------
 *  Enhanced "Create New Node" Dialog - Godot Style with Codicons
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import * as DOM from '../../../../../base/browser/dom.js';

export interface ObjectDefinition {
	id: string;
	name: string;
	icon: string; // Codicon class
	category: string;
	description: string;
	baseClass: string;
}

// Enhanced node definitions with Codicon icons
const NODES: ObjectDefinition[] = [
	// === SCENE ===
	{ id: 'empty', name: 'Node3D', icon: 'codicon-circle-outline', category: 'Scene', description: 'Base class for all 3D objects. Empty transform node.', baseClass: 'Node' },
	{ id: 'perspective camera', name: 'Camera3D', icon: 'codicon-device-camera', category: 'Scene', description: 'Camera node, displays the scene from a point of view.', baseClass: 'Node3D' },
	{ id: 'marker3d', name: 'Marker3D', icon: 'codicon-location', category: 'Scene', description: 'Invisible marker for spawn points and waypoints.', baseClass: 'Node3D' },
	
	// === 3D VISUAL ===
	{ id: 'meshinstance3d', name: 'MeshInstance3D', icon: 'codicon-symbol-misc', category: '3D Visual', description: '3D mesh node. Select shape in Inspector (Cube, Sphere, Capsule, etc).', baseClass: 'Node3D' },
	{ id: 'sprite3d', name: 'Sprite3D', icon: 'codicon-file-media', category: '3D Visual', description: '2D sprite in 3D space (billboard).', baseClass: 'Node3D' },
	{ id: 'animatedsprite3d', name: 'AnimatedSprite3D', icon: 'codicon-play-circle', category: '3D Visual', description: 'Animated sprite in 3D space.', baseClass: 'Node3D' },
	{ id: 'label3d', name: 'Label3D', icon: 'codicon-symbol-text', category: '3D Visual', description: '3D text label in space.', baseClass: 'Node3D' },
	{ id: 'gpuparticles3d', name: 'GPUParticles3D', icon: 'codicon-symbol-color', category: '3D Visual', description: 'GPU-based particle system for effects.', baseClass: 'Node3D' },
	{ id: 'cpuparticles3d', name: 'CPUParticles3D', icon: 'codicon-symbol-color', category: '3D Visual', description: 'CPU-based particle system.', baseClass: 'Node3D' },
	{ id: 'multimeshinstance3d', name: 'MultiMeshInstance3D', icon: 'codicon-layers', category: '3D Visual', description: 'Render multiple instances of a mesh efficiently.', baseClass: 'Node3D' },
	
	// === LIGHTS ===
	{ id: 'directional light', name: 'DirectionalLight3D', icon: 'codicon-lightbulb', category: 'Lights', description: 'Simulates the sun. Rays are parallel.', baseClass: 'Light3D' },
	{ id: 'point light', name: 'OmniLight3D', icon: 'codicon-lightbulb', category: 'Lights', description: 'Omnidirectional light source (Point Light).', baseClass: 'Light3D' },
	{ id: 'spotlight', name: 'SpotLight3D', icon: 'codicon-lightbulb', category: 'Lights', description: 'Spotlight with cone angle.', baseClass: 'Light3D' },
	
	// === PHYSICS 3D ===
	{ id: 'characterbody3d', name: 'CharacterBody3D', icon: 'codicon-person', category: 'Physics 3D', description: 'Physics body for player/NPC with manual control.', baseClass: 'Node3D' },
	{ id: 'rigidbody3d', name: 'RigidBody3D', icon: 'codicon-package', category: 'Physics 3D', description: 'Physics body with automatic simulation.', baseClass: 'Node3D' },
	{ id: 'staticbody3d', name: 'StaticBody3D', icon: 'codicon-symbol-structure', category: 'Physics 3D', description: 'Static physics body (walls, floor).', baseClass: 'Node3D' },
	{ id: 'area3d', name: 'Area3D', icon: 'codicon-selection', category: 'Physics 3D', description: 'Trigger zone for detecting objects.', baseClass: 'Node3D' },
	{ id: 'collisionshape3d', name: 'CollisionShape3D', icon: 'codicon-debug-stackframe-dot', category: 'Physics 3D', description: 'Collision shape for physics. Select shape in Inspector. Must be child of another node.', baseClass: 'Node3D' },
	{ id: 'raycast3d', name: 'RayCast3D', icon: 'codicon-arrow-right', category: 'Physics 3D', description: 'Ray for collision detection.', baseClass: 'Node3D' },
	{ id: 'shapecast3d', name: 'ShapeCast3D', icon: 'codicon-arrow-both', category: 'Physics 3D', description: 'Shape-based collision detection (thick ray).', baseClass: 'Node3D' },
	
	// === 2D ===
	{ id: 'node2d', name: 'Node2D', icon: 'codicon-circle-outline', category: '2D', description: 'Base class for all 2D objects.', baseClass: 'Node' },
	{ id: 'sprite2d', name: 'Sprite2D', icon: 'codicon-file-media', category: '2D', description: 'Static 2D sprite.', baseClass: 'Node2D' },
	{ id: 'animatedsprite2d', name: 'AnimatedSprite2D', icon: 'codicon-play-circle', category: '2D', description: 'Animated 2D sprite.', baseClass: 'Node2D' },
	{ id: 'marker2d', name: 'Marker2D', icon: 'codicon-location', category: '2D', description: 'Invisible 2D marker.', baseClass: 'Node2D' },
	
	// === PHYSICS 2D ===
	{ id: 'characterbody2d', name: 'CharacterBody2D', icon: 'codicon-person', category: 'Physics 2D', description: '2D character with manual control.', baseClass: 'Node2D' },
	{ id: 'rigidbody2d', name: 'RigidBody2D', icon: 'codicon-package', category: 'Physics 2D', description: '2D physics body.', baseClass: 'Node2D' },
	{ id: 'staticbody2d', name: 'StaticBody2D', icon: 'codicon-symbol-structure', category: 'Physics 2D', description: 'Static 2D body.', baseClass: 'Node2D' },
	{ id: 'area2d', name: 'Area2D', icon: 'codicon-selection', category: 'Physics 2D', description: '2D trigger zone.', baseClass: 'Node2D' },
	{ id: 'collisionshape2d', name: 'CollisionShape2D', icon: 'codicon-debug-stackframe-dot', category: 'Physics 2D', description: '2D collision shape.', baseClass: 'Node2D' },
	{ id: 'raycast2d', name: 'RayCast2D', icon: 'codicon-arrow-right', category: 'Physics 2D', description: '2D ray for collision detection.', baseClass: 'Node2D' },
	
	// === AUDIO ===
	{ id: 'audiostreamplayer', name: 'AudioStreamPlayer', icon: 'codicon-unmute', category: 'Audio', description: 'Audio player (no position).', baseClass: 'Node' },
	{ id: 'audiostreamplayer2d', name: 'AudioStreamPlayer2D', icon: 'codicon-unmute', category: 'Audio', description: '2D positional audio.', baseClass: 'Node2D' },
	{ id: 'audiostreamplayer3d', name: 'AudioStreamPlayer3D', icon: 'codicon-unmute', category: 'Audio', description: '3D positional audio.', baseClass: 'Node3D' },
	
	// === ANIMATION ===
	{ id: 'animationplayer', name: 'AnimationPlayer', icon: 'codicon-play', category: 'Animation', description: 'Plays animations on nodes.', baseClass: 'Node' },
	{ id: 'animationtree', name: 'AnimationTree', icon: 'codicon-type-hierarchy', category: 'Animation', description: 'Animation blending tree.', baseClass: 'Node' },
	{ id: 'tween', name: 'Tween', icon: 'codicon-graph-line', category: 'Animation', description: 'Interpolate values over time.', baseClass: 'Node' },
	
	// === NAVIGATION ===
	{ id: 'navigationregion3d', name: 'NavigationRegion3D', icon: 'codicon-map', category: 'Navigation', description: '3D navigation mesh region.', baseClass: 'Node3D' },
	{ id: 'navigationagent3d', name: 'NavigationAgent3D', icon: 'codicon-target', category: 'Navigation', description: '3D pathfinding agent.', baseClass: 'Node3D' },
	{ id: 'navigationobstacle3d', name: 'NavigationObstacle3D', icon: 'codicon-circle-slash', category: 'Navigation', description: '3D dynamic obstacle.', baseClass: 'Node3D' },
	{ id: 'navigationregion2d', name: 'NavigationRegion2D', icon: 'codicon-map', category: 'Navigation', description: '2D navigation region.', baseClass: 'Node2D' },
	{ id: 'navigationagent2d', name: 'NavigationAgent2D', icon: 'codicon-target', category: 'Navigation', description: '2D pathfinding agent.', baseClass: 'Node2D' },
	{ id: 'navigationobstacle2d', name: 'NavigationObstacle2D', icon: 'codicon-circle-slash', category: 'Navigation', description: '2D dynamic obstacle.', baseClass: 'Node2D' },
	
	// === ENVIRONMENT ===
	{ id: 'worldenvironment', name: 'WorldEnvironment', icon: 'codicon-globe', category: 'Environment', description: 'Scene environment settings (sky, fog, ambient).', baseClass: 'Node' },
	{ id: 'sky', name: 'Sky', icon: 'codicon-cloud', category: 'Environment', description: 'Sky/skybox configuration.', baseClass: 'Node' },
	{ id: 'fogvolume', name: 'FogVolume', icon: 'codicon-cloud-download', category: 'Environment', description: 'Volumetric fog.', baseClass: 'Node3D' },
	{ id: 'reflectionprobe', name: 'ReflectionProbe', icon: 'codicon-mirror', category: 'Environment', description: 'Environment reflections.', baseClass: 'Node3D' },
	
	// === UTILITIES ===
	{ id: 'timer', name: 'Timer', icon: 'codicon-watch', category: 'Utilities', description: 'Timer with timeout signal.', baseClass: 'Node' },
	{ id: 'path3d', name: 'Path3D', icon: 'codicon-git-commit', category: 'Utilities', description: '3D path curve.', baseClass: 'Node3D' },
	{ id: 'pathfollow3d', name: 'PathFollow3D', icon: 'codicon-debug-step-over', category: 'Utilities', description: 'Follow 3D path.', baseClass: 'Node3D' },
	{ id: 'path2d', name: 'Path2D', icon: 'codicon-git-commit', category: 'Utilities', description: '2D path curve.', baseClass: 'Node2D' },
	{ id: 'pathfollow2d', name: 'PathFollow2D', icon: 'codicon-debug-step-over', category: 'Utilities', description: 'Follow 2D path.', baseClass: 'Node2D' },
	{ id: 'remotetransform3d', name: 'RemoteTransform3D', icon: 'codicon-link', category: 'Utilities', description: 'Copy transform to another node.', baseClass: 'Node3D' },
	{ id: 'remotetransform2d', name: 'RemoteTransform2D', icon: 'codicon-link', category: 'Utilities', description: 'Copy 2D transform to another node.', baseClass: 'Node2D' },
	{ id: 'visibleonscreennotifier3d', name: 'VisibleOnScreenNotifier3D', icon: 'codicon-eye', category: 'Utilities', description: 'Notifies when visible on screen.', baseClass: 'Node3D' },
	{ id: 'visibleonscreennotifier2d', name: 'VisibleOnScreenNotifier2D', icon: 'codicon-eye', category: 'Utilities', description: 'Notifies when 2D node is visible.', baseClass: 'Node2D' },
	
	// === SPECIAL ===
	{ id: 'viewport', name: 'Viewport', icon: 'codicon-window', category: 'Special', description: 'Separate render target.', baseClass: 'Node' },
	{ id: 'subviewport', name: 'SubViewport', icon: 'codicon-multiple-windows', category: 'Special', description: 'Nested viewport.', baseClass: 'Viewport' },
	{ id: 'canvaslayer', name: 'CanvasLayer', icon: 'codicon-layers-active', category: 'Special', description: 'UI layer over 2D/3D.', baseClass: 'Node' },
	{ id: 'skeleton3d', name: 'Skeleton3D', icon: 'codicon-symbol-structure', category: 'Special', description: 'Skeleton for bone animation.', baseClass: 'Node3D' },
	{ id: 'boneattachment3d', name: 'BoneAttachment3D', icon: 'codicon-link-external', category: 'Special', description: 'Attach object to bone.', baseClass: 'Node3D' },
];

export class AddObjectDialog extends Disposable {
	private overlay: HTMLElement | null = null;
	private searchInput: HTMLInputElement | null = null;
	private treeContainer: HTMLElement | null = null;
	private descContainer: HTMLElement | null = null;
	private selectedId: string | null = null;

	private onSelectCallback: ((def: ObjectDefinition) => void) | null = null;

	constructor(private parent: HTMLElement) {
		super();
	}

	show(onSelect: (def: ObjectDefinition) => void): void {
		this.onSelectCallback = onSelect;
		this.render();
	}

	hide(): void {
		if (this.overlay) {
			this.overlay.remove();
			this.overlay = null;
		}
	}

	private render(): void {
		// Overlay
		this.overlay = DOM.append(this.parent, DOM.$('.godot-dialog-overlay'));
		this.overlay.style.cssText = `
			position: fixed; top: 0; left: 0; right: 0; bottom: 0;
			background: rgba(0, 0, 0, 0.58); z-index: var(--ve-layer-dialog, 3300);
			display: flex; align-items: center; justify-content: center;
			backdrop-filter: blur(10px);
		`;

		this._register(DOM.addDisposableListener(this.overlay, DOM.EventType.CLICK, (e) => {
			if (e.target === this.overlay) this.hide();
		}));

		// Window
		const window = DOM.append(this.overlay, DOM.$('.godot-dialog-window'));
		window.style.cssText = `
			width: 700px; height: 520px;
			background: #1f1f1f;
			border: 1px solid #343434;
			box-shadow: 0 28px 72px rgba(0, 0, 0, 0.5);
			border-radius: 24px; display: flex; flex-direction: column;
			color: var(--vscode-foreground);
			font-family: var(--vscode-font-family);
			overflow: hidden;
		`;

		// Header
		const header = DOM.append(window, DOM.$('.godot-dialog-header'));
		header.style.cssText = `
			padding: 14px 18px; font-weight: 600; 
			border-bottom: 1px solid #303030; 
			font-size: 13px; color: #ececec;
			display: flex; align-items: center; gap: 8px;
			background: #191919;
		`;
		
		const headerIcon = DOM.append(header, DOM.$('.codicon.codicon-add'));
		headerIcon.style.fontSize = '16px';
		
		const headerText = DOM.append(header, DOM.$('span'));
		headerText.textContent = 'Create New Node';

		// Content Area
		const content = DOM.append(window, DOM.$('.godot-dialog-content'));
		content.style.cssText = `flex: 1; display: flex; overflow: hidden;`;

		// Left Pane
		const leftPane = DOM.append(content, DOM.$('.godot-left-pane'));
		leftPane.style.cssText = `
			flex: 1; display: flex; flex-direction: column; 
			border-right: 1px solid var(--vscode-panel-border);
		`;

		// Search Bar
		const searchWrapper = DOM.append(leftPane, DOM.$('.godot-search-wrapper'));
		searchWrapper.style.cssText = `
			padding: 10px; 
			border-bottom: 1px solid var(--vscode-panel-border);
		`;
		
		this.searchInput = DOM.append(searchWrapper, DOM.$('input')) as HTMLInputElement;
		this.searchInput.placeholder = 'Search nodes...';
		this.searchInput.style.cssText = `
			width: 100%; box-sizing: border-box;
			background: #262626;
			border: 1px solid #343434;
			color: #e7e7e7;
			padding: 9px 12px; border-radius: 14px; outline: none;
			font-size: 12px; transition: border-color 0.15s ease;
		`;
		
		this._register(DOM.addDisposableListener(this.searchInput, DOM.EventType.FOCUS, () => {
			this.searchInput!.style.borderColor = 'var(--vscode-focusBorder)';
		}));
		this._register(DOM.addDisposableListener(this.searchInput, DOM.EventType.BLUR, () => {
			this.searchInput!.style.borderColor = 'var(--vscode-input-border)';
		}));
		this._register(DOM.addDisposableListener(this.searchInput, DOM.EventType.INPUT, () => {
			this.updateTree(this.searchInput!.value);
		}));

		// Tree List
		this.treeContainer = DOM.append(leftPane, DOM.$('.godot-tree-list'));
		this.treeContainer.style.cssText = `
			flex: 1; overflow-y: auto; padding: 6px;
		`;
		
		// Scrollbar styling for tree
		const treeStyle = document.createElement('style');
		treeStyle.textContent = `
			.godot-tree-list::-webkit-scrollbar {
				width: 10px;
			}
			.godot-tree-list::-webkit-scrollbar-track {
				background: var(--vscode-scrollbarSlider-background);
				border-radius: 5px;
			}
			.godot-tree-list::-webkit-scrollbar-thumb {
				background: var(--vscode-scrollbarSlider-hoverBackground);
				border-radius: 5px;
			}
			.godot-tree-list::-webkit-scrollbar-thumb:hover {
				background: var(--vscode-scrollbarSlider-activeBackground);
			}
		`;
		document.head.appendChild(treeStyle);

		// Right Pane - Description
		this.descContainer = DOM.append(content, DOM.$('.godot-desc-pane'));
		this.descContainer.style.cssText = `
			width: 260px; padding: 16px; 
			background: var(--vscode-sideBar-background);
			font-size: 12px; line-height: 1.6; 
			color: var(--vscode-foreground);
			overflow-y: auto;
		`;
		
		// Scrollbar styling for description
		const descStyle = document.createElement('style');
		descStyle.textContent = `
			.godot-desc-pane::-webkit-scrollbar {
				width: 10px;
			}
			.godot-desc-pane::-webkit-scrollbar-track {
				background: var(--vscode-scrollbarSlider-background);
				border-radius: 5px;
			}
			.godot-desc-pane::-webkit-scrollbar-thumb {
				background: var(--vscode-scrollbarSlider-hoverBackground);
				border-radius: 5px;
			}
			.godot-desc-pane::-webkit-scrollbar-thumb:hover {
				background: var(--vscode-scrollbarSlider-activeBackground);
			}
		`;
		document.head.appendChild(descStyle);

		// Footer
		const footer = DOM.append(window, DOM.$('.godot-dialog-footer'));
		footer.style.cssText = `
			padding: 12px 16px; display: flex; justify-content: flex-end; gap: 8px; 
			border-top: 1px solid var(--vscode-panel-border);
		`;

		const createBtn = this.createButton(footer, 'Create', true);
		const cancelBtn = this.createButton(footer, 'Cancel', false);

		this._register(DOM.addDisposableListener(createBtn, DOM.EventType.CLICK, () => {
			this.confirmSelection();
		}));
		this._register(DOM.addDisposableListener(cancelBtn, DOM.EventType.CLICK, () => {
			this.hide();
		}));

		// Keyboard shortcuts
		this._register(DOM.addDisposableListener(this.searchInput, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.confirmSelection();
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				this.hide();
			}
		}));

		// Initial render
		this.updateTree('');
		setTimeout(() => this.searchInput?.focus(), 50);
	}

	private createButton(parent: HTMLElement, text: string, primary: boolean): HTMLElement {
		const btn = DOM.append(parent, DOM.$('button'));
		btn.textContent = text;
		btn.style.cssText = `
			padding: 6px 20px; 
			border: 1px solid var(--vscode-button-border);
			border-radius: 3px;
			background: ${primary ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)'};
			color: ${primary ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)'};
			cursor: pointer; font-size: 12px; 
			transition: all 0.15s ease; outline: none;
			font-weight: 500;
		`;
		
		this._register(DOM.addDisposableListener(btn, DOM.EventType.MOUSE_ENTER, () => {
			btn.style.background = primary 
				? 'var(--vscode-button-hoverBackground)' 
				: 'var(--vscode-button-secondaryHoverBackground)';
		}));
		this._register(DOM.addDisposableListener(btn, DOM.EventType.MOUSE_LEAVE, () => {
			btn.style.background = primary 
				? 'var(--vscode-button-background)' 
				: 'var(--vscode-button-secondaryBackground)';
		}));
		
		return btn;
	}

	private updateTree(query: string): void {
		if (!this.treeContainer) return;
		DOM.clearNode(this.treeContainer);
		
		const q = query.toLowerCase();
		const filtered = NODES.filter(n => 
			n.name.toLowerCase().includes(q) || 
			n.baseClass.toLowerCase().includes(q) ||
			n.category.toLowerCase().includes(q)
		);

		// Group by category
		const categories = new Map<string, ObjectDefinition[]>();
		for (const node of filtered) {
			if (!categories.has(node.category)) {
				categories.set(node.category, []);
			}
			categories.get(node.category)!.push(node);
		}

		// Render categories
		for (const [category, nodes] of categories) {
			// Category header
			const catHeader = DOM.append(this.treeContainer, DOM.$('.category-header'));
			catHeader.textContent = category;
			catHeader.style.cssText = `
				padding: 6px 10px 4px; font-size: 10px; 
				font-weight: 600; color: var(--vscode-descriptionForeground);
				text-transform: uppercase; letter-spacing: 0.5px;
				margin-top: 8px;
			`;

			// Nodes in category
			for (const node of nodes) {
				this.renderNodeItem(node, query);
			}
		}

		// Auto-select first if none selected
		if (filtered.length > 0 && !this.selectedId) {
			this.selectItem(filtered[0].id);
		}
	}

	private renderNodeItem(node: ObjectDefinition, query: string): void {
		const el = DOM.append(this.treeContainer!, DOM.$('.godot-tree-item'));
		el.style.cssText = `
			padding: 5px 10px; cursor: pointer; display: flex; align-items: center; gap: 8px;
			border-radius: 3px; color: var(--vscode-foreground);
			transition: background 0.1s ease; margin: 1px 4px;
			font-size: 12px;
		`;
		
		if (node.id === this.selectedId) {
			el.style.background = 'var(--vscode-list-activeSelectionBackground)';
			el.style.color = 'var(--vscode-list-activeSelectionForeground)';
		}
		
		this._register(DOM.addDisposableListener(el, DOM.EventType.MOUSE_ENTER, () => {
			if (node.id !== this.selectedId) {
				el.style.background = 'var(--vscode-list-hoverBackground)';
			}
		}));
		this._register(DOM.addDisposableListener(el, DOM.EventType.MOUSE_LEAVE, () => {
			if (node.id !== this.selectedId) {
				el.style.background = 'transparent';
			}
		}));

		// Icon
		const icon = DOM.append(el, DOM.$(`.${node.icon}`));
		icon.style.cssText = 'font-size: 14px; opacity: 0.9;';

		// Label
		const label = DOM.append(el, DOM.$('span'));
		label.textContent = node.name;
		label.style.fontWeight = '400';

		this._register(DOM.addDisposableListener(el, DOM.EventType.CLICK, () => {
			this.selectItem(node.id);
			this.updateTree(query);
		}));

		this._register(DOM.addDisposableListener(el, DOM.EventType.DBLCLICK, () => {
			this.confirmSelection();
		}));
	}

	private selectItem(id: string): void {
		this.selectedId = id;
		const def = NODES.find(n => n.id === id);
		
		if (def && this.descContainer) {
			DOM.clearNode(this.descContainer);

			// Title
			const title = DOM.append(this.descContainer, DOM.$('div'));
			title.textContent = def.name;
			title.style.cssText = `
				font-weight: 600; font-size: 15px; margin-bottom: 8px; 
				color: var(--vscode-foreground);
			`;

			// Base class
			const meta = DOM.append(this.descContainer, DOM.$('div'));
			meta.textContent = `Inherits: ${def.baseClass}`;
			meta.style.cssText = `
				color: var(--vscode-descriptionForeground);
				font-family: var(--vscode-editor-font-family);
				font-size: 11px; margin-bottom: 12px;
			`;

			// Description
			const desc = DOM.append(this.descContainer, DOM.$('div'));
			desc.textContent = def.description;
			desc.style.cssText = `
				color: var(--vscode-descriptionForeground);
				line-height: 1.6;
			`;
		}
	}

	private confirmSelection(): void {
		if (this.selectedId && this.onSelectCallback) {
			const def = NODES.find(n => n.id === this.selectedId);
			if (def) {
				this.onSelectCallback(def);
			}
		}
		this.hide();
	}

	override dispose(): void {
		this.hide();
		super.dispose();
	}
}

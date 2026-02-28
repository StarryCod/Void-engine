/*---------------------------------------------------------------------------------------------
 *  Void Engine — Scene Tree Panel (Godot-style)
 *  Left panel showing scene hierarchy with icons and context menu
 *  Design: Godot 4.x style with orange accents
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import * as DOM from '../../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Entity, Component } from '../../common/vecnTypes.js';

// ============================================================================
// DESIGN SYSTEM COLORS
// ============================================================================

const COLORS = {
	// Panel background
	panelBg: '#1e1e1e',
	panelBgLighter: '#252526',
	panelBgHover: '#2a2d2e',
	panelBgSelected: '#094771',
	
	// Text
	textPrimary: '#cccccc',
	textSecondary: '#858585',
	textDisabled: '#5a5a5a',
	
	// Accents (Orange AI-IDE style)
	accent: '#E67E22',
	accentHover: '#F39C12',
	accentDark: '#D35400',
	
	// Selection (Blue Godot style)
	selection: '#3498DB',
	selectionHover: '#5DADE2',
	
	// Node type colors (for icons)
	node2D: '#478cbf',
	sprite2D: '#8EE486',
	collision2D: '#5FBF5F',
	rigidBody2D: '#7E9FC9',
	characterBody2D: '#6B9BD1',
	area2D: '#7EC8E3',
	audio: '#B589B5',
	animation: '#E8A858',
	camera: '#85C1E9',
	light: '#F4D03F',
	mesh: '#D4883F',
	unknown: '#808080'
};

// ============================================================================
// NODE TYPE ICONS (SVG)
// ============================================================================

const NODE_ICONS: Record<string, string> = {
	Node2D: `<svg viewBox="0 0 16 16" fill="${COLORS.node2D}"><circle cx="8" cy="8" r="6"/></svg>`,
	Sprite2D: `<svg viewBox="0 0 16 16" fill="${COLORS.sprite2D}"><rect x="2" y="2" width="12" height="12" rx="1"/></svg>`,
	AnimatedSprite2D: `<svg viewBox="0 0 16 16" fill="${COLORS.sprite2D}"><rect x="2" y="2" width="12" height="12" rx="1"/><rect x="4" y="4" width="3" height="3" fill="${COLORS.panelBg}"/><rect x="9" y="4" width="3" height="3" fill="${COLORS.panelBg}"/></svg>`,
	CollisionShape2D: `<svg viewBox="0 0 16 16" fill="${COLORS.collision2D}"><polygon points="8,2 14,8 8,14 2,8"/></svg>`,
	RigidBody2D: `<svg viewBox="0 0 16 16" fill="${COLORS.rigidBody2D}"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2" fill="${COLORS.panelBg}"/></svg>`,
	CharacterBody2D: `<svg viewBox="0 0 16 16" fill="${COLORS.characterBody2D}"><circle cx="8" cy="5" r="3"/><rect x="5" y="9" width="6" height="5" rx="1"/></svg>`,
	Area2D: `<svg viewBox="0 0 16 16" fill="${COLORS.area2D}"><rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="${COLORS.area2D}" stroke-width="2"/></svg>`,
	AudioStreamPlayer: `<svg viewBox="0 0 16 16" fill="${COLORS.audio}"><polygon points="4,4 4,12 8,10 8,6"/><path d="M10,5 Q13,8 10,11" fill="none" stroke="${COLORS.audio}" stroke-width="1.5"/></svg>`,
	AudioStreamPlayer2D: `<svg viewBox="0 0 16 16" fill="${COLORS.audio}"><polygon points="4,4 4,12 8,10 8,6"/><path d="M10,5 Q13,8 10,11" fill="none" stroke="${COLORS.audio}" stroke-width="1.5"/></svg>`,
	AnimationPlayer: `<svg viewBox="0 0 16 16" fill="${COLORS.animation}"><rect x="2" y="4" width="12" height="8" rx="1"/><polygon points="6,6 6,10 10,8" fill="${COLORS.panelBg}"/></svg>`,
	Camera2D: `<svg viewBox="0 0 16 16" fill="${COLORS.camera}"><rect x="2" y="5" width="9" height="6" rx="1"/><polygon points="11,6 14,4 14,12 11,10"/></svg>`,
	PointLight2D: `<svg viewBox="0 0 16 16" fill="${COLORS.light}"><circle cx="8" cy="8" r="4"/><line x1="8" y1="1" x2="8" y2="3" stroke="${COLORS.light}" stroke-width="1.5"/><line x1="8" y1="13" x2="8" y2="15" stroke="${COLORS.light}" stroke-width="1.5"/><line x1="1" y1="8" x2="3" y2="8" stroke="${COLORS.light}" stroke-width="1.5"/><line x1="13" y1="8" x2="15" y2="8" stroke="${COLORS.light}" stroke-width="1.5"/></svg>`,
	MeshInstance2D: `<svg viewBox="0 0 16 16" fill="${COLORS.mesh}"><rect x="3" y="3" width="10" height="10"/><line x1="3" y1="3" x2="13" y2="13" stroke="${COLORS.panelBg}" stroke-width="1"/><line x1="13" y1="3" x2="3" y2="13" stroke="${COLORS.panelBg}" stroke-width="1"/></svg>`,
	default: `<svg viewBox="0 0 16 16" fill="${COLORS.unknown}"><circle cx="8" cy="8" r="5"/></svg>`
};

// ============================================================================
// TREE NODE
// ============================================================================

interface TreeNode {
	id: string;
	name: string;
	type: string;
	visible: boolean;
	locked: boolean;
	children: TreeNode[];
	expanded: boolean;
	entity?: Entity;
}

// ============================================================================
// SCENE TREE PANEL
// ============================================================================

export class SceneTreePanel extends Disposable {
	private container: HTMLElement;
	private header: HTMLElement;
	private searchContainer: HTMLElement;
	private searchInput: HTMLInputElement;
	private treeContainer: HTMLElement;
	private root: TreeNode | null = null;
	private selectedId: string | null = null;
	
	// Events
	private readonly _onNodeSelected = new Emitter<string | null>();
	readonly onNodeSelected: Event<string | null> = this._onNodeSelected.event;
	
	private readonly _onNodeDoubleClicked = new Emitter<string>();
	readonly onNodeDoubleClicked: Event<string> = this._onNodeDoubleClicked.event;
	
	private readonly _onNodeVisibilityChanged = new Emitter<{ id: string; visible: boolean }>();
	readonly onNodeVisibilityChanged: Event<{ id: string; visible: boolean }> = this._onNodeVisibilityChanged.event;
	
	constructor(parent: HTMLElement) {
		super();
		
		// Main container
		this.container = document.createElement('div');
		this.container.className = 'void-scene-tree-panel';
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
		
		// Header
		this.header = document.createElement('div');
		this.header.className = 'void-panel-header';
		this.header.style.cssText = `
			display: flex;
			align-items: center;
			padding: 8px 10px;
			background: ${COLORS.panelBgLighter};
			border-bottom: 1px solid #3c3c3c;
			font-weight: 500;
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: ${COLORS.textSecondary};
		`;
		this.header.textContent = 'Сцена';
		this.container.appendChild(this.header);
		
		// Search bar
		this.searchContainer = document.createElement('div');
		this.searchContainer.style.cssText = `
			display: flex;
			align-items: center;
			padding: 6px 10px;
			background: ${COLORS.panelBgLighter};
			border-bottom: 1px solid #3c3c3c;
		`;
		
		this.searchInput = document.createElement('input');
		this.searchInput.type = 'text';
		this.searchInput.placeholder = 'Фильтр: имя, тип:';
		this.searchInput.style.cssText = `
			flex: 1;
			padding: 4px 8px;
			background: ${COLORS.panelBg};
			border: 1px solid #3c3c3c;
			border-radius: 2px;
			color: ${COLORS.textPrimary};
			font-size: 11px;
			outline: none;
		`;
		this.searchInput.addEventListener('focus', () => {
			this.searchInput.style.borderColor = COLORS.accent;
		});
		this.searchInput.addEventListener('blur', () => {
			this.searchInput.style.borderColor = '#3c3c3c';
		});
		this.searchInput.addEventListener('input', () => {
			this.filterTree(this.searchInput.value);
		});
		
		this.searchContainer.appendChild(this.searchInput);
		this.container.appendChild(this.searchContainer);
		
		// Tree container
		this.treeContainer = document.createElement('div');
		this.treeContainer.className = 'void-tree-container';
		this.treeContainer.style.cssText = `
			flex: 1;
			overflow-y: auto;
			overflow-x: hidden;
		`;
		this.container.appendChild(this.treeContainer);
		
		// Add toolbar buttons
		this.addToolbarButtons();
		
		DOM.append(parent, this.container);
		
		// Create placeholder
		this.showPlaceholder();
	}
	
	private addToolbarButtons(): void {
		// Buttons container (after header)
		const buttonsContainer = document.createElement('div');
		buttonsContainer.style.cssText = `
			display: flex;
			gap: 4px;
			margin-left: auto;
		`;
		
		// Add node button
		const addBtn = this.createIconButton('+', 'Добавить узел');
		addBtn.addEventListener('click', () => {
			this.showAddNodeMenu();
		});
		buttonsContainer.appendChild(addBtn);
		
		this.header.appendChild(buttonsContainer);
	}
	
	private createIconButton(icon: string, tooltip: string): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.innerHTML = icon;
		btn.title = tooltip;
		btn.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			height: 20px;
			background: transparent;
			border: none;
			border-radius: 2px;
			color: ${COLORS.textSecondary};
			cursor: pointer;
			font-size: 14px;
			font-weight: bold;
		`;
		btn.addEventListener('mouseenter', () => {
			btn.style.background = COLORS.panelBgHover;
			btn.style.color = COLORS.textPrimary;
		});
		btn.addEventListener('mouseleave', () => {
			btn.style.background = 'transparent';
			btn.style.color = COLORS.textSecondary;
		});
		return btn;
	}
	
	private showPlaceholder(): void {
		this.treeContainer.innerHTML = '';
		
		const placeholder = document.createElement('div');
		placeholder.style.cssText = `
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 40px 20px;
			color: ${COLORS.textSecondary};
			text-align: center;
		`;
		placeholder.innerHTML = `
			<div style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;">📁</div>
			<div style="margin-bottom: 8px;">Нет открытой сцены</div>
			<div style="font-size: 11px; color: ${COLORS.textDisabled};">Откройте файл .vecn или создайте новую сцену</div>
		`;
		this.treeContainer.appendChild(placeholder);
	}
	
	public loadScene(entities: Entity[]): void {
		this.root = this.buildTree(entities);
		this.renderTree();
	}
	
	private buildTree(entities: Entity[]): TreeNode {
		const root: TreeNode = {
			id: 'root',
			name: 'Root',
			type: 'Root',
			visible: true,
			locked: false,
			children: [],
			expanded: true
		};
		
		const convertEntity = (entity: Entity): TreeNode => {
			const nodeType = this.getNodeType(entity);
			return {
				id: entity.id,
				name: entity.name,
				type: nodeType,
				visible: entity.visible,
				locked: false,
				children: entity.children.map(convertEntity),
				expanded: true,
				entity
			};
		};
		
		root.children = entities.map(convertEntity);
		return root;
	}
	
	private getNodeType(entity: Entity): string {
		for (const comp of entity.components) {
			if (comp.type.startsWith('Sprite') || comp.type.startsWith('AnimatedSprite')) {
				return comp.type;
			}
			if (comp.type.includes('Collision') || comp.type.includes('Body') || comp.type.includes('Area')) {
				return comp.type;
			}
			if (comp.type.includes('Camera')) return comp.type;
			if (comp.type.includes('Light')) return comp.type;
			if (comp.type.includes('Audio')) return comp.type;
			if (comp.type.includes('Animation')) return comp.type;
		}
		return 'Node2D';
	}
	
	private renderTree(): void {
		this.treeContainer.innerHTML = '';
		if (!this.root) return;
		
		for (const child of this.root.children) {
			this.renderNode(child, this.treeContainer, 0);
		}
	}
	
	private renderNode(node: TreeNode, parent: HTMLElement, depth: number): void {
		const nodeEl = document.createElement('div');
		nodeEl.className = 'void-tree-node';
		nodeEl.dataset.id = node.id;
		nodeEl.style.cssText = `
			display: flex;
			align-items: center;
			padding: 3px 4px;
			padding-left: ${depth * 16 + 4}px;
			cursor: pointer;
			user-select: none;
		`;
		
		// Background for selection
		const bgEl = document.createElement('div');
		bgEl.className = 'void-node-bg';
		bgEl.style.cssText = `
			position: absolute;
			left: 0;
			right: 0;
			top: 0;
			bottom: 0;
			pointer-events: none;
		`;
		nodeEl.style.position = 'relative';
		nodeEl.insertBefore(bgEl, nodeEl.firstChild);
		
		// Expand/collapse button
		if (node.children.length > 0) {
			const expandBtn = document.createElement('div');
			expandBtn.style.cssText = `
				width: 16px;
				height: 16px;
				display: flex;
				align-items: center;
				justify-content: center;
				color: ${COLORS.textSecondary};
				font-size: 10px;
				transform: rotate(${node.expanded ? '90deg' : '0deg'});
				transition: transform 0.1s;
			`;
			expandBtn.textContent = '▶';
			expandBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				node.expanded = !node.expanded;
				this.renderTree();
			});
			nodeEl.appendChild(expandBtn);
		} else {
			// Spacer
			const spacer = document.createElement('div');
			spacer.style.cssText = `width: 16px; height: 16px;`;
			nodeEl.appendChild(spacer);
		}
		
		// Icon
		const iconEl = document.createElement('div');
		iconEl.className = 'void-node-icon';
		iconEl.style.cssText = `
			width: 16px;
			height: 16px;
			margin-right: 4px;
			display: flex;
			align-items: center;
			justify-content: center;
		`;
		iconEl.innerHTML = NODE_ICONS[node.type] || NODE_ICONS.default;
		nodeEl.appendChild(iconEl);
		
		// Name
		const nameEl = document.createElement('div');
		nameEl.className = 'void-node-name';
		nameEl.style.cssText = `
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`;
		nameEl.textContent = node.name;
		if (!node.visible) {
			nameEl.style.opacity = '0.5';
		}
		nodeEl.appendChild(nameEl);
		
		// Visibility toggle
		const visBtn = document.createElement('div');
		visBtn.style.cssText = `
			width: 16px;
			height: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
			color: ${node.visible ? COLORS.textSecondary : COLORS.textDisabled};
			font-size: 12px;
			opacity: 0;
			transition: opacity 0.15s;
		`;
		visBtn.textContent = node.visible ? '👁' : '👁‍🗨';
		visBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			node.visible = !node.visible;
			this._onNodeVisibilityChanged.fire({ id: node.id, visible: node.visible });
			this.renderTree();
		});
		nodeEl.appendChild(visBtn);
		
		// Hover effects
		nodeEl.addEventListener('mouseenter', () => {
			bgEl.style.background = COLORS.panelBgHover;
			visBtn.style.opacity = '1';
		});
		nodeEl.addEventListener('mouseleave', () => {
			if (node.id !== this.selectedId) {
				bgEl.style.background = 'transparent';
			}
			if (node.id !== this.selectedId) {
				visBtn.style.opacity = '0';
			}
		});
		
		// Selection
		nodeEl.addEventListener('click', () => {
			this.selectNode(node.id);
		});
		
		// Double-click (focus in viewport)
		nodeEl.addEventListener('dblclick', () => {
			this._onNodeDoubleClicked.fire(node.id);
		});
		
		// Apply selection state
		if (node.id === this.selectedId) {
			bgEl.style.background = COLORS.panelBgSelected;
			visBtn.style.opacity = '1';
		}
		
		parent.appendChild(nodeEl);
		
		// Render children
		if (node.expanded && node.children.length > 0) {
			const childrenContainer = document.createElement('div');
			childrenContainer.className = 'void-node-children';
			parent.appendChild(childrenContainer);
			
			for (const child of node.children) {
				this.renderNode(child, childrenContainer, depth + 1);
			}
		}
	}
	
	public selectNode(id: string | null): void {
		this.selectedId = id;
		this.renderTree();
		this._onNodeSelected.fire(id);
	}
	
	public getSelectedNode(): string | null {
		return this.selectedId;
	}
	
	private filterTree(filter: string): void {
		// TODO: Implement filtering
		console.log('Filter:', filter);
	}
	
	private showAddNodeMenu(): void {
		// TODO: Show context menu with node types
		console.log('Show add node menu');
	}
	
	public expandAll(): void {
		const expand = (node: TreeNode) => {
			node.expanded = true;
			for (const child of node.children) {
				expand(child);
			}
		};
		if (this.root) expand(this.root);
		this.renderTree();
	}
	
	public collapseAll(): void {
		const collapse = (node: TreeNode) => {
			node.expanded = false;
			for (const child of node.children) {
				collapse(child);
			}
		};
		if (this.root) collapse(this.root);
		this.renderTree();
	}
	
	override dispose(): void {
		this._onNodeSelected.dispose();
		this._onNodeDoubleClicked.dispose();
		this._onNodeVisibilityChanged.dispose();
		super.dispose();
	}
}

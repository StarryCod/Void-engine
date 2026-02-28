/*---------------------------------------------------------------------------------------------
 *  Void Engine — FileSystem Panel (Godot-style)
 *  Bottom-left panel showing project files organized by type
 *  Design: Godot 4.x style with orange accents and scene/file/script tabs
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import * as DOM from '../../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../../base/common/event.js';

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
	
	// Selection (Blue Godot style)
	selection: '#3498DB',
	
	// File type colors
	scene: '#89CFF0',      // Light blue for .vecn scenes
	script: '#85C1E9',     // Blue for scripts
	texture: '#F4D03F',    // Yellow for images
	audio: '#B589B5',      // Purple for audio
	folder: '#E8A858',     // Orange for folders
	other: '#808080'       // Gray for unknown
};

// ============================================================================
// FILE TYPE ICONS
// ============================================================================

const FILE_ICONS: Record<string, string> = {
	vecn: `<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1" fill="${COLORS.scene}"/><circle cx="8" cy="8" r="3" fill="${COLORS.panelBg}"/></svg>`,
	rs: `<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1" fill="${COLORS.script}"/><text x="8" y="11" font-size="8" text-anchor="middle" fill="${COLORS.panelBg}">Rs</text></svg>`,
	ts: `<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1" fill="#3178C6"/><text x="8" y="11" font-size="7" text-anchor="middle" fill="white">TS</text></svg>`,
	js: `<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1" fill="#F7DF1E"/><text x="8" y="11" font-size="7" text-anchor="middle" fill="black">JS</text></svg>`,
	png: `<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1" fill="${COLORS.texture}"/><rect x="4" y="4" width="4" height="4" fill="${COLORS.panelBg}"/><rect x="8" y="8" width="4" height="4" fill="${COLORS.panelBg}"/></svg>`,
	jpg: `<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1" fill="${COLORS.texture}"/><circle cx="6" cy="6" r="2" fill="${COLORS.panelBg}"/></svg>`,
	ogg: `<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1" fill="${COLORS.audio}"/><polygon points="6,4 6,12 11,8" fill="${COLORS.panelBg}"/></svg>`,
	mp3: `<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1" fill="${COLORS.audio}"/><polygon points="6,4 6,12 11,8" fill="${COLORS.panelBg}"/></svg>`,
	folder: `<svg viewBox="0 0 16 16"><path d="M2,4 L2,13 L14,13 L14,5 L8,5 L7,4 Z" fill="${COLORS.folder}"/></svg>`,
	folderOpen: `<svg viewBox="0 0 16 16"><path d="M2,4 L2,13 L14,13 L13,7 L8,7 L7,4 Z" fill="${COLORS.folder}"/><path d="M3,6 L13,6 L12,12 L4,12 Z" fill="${COLORS.panelBgLighter}"/></svg>`,
	default: `<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1" fill="${COLORS.other}"/></svg>`
};

// ============================================================================
// FILE TREE NODE
// ============================================================================

interface FileNode {
	name: string;
	path: string;
	type: 'folder' | 'file';
	extension?: string;
	children: FileNode[];
	expanded: boolean;
}

// ============================================================================
// TAB TYPE
// ============================================================================

type FileSystemTab = 'scenes' | 'files' | 'scripts';

// ============================================================================
// FILESYSTEM PANEL
// ============================================================================

export class FileSystemPanel extends Disposable {
	private container: HTMLElement;
	private header: HTMLElement;
	private tabsContainer: HTMLElement;
	private searchContainer: HTMLElement;
	private searchInput: HTMLInputElement;
	private treeContainer: HTMLElement;
	private breadcrumbContainer: HTMLElement;
	private root: FileNode | null = null;
	private selectedPath: string | null = null;
	private currentTab: FileSystemTab = 'scenes';
	
	// Events
	private readonly _onFileSelected = new Emitter<string | null>();
	readonly onFileSelected: Event<string | null> = this._onFileSelected.event;
	
	private readonly _onFileDoubleClicked = new Emitter<string>();
	readonly onFileDoubleClicked: Event<string> = this._onFileDoubleClicked.event;
	
	constructor(parent: HTMLElement) {
		super();
		
		// Main container
		this.container = document.createElement('div');
		this.container.className = 'void-filesystem-panel';
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
		
		// Header with tabs
		this.header = document.createElement('div');
		this.header.style.cssText = `
			display: flex;
			flex-direction: column;
			background: ${COLORS.panelBgLighter};
			border-bottom: 1px solid #3c3c3c;
		`;
		
		// Tabs
		this.tabsContainer = document.createElement('div');
		this.tabsContainer.style.cssText = `
			display: flex;
			border-bottom: 1px solid #3c3c3c;
		`;
		
		this.createTabs();
		this.header.appendChild(this.tabsContainer);
		
		// Search bar
		this.searchContainer = document.createElement('div');
		this.searchContainer.style.cssText = `
			display: flex;
			align-items: center;
			padding: 6px 10px;
			background: ${COLORS.panelBgLighter};
		`;
		
		this.searchInput = document.createElement('input');
		this.searchInput.type = 'text';
		this.searchInput.placeholder = 'Фильтр файлов';
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
		
		this.searchContainer.appendChild(this.searchInput);
		this.header.appendChild(this.searchContainer);
		
		// Breadcrumb
		this.breadcrumbContainer = document.createElement('div');
		this.breadcrumbContainer.style.cssText = `
			display: flex;
			align-items: center;
			padding: 4px 10px;
			background: ${COLORS.panelBgLighter};
			border-bottom: 1px solid #3c3c3c;
			font-size: 11px;
			color: ${COLORS.textSecondary};
		`;
		this.breadcrumbContainer.textContent = 'res://';
		this.header.appendChild(this.breadcrumbContainer);
		
		this.container.appendChild(this.header);
		
		// Tree container
		this.treeContainer = document.createElement('div');
		this.treeContainer.className = 'void-file-tree-container';
		this.treeContainer.style.cssText = `
			flex: 1;
			overflow-y: auto;
			overflow-x: hidden;
		`;
		this.container.appendChild(this.treeContainer);
		
		DOM.append(parent, this.container);
		
		// Show placeholder
		this.showPlaceholder();
	}
	
	private createTabs(): void {
		const tabs: { id: FileSystemTab; label: string; icon: string }[] = [
			{ id: 'scenes', label: 'Сцены', icon: '🎬' },
			{ id: 'files', label: 'Файлы', icon: '📁' },
			{ id: 'scripts', label: 'Скрипты', icon: '📜' }
		];
		
		for (const tab of tabs) {
			const tabEl = document.createElement('div');
			tabEl.className = 'void-fs-tab';
			tabEl.dataset.tab = tab.id;
			tabEl.style.cssText = `
				flex: 1;
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 8px 12px;
				cursor: pointer;
				color: ${this.currentTab === tab.id ? COLORS.accent : COLORS.textSecondary};
				border-bottom: 2px solid ${this.currentTab === tab.id ? COLORS.accent : 'transparent'};
				transition: all 0.15s;
				font-size: 11px;
				font-weight: 500;
			`;
			
			tabEl.innerHTML = `<span style="margin-right: 4px;">${tab.icon}</span>${tab.label}`;
			
			tabEl.addEventListener('click', () => {
				this.switchTab(tab.id);
			});
			
			tabEl.addEventListener('mouseenter', () => {
				if (this.currentTab !== tab.id) {
					tabEl.style.color = COLORS.textPrimary;
				}
			});
			tabEl.addEventListener('mouseleave', () => {
				if (this.currentTab !== tab.id) {
					tabEl.style.color = COLORS.textSecondary;
				}
			});
			
			this.tabsContainer.appendChild(tabEl);
		}
	}
	
	private switchTab(tab: FileSystemTab): void {
		this.currentTab = tab;
		
		// Update tab styles
		const tabs = this.tabsContainer.querySelectorAll('.void-fs-tab');
		tabs.forEach(el => {
			const tabId = (el as HTMLElement).dataset.tab as FileSystemTab;
			(el as HTMLElement).style.color = tabId === tab ? COLORS.accent : COLORS.textSecondary;
			(el as HTMLElement).style.borderBottomColor = tabId === tab ? COLORS.accent : 'transparent';
		});
		
		// Re-render tree with filter
		this.renderTree();
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
		
		const icons: Record<FileSystemTab, string> = {
			scenes: '🎬',
			files: '📁',
			scripts: '📜'
		};
		
		const messages: Record<FileSystemTab, { title: string; subtitle: string }> = {
			scenes: { title: 'Нет сцен', subtitle: 'Создайте новую сцену (.vecn)' },
			files: { title: 'Нет файлов', subtitle: 'Добавьте файлы в проект' },
			scripts: { title: 'Нет скриптов', subtitle: 'Создайте Rust или TypeScript файл' }
		};
		
		const msg = messages[this.currentTab];
		placeholder.innerHTML = `
			<div style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;">${icons[this.currentTab]}</div>
			<div style="margin-bottom: 8px;">${msg.title}</div>
			<div style="font-size: 11px; color: ${COLORS.textDisabled};">${msg.subtitle}</div>
		`;
		this.treeContainer.appendChild(placeholder);
	}
	
	public loadProject(structure: FileNode): void {
		this.root = structure;
		this.renderTree();
	}
	
	private renderTree(): void {
		this.treeContainer.innerHTML = '';
		if (!this.root) {
			this.showPlaceholder();
			return;
		}
		
		this.renderNode(this.root, this.treeContainer, 0);
	}
	
	private renderNode(node: FileNode, parent: HTMLElement, depth: number): void {
		// Filter by current tab
		if (!this.shouldShowNode(node)) return;
		
		const nodeEl = document.createElement('div');
		nodeEl.className = 'void-file-node';
		nodeEl.dataset.path = node.path;
		nodeEl.style.cssText = `
			display: flex;
			align-items: center;
			padding: 3px 4px;
			padding-left: ${depth * 16 + 4}px;
			cursor: pointer;
			user-select: none;
			position: relative;
		`;
		
		// Background
		const bgEl = document.createElement('div');
		bgEl.style.cssText = `
			position: absolute;
			left: 0;
			right: 0;
			top: 0;
			bottom: 0;
			pointer-events: none;
		`;
		nodeEl.insertBefore(bgEl, nodeEl.firstChild);
		
		// Expand/collapse
		if (node.type === 'folder' && node.children.length > 0) {
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
			const spacer = document.createElement('div');
			spacer.style.cssText = `width: 16px; height: 16px;`;
			nodeEl.appendChild(spacer);
		}
		
		// Icon
		const iconEl = document.createElement('div');
		iconEl.style.cssText = `
			width: 16px;
			height: 16px;
			margin-right: 4px;
			display: flex;
			align-items: center;
			justify-content: center;
		`;
		
		if (node.type === 'folder') {
			iconEl.innerHTML = node.expanded ? FILE_ICONS.folderOpen : FILE_ICONS.folder;
		} else {
			iconEl.innerHTML = FILE_ICONS[node.extension || ''] || FILE_ICONS.default;
		}
		nodeEl.appendChild(iconEl);
		
		// Name
		const nameEl = document.createElement('div');
		nameEl.style.cssText = `
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`;
		nameEl.textContent = node.name;
		nodeEl.appendChild(nameEl);
		
		// Events
		nodeEl.addEventListener('mouseenter', () => {
			bgEl.style.background = COLORS.panelBgHover;
		});
		nodeEl.addEventListener('mouseleave', () => {
			if (node.path !== this.selectedPath) {
				bgEl.style.background = 'transparent';
			}
		});
		
		nodeEl.addEventListener('click', () => {
			this.selectFile(node.path);
		});
		
		nodeEl.addEventListener('dblclick', () => {
			this._onFileDoubleClicked.fire(node.path);
		});
		
		// Selection state
		if (node.path === this.selectedPath) {
			bgEl.style.background = COLORS.panelBgSelected;
		}
		
		parent.appendChild(nodeEl);
		
		// Render children
		if (node.type === 'folder' && node.expanded) {
			for (const child of node.children) {
				this.renderNode(child, parent, depth + 1);
			}
		}
	}
	
	private shouldShowNode(node: FileNode): boolean {
		switch (this.currentTab) {
			case 'scenes':
				if (node.type === 'folder') return true;
				return node.extension === 'vecn';
			case 'scripts':
				if (node.type === 'folder') return true;
				return node.extension === 'rs' || node.extension === 'ts' || node.extension === 'js';
			case 'files':
			default:
				return true;
		}
	}
	
	public selectFile(path: string | null): void {
		this.selectedPath = path;
		this.renderTree();
		this._onFileSelected.fire(path);
	}
	
	public getCurrentTab(): FileSystemTab {
		return this.currentTab;
	}
	
	public setBreadcrumb(path: string): void {
		this.breadcrumbContainer.textContent = `res://${path}`;
	}
	
	override dispose(): void {
		this._onFileSelected.dispose();
		this._onFileDoubleClicked.dispose();
		super.dispose();
	}
}

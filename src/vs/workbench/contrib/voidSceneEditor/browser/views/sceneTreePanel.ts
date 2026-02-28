/*---------------------------------------------------------------------------------------------
 *  Void Engine — Scene Tree Panel (Godot-style)
 *  Left panel showing scene hierarchy with icons and context menu
 *  Design: Godot 4.x style with orange accents
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import * as DOM from '../../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Entity } from '../../common/vecnTypes.js';

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
// NODE TYPE ICONS (CSP-safe SVG creation)
// ============================================================================

function createSVGElement(): SVGSVGElement {
        return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

function createSVGCircle(cx: number, cy: number, r: number, fill: string): SVGCircleElement {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(cx));
        circle.setAttribute('cy', String(cy));
        circle.setAttribute('r', String(r));
        circle.setAttribute('fill', fill);
        return circle;
}

function createSVGRect(x: number, y: number, width: number, height: number, fill: string, rx?: number): SVGRectElement {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', String(height));
        rect.setAttribute('fill', fill);
        if (rx !== undefined) rect.setAttribute('rx', String(rx));
        return rect;
}

function createNodeIcon(type: string): SVGSVGElement {
        const svg = createSVGElement();
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.style.width = '16px';
        svg.style.height = '16px';
        
        const colorMap: Record<string, string> = {
                Node2D: COLORS.node2D,
                Sprite2D: COLORS.sprite2D,
                AnimatedSprite2D: COLORS.sprite2D,
                CollisionShape2D: COLORS.collision2D,
                RigidBody2D: COLORS.rigidBody2D,
                CharacterBody2D: COLORS.characterBody2D,
                Area2D: COLORS.area2D,
                AudioStreamPlayer: COLORS.audio,
                AudioStreamPlayer2D: COLORS.audio,
                AnimationPlayer: COLORS.animation,
                Camera2D: COLORS.camera,
                PointLight2D: COLORS.light,
                MeshInstance2D: COLORS.mesh,
        };
        
        const color = colorMap[type] || COLORS.unknown;
        
        // Simple circle for most types
        svg.appendChild(createSVGCircle(8, 8, 5, color));
        
        // Special cases
        if (type === 'Sprite2D' || type === 'AnimatedSprite2D') {
                svg.textContent = '';
                svg.appendChild(createSVGRect(2, 2, 12, 12, color, 1));
        } else if (type === 'CollisionShape2D') {
                svg.textContent = '';
                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygon.setAttribute('points', '8,2 14,8 8,14 2,8');
                polygon.setAttribute('fill', color);
                svg.appendChild(polygon);
        } else if (type === 'Area2D') {
                svg.textContent = '';
                const rect = createSVGRect(2, 2, 12, 12, 'none', 2);
                rect.setAttribute('stroke', color);
                rect.setAttribute('stroke-width', '2');
                svg.appendChild(rect);
        } else if (type === 'RigidBody2D') {
                svg.textContent = '';
                svg.appendChild(createSVGCircle(8, 8, 5, color));
                svg.appendChild(createSVGCircle(8, 8, 2, COLORS.panelBg));
        }
        
        return svg;
}

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
                btn.textContent = icon;
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
                this.treeContainer.textContent = '';
                
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
                // CSP-safe placeholder creation
                const iconDiv = document.createElement('div');
                iconDiv.style.cssText = `font-size: 32px; margin-bottom: 12px; opacity: 0.5;`;
                iconDiv.textContent = '📁';
                placeholder.appendChild(iconDiv);
                
                const titleDiv = document.createElement('div');
                titleDiv.style.cssText = `margin-bottom: 8px;`;
                titleDiv.textContent = 'Нет открытой сцены';
                placeholder.appendChild(titleDiv);
                
                const subtitleDiv = document.createElement('div');
                subtitleDiv.style.cssText = `font-size: 11px; color: ${COLORS.textDisabled};`;
                subtitleDiv.textContent = 'Откройте файл .vecn или создайте новую сцену';
                placeholder.appendChild(subtitleDiv);
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
                this.treeContainer.textContent = '';
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
                iconEl.appendChild(createNodeIcon(node.type));
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

/*---------------------------------------------------------------------------------------------
 *  Scene Hierarchy View — Professional Godot-style Tree
 *  Features: Collapsible nodes, smart icons, hide gizmo objects, drag & drop
 *--------------------------------------------------------------------------------------------*/

import './sceneHierarchyView.css';
import * as DOM from '../../../../../base/browser/dom.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { ViewPane, IViewPaneOptions } from '../../../../browser/parts/views/viewPane.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { sceneBridge } from '../../../voidSceneEditor/common/voidSceneBridge.js';
import { Entity, Component } from '../../../voidSceneEditor/common/vecnTypes.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ICON DEFINITIONS — Godot-style colored icons
// ═══════════════════════════════════════════════════════════════════════════════

interface NodeIconDef {
        icon: string;       // Codicon class
        color: string;      // CSS color
        label: string;      // Tooltip
}

const NODE_ICONS: Record<string, NodeIconDef> = {
        // ── Root & Structure ──
        root:           { icon: 'codicon-symbol-file', color: '#888', label: 'Scene Root' },
        
        // ── 3D Objects ──
        mesh:           { icon: 'codicon-cube', color: '#4ec9b0', label: 'Mesh' },
        camera:         { icon: 'codicon-device-camera', color: '#60a5fa', label: 'Camera' },
        
        // ── Lights ──
        pointLight:     { icon: 'codicon-lightbulb', color: '#fcd34d', label: 'Point Light' },
        dirLight:       { icon: 'codicon-symbol-color', color: '#fbbf24', label: 'Directional Light' },
        spotLight:      { icon: 'codicon-flashlight', color: '#f97316', label: 'Spot Light' },
        
        // ── Physics ──
        rigidBody:      { icon: 'codicon-package', color: '#60a5fa', label: 'Rigid Body' },
        staticBody:     { icon: 'codicon-package', color: '#6b7280', label: 'Static Body' },
        characterBody:  { icon: 'codicon-person', color: '#38bdf8', label: 'Character Body' },
        area:           { icon: 'codicon-combined-view', color: '#22c55e', label: 'Area' },
        collision:      { icon: 'codicon-shield', color: '#22c55e', label: 'Collision Shape' },
        rayCast:        { icon: 'codicon-arrow-right', color: '#ef4444', label: 'RayCast' },
        
        // ── Audio ──
        audio:          { icon: 'codicon-unmute', color: '#a78bfa', label: 'Audio Player' },
        
        // ── Animation ──
        animation:      { icon: 'codicon-play-circle', color: '#fb923c', label: 'Animation' },
        tween:          { icon: 'codicon-graph-line', color: '#fb923c', label: 'Tween' },
        
        // ── Navigation ──
        navAgent:       { icon: 'codicon-map', color: '#22d3ee', label: 'Navigation Agent' },
        navRegion:      { icon: 'codicon-map-filled', color: '#22d3ee', label: 'Navigation Region' },
        
        // ── Particles ──
        particles:      { icon: 'codicon-sparkle', color: '#f97316', label: 'Particles' },
        
        // ── 2D ──
        sprite:         { icon: 'codicon-file-media', color: '#a78bfa', label: 'Sprite' },
        label2D:        { icon: 'codicon-tag', color: '#a78bfa', label: 'Label' },
        
        // ── Environment ──
        worldEnv:       { icon: 'codicon-globe', color: '#38bdf8', label: 'World Environment' },
        fog:            { icon: 'codicon-cloud', color: '#94a3b8', label: 'Fog Volume' },
        reflection:     { icon: 'codicon-mirror', color: '#fcd34d', label: 'Reflection Probe' },
        
        // ── Utility ──
        timer:          { icon: 'codicon-clock', color: '#6b7280', label: 'Timer' },
        marker:         { icon: 'codicon-location', color: '#fcd34d', label: 'Marker' },
        path:           { icon: 'codicon-git-branch', color: '#22d3ee', label: 'Path' },
        
        // ── Default ──
        node:           { icon: 'codicon-circle-outline', color: '#888', label: 'Node' },
};

// Components that should be hidden from tree (they're visual gizmos/helpers)
const HIDDEN_COMPONENTS = new Set([
        'Transform',        // Every entity has this - redundant
        'Transform2D',      // Same for 2D
        'Gizmo',            // Gizmo marker components
        'EditorGizmo',      // Editor-only gizmos
        'DebugDraw',        // Debug visualization
]);

// Entities that start with underscore are editor helpers
const isEditorHelper = (entity: Entity): boolean => {
        return entity.name.startsWith('_') || 
               entity.name.startsWith('__') ||
               entity.name === 'GizmoRoot' ||
               entity.name === 'EditorHelpers';
};

// ═══════════════════════════════════════════════════════════════════════════════

interface TreeNodeState {
        expanded: boolean;
}

export class SceneHierarchyView extends ViewPane {
        private treeContainer!: HTMLElement;
        private treeHeaderContainer!: HTMLElement;
        private selectedId: string | null = null;
        private draggedEntityId: string | null = null;
        private showHidden = false;  // Toggle for showing editor helpers
        private nodeStates: Map<string, TreeNodeState> = new Map();

        constructor(
                options: IViewPaneOptions,
                @IKeybindingService keybindingService: IKeybindingService,
                @IContextMenuService contextMenuService: IContextMenuService,
                @IConfigurationService configurationService: IConfigurationService,
                @IContextKeyService contextKeyService: IContextKeyService,
                @IViewDescriptorService viewDescriptorService: IViewDescriptorService,
                @IInstantiationService instantiationService: IInstantiationService,
                @IOpenerService openerService: IOpenerService,
                @IThemeService themeService: IThemeService,
                @IHoverService hoverService: IHoverService,
                @IDialogService private readonly dialogService: IDialogService
        ) {
                super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        }

        protected override renderBody(container: HTMLElement): void {
                super.renderBody(container);
                container.classList.add('scene-hierarchy-view');

                // ═══ Header with title, toggle hidden button, and add button ═══
                this.treeHeaderContainer = DOM.append(container, DOM.$('.tree-header'));
                
                const title = DOM.append(this.treeHeaderContainer, DOM.$('.tree-title'));
                title.textContent = 'SCENE';

                // Toggle hidden objects button
                const toggleHiddenBtn = DOM.append(this.treeHeaderContainer, DOM.$('.tree-action-btn.codicon.codicon-eye'));
                toggleHiddenBtn.title = 'Toggle hidden objects';
                this._register(DOM.addDisposableListener(toggleHiddenBtn, DOM.EventType.CLICK, () => {
                        this.showHidden = !this.showHidden;
                        toggleHiddenBtn.classList.toggle('active', this.showHidden);
                        this.refresh();
                }));

                // Add entity button
                const addButton = DOM.append(this.treeHeaderContainer, DOM.$('.tree-action-btn.codicon.codicon-add'));
                addButton.title = 'Add Entity';
                this._register(DOM.addDisposableListener(addButton, DOM.EventType.CLICK, () => {
                        this.showAddEntityMenu();
                }));

                // ═══ Tree container ═══
                this.treeContainer = DOM.append(container, DOM.$('.tree-content'));

                // ═══ Connect to Bridge ═══
                if (sceneBridge.hasScene()) {
                        this.setEntities(sceneBridge.getEntities());
                }

                this._register(sceneBridge.onSceneUpdated(u => {
                        if (u.source === 'viewport') return;
                        this.setEntities(u.entities);
                }));

                this._register(sceneBridge.onEntitySelected(id => {
                        this.selectedId = id;
                        this.updateSelection();
                        if (id) {
                                this.expandToEntity(id);
                        }
                }));
        }

        private setEntities(entities: Entity[]): void {
                DOM.clearNode(this.treeContainer);

                const visibleEntities = this.showHidden 
                        ? entities 
                        : entities.filter(e => !isEditorHelper(e));

                if (visibleEntities.length === 0) {
                        const empty = DOM.$('.empty-message');
                        empty.textContent = this.showHidden 
                                ? 'No entities in scene' 
                                : 'No visible entities (toggle eye to see hidden)';
                        DOM.append(this.treeContainer, empty);
                        return;
                }

                for (const entity of visibleEntities) {
                        this.renderEntity(entity, 0, this.treeContainer);
                }
        }

        private refresh(): void {
                if (sceneBridge.hasScene()) {
                        this.setEntities(sceneBridge.getEntities());
                }
        }

        // ═══════════════════════════════════════════════════════════════════════════
        // ENTITY RENDERING
        // ═══════════════════════════════════════════════════════════════════════════

        private renderEntity(entity: Entity, level: number, parent: HTMLElement): void {
                const hasChildren = entity.children.length > 0;
                const state = this.nodeStates.get(entity.id) || { expanded: true };
                
                const item = DOM.$('.tree-item');
                item.style.paddingLeft = `${8 + level * 16}px`;
                item.setAttribute('data-entity-id', entity.id);
                item.draggable = true;

                // ── Expand/collapse arrow ──
                if (hasChildren) {
                        const arrow = DOM.append(item, DOM.$('.item-arrow.codicon'));
                        arrow.classList.add(state.expanded ? 'codicon-chevron-down' : 'codicon-chevron-right');
                        if (!state.expanded) arrow.classList.add('collapsed');
                        
                        this._register(DOM.addDisposableListener(arrow, DOM.EventType.CLICK, (e) => {
                                e.stopPropagation();
                                this.toggleNode(entity.id);
                        }));
                } else {
                        DOM.append(item, DOM.$('.item-arrow-spacer'));
                }

                // ── Icon based on entity type ──
                const iconDef = this.getEntityIcon(entity);
                const icon = DOM.append(item, DOM.$('.item-icon.codicon'));
                icon.classList.add(iconDef.icon);
                icon.title = iconDef.label;

                // ── Name ──
                const name = DOM.append(item, DOM.$('.item-name'));
                name.textContent = entity.name;
                
                // Dim hidden entities
                if (!entity.visible) {
                        name.style.opacity = '0.5';
                        item.classList.add('is-hidden');
                }

                // ── Action buttons (visible on hover) ──
                const actions = DOM.append(item, DOM.$('.item-actions'));
                
                const visibilityBtn = DOM.append(actions, DOM.$('.action-btn.codicon'));
                visibilityBtn.classList.add(entity.visible ? 'codicon-eye' : 'codicon-eye-closed');
                visibilityBtn.title = entity.visible ? 'Hide' : 'Show';
                this._register(DOM.addDisposableListener(visibilityBtn, DOM.EventType.CLICK, (e) => {
                        e.stopPropagation();
                        this.toggleEntityVisibility(entity.id);
                }));

                const deleteBtn = DOM.append(actions, DOM.$('.action-btn.codicon.codicon-trash'));
                deleteBtn.title = 'Delete Entity';
                this._register(DOM.addDisposableListener(deleteBtn, DOM.EventType.CLICK, (e) => {
                        e.stopPropagation();
                        this.deleteEntity(entity.id);
                }));

                // ── Selection ──
                if (this.selectedId === entity.id) {
                        item.classList.add('selected');
                }

                // ── Drag & Drop ──
                this.setupDragDrop(item, entity);

                // ── Click to select ──
                this._register(DOM.addDisposableListener(item, DOM.EventType.CLICK, () => {
                        sceneBridge.selectEntity(entity.id);
                }));

                // ── Double-click to rename ──
                this._register(DOM.addDisposableListener(item, DOM.EventType.DBLCLICK, () => {
                        this.startRename(entity, name);
                }));

                parent.appendChild(item);

                // ── Render visible components (not hidden ones) ──
                if (state.expanded) {
                        const visibleComponents = entity.components.filter(c => !HIDDEN_COMPONENTS.has(c.type));
                        for (const component of visibleComponents) {
                                this.renderComponent(component, level + 1, parent);
                        }

                        // Render children
                        for (const child of entity.children) {
                                if (this.showHidden || !isEditorHelper(child)) {
                                        this.renderEntity(child, level + 1, parent);
                                }
                        }
                }
        }

        private renderComponent(component: Component, level: number, parent: HTMLElement): void {
                const item = DOM.$('.tree-item.component-item');
                item.style.paddingLeft = `${8 + level * 16}px`;

                DOM.append(item, DOM.$('.item-arrow-spacer'));

                const iconDef = this.getComponentIcon(component.type);
                const icon = DOM.append(item, DOM.$('.item-icon.codicon'));
                icon.classList.add(iconDef.icon);

                const name = DOM.append(item, DOM.$('.item-name'));
                name.textContent = component.type;

                parent.appendChild(item);
        }

        // ═══════════════════════════════════════════════════════════════════════════
        // ICON RESOLUTION
        // ═══════════════════════════════════════════════════════════════════════════

        private getEntityIcon(entity: Entity): NodeIconDef {
                // Check components in priority order
                if (entity.components.some(c => c.type === 'Camera')) return NODE_ICONS.camera;
                if (entity.components.some(c => c.type === 'PointLight')) return NODE_ICONS.pointLight;
                if (entity.components.some(c => c.type === 'DirectionalLight')) return NODE_ICONS.dirLight;
                if (entity.components.some(c => c.type === 'SpotLight')) return NODE_ICONS.spotLight;
                if (entity.components.some(c => c.type === 'CharacterBody')) return NODE_ICONS.characterBody;
                if (entity.components.some(c => c.type === 'RigidBody')) return NODE_ICONS.rigidBody;
                if (entity.components.some(c => c.type === 'StaticBody')) return NODE_ICONS.staticBody;
                if (entity.components.some(c => c.type === 'Area')) return NODE_ICONS.area;
                if (entity.components.some(c => c.type === 'RayCast')) return NODE_ICONS.rayCast;
                if (entity.components.some(c => c.type === 'AudioStreamPlayer' || c.type === 'AudioStreamPlayer3D')) return NODE_ICONS.audio;
                if (entity.components.some(c => c.type === 'AnimationPlayer')) return NODE_ICONS.animation;
                if (entity.components.some(c => c.type === 'NavigationAgent3D')) return NODE_ICONS.navAgent;
                if (entity.components.some(c => c.type === 'GPUParticles3D' || c.type === 'CPUParticles3D')) return NODE_ICONS.particles;
                if (entity.components.some(c => c.type === 'Sprite2D' || c.type === 'AnimatedSprite2D')) return NODE_ICONS.sprite;
                if (entity.components.some(c => c.type === 'WorldEnvironment')) return NODE_ICONS.worldEnv;
                if (entity.components.some(c => c.type === 'FogVolume')) return NODE_ICONS.fog;
                if (entity.components.some(c => c.type === 'ReflectionProbe')) return NODE_ICONS.reflection;
                if (entity.components.some(c => c.type === 'Timer')) return NODE_ICONS.timer;
                if (entity.components.some(c => c.type === 'Marker3D' || c.type === 'Marker2D')) return NODE_ICONS.marker;
                if (entity.components.some(c => c.type === 'Mesh')) return NODE_ICONS.mesh;
                if (entity.components.some(c => c.type === 'CollisionShape')) return NODE_ICONS.collision;
                
                return NODE_ICONS.node;
        }

        private getComponentIcon(type: string): NodeIconDef {
                const mapping: Record<string, keyof typeof NODE_ICONS> = {
                        'Mesh': 'mesh',
                        'Material': 'mesh',
                        'PointLight': 'pointLight',
                        'DirectionalLight': 'dirLight',
                        'SpotLight': 'spotLight',
                        'Camera': 'camera',
                        'CharacterBody': 'characterBody',
                        'RigidBody': 'rigidBody',
                        'StaticBody': 'staticBody',
                        'Area': 'area',
                        'CollisionShape': 'collision',
                        'RayCast': 'rayCast',
                        'ShapeCast': 'rayCast',
                        'AudioStreamPlayer': 'audio',
                        'AudioStreamPlayer2D': 'audio',
                        'AudioStreamPlayer3D': 'audio',
                        'AnimationPlayer': 'animation',
                        'Tween': 'tween',
                        'NavigationAgent3D': 'navAgent',
                        'NavigationAgent2D': 'navAgent',
                        'NavigationRegion3D': 'navRegion',
                        'GPUParticles3D': 'particles',
                        'CPUParticles3D': 'particles',
                        'Sprite2D': 'sprite',
                        'AnimatedSprite2D': 'sprite',
                        'WorldEnvironment': 'worldEnv',
                        'FogVolume': 'fog',
                        'ReflectionProbe': 'reflection',
                        'Timer': 'timer',
                        'Marker3D': 'marker',
                        'Marker2D': 'marker',
                };
                
                return NODE_ICONS[mapping[type]] || NODE_ICONS.node;
        }

        // ═══════════════════════════════════════════════════════════════════════════
        // TREE INTERACTIONS
        // ═══════════════════════════════════════════════════════════════════════════

        private toggleNode(entityId: string): void {
                const state = this.nodeStates.get(entityId) || { expanded: true };
                state.expanded = !state.expanded;
                this.nodeStates.set(entityId, state);
                this.refresh();
        }

        private expandToEntity(entityId: string): void {
                // Find all parents and expand them
                const entities = sceneBridge.getEntities();
                const parents = this.findParentChain(entities, entityId);
                
                for (const parentId of parents) {
                        const state = this.nodeStates.get(parentId) || { expanded: true };
                        state.expanded = true;
                        this.nodeStates.set(parentId, state);
                }
                
                if (parents.length > 0) {
                        this.refresh();
                }
        }

        private findParentChain(entities: Entity[], targetId: string, path: string[] = []): string[] {
                for (const entity of entities) {
                        if (entity.id === targetId) {
                                return path;
                        }
                        const childPath = this.findParentChain(entity.children, targetId, [...path, entity.id]);
                        if (childPath.length > 0 || entity.children.some(c => c.id === targetId)) {
                                return childPath.length > 0 ? childPath : path;
                        }
                }
                return [];
        }

        private setupDragDrop(item: HTMLElement, entity: Entity): void {
                this._register(DOM.addDisposableListener(item, DOM.EventType.DRAG_START, (e: DragEvent) => {
                        this.draggedEntityId = entity.id;
                        if (e.dataTransfer) {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', entity.id);
                        }
                        item.classList.add('dragging');
                }));

                this._register(DOM.addDisposableListener(item, DOM.EventType.DRAG_END, () => {
                        this.draggedEntityId = null;
                        item.classList.remove('dragging');
                }));

                this._register(DOM.addDisposableListener(item, DOM.EventType.DRAG_OVER, (e: DragEvent) => {
                        if (this.draggedEntityId && this.draggedEntityId !== entity.id) {
                                e.preventDefault();
                                if (e.dataTransfer) {
                                        e.dataTransfer.dropEffect = 'move';
                                }
                                item.classList.add('drag-over');
                        }
                }));

                this._register(DOM.addDisposableListener(item, DOM.EventType.DRAG_LEAVE, () => {
                        item.classList.remove('drag-over');
                }));

                this._register(DOM.addDisposableListener(item, DOM.EventType.DROP, (e: DragEvent) => {
                        e.preventDefault();
                        item.classList.remove('drag-over');
                        if (this.draggedEntityId && this.draggedEntityId !== entity.id) {
                                this.reparentEntity(this.draggedEntityId, entity.id);
                        }
                }));
        }

        private startRename(entity: Entity, nameEl: HTMLElement): void {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = entity.name;
                input.className = 'rename-input';
                
                const rect = nameEl.getBoundingClientRect();
                input.style.cssText = `
                        position: fixed;
                        left: ${rect.left}px;
                        top: ${rect.top}px;
                        width: ${rect.width + 50}px;
                        height: ${rect.height}px;
                        font: inherit;
                        background: #1e1e1e;
                        border: 1px solid #d47a4a;
                        color: #fff;
                        padding: 0 4px;
                        z-index: 10000;
                `;
                
                document.body.appendChild(input);
                input.focus();
                input.select();

                const finish = () => {
                        const newName = input.value.trim();
                        if (newName && newName !== entity.name) {
                                sceneBridge.updateEntityName(entity.id, newName);
                        }
                        input.remove();
                };

                input.onblur = finish;
                input.onkeydown = (e) => {
                        if (e.key === 'Enter') finish();
                        if (e.key === 'Escape') input.remove();
                };
        }

        // ═══════════════════════════════════════════════════════════════════════════
        // SELECTION & ACTIONS
        // ═══════════════════════════════════════════════════════════════════════════

        private updateSelection(): void {
                const items = this.treeContainer.querySelectorAll('.tree-item[data-entity-id]');
                items.forEach(item => {
                        const entityId = item.getAttribute('data-entity-id');
                        item.classList.toggle('selected', entityId === this.selectedId);
                });
        }

        private showAddEntityMenu(): void {
                import('../dialogs/addObjectDialog.js').then(({ AddObjectDialog }) => {
                        const dialog = new AddObjectDialog(this.element);
                        this._register(dialog);
                        dialog.show((def) => {
                                const newEntity = sceneBridge.createEntity(def.id);
                                if (newEntity) {
                                        sceneBridge.selectEntity(newEntity.id);
                                }
                        });
                });
        }

        private toggleEntityVisibility(entityId: string): void {
                sceneBridge.toggleEntityVisibility(entityId);
        }

        private async deleteEntity(entityId: string): Promise<void> {
                const entity = sceneBridge.findEntity(sceneBridge.getEntities(), entityId);
                if (!entity) return;

                const result = await this.dialogService.confirm({
                        message: `Delete "${entity.name}"?`,
                        detail: 'This action cannot be undone.',
                        primaryButton: 'Delete',
                        type: 'warning'
                });

                if (result.confirmed) {
                        sceneBridge.deleteEntity(entityId);
                }
        }

        private reparentEntity(draggedId: string, targetId: string): void {
                sceneBridge.reparentEntity(draggedId, targetId);
        }

        protected override layoutBody(height: number, width: number): void {
                super.layoutBody(height, width);
        }
}

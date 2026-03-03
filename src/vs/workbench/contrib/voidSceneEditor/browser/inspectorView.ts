/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// FILE: vscode/src/vs/workbench/contrib/voidSceneEditor/browser/inspectorView.ts
// FULL REPLACEMENT - Godot-Style Inspector

/*---------------------------------------------------------------------------------------------
 *  Inspector View — Godot-Style Professional UI
 *  Connected to SceneBridge as Single Source of Truth
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import * as DOM from '../../../../base/browser/dom.js';
import { Component } from '../common/vecnTypes.js';
import { sceneBridge } from '../common/voidSceneBridge.js';
import { Emitter, Event } from '../../../../base/common/event.js';

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR PALETTE - Godot-Inspired Dark Theme
// ═══════════════════════════════════════════════════════════════════════════════
const COLORS = {
        // Backgrounds
        background: '#191919',
        sectionHeader: '#202020',
        sectionBody: '#1c1c1c',
        inputBg: '#212121',
        inputFocus: '#282828',

        // Borders
        border: '#353535',
        borderLight: '#474747',
        focusBorder: '#d47a4a',

        // Text
        labelText: '#9a9a9a',
        valueText: '#dddddd',
        dimmedText: '#676767',
        hoverText: '#ffffff',

        // Component accents (warm + neutral, no blue)
        transformAccent: '#d47a4a',
        meshAccent: '#a5a072',
        materialAccent: '#b28b74',
        cameraAccent: '#8f8f8f',
        pointLightAccent: '#d6aa66',
        directionalLightAccent: '#c79658',
        spotLightAccent: '#d1a06a',
        collisionAccent: '#a07663',
        characterBodyAccent: '#9b8b7a',
        rigidBodyAccent: '#8ea06f',
        staticBodyAccent: '#8c7b6d',
        areaAccent: '#879b74',
        rayCastAccent: '#ba7f66',
        worldEnvironmentAccent: '#9a907f',
        skyAccent: '#9b9687',
        particleAccent: '#c27c5a',
        audioAccent: '#9d866f',
        audio3DAccent: '#8f7b6f',
        animationAccent: '#b87d67',
        timerAccent: '#8f8f8f',
        markerAccent: '#c8965d',

        // Axis colors
        axisX: '#d47a4a',
        axisY: '#8ea06f',
        axisZ: '#a1a1a1',

        // UI elements
        toggleOn: '#d47a4a',
        toggleOff: '#3a3a3a',
        sliderTrack: '#3a3a3a',
        sliderThumb: '#c88a67',
};

export class InspectorView extends Disposable {
        private container: HTMLElement;
        private headerEl: HTMLElement;
        private entityHeader: HTMLElement;
        private body: HTMLElement;
        private selectedId: string | null = null;
        private rafId: number | null = null;
        private cssInjected = false;

        private readonly _onPropertyChange = this._register(new Emitter<void>());
        public readonly onPropertyChange: Event<void> = this._onPropertyChange.event;

        constructor(parent: HTMLElement) {
                super();
                this.injectCSS();

                // Main container
                this.container = DOM.append(parent, DOM.$('.vi-inspector'));
                this.container.style.cssText = `
                        display: flex; flex-direction: column;
                        width: 100%; height: 100%;
                        background: ${COLORS.background};
                        overflow: hidden;
                        font: 11px/1.4 -apple-system, 'Segoe UI', system-ui, sans-serif;
                        color: ${COLORS.valueText};
                `;

                // Title header
                this.headerEl = DOM.append(this.container, DOM.$('.vi-title-header'));
                this.headerEl.style.cssText = `
                        padding: 8px 12px;
                        font-weight: 600; font-size: 11px;
                        color: ${COLORS.labelText};
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        background: ${COLORS.sectionHeader};
                        border-bottom: 1px solid ${COLORS.border};
                        flex-shrink: 0;
                `;
                this.headerEl.textContent = 'Inspector';

                // Entity header (dynamic - shows selected entity info)
                this.entityHeader = DOM.append(this.container, DOM.$('.vi-entity-header'));
                this.entityHeader.style.cssText = `
                        display: none;
                        padding: 10px 12px;
                        background: ${COLORS.sectionHeader};
                        border-bottom: 1px solid ${COLORS.border};
                        flex-shrink: 0;
                `;

                // Scrollable body
                this.body = DOM.append(this.container, DOM.$('.vi-body'));
                this.body.style.cssText = `
                        flex: 1;
                        overflow-y: auto;
                        overflow-x: hidden;
                `;

                // Bridge listeners
                this._register(sceneBridge.onSceneUpdated(u => {
                        if (u.source !== 'inspector') this.scheduleRender();
                }));

                this._register(sceneBridge.onEntitySelected(id => {
                        
                        this.selectedId = id;
                        this.render();
                }));
        }

        private scheduleRender(): void {
                if (this.rafId !== null) return;
                this.rafId = requestAnimationFrame(() => { this.rafId = null; this.render(); });
        }

        private render(): void {
                this.clear(this.body);
                this.clear(this.entityHeader);

                

                if (!this.selectedId) {
                        this.entityHeader.style.display = 'none';
                        this.empty();
                        return;
                }

                const entities = sceneBridge.getEntities();
                
                
                const ent = sceneBridge.findEntity(entities, this.selectedId);
                
                
                if (!ent) {
                        this.entityHeader.style.display = 'none';
                        this.empty();
                        return;
                }

                // Render entity header
                this.renderEntityHeader(ent);

                // Render component sections
                for (const c of ent.components) {
                        
                        this.section(c);
                }
        }

        private renderEntityHeader(ent: any): void {
                this.entityHeader.style.display = 'block';
                this.clear(this.entityHeader);

                // Main row: icon + name
                const mainRow = this.div(this.entityHeader, `
                        display: flex; align-items: center; gap: 8px;
                `);

                // Entity icon
                const icon = document.createElement('span');
                icon.className = 'codicon codicon-symbol-field';
                icon.style.cssText = `
                        font-size: 14px; width: 20px; height: 20px;
                        color: ${COLORS.labelText};
                        display: inline-flex; align-items: center; justify-content: center;
                `;
                mainRow.appendChild(icon);

                // Entity name
                const nameEl = document.createElement('span');
                nameEl.textContent = ent.name || 'Entity';
                nameEl.style.cssText = `
                        font-weight: 600; font-size: 12px;
                        color: ${COLORS.valueText};
                        flex: 1;
                `;
                mainRow.appendChild(nameEl);

                // Add Component button
                const addBtn = document.createElement('button');
                addBtn.textContent = '+ Add Component';
                addBtn.className = 'vi-add-component-btn';
                addBtn.style.cssText = `
                        padding: 4px 10px;
                        font-size: 10px;
                        font-weight: 500;
                        color: ${COLORS.labelText};
                        background: ${COLORS.inputBg};
                        border: 1px solid ${COLORS.borderLight};
                        border-radius: 8px;
                        cursor: pointer;
                `;
                addBtn.onmouseenter = () => {
                        addBtn.style.background = '#272727';
                        addBtn.style.color = COLORS.hoverText;
                        addBtn.style.borderColor = COLORS.focusBorder;
                };
                addBtn.onmouseleave = () => {
                        addBtn.style.background = COLORS.inputBg;
                        addBtn.style.color = COLORS.labelText;
                        addBtn.style.borderColor = COLORS.borderLight;
                };
                mainRow.appendChild(addBtn);
        }

        private empty(): void {
                const d = this.div(this.body, `
                        padding: 40px 16px;
                        text-align: center;
                `);
                
                const icon = document.createElement('div');
                icon.className = 'codicon codicon-inspect';
                icon.style.cssText = `
                        font-size: 24px;
                        margin-bottom: 12px;
                        opacity: 0.3;
                `;
                d.appendChild(icon);

                const text = this.label(d, 'Select an entity to inspect', COLORS.dimmedText);
                text.style.fontSize = '11px';
        }

        // Component icons mapping
        private static COMP_ICONS: Record<string, string> = {
                'Transform': '⬚',
                'Mesh': '◼',
                'Material': '◉',
                'Camera': '◇',
                'PointLight': '☀',
                'DirectionalLight': '◐',
                'SpotLight': '▼',
                'CollisionShape': '▣',
                'CharacterBody': '●',
                'RigidBody': '●',
                'StaticBody': '■',
                'Area': '▢',
                'RayCast': '→',
                'ShapeCast': '⟶',
                'GPUParticles3D': '✧',
                'CPUParticles3D': '✦',
                'AudioStreamPlayer': '♪',
                'AudioStreamPlayer2D': '♫',
                'AudioStreamPlayer3D': '♬',
                'AnimationPlayer': '▶',
                'AnimationTree': '⌬',
                'Tween': '↔',
                'NavigationRegion3D': '▤',
                'NavigationAgent3D': '◎',
                'NavigationObstacle3D': '⊕',
                'WorldEnvironment': '◎',
                'Sky': '☁',
                'FogVolume': '░',
                'ReflectionProbe': '◆',
                'Timer': '⏱',
                'Marker3D': '⚑',
                'Marker2D': '⚑',
                'Path3D': '⌇',
                'PathFollow3D': '●',
                'Sprite3D': '□',
                'Label3D': 'T',
                'Skeleton3D': '💀',
                'BoneAttachment3D': '○',
                'Transform2D': '⬚',
                'Sprite2D': '□',
                'AnimatedSprite2D': '□',
                'CollisionShape2D': '▣',
                'Viewport': '◱',
                'SubViewport': '◱',
                'CanvasLayer': '▤',
                'default': '📄'
        };

        // Get component accent color
        private getComponentColor(type: string): string {
                const colors: Record<string, string> = {
                        'Transform': COLORS.transformAccent,
                        'Mesh': COLORS.meshAccent,
                        'Material': COLORS.materialAccent,
                        'Camera': COLORS.cameraAccent,
                        'PointLight': COLORS.pointLightAccent,
                        'DirectionalLight': COLORS.directionalLightAccent,
                        'SpotLight': COLORS.spotLightAccent,
                        'CollisionShape': COLORS.collisionAccent,
                        'CharacterBody': COLORS.characterBodyAccent,
                        'RigidBody': COLORS.rigidBodyAccent,
                        'StaticBody': COLORS.staticBodyAccent,
                        'Area': COLORS.areaAccent,
                        'RayCast': COLORS.rayCastAccent,
                        'ShapeCast': COLORS.rayCastAccent,
                        'WorldEnvironment': COLORS.worldEnvironmentAccent,
                        'Sky': COLORS.skyAccent,
                        'GPUParticles3D': COLORS.particleAccent,
                        'CPUParticles3D': COLORS.particleAccent,
                        'AudioStreamPlayer': COLORS.audioAccent,
                        'AudioStreamPlayer2D': COLORS.audioAccent,
                        'AudioStreamPlayer3D': COLORS.audio3DAccent,
                        'AnimationPlayer': COLORS.animationAccent,
                        'AnimationTree': COLORS.animationAccent,
                        'Tween': COLORS.animationAccent,
                        'Timer': COLORS.timerAccent,
                        'Marker3D': COLORS.markerAccent,
                        'Marker2D': COLORS.markerAccent,
                        'Path3D': COLORS.transformAccent,
                        'PathFollow3D': COLORS.transformAccent,
                        'NavigationRegion3D': COLORS.areaAccent,
                        'NavigationAgent3D': COLORS.areaAccent,
                        'NavigationAgent2D': COLORS.areaAccent,
                        'NavigationObstacle3D': COLORS.areaAccent,
                        'FogVolume': COLORS.skyAccent,
                        'ReflectionProbe': COLORS.worldEnvironmentAccent,
                        'Skeleton3D': COLORS.characterBodyAccent,
                        'BoneAttachment3D': COLORS.characterBodyAccent,
                        'Sprite2D': COLORS.meshAccent,
                        'AnimatedSprite2D': COLORS.animationAccent,
                        'Sprite3D': COLORS.meshAccent,
                        'Label3D': COLORS.meshAccent,
                        'CollisionShape2D': COLORS.collisionAccent,
                        'Transform2D': COLORS.transformAccent,
                        'Viewport': COLORS.cameraAccent,
                        'SubViewport': COLORS.cameraAccent,
                        'CanvasLayer': COLORS.cameraAccent,
                };
                return colors[type] || '#555';
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // SECTION RENDERER - Collapsible Component Sections
        // ═══════════════════════════════════════════════════════════════════════════════
        private section(c: Component): void {
                if (c.type === 'Sky') {
                        return;
                }
                const accentColor = this.getComponentColor(c.type);

                // Section container
                const sec = this.div(this.body, `
                        margin: 6px 8px;
                        border: 1px solid ${COLORS.border};
                        border-radius: 10px;
                        overflow: hidden;
                `);

                // Header with colored left border
                const hdr = this.div(sec, `
                        padding: 7px 10px;
                        background: ${COLORS.sectionHeader};
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        cursor: pointer;
                        user-select: none;
                        border-left: 2px solid ${accentColor};
                        transition: background 0.1s;
                `);
                hdr.className = 'vi-section-header';

                // Collapse arrow
                const arrow = document.createElement('span');
                arrow.textContent = '▾';
                arrow.style.cssText = `
                        font-size: 10px;
                        color: ${COLORS.labelText};
                        transition: transform 0.2s ease;
                        width: 10px;
                        flex-shrink: 0;
                `;
                hdr.appendChild(arrow);

                // Component icon
                const icon = document.createElement('span');
                icon.textContent = InspectorView.COMP_ICONS[c.type] || InspectorView.COMP_ICONS['default'];
                icon.style.cssText = `
                        font-size: 12px;
                        color: ${accentColor};
                        width: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                `;
                hdr.appendChild(icon);

                // Type name
                const nameEl = document.createElement('span');
                nameEl.textContent = c.type;
                nameEl.style.cssText = `
                        font-weight: 500;
                        font-size: 11px;
                        color: ${COLORS.valueText};
                        flex: 1;
                `;
                hdr.appendChild(nameEl);

                // Section body
                const bd = this.div(sec, `
                        padding: 8px 10px 10px;
                        background: ${COLORS.sectionBody};
                `);
                bd.className = 'vi-section-body';

                // Collapse toggle
                hdr.onclick = () => {
                        const vis = bd.style.display !== 'none';
                        bd.style.display = vis ? 'none' : 'block';
                        arrow.style.transform = vis ? 'rotate(-90deg)' : '';
                };

                // Hover effect
                hdr.onmouseenter = () => {
                        hdr.style.background = '#292929';
                };
                hdr.onmouseleave = () => {
                        hdr.style.background = COLORS.sectionHeader;
                };

                const commit = () => { sceneBridge.commitInspectorEdit(); this._onPropertyChange.fire(); };

                // Render component properties
                switch (c.type) {
                        case 'Transform': this.trTransform(bd, c, commit); break;
                        case 'Material': this.trMaterial(bd, c, commit); break;
                        case 'Mesh': this.trMesh(bd, c); break;
                        case 'CollisionShape': this.trCollisionShape(bd, c); break;
                        case 'PointLight': this.trPointLight(bd, c, commit); break;
                        case 'DirectionalLight': this.trDirLight(bd, c, commit); break;
                        case 'SpotLight': this.trSpotLight(bd, c, commit); break;
                        case 'Camera': this.trCamera(bd, c, commit); break;
                        // Physics 3D
                        case 'CharacterBody': this.trCharacterBody(bd, c, commit); break;
                        case 'RigidBody': this.trRigidBody(bd, c, commit); break;
                        case 'StaticBody': this.trStaticBody(bd, c, commit); break;
                        case 'Area': this.trArea(bd, c, commit); break;
                        case 'RayCast': this.trRayCast(bd, c, commit); break;
                        case 'ShapeCast': this.trShapeCast(bd, c, commit); break;
                        // 2D
                        case 'Transform2D': this.trTransform2D(bd, c, commit); break;
                        case 'Sprite2D': this.trSprite2D(bd, c, commit); break;
                        case 'AnimatedSprite2D': this.trAnimatedSprite2D(bd, c, commit); break;
                        case 'CollisionShape2D': this.trCollisionShape2D(bd, c); break;
                        // Audio
                        case 'AudioStreamPlayer': this.trAudioStreamPlayer(bd, c, commit); break;
                        case 'AudioStreamPlayer2D': this.trAudioStreamPlayer2D(bd, c, commit); break;
                        case 'AudioStreamPlayer3D': this.trAudioStreamPlayer3D(bd, c, commit); break;
                        // Animation
                        case 'AnimationPlayer': this.trAnimationPlayer(bd, c, commit); break;
                        case 'AnimationTree': this.trAnimationTree(bd, c, commit); break;
                        case 'Tween': this.trTween(bd, c, commit); break;
                        // Navigation
                        case 'NavigationAgent3D': this.trNavigationAgent3D(bd, c, commit); break;
                        case 'NavigationAgent2D': this.trNavigationAgent2D(bd, c, commit); break;
                        case 'NavigationRegion3D': this.trNavigationRegion3D(bd, c, commit); break;
                        case 'NavigationObstacle3D': this.trNavigationObstacle3D(bd, c, commit); break;
                        // Particles
                        case 'GPUParticles3D': this.trGPUParticles3D(bd, c, commit); break;
                        case 'CPUParticles3D': this.trCPUParticles3D(bd, c, commit); break;
                        // Environment
                        case 'WorldEnvironment': this.trWorldEnvironment(bd, c, commit); break;
                        case 'FogVolume': this.trFogVolume(bd, c, commit); break;
                        case 'ReflectionProbe': this.trReflectionProbe(bd, c, commit); break;
                        // Paths
                        case 'Path3D': this.trPath3D(bd, c, commit); break;
                        case 'PathFollow3D': this.trPathFollow3D(bd, c, commit); break;
                        // Utilities
                        case 'Timer': this.trTimer(bd, c, commit); break;
                        case 'Marker3D': this.trMarker3D(bd, c, commit); break;
                        case 'Marker2D': this.trMarker2D(bd, c, commit); break;
                        // Special
                        case 'Viewport': this.trViewport(bd, c, commit); break;
                        case 'SubViewport': this.trSubViewport(bd, c, commit); break;
                        case 'CanvasLayer': this.trCanvasLayer(bd, c, commit); break;
                        // Skeleton/Bones
                        case 'Skeleton3D': this.trSkeleton3D(bd, c, commit); break;
                        case 'BoneAttachment3D': this.trBoneAttachment3D(bd, c, commit); break;
                        // Additional 2D nodes
                        case 'CharacterBody2D': this.trCharacterBody2D(bd, c, commit); break;
                        case 'RigidBody2D': this.trRigidBody2D(bd, c, commit); break;
                        case 'StaticBody2D': this.trStaticBody2D(bd, c, commit); break;
                        case 'Area2D': this.trArea2D(bd, c, commit); break;
                        case 'RayCast2D': this.trRayCast2D(bd, c, commit); break;
                        // Additional 3D nodes
                        case 'Sprite3D': this.trSprite3D(bd, c, commit); break;
                        case 'Label3D': this.trLabel3D(bd, c, commit); break;
                        case 'MultiMeshInstance3D': this.trMultiMesh(bd, c, commit); break;
                        case 'VisibleOnScreenNotifier3D': this.trVisibilityNotifier(bd, c, commit, '3D'); break;
                        case 'VisibleOnScreenNotifier2D': this.trVisibilityNotifier(bd, c, commit, '2D'); break;
                        case 'RemoteTransform3D': this.trRemoteTransform(bd, c, commit, '3D'); break;
                        case 'RemoteTransform2D': this.trRemoteTransform(bd, c, commit, '2D'); break;
                        case 'Path2D': this.trPath2D(bd, c, commit); break;
                        case 'PathFollow2D': this.trPathFollow2D(bd, c, commit); break;
                        case 'NavigationRegion2D': this.trNavRegion2D(bd, c, commit); break;
                        case 'NavigationObstacle2D': this.trNavObstacle2D(bd, c, commit); break;
                        // Default fallback
                        default: this.trDefault(bd, c, commit); break;
                }
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // COMPONENT RENDERERS
        // ═══════════════════════════════════════════════════════════════════════════════

        // ── Transform ──
        private trTransform(p: HTMLElement, c: any, commit: () => void): void {
                this.vec3Row(p, 'Position', c.translation, v => { c.translation = v; commit(); });
                const eul = this.q2e(c.rotation);
                this.vec3Row(p, 'Rotation', eul, v => { c.rotation = this.e2q(v); commit(); }, 1);
                this.vec3Row(p, 'Scale', c.scale, v => { c.scale = v; commit(); });
        }

        // ── Material ──
        private trMaterial(p: HTMLElement, c: any, commit: () => void): void {
                this.colorRow(p, 'Color', c.color, v => { c.color = v; commit(); });
                this.sliderRow(p, 'Metallic', c.metallic, 0, 1, 0.01, v => { c.metallic = v; commit(); });
                this.sliderRow(p, 'Roughness', c.roughness, 0, 1, 0.01, v => { c.roughness = v; commit(); });
        }

        // ── Mesh ──
        private trMesh(p: HTMLElement, c: any): void {
                const s = c.shape; if (!s) return;
                const commit = () => sceneBridge.commitInspectorEdit();
                
                // Shape type dropdown
                this.dropdownRow(p, 'Shape', s.type, 
                        ['Cube', 'Sphere', 'Capsule', 'Cylinder', 'Cone', 'Torus', 'Plane'],
                        (newType) => {
                                switch (newType) {
                                        case 'Cube': c.shape = { type: 'Cube', size: 1.0 }; break;
                                        case 'Sphere': c.shape = { type: 'Sphere', radius: 0.5 }; break;
                                        case 'Capsule': c.shape = { type: 'Capsule', radius: 0.5, height: 1.0 }; break;
                                        case 'Cylinder': c.shape = { type: 'Cylinder', radius: 0.5, height: 1.0 }; break;
                                        case 'Cone': c.shape = { type: 'Cone', radius: 0.5, height: 1.0 }; break;
                                        case 'Torus': c.shape = { type: 'Torus', radius: 0.5, tube: 0.2 }; break;
                                        case 'Plane': c.shape = { type: 'Plane', size: 10.0 }; break;
                                }
                                commit();
                        }
                );
                
                // Shape parameters
                if (s.size != null) this.sliderRow(p, 'Size', s.size, 0.1, 20, 0.1, v => { s.size = v; commit(); });
                if (s.radius != null) this.sliderRow(p, 'Radius', s.radius, 0.01, 10, 0.05, v => { s.radius = v; commit(); });
                if (s.height != null) this.sliderRow(p, 'Height', s.height, 0.01, 20, 0.1, v => { s.height = v; commit(); });
                if (s.tube != null) this.sliderRow(p, 'Tube', s.tube, 0.01, 5, 0.05, v => { s.tube = v; commit(); });
        }

        // ── CollisionShape ──
        private trCollisionShape(p: HTMLElement, c: any): void {
                const s = c.shape; if (!s) return;
                const commit = () => sceneBridge.commitInspectorEdit();
                
                this.dropdownRow(p, 'Shape', s.type,
                        ['Box', 'Sphere', 'Capsule', 'Cylinder'],
                        (newType) => {
                                switch (newType) {
                                        case 'Box': c.shape = { type: 'Box', size: 1.0 }; break;
                                        case 'Sphere': c.shape = { type: 'Sphere', radius: 0.5 }; break;
                                        case 'Capsule': c.shape = { type: 'Capsule', radius: 0.5, height: 1.0 }; break;
                                        case 'Cylinder': c.shape = { type: 'Cylinder', radius: 0.5, height: 1.0 }; break;
                                }
                                commit();
                        }
                );
                
                if (s.size != null) this.sliderRow(p, 'Size', s.size, 0.1, 20, 0.1, v => { s.size = v; commit(); });
                if (s.radius != null) this.sliderRow(p, 'Radius', s.radius, 0.01, 10, 0.05, v => { s.radius = v; commit(); });
                if (s.height != null) this.sliderRow(p, 'Height', s.height, 0.01, 20, 0.1, v => { s.height = v; commit(); });
        }

        // ── Lights ──
        private trPointLight(p: HTMLElement, c: any, commit: () => void): void {
                this.colorRow(p, 'Color', [...c.color, 1], v => { c.color = [v[0], v[1], v[2]]; commit(); });
                this.sliderRow(p, 'Intensity', c.intensity, 0, 5000, 10, v => { c.intensity = v; commit(); });
                this.sliderRow(p, 'Range', c.range, 0, 100, 0.5, v => { c.range = v; commit(); });
        }

        private trDirLight(p: HTMLElement, c: any, commit: () => void): void {
                this.colorRow(p, 'Color', [...c.color, 1], v => { c.color = [v[0], v[1], v[2]]; commit(); });
                this.sliderRow(p, 'Illuminance', c.illuminance, 0, 100000, 100, v => { c.illuminance = v; commit(); });
        }

        private trSpotLight(p: HTMLElement, c: any, commit: () => void): void {
                this.colorRow(p, 'Color', [...c.color, 1], v => { c.color = [v[0], v[1], v[2]]; commit(); });
                this.sliderRow(p, 'Intensity', c.intensity, 0, 5000, 10, v => { c.intensity = v; commit(); });
                this.sliderRow(p, 'Range', c.range, 0, 100, 0.5, v => { c.range = v; commit(); });
                this.sliderRow(p, 'Angle', c.angle, 0, 90, 1, v => { c.angle = v; commit(); });
                this.sliderRow(p, 'Attenuation', c.attenuation, 0, 1, 0.01, v => { c.attenuation = v; commit(); });
        }

        // ── Camera ──
        private trCamera(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'FOV', c.fov ?? 60, 10, 120, 1, v => { c.fov = v; commit(); });
                this.sliderRow(p, 'Near', c.near ?? 0.1, 0.001, 10, 0.01, v => { c.near = v; commit(); });
                this.sliderRow(p, 'Far', c.far ?? 1000, 10, 10000, 10, v => { c.far = v; commit(); });
        }

        // ── Physics Bodies ──
        private trCharacterBody(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Mass', c.mass, 0.1, 100, 0.1, v => { c.mass = v; commit(); });
                this.sliderRow(p, 'Gravity Scale', c.gravity_scale, 0, 10, 0.1, v => { c.gravity_scale = v; commit(); });
                this.checkboxRow(p, 'Lock Rotation', c.lock_rotation, v => { c.lock_rotation = v; commit(); });
        }

        private trRigidBody(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Mass', c.mass, 0.1, 100, 0.1, v => { c.mass = v; commit(); });
                this.sliderRow(p, 'Gravity Scale', c.gravity_scale, 0, 10, 0.1, v => { c.gravity_scale = v; commit(); });
                this.sliderRow(p, 'Linear Damping', c.linear_damping, 0, 10, 0.1, v => { c.linear_damping = v; commit(); });
                this.sliderRow(p, 'Angular Damping', c.angular_damping, 0, 10, 0.1, v => { c.angular_damping = v; commit(); });
                this.checkboxRow(p, 'Lock Rotation X', c.lock_rotation_x, v => { c.lock_rotation_x = v; commit(); });
                this.checkboxRow(p, 'Lock Rotation Y', c.lock_rotation_y, v => { c.lock_rotation_y = v; commit(); });
                this.checkboxRow(p, 'Lock Rotation Z', c.lock_rotation_z, v => { c.lock_rotation_z = v; commit(); });
        }

        private trStaticBody(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Friction', c.friction, 0, 2, 0.01, v => { c.friction = v; commit(); });
                this.sliderRow(p, 'Restitution', c.restitution, 0, 1, 0.01, v => { c.restitution = v; commit(); });
        }

        private trArea(p: HTMLElement, c: any, commit: () => void): void {
                this.checkboxRow(p, 'Monitoring', c.monitoring, v => { c.monitoring = v; commit(); });
                this.checkboxRow(p, 'Monitorable', c.monitorable, v => { c.monitorable = v; commit(); });
                this.sliderRow(p, 'Priority', c.priority, 0, 128, 1, v => { c.priority = v; commit(); });
        }

        private trRayCast(p: HTMLElement, c: any, commit: () => void): void {
                this.checkboxRow(p, 'Enabled', c.enabled, v => { c.enabled = v; commit(); });
                this.vec3Row(p, 'Target Position', c.target_position, v => { c.target_position = v; commit(); });
                this.numberRow(p, 'Collision Mask', c.collision_mask, v => { c.collision_mask = v; commit(); });
                this.checkboxRow(p, 'Hit From Inside', c.hit_from_inside, v => { c.hit_from_inside = v; commit(); });
        }

        private trShapeCast(p: HTMLElement, c: any, commit: () => void): void {
                this.checkboxRow(p, 'Enabled', c.enabled, v => { c.enabled = v; commit(); });
                this.vec3Row(p, 'Target Position', c.target_position, v => { c.target_position = v; commit(); });
                this.numberRow(p, 'Collision Mask', c.collision_mask, v => { c.collision_mask = v; commit(); });
                this.sliderRow(p, 'Max Results', c.max_results, 1, 100, 1, v => { c.max_results = v; commit(); });
        }

        // ── 2D Components ──
        private trTransform2D(p: HTMLElement, c: any, commit: () => void): void {
                this.vec2Row(p, 'Position', c.position, v => { c.position = v; commit(); });
                this.sliderRow(p, 'Rotation', c.rotation, -180, 180, 1, v => { c.rotation = v; commit(); });
                this.vec2Row(p, 'Scale', c.scale, v => { c.scale = v; commit(); });
        }

        private trSprite2D(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Texture', c.texture, v => { c.texture = v; commit(); });
                this.checkboxRow(p, 'Region Enabled', c.region_enabled, v => { c.region_enabled = v; commit(); });
                this.vec2Row(p, 'Offset', c.offset, v => { c.offset = v; commit(); });
        }

        private trAnimatedSprite2D(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Sprite Frames', c.sprite_frames, v => { c.sprite_frames = v; commit(); });
                this.textRow(p, 'Animation', c.animation, v => { c.animation = v; commit(); });
                this.sliderRow(p, 'Frame', c.frame, 0, 100, 1, v => { c.frame = v; commit(); });
                this.checkboxRow(p, 'Playing', c.playing, v => { c.playing = v; commit(); });
                this.sliderRow(p, 'Speed Scale', c.speed_scale, 0, 10, 0.1, v => { c.speed_scale = v; commit(); });
        }

        private trCollisionShape2D(p: HTMLElement, c: any): void {
                const s = c.shape; if (!s) return;
                const commit = () => sceneBridge.commitInspectorEdit();
                
                this.dropdownRow(p, 'Shape', s.type,
                        ['Rectangle', 'Circle', 'Capsule'],
                        (newType) => {
                                switch (newType) {
                                        case 'Rectangle': c.shape = { type: 'Rectangle', size: [1.0, 1.0] }; break;
                                        case 'Circle': c.shape = { type: 'Circle', radius: 0.5 }; break;
                                        case 'Capsule': c.shape = { type: 'Capsule', radius: 0.5, height: 1.0 }; break;
                                }
                                commit();
                        }
                );
                
                if (s.size != null) this.vec2Row(p, 'Size', s.size, v => { s.size = v; commit(); });
                if (s.radius != null) this.sliderRow(p, 'Radius', s.radius, 0.01, 10, 0.05, v => { s.radius = v; commit(); });
                if (s.height != null) this.sliderRow(p, 'Height', s.height, 0.01, 20, 0.1, v => { s.height = v; commit(); });
                
                this.checkboxRow(p, 'Disabled', c.disabled, v => { c.disabled = v; commit(); });
                this.checkboxRow(p, 'One Way Collision', c.one_way_collision, v => { c.one_way_collision = v; commit(); });
        }

        // ── Audio ──
        private trAudioStreamPlayer(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Stream', c.stream, v => { c.stream = v; commit(); });
                this.sliderRow(p, 'Volume dB', c.volume_db, -80, 24, 1, v => { c.volume_db = v; commit(); });
                this.sliderRow(p, 'Pitch Scale', c.pitch_scale, 0.01, 4, 0.01, v => { c.pitch_scale = v; commit(); });
                this.checkboxRow(p, 'Playing', c.playing, v => { c.playing = v; commit(); });
                this.checkboxRow(p, 'Autoplay', c.autoplay, v => { c.autoplay = v; commit(); });
                this.checkboxRow(p, 'Stream Paused', c.stream_paused, v => { c.stream_paused = v; commit(); });
        }

        private trAudioStreamPlayer2D(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Stream', c.stream, v => { c.stream = v; commit(); });
                this.sliderRow(p, 'Volume dB', c.volume_db, -80, 24, 1, v => { c.volume_db = v; commit(); });
                this.sliderRow(p, 'Pitch Scale', c.pitch_scale, 0.01, 4, 0.01, v => { c.pitch_scale = v; commit(); });
                this.checkboxRow(p, 'Playing', c.playing, v => { c.playing = v; commit(); });
                this.checkboxRow(p, 'Autoplay', c.autoplay, v => { c.autoplay = v; commit(); });
                this.sliderRow(p, 'Max Distance', c.max_distance, 1, 10000, 10, v => { c.max_distance = v; commit(); });
                this.sliderRow(p, 'Attenuation', c.attenuation, 0, 4, 0.1, v => { c.attenuation = v; commit(); });
        }

        private trAudioStreamPlayer3D(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Stream', c.stream, v => { c.stream = v; commit(); });
                this.sliderRow(p, 'Volume dB', c.volume_db, -80, 24, 1, v => { c.volume_db = v; commit(); });
                this.sliderRow(p, 'Pitch Scale', c.pitch_scale, 0.01, 4, 0.01, v => { c.pitch_scale = v; commit(); });
                this.checkboxRow(p, 'Playing', c.playing, v => { c.playing = v; commit(); });
                this.checkboxRow(p, 'Autoplay', c.autoplay, v => { c.autoplay = v; commit(); });
                this.sliderRow(p, 'Max Distance', c.max_distance, 1, 1000, 1, v => { c.max_distance = v; commit(); });
                this.dropdownRow(p, 'Attenuation Model', c.attenuation_model,
                        ['InverseDistance', 'InverseSquareDistance', 'Logarithmic'],
                        v => { c.attenuation_model = v; commit(); }
                );
                this.checkboxRow(p, 'Emission Angle Enabled', c.emission_angle_enabled, v => { c.emission_angle_enabled = v; commit(); });
                this.sliderRow(p, 'Emission Angle', c.emission_angle_degrees, 0, 90, 1, v => { c.emission_angle_degrees = v; commit(); });
        }

        // ── Animation ──
        private trAnimationPlayer(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Current Animation', c.current_animation, v => { c.current_animation = v; commit(); });
                this.sliderRow(p, 'Playback Speed', c.playback_speed, 0, 10, 0.1, v => { c.playback_speed = v; commit(); });
                this.textRow(p, 'Autoplay', c.autoplay, v => { c.autoplay = v; commit(); });
                this.checkboxRow(p, 'Playback Active', c.playback_active, v => { c.playback_active = v; commit(); });
                this.sliderRow(p, 'Blend Time', c.playback_default_blend_time, 0, 5, 0.1, v => { c.playback_default_blend_time = v; commit(); });
        }

        private trTween(p: HTMLElement, c: any, commit: () => void): void {
                this.checkboxRow(p, 'Active', c.active, v => { c.active = v; commit(); });
                this.sliderRow(p, 'Speed Scale', c.speed_scale, 0, 10, 0.1, v => { c.speed_scale = v; commit(); });
        }

        // ── Navigation ──
        private trNavigationAgent3D(p: HTMLElement, c: any, commit: () => void): void {
                this.vec3Row(p, 'Target Position', c.target_position, v => { c.target_position = v; commit(); });
                this.sliderRow(p, 'Path Desired Distance', c.path_desired_distance, 0.1, 10, 0.1, v => { c.path_desired_distance = v; commit(); });
                this.sliderRow(p, 'Target Desired Distance', c.target_desired_distance, 0.1, 10, 0.1, v => { c.target_desired_distance = v; commit(); });
                this.sliderRow(p, 'Radius', c.radius, 0.1, 10, 0.1, v => { c.radius = v; commit(); });
                this.sliderRow(p, 'Height', c.height, 0.1, 10, 0.1, v => { c.height = v; commit(); });
                this.sliderRow(p, 'Max Speed', c.max_speed, 0.1, 50, 0.5, v => { c.max_speed = v; commit(); });
                this.checkboxRow(p, 'Avoidance Enabled', c.avoidance_enabled, v => { c.avoidance_enabled = v; commit(); });
        }

        private trNavigationAgent2D(p: HTMLElement, c: any, commit: () => void): void {
                this.vec2Row(p, 'Target Position', c.target_position, v => { c.target_position = v; commit(); });
                this.sliderRow(p, 'Path Desired Distance', c.path_desired_distance, 0.1, 10, 0.1, v => { c.path_desired_distance = v; commit(); });
                this.sliderRow(p, 'Target Desired Distance', c.target_desired_distance, 0.1, 10, 0.1, v => { c.target_desired_distance = v; commit(); });
                this.sliderRow(p, 'Radius', c.radius, 0.1, 10, 0.1, v => { c.radius = v; commit(); });
                this.sliderRow(p, 'Max Speed', c.max_speed, 0.1, 50, 0.5, v => { c.max_speed = v; commit(); });
                this.checkboxRow(p, 'Avoidance Enabled', c.avoidance_enabled, v => { c.avoidance_enabled = v; commit(); });
        }

        private trFogVolume(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Density', c.density, 0, 10, 0.1, v => { c.density = v; commit(); });
                this.colorRow(p, 'Albedo', [...c.albedo, 1], v => { c.albedo = [v[0], v[1], v[2]]; commit(); });
                this.colorRow(p, 'Emission', [...c.emission, 1], v => { c.emission = [v[0], v[1], v[2]]; commit(); });
                this.sliderRow(p, 'Height Falloff', c.height_falloff, 0, 10, 0.1, v => { c.height_falloff = v; commit(); });
        }

        private trReflectionProbe(p: HTMLElement, c: any, commit: () => void): void {
                this.dropdownRow(p, 'Update Mode', c.update_mode, ['Once', 'Always'], v => { c.update_mode = v; commit(); });
                this.sliderRow(p, 'Intensity', c.intensity, 0, 2, 0.01, v => { c.intensity = v; commit(); });
                this.sliderRow(p, 'Max Distance', c.max_distance, 0, 1000, 1, v => { c.max_distance = v; commit(); });
                this.vec3Row(p, 'Extents', c.extents, v => { c.extents = v; commit(); });
                this.vec3Row(p, 'Origin Offset', c.origin_offset, v => { c.origin_offset = v; commit(); });
                this.checkboxRow(p, 'Box Projection', c.box_projection, v => { c.box_projection = v; commit(); });
                this.checkboxRow(p, 'Enable Shadows', c.enable_shadows, v => { c.enable_shadows = v; commit(); });
        }

        private trTimer(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Wait Time', c.wait_time, 0.01, 60, 0.1, v => { c.wait_time = v; commit(); });
                this.checkboxRow(p, 'One Shot', c.one_shot, v => { c.one_shot = v; commit(); });
                this.checkboxRow(p, 'Autostart', c.autostart, v => { c.autostart = v; commit(); });
                this.sliderRow(p, 'Time Left', c.time_left, 0, 60, 0.1, v => { c.time_left = v; commit(); });
                this.checkboxRow(p, 'Paused', c.paused, v => { c.paused = v; commit(); });
        }

        private trMarker3D(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Gizmo Extents', c.gizmo_extents, 0.1, 10, 0.1, v => { c.gizmo_extents = v; commit(); });
        }

        private trMarker2D(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Gizmo Extents', c.gizmo_extents, 1, 100, 1, v => { c.gizmo_extents = v; commit(); });
        }

        private trViewport(p: HTMLElement, c: any, commit: () => void): void {
                this.vec2Row(p, 'Size', c.size, v => { c.size = v; commit(); });
                this.checkboxRow(p, 'Transparent BG', c.transparent_bg, v => { c.transparent_bg = v; commit(); });
                this.dropdownRow(p, 'MSAA', c.msaa, ['Disabled', 'MSAA2x', 'MSAA4x', 'MSAA8x'], v => { c.msaa = v; commit(); });
                this.dropdownRow(p, 'Screen Space AA', c.screen_space_aa, ['Disabled', 'FXAA'], v => { c.screen_space_aa = v; commit(); });
                this.checkboxRow(p, 'Use Debanding', c.use_debanding, v => { c.use_debanding = v; commit(); });
                this.checkboxRow(p, 'Use Occlusion Culling', c.use_occlusion_culling, v => { c.use_occlusion_culling = v; commit(); });
        }

        private trSubViewport(p: HTMLElement, c: any, commit: () => void): void {
                this.vec2Row(p, 'Size', c.size, v => { c.size = v; commit(); });
                this.dropdownRow(p, 'Update Mode', c.render_target_update_mode,
                        ['Disabled', 'Once', 'WhenVisible', 'WhenParentVisible', 'Always'],
                        v => { c.render_target_update_mode = v; commit(); }
                );
        }

        private trCanvasLayer(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Layer', c.layer, -128, 128, 1, v => { c.layer = v; commit(); });
                this.vec2Row(p, 'Offset', c.offset, v => { c.offset = v; commit(); });
                this.sliderRow(p, 'Rotation', c.rotation, -180, 180, 1, v => { c.rotation = v; commit(); });
                this.vec2Row(p, 'Scale', c.scale, v => { c.scale = v; commit(); });
                this.checkboxRow(p, 'Follow Viewport', c.follow_viewport_enabled, v => { c.follow_viewport_enabled = v; commit(); });
        }

        // ── Additional Component Renderers ──
        private trAnimationTree(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Tree Root', c.tree_root ?? '', v => { c.tree_root = v; commit(); });
                this.sliderRow(p, 'Playback Speed', c.playback_speed ?? 1.0, 0, 10, 0.1, v => { c.playback_speed = v; commit(); });
                this.checkboxRow(p, 'Active', c.active ?? true, v => { c.active = v; commit(); });
        }

        private trNavigationRegion3D(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Navigation Mesh', c.navmesh ?? '', v => { c.navmesh = v; commit(); });
                this.vec3Row(p, 'Extents', c.extents ?? [10, 10, 10], v => { c.extents = v; commit(); });
                this.numberRow(p, 'Layer', c.layer ?? 1, v => { c.layer = v; commit(); });
        }

        private trNavigationObstacle3D(p: HTMLElement, c: any, commit: () => void): void {
                this.vec3Row(p, 'Radius', [c.radius ?? 0.5, 0, 0], v => { c.radius = v[0]; commit(); });
                this.sliderRow(p, 'Height', c.height ?? 1.0, 0.1, 20, 0.1, v => { c.height = v; commit(); });
                this.checkboxRow(p, 'Affect Navigation Mesh', c.affect_navigation_mesh ?? true, v => { c.affect_navigation_mesh = v; commit(); });
        }

        private trGPUParticles3D(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Amount', c.amount ?? 1000, 1, 100000, 100, v => { c.amount = v; commit(); });
                this.checkboxRow(p, 'Emitting', c.emitting ?? true, v => { c.emitting = v; commit(); });
                this.sliderRow(p, 'Lifetime', c.lifetime ?? 1.0, 0.1, 60, 0.1, v => { c.lifetime = v; commit(); });
                this.sliderRow(p, 'Speed Scale', c.speed_scale ?? 1.0, 0, 10, 0.1, v => { c.speed_scale = v; commit(); });
                this.checkboxRow(p, 'One Shot', c.one_shot ?? false, v => { c.one_shot = v; commit(); });
                this.sliderRow(p, 'Explosiveness', c.explosiveness ?? 0, 0, 1, 0.01, v => { c.explosiveness = v; commit(); });
                this.sliderRow(p, 'Randomness', c.randomness ?? 0, 0, 1, 0.01, v => { c.randomness = v; commit(); });
                this.vec3Row(p, 'Direction', c.direction ?? [0, 1, 0], v => { c.direction = v; commit(); }, 1);
                this.sliderRow(p, 'Spread', c.spread ?? 0, 0, 180, 1, v => { c.spread = v; commit(); });
        }

        private trCPUParticles3D(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Amount', c.amount ?? 100, 1, 10000, 10, v => { c.amount = v; commit(); });
                this.checkboxRow(p, 'Emitting', c.emitting ?? true, v => { c.emitting = v; commit(); });
                this.sliderRow(p, 'Lifetime', c.lifetime ?? 1.0, 0.1, 60, 0.1, v => { c.lifetime = v; commit(); });
                this.sliderRow(p, 'Speed Scale', c.speed_scale ?? 1.0, 0, 10, 0.1, v => { c.speed_scale = v; commit(); });
                this.checkboxRow(p, 'One Shot', c.one_shot ?? false, v => { c.one_shot = v; commit(); });
        }

        private trWorldEnvironment(p: HTMLElement, c: any, commit: () => void): void {
                // Background Section
                this.sectionHeader(p, 'Background');
                this.dropdownRow(p, 'Mode', c.background_mode ?? 'Sky',
                        ['Sky', 'Color', 'Gradient', 'Canvas', 'Keep'],
                        v => { c.background_mode = v; commit(); }
                );
                
                if ((c.background_mode ?? 'Sky') === 'Color') {
                        this.colorRow(p, 'Color', c.background_color ?? [0.05, 0.05, 0.1, 1], v => { c.background_color = v; commit(); });
                }
                
                if ((c.background_mode ?? 'Sky') === 'Gradient') {
                        this.colorRow(p, 'Top', c.gradient_top ?? [0.4, 0.4, 0.5, 1], v => { c.gradient_top = v; commit(); });
                        this.colorRow(p, 'Bottom', c.gradient_bottom ?? [0.15, 0.15, 0.18, 1], v => { c.gradient_bottom = v; commit(); });
                }

                if ((c.background_mode ?? 'Sky') === 'Sky') {
                        this.sectionHeader(p, 'Sky');
                        this.dropdownRow(p, 'Material', c.sky_material ?? 'ProceduralSky',
                                ['ProceduralSky', 'PanoramaSky', 'PhysicalSky'],
                                v => { c.sky_material = v; commit(); }
                        );
                        this.colorRow(p, 'Top Color', c.sky_top_color ?? [0.35, 0.55, 0.85, 1], v => { c.sky_top_color = v; commit(); });
                        this.colorRow(p, 'Horizon', c.sky_horizon_color ?? [0.65, 0.78, 0.90, 1], v => { c.sky_horizon_color = v; commit(); });
                        this.sliderRow(p, 'Curve', c.sky_curve ?? 0.15, 0, 2, 0.05, v => { c.sky_curve = v; commit(); });
                        this.sliderRow(p, 'Energy', c.sky_energy ?? 1.0, 0, 8, 0.1, v => { c.sky_energy = v; commit(); });

                        this.sectionHeader(p, 'Ground');
                        this.colorRow(p, 'Bottom', c.ground_bottom_color ?? [0.12, 0.10, 0.08, 1], v => { c.ground_bottom_color = v; commit(); });
                        this.colorRow(p, 'Horizon', c.ground_horizon_color ?? [0.35, 0.30, 0.25, 1], v => { c.ground_horizon_color = v; commit(); });
                        this.sliderRow(p, 'Curve', c.ground_curve ?? 0.1, 0, 2, 0.05, v => { c.ground_curve = v; commit(); });
                        this.sliderRow(p, 'Energy', c.ground_energy ?? 1.0, 0, 4, 0.1, v => { c.ground_energy = v; commit(); });

                        this.sectionHeader(p, 'Sun');
                        this.checkboxRow(p, 'Enabled', c.sun_enabled ?? true, v => { c.sun_enabled = v; commit(); });
                        if (c.sun_enabled ?? true) {
                                this.sliderRow(p, 'Angle Min', c.sun_angle_min ?? 0.5, 0, 90, 0.5, v => { c.sun_angle_min = v; commit(); });
                                this.sliderRow(p, 'Angle Max', c.sun_angle_max ?? 2.0, 0, 90, 0.5, v => { c.sun_angle_max = v; commit(); });
                                this.sliderRow(p, 'Curve', c.sun_curve ?? 0.05, 0, 1, 0.01, v => { c.sun_curve = v; commit(); });
                                this.sliderRow(p, 'Energy', c.sun_energy ?? 16.0, 0, 100, 1, v => { c.sun_energy = v; commit(); });
                                this.colorRow(p, 'Color', c.sun_color ?? [1.0, 0.95, 0.85, 1], v => { c.sun_color = v; commit(); });
                                this.vec3Row(p, 'Direction', c.sun_position ?? [0.5, 0.8, -0.3], v => { c.sun_position = v; commit(); }, 2);
                        }

                        this.sectionHeader(p, 'Clouds');
                        this.checkboxRow(p, 'Enabled', c.clouds_enabled ?? false, v => { c.clouds_enabled = v; commit(); });
                        if (c.clouds_enabled ?? false) {
                                this.colorRow(p, 'Color', c.clouds_color ?? [1.0, 1.0, 1.0, 1], v => { c.clouds_color = v; commit(); });
                                this.sliderRow(p, 'Density', c.clouds_density ?? 0.5, 0, 2, 0.05, v => { c.clouds_density = v; commit(); });
                                this.sliderRow(p, 'Speed', c.clouds_speed ?? 0.1, 0, 1, 0.01, v => { c.clouds_speed = v; commit(); });
                                this.sliderRow(p, 'Height', c.clouds_height ?? 500, 100, 2000, 50, v => { c.clouds_height = v; commit(); });
                                this.sliderRow(p, 'Coverage', c.clouds_coverage ?? 0.5, 0, 1, 0.05, v => { c.clouds_coverage = v; commit(); });
                                this.sliderRow(p, 'Thickness', c.clouds_thickness ?? 100, 10, 500, 10, v => { c.clouds_thickness = v; commit(); });
                        }

                        this.sectionHeader(p, 'Fog');
                        this.checkboxRow(p, 'Enabled', c.fog_enabled ?? false, v => { c.fog_enabled = v; commit(); });
                        if (c.fog_enabled ?? false) {
                                this.colorRow(p, 'Color', c.fog_color ?? [0.7, 0.75, 0.80, 1], v => { c.fog_color = v; commit(); });
                                this.sliderRow(p, 'Density', c.fog_density ?? 0.001, 0, 0.1, 0.001, v => { c.fog_density = v; commit(); });
                                this.sliderRow(p, 'Depth Begin', c.fog_depth_begin ?? 10, 0, 500, 10, v => { c.fog_depth_begin = v; commit(); });
                                this.sliderRow(p, 'Depth End', c.fog_depth_end ?? 100, 0, 2000, 50, v => { c.fog_depth_end = v; commit(); });
                        }
                }
                
                // Ambient Light Section
                this.sectionHeader(p, 'Ambient Light');
                this.sliderRow(p, 'Energy', c.ambient_light_energy ?? 1.0, 0, 16, 0.1, v => { c.ambient_light_energy = v; commit(); });
                this.colorRow(p, 'Color', c.ambient_light_color ?? [0.5, 0.5, 0.55, 1], v => { c.ambient_light_color = v; commit(); });
                this.sliderRow(p, 'Sky Contrib', c.ambient_light_sky_contribution ?? 1.0, 0, 1, 0.05, v => { c.ambient_light_sky_contribution = v; commit(); });
                
                // Tonemap Section
                this.sectionHeader(p, 'Tonemap');
                this.dropdownRow(p, 'Mode', c.tonemap_mode ?? 'Linear',
                        ['Linear', 'Reinhard', 'Filmic', 'ACES'],
                        v => { c.tonemap_mode = v; commit(); }
                );
                this.sliderRow(p, 'Exposure', c.tonemap_exposure ?? 1.0, 0, 8, 0.1, v => { c.tonemap_exposure = v; commit(); });
                this.sliderRow(p, 'White', c.tonemap_white ?? 1.0, 0.1, 8, 0.1, v => { c.tonemap_white = v; commit(); });
                
                // SSAO Section
                this.sectionHeader(p, 'SSAO');
                this.checkboxRow(p, 'Enabled', c.ssao_enabled ?? false, v => { c.ssao_enabled = v; commit(); });
                if (c.ssao_enabled) {
                        this.sliderRow(p, 'Intensity', c.ssao_intensity ?? 1.0, 0, 4, 0.1, v => { c.ssao_intensity = v; commit(); });
                        this.sliderRow(p, 'Radius', c.ssao_radius ?? 1.0, 0, 10, 0.1, v => { c.ssao_radius = v; commit(); });
                }
                
                // Glow Section
                this.sectionHeader(p, 'Glow/Bloom');
                this.checkboxRow(p, 'Enabled', c.glow_enabled ?? false, v => { c.glow_enabled = v; commit(); });
                if (c.glow_enabled) {
                        this.sliderRow(p, 'Intensity', c.glow_intensity ?? 0.8, 0, 4, 0.1, v => { c.glow_intensity = v; commit(); });
                        this.sliderRow(p, 'Threshold', c.glow_threshold ?? 0.9, 0, 2, 0.05, v => { c.glow_threshold = v; commit(); });
                }
        }

        // Section header helper for organizing inspector
        private sectionHeader(p: HTMLElement, text: string): void {
                const hdr = this.div(p, `
                        font-size: 9px;
                        color: ${COLORS.dimmedText};
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin: 8px 0 4px;
                        padding-top: 6px;
                        border-top: 1px solid ${COLORS.border};
                `);
                hdr.textContent = text;
        }

        private trPath3D(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Curve', c.curve ?? '', v => { c.curve = v; commit(); });
                this.checkboxRow(p, 'Debug Visible', c.debug_visible ?? true, v => { c.debug_visible = v; commit(); });
        }

        private trPathFollow3D(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Progress', c.progress ?? 0, 0, 1000, 0.1, v => { c.progress = v; commit(); });
                this.sliderRow(p, 'Progress Ratio', c.progress_ratio ?? 0, 0, 1, 0.001, v => { c.progress_ratio = v; commit(); });
                this.dropdownRow(p, 'Rotation Mode', c.rotation_mode ?? 'OrientPath',
                        ['None', 'OrientPath', 'OrientY'],
                        v => { c.rotation_mode = v; commit(); }
                );
                this.checkboxRow(p, 'Loop', c.loop ?? true, v => { c.loop = v; commit(); });
        }

        private trSkeleton3D(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Rest Pose', c.rest_pose ?? 'Default', v => { c.rest_pose = v; commit(); });
                this.numberRow(p, 'Bone Count', c.bone_count ?? 0, v => { c.bone_count = v; commit(); });
                this.checkboxRow(p, 'Show Rest', c.show_rest_only ?? false, v => { c.show_rest_only = v; commit(); });
        }

        private trBoneAttachment3D(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Bone Name', c.bone_name ?? '', v => { c.bone_name = v; commit(); });
                this.sliderRow(p, 'Bone Index', c.bone_idx ?? -1, -1, 256, 1, v => { c.bone_idx = v; commit(); });
                this.checkboxRow(p, 'Override Pose', c.override_pose ?? false, v => { c.override_pose = v; commit(); });
        }

        // Default fallback for unknown components
        private trDefault(p: HTMLElement, c: any, commit: () => void): void {
                const info = this.div(p, `
                        font-size: 9px;
                        color: ${COLORS.dimmedText};
                        font-family: monospace;
                        white-space: pre-wrap;
                        word-break: break-all;
                `);
                info.textContent = JSON.stringify(c, null, 2).slice(0, 500);
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // WIDGETS - Godot-Style Property Inputs
        // ═══════════════════════════════════════════════════════════════════════════════

        // Create a property row
        private row(parent: HTMLElement): [HTMLElement, HTMLElement] {
                const r = this.div(parent, `
                        display: flex;
                        align-items: center;
                        min-height: 22px;
                        margin: 2px 0;
                        padding: 1px 0;
                        border-radius: 6px;
                `);
                r.className = 'vi-prop-row';
                
                const l = this.div(r, `
                        width: 75px;
                        flex-shrink: 0;
                        font-size: 10px;
                        color: ${COLORS.labelText};
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        padding-right: 8px;
                `);
                
                const v = this.div(r, `
                        flex: 1;
                        min-width: 0;
                        display: flex;
                        gap: 2px;
                `);
                
                return [l, v];
        }

        // Drag-to-change number helper (Godot-style)
        private makeDraggable(inp: HTMLInputElement, min: number, max: number, step: number, cb: (v: number) => void): void {
                let isDragging = false;
                let startX = 0;
                let startVal = 0;
                
                inp.onmousedown = (e) => {
                        if (e.button !== 0) return;
                        isDragging = true;
                        startX = e.clientX;
                        startVal = parseFloat(inp.value) || 0;
                        inp.style.cursor = 'ew-resize';
                        inp.style.color = COLORS.focusBorder;
                        inp.style.background = COLORS.inputFocus;
                        
                        const onMove = (ev: MouseEvent) => {
                                if (!isDragging) return;
                                const dx = ev.clientX - startX;
                                const delta = dx * step * 0.5;
                                let newVal = startVal + delta;
                                newVal = Math.max(min, Math.min(max, newVal));
                                inp.value = newVal.toFixed(step < 1 ? 2 : 0);
                                cb(newVal);
                        };
                        
                        const onUp = () => {
                                isDragging = false;
                                inp.style.cursor = '';
                                inp.style.color = '';
                                inp.style.background = '';
                                window.removeEventListener('mousemove', onMove);
                                window.removeEventListener('mouseup', onUp);
                        };
                        
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                };
        }

        // Vec3 row with colored axis badges
        private vec3Row(parent: HTMLElement, lbl: string, val: number[], cb: (v: [number, number, number]) => void, prec: number = 3): void {
                const [l, v] = this.row(parent);
                l.textContent = lbl;

                const axisColors = [COLORS.axisX, COLORS.axisY, COLORS.axisZ];
                const axes = ['X', 'Y', 'Z'];

                axes.forEach((ax, i) => {
                        const cell = this.div(v, 'flex:1;display:flex;min-width:0;');

                        // Colored badge
                        const badge = document.createElement('span');
                        badge.textContent = ax;
                        badge.style.cssText = `
                                font-size: 9px;
                                font-weight: 700;
                                color: #fff;
                                width: 16px;
                                height: 20px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                background: ${axisColors[i]};
                                border-radius: 6px 0 0 6px;
                                flex-shrink: 0;
                        `;
                        cell.appendChild(badge);

                        // Number input
                        const inp = document.createElement('input');
                        inp.type = 'number';
                        inp.value = val[i].toFixed(prec);
                        inp.step = prec <= 1 ? '1' : '0.1';
                        inp.className = 'vi-drag-num';
                        inp.style.cssText = `
                                flex: 1;
                                min-width: 0;
                                width: 0;
                                background: ${COLORS.inputBg};
                                color: ${COLORS.valueText};
                                border: 1px solid ${COLORS.borderLight};
                                border-left: none;
                                border-radius: 0 6px 6px 0;
                                padding: 2px 4px;
                                font-size: 10px;
                                font-family: Consolas, monospace;
                                outline: none;
                                -moz-appearance: textfield;
                                height: 20px;
                        `;
                        
                        inp.onfocus = () => {
                                inp.style.borderColor = COLORS.focusBorder;
                                inp.style.background = COLORS.inputFocus;
                        };
                        inp.onblur = () => {
                                inp.style.borderColor = COLORS.borderLight;
                                inp.style.background = COLORS.inputBg;
                        };
                        inp.onchange = () => {
                                const nv = [val[0], val[1], val[2]] as [number, number, number];
                                nv[i] = parseFloat(inp.value) || 0;
                                cb(nv);
                        };
                        
                        // Make draggable
                        this.makeDraggable(inp, -10000, 10000, prec <= 1 ? 1 : 0.1, (newVal) => {
                                const nv = [val[0], val[1], val[2]] as [number, number, number];
                                nv[i] = newVal;
                                cb(nv);
                        });
                        
                        cell.appendChild(inp);
                });
        }

        // Slider row with number input
        private sliderRow(parent: HTMLElement, lbl: string, val: number, min: number, max: number, step: number, cb: (v: number) => void): void {
                const [l, v] = this.row(parent);
                l.textContent = lbl;

                const prec = step < 1 ? 2 : 0;

                // Number input
                const num = document.createElement('input');
                num.type = 'number';
                num.value = val.toFixed(prec);
                num.min = String(min);
                num.max = String(max);
                num.step = String(step);
                num.className = 'vi-drag-num';
                num.style.cssText = `
                        width: 55px;
                        background: ${COLORS.inputBg};
                        color: ${COLORS.valueText};
                        border: 1px solid ${COLORS.borderLight};
                        border-radius: 6px;
                        padding: 2px 4px;
                        font-size: 10px;
                        text-align: right;
                        font-family: Consolas, monospace;
                        outline: none;
                        -moz-appearance: textfield;
                        flex-shrink: 0;
                        height: 20px;
                `;
                
                this.makeDraggable(num, min, max, step, cb);
                
                num.onchange = () => { 
                        const n = Math.max(min, Math.min(max, parseFloat(num.value) || 0)); 
                        num.value = n.toFixed(prec); 
                        cb(n); 
                };
                v.appendChild(num);

                // Slider
                const sl = document.createElement('input');
                sl.type = 'range';
                sl.min = String(min);
                sl.max = String(max);
                sl.step = String(step);
                sl.value = String(val);
                sl.className = 'vi-slider';
                sl.style.cssText = `
                        flex: 1;
                        min-width: 0;
                        margin: 0 0 0 6px;
                        cursor: pointer;
                `;
                sl.oninput = () => {
                        const n = parseFloat(sl.value);
                        num.value = n.toFixed(prec);
                        cb(n);
                };
                v.appendChild(sl);
        }

        // Color row with picker and hex input
        private colorRow(parent: HTMLElement, lbl: string, val: number[], cb: (v: [number, number, number, number]) => void): void {
                const [l, v] = this.row(parent);
                l.textContent = lbl;

                const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n * 255))).toString(16).padStart(2, '0');
                const hexStr = `#${toHex(val[0])}${toHex(val[1])}${toHex(val[2])}`;

                // Color swatch
                const swatch = document.createElement('input');
                swatch.type = 'color';
                swatch.value = hexStr;
                swatch.className = 'vi-color-swatch';
                swatch.style.cssText = `
                        width: 32px;
                        height: 20px;
                        border: 1px solid ${COLORS.borderLight};
                        border-radius: 3px;
                        padding: 0;
                        background: none;
                        cursor: pointer;
                        flex-shrink: 0;
                `;
                v.appendChild(swatch);

                // Hex input
                const hex = document.createElement('input');
                hex.type = 'text';
                hex.value = hexStr.toUpperCase();
                hex.maxLength = 7;
                hex.style.cssText = `
                        width: 65px;
                        background: ${COLORS.inputBg};
                        color: ${COLORS.valueText};
                        border: 1px solid ${COLORS.borderLight};
                        border-radius: 6px;
                        padding: 2px 4px;
                        font-size: 10px;
                        font-family: Consolas, monospace;
                        outline: none;
                        text-transform: uppercase;
                `;
                
                hex.onfocus = () => hex.style.borderColor = COLORS.focusBorder;
                hex.onblur = () => hex.style.borderColor = COLORS.borderLight;
                v.appendChild(hex);

                swatch.oninput = () => {
                        const h = swatch.value;
                        hex.value = h.toUpperCase();
                        const r = parseInt(h.slice(1, 3), 16);
                        const g = parseInt(h.slice(3, 5), 16);
                        const b = parseInt(h.slice(5, 7), 16);
                        cb([r / 255, g / 255, b / 255, val[3] ?? 1]);
                };
                
                hex.onchange = () => {
                        let h = hex.value.trim();
                        if (!h.startsWith('#')) h = '#' + h;
                        if (h.length === 7) {
                                swatch.value = h;
                                const r = parseInt(h.slice(1, 3), 16);
                                const g = parseInt(h.slice(3, 5), 16);
                                const b = parseInt(h.slice(5, 7), 16);
                                cb([r / 255, g / 255, b / 255, val[3] ?? 1]);
                        }
                };
        }

        // Dropdown row
        private dropdownRow(parent: HTMLElement, lbl: string, currentValue: string, options: string[], cb: (v: string) => void): void {
                const [l, v] = this.row(parent);
                l.textContent = lbl;

                const select = document.createElement('select');
                select.style.cssText = `
                        flex: 1;
                        background: ${COLORS.inputBg};
                        color: ${COLORS.valueText};
                        border: 1px solid ${COLORS.borderLight};
                        border-radius: 6px;
                        padding: 3px 6px;
                        font-size: 10px;
                        font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
                        outline: none;
                        cursor: pointer;
                        height: 20px;
                        appearance: none;
                        -webkit-appearance: none;
                        -moz-appearance: none;
                `;
                select.onfocus = () => select.style.borderColor = COLORS.focusBorder;
                select.onblur = () => select.style.borderColor = COLORS.borderLight;

                options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt;
                        option.textContent = opt;
                        if (opt === currentValue) {
                                option.selected = true;
                        }
                        select.appendChild(option);
                });

                select.onchange = () => cb(select.value);
                v.appendChild(select);
        }

        // Checkbox row with toggle switch
        private checkboxRow(parent: HTMLElement, lbl: string, val: boolean, cb: (v: boolean) => void): void {
                const [l, v] = this.row(parent);
                l.textContent = lbl;

                // Toggle switch
                const toggle = document.createElement('div');
                toggle.style.cssText = `
                        width: 32px;
                        height: 16px;
                        border-radius: 8px;
                        background: ${val ? COLORS.toggleOn : COLORS.toggleOff};
                        cursor: pointer;
                        position: relative;
                        transition: background 0.15s;
                `;
                
                const knob = document.createElement('div');
                knob.style.cssText = `
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        background: #fff;
                        position: absolute;
                        top: 2px;
                        left: ${val ? '17px' : '3px'};
                        transition: left 0.15s;
                `;
                toggle.appendChild(knob);
                
                toggle.onclick = () => {
                        const newVal = !toggle.classList.contains('on');
                        toggle.classList.toggle('on', newVal);
                        toggle.style.background = newVal ? COLORS.toggleOn : COLORS.toggleOff;
                        knob.style.left = newVal ? '17px' : '3px';
                        cb(newVal);
                };
                if (val) toggle.classList.add('on');

                v.appendChild(toggle);
        }

        // Text row
        private textRow(parent: HTMLElement, lbl: string, val: string, cb: (v: string) => void): void {
                const [l, v] = this.row(parent);
                l.textContent = lbl;

                const input = document.createElement('input');
                input.type = 'text';
                input.value = val;
                input.style.cssText = `
                        flex: 1;
                        background: ${COLORS.inputBg};
                        color: ${COLORS.valueText};
                        border: 1px solid ${COLORS.borderLight};
                        border-radius: 6px;
                        padding: 2px 4px;
                        font-size: 10px;
                        font-family: Consolas, monospace;
                        outline: none;
                `;
                input.onfocus = () => input.style.borderColor = COLORS.focusBorder;
                input.onblur = () => input.style.borderColor = COLORS.borderLight;
                input.onchange = () => cb(input.value);

                v.appendChild(input);
        }

        // Number row
        private numberRow(parent: HTMLElement, lbl: string, val: number, cb: (v: number) => void): void {
                const [l, v] = this.row(parent);
                l.textContent = lbl;

                const input = document.createElement('input');
                input.type = 'number';
                input.value = String(val);
                input.style.cssText = `
                        flex: 1;
                        background: ${COLORS.inputBg};
                        color: ${COLORS.valueText};
                        border: 1px solid ${COLORS.borderLight};
                        border-radius: 6px;
                        padding: 2px 4px;
                        font-size: 10px;
                        font-family: Consolas, monospace;
                        outline: none;
                        -moz-appearance: textfield;
                `;
                input.onfocus = () => input.style.borderColor = COLORS.focusBorder;
                input.onblur = () => input.style.borderColor = COLORS.borderLight;
                input.onchange = () => cb(parseInt(input.value, 10) || 0);

                v.appendChild(input);
        }

        // Vec2 row
        private vec2Row(parent: HTMLElement, lbl: string, val: [number, number], cb: (v: [number, number]) => void, prec: number = 2): void {
                const [l, v] = this.row(parent);
                l.textContent = lbl;

                const axisColors = [COLORS.axisX, COLORS.axisY];
                const axes = ['X', 'Y'];

                axes.forEach((ax, i) => {
                        const cell = this.div(v, 'flex:1;display:flex;min-width:0;');

                        // Badge
                        const badge = document.createElement('span');
                        badge.textContent = ax;
                        badge.style.cssText = `
                                font-size: 9px;
                                font-weight: 700;
                                color: ${axisColors[i]};
                                width: 14px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                background: ${COLORS.inputFocus};
                                border: 1px solid ${COLORS.borderLight};
                                border-right: none;
                                border-radius: 6px 0 0 6px;
                                flex-shrink: 0;
                        `;
                        cell.appendChild(badge);

                        const inp = document.createElement('input');
                        inp.type = 'number';
                        inp.value = val[i].toFixed(prec);
                        inp.step = prec <= 1 ? '1' : '0.1';
                        inp.style.cssText = `
                                flex: 1;
                                min-width: 0;
                                width: 0;
                                background: ${COLORS.inputBg};
                                color: ${COLORS.valueText};
                                border: 1px solid ${COLORS.borderLight};
                                border-radius: 0 6px 6px 0;
                                padding: 2px 4px;
                                font-size: 10px;
                                font-family: Consolas, monospace;
                                outline: none;
                                -moz-appearance: textfield;
                                height: 20px;
                        `;
                        inp.onfocus = () => inp.style.borderColor = COLORS.focusBorder;
                        inp.onblur = () => inp.style.borderColor = COLORS.borderLight;
                        inp.onchange = () => {
                                const nv = [val[0], val[1]] as [number, number];
                                nv[i] = parseFloat(inp.value) || 0;
                                cb(nv);
                        };
                        cell.appendChild(inp);
                });
        }

        // Quaternion <-> Euler conversion
        private q2e(q: number[]): [number, number, number] {
                const [x, y, z, w] = q;
                const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)) * 180 / Math.PI;
                const sinp = 2 * (w * y - z * x);
                const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * 90 : Math.asin(sinp) * 180 / Math.PI;
                const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * 180 / Math.PI;
                return [roll, pitch, yaw];
        }

        private e2q(d: number[]): [number, number, number, number] {
                const [rx, ry, rz] = d.map(v => v * Math.PI / 180);
                const cx = Math.cos(rx * .5), sx = Math.sin(rx * .5);
                const cy = Math.cos(ry * .5), sy = Math.sin(ry * .5);
                const cz = Math.cos(rz * .5), sz = Math.sin(rz * .5);
                return [
                        sx * cy * cz - cx * sy * sz,
                        cx * sy * cz + sx * cy * sz,
                        cx * cy * sz - sx * sy * cz,
                        cx * cy * cz + sx * sy * sz
                ];
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // DOM HELPERS
        // ═══════════════════════════════════════════════════════════════════════════════

        private div(p: HTMLElement, css: string = ''): HTMLElement {
                const d = document.createElement('div');
                if (css) d.style.cssText = css;
                p.appendChild(d);
                return d;
        }

        private label(p: HTMLElement, text: string, color: string): HTMLElement {
                const s = document.createElement('span');
                s.textContent = text;
                s.style.color = color;
                s.style.fontSize = '10px';
                p.appendChild(s);
                return s;
        }

        private clear(el: HTMLElement): void {
                while (el.firstChild) el.removeChild(el.firstChild);
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // ADDITIONAL COMPONENT RENDERERS
        // ═══════════════════════════════════════════════════════════════════════════════

        // ── 2D Physics Bodies ──
        private trCharacterBody2D(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Mass', c.mass ?? 1, 0.1, 100, 0.1, v => { c.mass = v; commit(); });
                this.sliderRow(p, 'Gravity Scale', c.gravity_scale ?? 1, 0, 10, 0.1, v => { c.gravity_scale = v; commit(); });
                this.checkboxRow(p, 'Lock Rotation', c.lock_rotation ?? false, v => { c.lock_rotation = v; commit(); });
        }

        private trRigidBody2D(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Mass', c.mass ?? 1, 0.1, 100, 0.1, v => { c.mass = v; commit(); });
                this.sliderRow(p, 'Gravity Scale', c.gravity_scale ?? 1, 0, 10, 0.1, v => { c.gravity_scale = v; commit(); });
                this.sliderRow(p, 'Linear Damping', c.linear_damping ?? 0, 0, 10, 0.1, v => { c.linear_damping = v; commit(); });
                this.sliderRow(p, 'Angular Damping', c.angular_damping ?? 0, 0, 10, 0.1, v => { c.angular_damping = v; commit(); });
        }

        private trStaticBody2D(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Friction', c.friction ?? 0.7, 0, 2, 0.01, v => { c.friction = v; commit(); });
                this.sliderRow(p, 'Restitution', c.restitution ?? 0, 0, 1, 0.01, v => { c.restitution = v; commit(); });
        }

        private trArea2D(p: HTMLElement, c: any, commit: () => void): void {
                this.checkboxRow(p, 'Monitoring', c.monitoring ?? true, v => { c.monitoring = v; commit(); });
                this.checkboxRow(p, 'Monitorable', c.monitorable ?? true, v => { c.monitorable = v; commit(); });
                this.sliderRow(p, 'Priority', c.priority ?? 0, 0, 128, 1, v => { c.priority = v; commit(); });
        }

        private trRayCast2D(p: HTMLElement, c: any, commit: () => void): void {
                this.checkboxRow(p, 'Enabled', c.enabled ?? true, v => { c.enabled = v; commit(); });
                this.vec2Row(p, 'Target Position', c.target_position ?? [0, -1], v => { c.target_position = v; commit(); });
                this.numberRow(p, 'Collision Mask', c.collision_mask ?? 1, v => { c.collision_mask = v; commit(); });
        }

        // ── Additional 3D Nodes ──
        private trSprite3D(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Texture', c.texture ?? '', v => { c.texture = v; commit(); });
                this.checkboxRow(p, 'Flip H', c.flip_h ?? false, v => { c.flip_h = v; commit(); });
                this.checkboxRow(p, 'Flip V', c.flip_v ?? false, v => { c.flip_v = v; commit(); });
                this.sliderRow(p, 'Pixel Size', c.pixel_size ?? 0.01, 0.001, 0.1, 0.001, v => { c.pixel_size = v; commit(); });
        }

        private trLabel3D(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Text', c.text ?? 'Label', v => { c.text = v; commit(); });
                this.sliderRow(p, 'Pixel Size', c.pixel_size ?? 0.01, 0.001, 0.1, 0.001, v => { c.pixel_size = v; commit(); });
                this.colorRow(p, 'Color', c.color ?? [1, 1, 1, 1], v => { c.color = v; commit(); });
        }

        private trMultiMesh(p: HTMLElement, c: any, commit: () => void): void {
                this.numberRow(p, 'Instance Count', c.instance_count ?? 1, v => { c.instance_count = v; commit(); });
                this.textRow(p, 'Mesh', c.mesh ?? '', v => { c.mesh = v; commit(); });
        }

        private trVisibilityNotifier(p: HTMLElement, c: any, commit: () => void, type: '2D' | '3D'): void {
                if (type === '3D') {
                        this.vec3Row(p, 'AABB Position', c.aabb_position ?? [0, 0, 0], v => { c.aabb_position = v; commit(); });
                        this.vec3Row(p, 'AABB Size', c.aabb_size ?? [1, 1, 1], v => { c.aabb_size = v; commit(); });
                } else {
                        this.vec2Row(p, 'Rect Position', c.rect_position ?? [0, 0], v => { c.rect_position = v; commit(); });
                        this.vec2Row(p, 'Rect Size', c.rect_size ?? [1, 1], v => { c.rect_size = v; commit(); });
                }
                this.checkboxRow(p, 'One Shot', c.one_shot ?? false, v => { c.one_shot = v; commit(); });
        }

        private trRemoteTransform(p: HTMLElement, c: any, commit: () => void, type: '2D' | '3D'): void {
                this.textRow(p, 'Remote Path', c.remote_path ?? '', v => { c.remote_path = v; commit(); });
                this.checkboxRow(p, 'Update Position', c.update_position ?? true, v => { c.update_position = v; commit(); });
                this.checkboxRow(p, 'Update Rotation', c.update_rotation ?? true, v => { c.update_rotation = v; commit(); });
                this.checkboxRow(p, 'Update Scale', c.update_scale ?? true, v => { c.update_scale = v; commit(); });
        }

        private trPath2D(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Curve', c.curve ?? '', v => { c.curve = v; commit(); });
                this.checkboxRow(p, 'Closed', c.closed ?? false, v => { c.closed = v; commit(); });
        }

        private trPathFollow2D(p: HTMLElement, c: any, commit: () => void): void {
                this.sliderRow(p, 'Progress', c.progress ?? 0, 0, 1, 0.01, v => { c.progress = v; commit(); });
                this.sliderRow(p, 'Progress Ratio', c.progress_ratio ?? 0, 0, 1, 0.01, v => { c.progress_ratio = v; commit(); });
                this.checkboxRow(p, 'Loop', c.loop ?? true, v => { c.loop = v; commit(); });
        }

        private trNavRegion2D(p: HTMLElement, c: any, commit: () => void): void {
                this.textRow(p, 'Navigation Polygon', c.navigation_polygon ?? '', v => { c.navigation_polygon = v; commit(); });
                this.sliderRow(p, 'Cell Size', c.cell_size ?? 1, 0.1, 10, 0.1, v => { c.cell_size = v; commit(); });
        }

        private trNavObstacle2D(p: HTMLElement, c: any, commit: () => void): void {
                this.vec2Row(p, 'Size', c.size ?? [1, 1], v => { c.size = v; commit(); });
                this.sliderRow(p, 'Radius', c.radius ?? 0, 0, 10, 0.1, v => { c.radius = v; commit(); });
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // CSS INJECTION
        // ═══════════════════════════════════════════════════════════════════════════════

        private injectCSS(): void {
                if (this.cssInjected || document.getElementById('vi-css')) {
                        this.cssInjected = true;
                        return;
                }
                const s = document.createElement('style');
                s.id = 'vi-css';
                s.textContent = `
                        /* ═══════════════════════════════════════════════════════════════
                           Void Engine Inspector - Godot-Style Dark Theme
                           ═══════════════════════════════════════════════════════════════ */
                        
                        /* Slider styling */
                        .vi-slider {
                                -webkit-appearance: none;
                                appearance: none;
                                height: 5px;
                                background: ${COLORS.sliderTrack};
                                border-radius: 999px;
                                outline: none;
                        }
                        .vi-slider::-webkit-slider-thumb {
                                -webkit-appearance: none;
                                width: 11px;
                                height: 11px;
                                border-radius: 50%;
                                background: ${COLORS.sliderThumb};
                                border: none;
                                cursor: pointer;
                                transition: background 0.1s;
                        }
                        .vi-slider::-webkit-slider-thumb:hover {
                                background: ${COLORS.focusBorder};
                        }
                        .vi-slider::-moz-range-thumb {
                                width: 11px;
                                height: 11px;
                                border-radius: 50%;
                                background: ${COLORS.sliderThumb};
                                border: none;
                                cursor: pointer;
                        }
                        .vi-slider::-moz-range-track {
                                height: 5px;
                                background: ${COLORS.sliderTrack};
                                border-radius: 999px;
                        }

                        .vi-color-swatch {
                                -webkit-appearance: none;
                                appearance: none;
                                background: transparent;
                        }
                        .vi-color-swatch::-webkit-color-swatch-wrapper {
                                padding: 0;
                        }
                        .vi-color-swatch::-webkit-color-swatch {
                                border: none;
                                border-radius: 0;
                        }
                        .vi-color-swatch::-moz-color-swatch {
                                border: none;
                                border-radius: 0;
                        }
                        
                        /* Scrollbar */
                        .vi-body::-webkit-scrollbar {
                                width: 8px;
                        }
                        .vi-body::-webkit-scrollbar-track {
                                background: #1a1a1a;
                        }
                        .vi-body::-webkit-scrollbar-thumb {
                                background: #4a4a4a;
                                border-radius: 999px;
                        }
                        .vi-body::-webkit-scrollbar-thumb:hover {
                                background: #4a4a4a;
                        }
                        
                        /* Hide number spinners */
                        input[type=number]::-webkit-inner-spin-button,
                        input[type=number]::-webkit-outer-spin-button {
                                -webkit-appearance: none;
                                margin: 0;
                        }
                        input[type=number] {
                                -moz-appearance: textfield;
                        }
                        
                        /* Property row hover */
                        .vi-prop-row:hover {
                                background: rgba(255,255,255,0.02);
                        }
                        
                        /* Draggable number cursor */
                        .vi-drag-num {
                                cursor: ew-resize;
                        }
                        .vi-drag-num:active {
                                cursor: ew-resize;
                        }
                        
                        /* Color swatch with transparency checker */
                        .vi-color-swatch {
                                position: relative;
                                overflow: hidden;
                        }
                        
                        /* Section header hover */
                        .vi-section-header:hover {
                                background: #292929 !important;
                        }
                        
                        /* Section body animation */
                        .vi-section-body {
                                transition: none;
                        }
                        
                        /* Add Component button */
                        .vi-add-component-btn {
                                transition: none;
                        }
                `;
                document.head.appendChild(s);
                this.cssInjected = true;
        }

        override dispose(): void {
                if (this.rafId !== null) cancelAnimationFrame(this.rafId);
                super.dispose();
        }
}

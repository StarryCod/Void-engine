/*---------------------------------------------------------------------------------------------
 *  Void Scene Bridge — Single Source of Truth (COMPLETE REWRITE)
 *
 *  ALL data flows through here:
 *  - Viewport gizmo ──► updateTransform() ──► patches in-memory + raw ──► fires events
 *  - Inspector edit ──► commitInspectorEdit() ──► serializes ──► fires events
 *  - Text editor type ──► loadFromText() ──► parses ──► fires events
 *  - Disk file change ──► loadFromText() ──► parses ──► fires events
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { Entity } from './vecnTypes.js';
import { VecnParser, VecnScene } from './vecnParser.js';
import { validateVecnScene, VecnValidationResult } from './vecnValidation.js';
import { diffVecnScenes, mergeVecnScenes, VecnMergeStrategy, VecnSceneDiff } from './vecnDiff.js';

export interface BridgeUpdate {
        readonly entities: Entity[];
        readonly raw: string;
        readonly source: 'viewport' | 'inspector' | 'editor' | 'disk' | 'init' | 'history';
        readonly timestamp: number;
}

export interface TransformPatch {
        entityId: string;
        translation: [number, number, number];
        rotation: [number, number, number, number];
        scale: [number, number, number];
}

export interface Transform2DPatch {
        entityId: string;
        position: [number, number];
        rotation?: number;
        scale?: [number, number];
}

interface BridgeHistorySnapshot {
        readonly raw: string;
        readonly selectedEntityId: string | null;
}

export interface BridgeHistoryState {
        readonly canUndo: boolean;
        readonly canRedo: boolean;
        readonly undoDepth: number;
        readonly redoDepth: number;
}

const EMPTY_VALIDATION: VecnValidationResult = {
        ok: true,
        normalizedContent: '',
        originalVersion: '1.0',
        effectiveVersion: '1.0',
        migrated: false,
        migrationNotes: [],
        issues: [],
};

class SceneBridge extends Disposable {

        // ── Master State ──
        private _uri: URI | null = null;
        private _scene: VecnScene | null = null;
        private _raw: string = '';
        private _hash: number = 0;
        private _validation: VecnValidationResult = EMPTY_VALIDATION;
        private _selectedEntityId: string | null = null;
        private readonly _undoStack: BridgeHistorySnapshot[] = [];
        private readonly _redoStack: BridgeHistorySnapshot[] = [];
        private _transformHistoryTimer: any = null;
        private _transformHistoryArmed = true;
        private readonly historyLimit = 200;

        // ── Events ──
        private readonly _onSceneUpdated = new Emitter<BridgeUpdate>();
        public readonly onSceneUpdated: Event<BridgeUpdate> = this._onSceneUpdated.event;

        private readonly _onNeedsSave = new Emitter<{ uri: URI; content: string }>();
        public readonly onNeedsSave: Event<{ uri: URI; content: string }> = this._onNeedsSave.event;

        private readonly _onEntitySelected = new Emitter<string | null>();
        public readonly onEntitySelected: Event<string | null> = this._onEntitySelected.event;

        private readonly _onValidationChanged = new Emitter<VecnValidationResult>();
        public readonly onValidationChanged: Event<VecnValidationResult> = this._onValidationChanged.event;

        private readonly _onHistoryChanged = new Emitter<BridgeHistoryState>();
        public readonly onHistoryChanged: Event<BridgeHistoryState> = this._onHistoryChanged.event;

        private _saveTimer: any = null;

        // ── Getters ──
        get uri(): URI | null { return this._uri; }
        public setUri(uri: URI): void { this._uri = uri; }
        public getEntities(): Entity[] { return this._scene?.entities ?? []; }
        public getRaw(): string { return this._raw; }
        public getSelectedEntityId(): string | null { return this._selectedEntityId; }
        public hasScene(): boolean { return this._scene !== null && this._scene.entities.length > 0; }
        public getValidation(): VecnValidationResult { return this._validation; }
        public canUndo(): boolean { return this._undoStack.length > 0; }
        public canRedo(): boolean { return this._redoStack.length > 0; }
        public getHistoryState(): BridgeHistoryState {
                return {
                        canUndo: this.canUndo(),
                        canRedo: this.canRedo(),
                        undoDepth: this._undoStack.length,
                        redoDepth: this._redoStack.length,
                };
        }
        public diffWithContent(content: string): VecnSceneDiff | null {
                if (!this._scene || !content.trim()) {
                        return null;
                }
                const parsed = VecnParser.parse(content);
                if (!parsed) {
                        return null;
                }
                return diffVecnScenes(this._scene, parsed);
        }

        public mergeFromContent(content: string, strategy: VecnMergeStrategy = 'smart'): boolean {
                if (!this._scene || !content.trim()) {
                        return false;
                }
                const parsed = VecnParser.parse(content);
                if (!parsed) {
                        return false;
                }

                this.pushUndoSnapshot();
                this._scene = mergeVecnScenes(this._scene, parsed, strategy);
                this._raw = VecnParser.serialize(this._scene);
                this._hash = this.hash(this._raw);

                this._onSceneUpdated.fire({
                        entities: this._scene.entities,
                        raw: this._raw,
                        source: 'inspector',
                        timestamp: Date.now(),
                });

                this.scheduleSave();
                return true;
        }

        // ================================================================
        // 1. Load from text (disk / editor typing / initial load)
        // ================================================================
        public loadFromText(content: string, source: BridgeUpdate['source'] = 'disk'): boolean {
                if (!content || !content.trim()) return false;

                const validation = validateVecnScene(content);
                this._validation = validation;
                this._onValidationChanged.fire(validation);
                if (!validation.ok) return false;

                const normalizedContent = validation.normalizedContent;
                const hash = this.hash(normalizedContent);
                if (hash === this._hash && this._scene) return false; // Identical content, skip

                const parsed = VecnParser.parse(normalizedContent);
                if (!parsed) return false; // Syntax error — keep old state

                this._scene = parsed;
                this._raw = normalizedContent;
                this._hash = hash;
                this.resetHistoryToCurrentScene();

                this._onSceneUpdated.fire({
                        entities: parsed.entities,
                        raw: this._raw,
                        source,
                        timestamp: Date.now(),
                });

                if (validation.migrated && (source === 'init' || source === 'disk')) {
                        this.scheduleSave();
                }
                return true;
        }

        // ================================================================
        // 2. Transform update from Viewport gizmo (called ~60fps during drag)
        // ================================================================
        public updateTransform(patch: TransformPatch): void {
                if (!this._scene) return;

                // 2a. Update in-memory entity (so Inspector sees fresh values)
                const entity = this.findEntity(this._scene.entities, patch.entityId);
                if (!entity) {
                        return;
                }
                const tr = entity.components.find(c => c.type === 'Transform');
                if (!tr || tr.type !== 'Transform') {
                        return;
                }
                this.pushTransformUndoSnapshotOnce();
                tr.translation = [patch.translation[0], patch.translation[1], patch.translation[2]];
                tr.rotation = [patch.rotation[0], patch.rotation[1], patch.rotation[2], patch.rotation[3]];
                tr.scale = [patch.scale[0], patch.scale[1], patch.scale[2]];

                // 2b. Patch raw text (fast regex, preserves comments/formatting)
                this._raw = this.patchRawTRS(this._raw, patch);
                this._hash = this.hash(this._raw);

                // 2c. Notify consumers (Inspector re-reads, Hierarchy skips for perf)
                this._onSceneUpdated.fire({
                        entities: this._scene.entities,
                        raw: this._raw,
                        source: 'viewport',
                        timestamp: Date.now(),
                });

                // 2d. Debounced save
                this.scheduleSave();
        }

        // ================================================================
        // 2D transform update from 2D viewport drag
        // ================================================================
        public updateTransform2D(patch: Transform2DPatch): void {
                if (!this._scene) return;

                const entity = this.findEntity(this._scene.entities, patch.entityId);
                if (!entity) return;

                const tr2d = entity.components.find(c => c.type === 'Transform2D');
                if (!tr2d || tr2d.type !== 'Transform2D') return;
                this.pushTransformUndoSnapshotOnce();

                tr2d.position = [patch.position[0], patch.position[1]];
                if (typeof patch.rotation === 'number') {
                        tr2d.rotation = patch.rotation;
                }
                if (patch.scale) {
                        tr2d.scale = [patch.scale[0], patch.scale[1]];
                }

                this._raw = VecnParser.serialize(this._scene);
                this._hash = this.hash(this._raw);

                this._onSceneUpdated.fire({
                        entities: this._scene.entities,
                        raw: this._raw,
                        source: 'viewport',
                        timestamp: Date.now(),
                });

                this.scheduleSave();
        }

        // ================================================================
        // 3. Inspector committed an edit (mutated entities in place, now serialize)
        // ================================================================
        public commitInspectorEdit(): void {
                if (!this._scene) return;
                this.pushUndoSnapshot();

                // Full serialize (inspector edits can be anything: color, shape params, etc.)
                this._raw = VecnParser.serialize(this._scene);
                this._hash = this.hash(this._raw);

                this._onSceneUpdated.fire({
                        entities: this._scene.entities,
                        raw: this._raw,
                        source: 'inspector',
                        timestamp: Date.now(),
                });

                this.scheduleSave();
        }

        // ================================================================
        // 3b. Mass-apply component template to all entities with same component type
        // ================================================================
        public applyComponentTemplateToAll(componentType: string, componentTemplate: any): number {
                if (!this._scene) {
                        return 0;
                }

                let changed = 0;

                const walk = (entities: Entity[]) => {
                        for (const entity of entities) {
                                for (let i = 0; i < entity.components.length; i++) {
                                        if (entity.components[i].type !== componentType) {
                                                continue;
                                        }
                                        if (changed === 0) {
                                                this.pushUndoSnapshot();
                                        }
                                        entity.components[i] = this.deepClone(componentTemplate);
                                        changed++;
                                }
                                if (entity.children.length > 0) {
                                        walk(entity.children);
                                }
                        }
                };

                walk(this._scene.entities);

                if (changed === 0) {
                        return 0;
                }

                this._raw = VecnParser.serialize(this._scene);
                this._hash = this.hash(this._raw);

                this._onSceneUpdated.fire({
                        entities: this._scene.entities,
                        raw: this._raw,
                        source: 'inspector',
                        timestamp: Date.now(),
                });

                this.scheduleSave();
                return changed;
        }

        // ================================================================
        // 4. Entity selection
        // ================================================================
        public selectEntity(id: string | null): void {
                this._selectedEntityId = id;
                this._onEntitySelected.fire(id);
        }

        // ================================================================
        // 5. Create new entity
        // ================================================================
        public createEntity(type: string, parentId?: string): Entity | null {
                if (!this._scene) return null;
                this.pushUndoSnapshot();

                // Generate new entity
                const newEntity: Entity = {
                        id: this.generateId(),
                        name: `New${type}`,
                        visible: true,
                        components: [
                                {
                                        type: 'Transform',
                                        translation: [0, 0, 0],
                                        rotation: [0, 0, 0, 1],
                                        scale: [1, 1, 1]
                                }
                        ],
                        children: []
                };

                // Add type-specific components
                console.log('[SceneBridge] Creating entity type:', type);
                switch (type) {
                        case 'meshinstance3d':
                                console.log('[SceneBridge] Adding Mesh and Material components');
                                newEntity.name = 'MeshInstance3D';
                                newEntity.components.push({
                                        type: 'Mesh',
                                        shape: { type: 'Cube', size: 1 }
                                });
                                newEntity.components.push({
                                        type: 'Material',
                                        color: [0.6, 0.6, 0.6, 1.0],
                                        metallic: 0,
                                        roughness: 0.8
                                });
                                break;
                        case 'collisionshape3d':
                                newEntity.name = 'CollisionShape3D';
                                newEntity.components.push({
                                        type: 'CollisionShape',
                                        shape: { type: 'Box', size: 1 }
                                });
                                break;
                        case 'cube':
                                newEntity.name = 'Cube';
                                newEntity.components.push({
                                        type: 'Mesh',
                                        shape: { type: 'Cube', size: 1 }
                                });
                                newEntity.components.push({
                                        type: 'Material',
                                        color: [0.6, 0.6, 0.6, 1.0],
                                        metallic: 0,
                                        roughness: 0.8
                                });
                                break;
                        case 'sphere':
                                newEntity.name = 'Sphere';
                                newEntity.components.push({
                                        type: 'Mesh',
                                        shape: { type: 'Sphere', radius: 0.5 }
                                });
                                newEntity.components.push({
                                        type: 'Material',
                                        color: [0.6, 0.6, 0.6, 1.0],
                                        metallic: 0,
                                        roughness: 0.8
                                });
                                break;
                        case 'cylinder':
                                newEntity.name = 'Cylinder';
                                newEntity.components.push({
                                        type: 'Mesh',
                                        shape: { type: 'Cylinder', radius: 0.5, height: 1.0 }
                                });
                                newEntity.components.push({
                                        type: 'Material',
                                        color: [0.6, 0.6, 0.6, 1.0],
                                        metallic: 0,
                                        roughness: 0.8
                                });
                                break;
                        case 'cone':
                                newEntity.name = 'Cone';
                                newEntity.components.push({
                                        type: 'Mesh',
                                        shape: { type: 'Cone', radius: 0.5, height: 1.0 }
                                });
                                newEntity.components.push({
                                        type: 'Material',
                                        color: [0.6, 0.6, 0.6, 1.0],
                                        metallic: 0,
                                        roughness: 0.8
                                });
                                break;
                        case 'torus':
                                newEntity.name = 'Torus';
                                newEntity.components.push({
                                        type: 'Mesh',
                                        shape: { type: 'Torus', radius: 0.5, tube: 0.2 }
                                });
                                newEntity.components.push({
                                        type: 'Material',
                                        color: [0.6, 0.6, 0.6, 1.0],
                                        metallic: 0,
                                        roughness: 0.8
                                });
                                break;
                        case 'plane':
                                newEntity.name = 'Plane';
                                newEntity.components.push({
                                        type: 'Mesh',
                                        shape: { type: 'Plane', size: 10 }
                                });
                                newEntity.components.push({
                                        type: 'Material',
                                        color: [0.6, 0.6, 0.6, 1.0],
                                        metallic: 0,
                                        roughness: 0.8
                                });
                                break;
                        case 'point light':
                                newEntity.name = 'Point Light';
                                newEntity.components.push({
                                        type: 'PointLight',
                                        color: [1.0, 1.0, 1.0],
                                        intensity: 1000,
                                        range: 10.0
                                });
                                break;
                        case 'directional light':
                                newEntity.name = 'Sun Light';
                                newEntity.components.push({
                                        type: 'DirectionalLight',
                                        color: [1.0, 1.0, 0.9],
                                        illuminance: 1.0
                                });
                                break;
                        case 'perspective camera':
                                newEntity.name = 'Camera';
                                newEntity.components.push({
                                        type: 'Camera',
                                        fov: 60,
                                        near: 0.1,
                                        far: 1000
                                });
                                break;
                        case 'empty':
                                newEntity.name = 'Node3D';
                                // Only Transform component
                                break;
                        
                        // === PHYSICS 3D ===
                        case 'characterbody3d':
                                newEntity.name = 'CharacterBody3D';
                                newEntity.components.push({
                                        type: 'CharacterBody',
                                        mass: 1.0,
                                        gravity_scale: 1.0,
                                        lock_rotation: false
                                });
                                break;
                        case 'rigidbody3d':
                                newEntity.name = 'RigidBody3D';
                                newEntity.components.push({
                                        type: 'RigidBody',
                                        mass: 1.0,
                                        gravity_scale: 1.0,
                                        linear_damping: 0.0,
                                        angular_damping: 0.0,
                                        lock_rotation_x: false,
                                        lock_rotation_y: false,
                                        lock_rotation_z: false
                                });
                                break;
                        case 'staticbody3d':
                                newEntity.name = 'StaticBody3D';
                                newEntity.components.push({
                                        type: 'StaticBody',
                                        friction: 1.0,
                                        restitution: 0.0
                                });
                                break;
                        case 'area3d':
                                newEntity.name = 'Area3D';
                                newEntity.components.push({
                                        type: 'Area',
                                        monitoring: true,
                                        monitorable: true,
                                        priority: 0
                                });
                                break;
                        case 'raycast3d':
                                newEntity.name = 'RayCast3D';
                                newEntity.components.push({
                                        type: 'RayCast',
                                        enabled: true,
                                        target_position: [0, 0, -1],
                                        collision_mask: 1,
                                        hit_from_inside: false
                                });
                                break;
                        case 'shapecast3d':
                                newEntity.name = 'ShapeCast3D';
                                newEntity.components.push({
                                        type: 'ShapeCast',
                                        enabled: true,
                                        shape: { type: 'Sphere', radius: 0.5 },
                                        target_position: [0, 0, -1],
                                        collision_mask: 1,
                                        max_results: 32
                                });
                                break;
                        case 'spotlight':
                                newEntity.name = 'SpotLight3D';
                                newEntity.components.push({
                                        type: 'SpotLight',
                                        color: [1.0, 1.0, 1.0],
                                        intensity: 1000,
                                        range: 10.0,
                                        angle: 45,
                                        attenuation: 1.0
                                });
                                break;
                        
                        // === 3D VISUAL ===
                        case 'sprite3d':
                                newEntity.name = 'Sprite3D';
                                newEntity.components.push({
                                        type: 'Sprite3D',
                                        texture: '',
                                        billboard: 'Enabled',
                                        transparent: true,
                                        shaded: false,
                                        double_sided: true,
                                        alpha_cut: 0.5
                                });
                                break;
                        case 'animatedsprite3d':
                                newEntity.name = 'AnimatedSprite3D';
                                newEntity.components.push({
                                        type: 'AnimatedSprite3D',
                                        sprite_frames: '',
                                        animation: 'default',
                                        frame: 0,
                                        playing: false,
                                        billboard: 'Enabled'
                                });
                                break;
                        case 'label3d':
                                newEntity.name = 'Label3D';
                                newEntity.components.push({
                                        type: 'Label3D',
                                        text: 'Label',
                                        font_size: 32,
                                        outline_size: 0,
                                        modulate: [1, 1, 1, 1],
                                        billboard: 'Enabled'
                                });
                                break;
                        case 'gpuparticles3d':
                                newEntity.name = 'GPUParticles3D';
                                newEntity.components.push({
                                        type: 'GPUParticles3D',
                                        emitting: false,
                                        amount: 8,
                                        lifetime: 1.0,
                                        one_shot: false,
                                        explosiveness: 0.0,
                                        randomness: 0.0,
                                        visibility_aabb: [-4, -4, -4, 4, 4, 4]
                                });
                                break;
                        case 'cpuparticles3d':
                                newEntity.name = 'CPUParticles3D';
                                newEntity.components.push({
                                        type: 'CPUParticles3D',
                                        emitting: false,
                                        amount: 8,
                                        lifetime: 1.0,
                                        one_shot: false,
                                        explosiveness: 0.0,
                                        randomness: 0.0,
                                        emission_shape: 'Point'
                                });
                                break;
                        case 'multimeshinstance3d':
                                newEntity.name = 'MultiMeshInstance3D';
                                newEntity.components.push({
                                        type: 'MultiMeshInstance3D',
                                        instance_count: 0,
                                        visible_instance_count: -1,
                                        mesh: '',
                                        transform_format: '3D'
                                });
                                break;
                        
                        // === 2D ===
                        case 'node2d':
                                newEntity.name = 'Node2D';
                                newEntity.components = [{
                                        type: 'Transform2D',
                                        position: [0, 0],
                                        rotation: 0,
                                        scale: [1, 1]
                                }];
                                break;
                        case 'sprite2d':
                                newEntity.name = 'Sprite2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'Sprite2D', texture: '', region_enabled: false, region_rect: [0, 0, 0, 0], offset: [0, 0] }
                                ];
                                break;
                        case 'animatedsprite2d':
                                newEntity.name = 'AnimatedSprite2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'AnimatedSprite2D', sprite_frames: '', animation: 'default', frame: 0, playing: false, speed_scale: 1.0 }
                                ];
                                break;
                        case 'marker2d':
                                newEntity.name = 'Marker2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'Marker2D', gizmo_extents: 10 }
                                ];
                                break;
                        
                        // === PHYSICS 2D ===
                        case 'characterbody2d':
                                newEntity.name = 'CharacterBody2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'CharacterBody2D', motion_mode: 'Grounded', up_direction: [0, -1], velocity: [0, 0], max_slides: 4, floor_stop_on_slope: true }
                                ];
                                break;
                        case 'rigidbody2d':
                                newEntity.name = 'RigidBody2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'RigidBody2D', mass: 1.0, gravity_scale: 1.0, linear_damp: 0.0, angular_damp: 0.0, lock_rotation: false }
                                ];
                                break;
                        case 'staticbody2d':
                                newEntity.name = 'StaticBody2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'StaticBody2D', friction: 1.0, bounce: 0.0 }
                                ];
                                break;
                        case 'area2d':
                                newEntity.name = 'Area2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'Area2D', monitoring: true, monitorable: true, priority: 0, gravity_space_override: 'Disabled' }
                                ];
                                break;
                        case 'collisionshape2d':
                                newEntity.name = 'CollisionShape2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'CollisionShape2D', shape: { type: 'Rectangle', size: [20, 20] }, disabled: false, one_way_collision: false }
                                ];
                                break;
                        case 'raycast2d':
                                newEntity.name = 'RayCast2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'RayCast2D', enabled: true, target_position: [0, 50], collision_mask: 1, hit_from_inside: false }
                                ];
                                break;
                        
                        // === AUDIO ===
                        case 'audiostreamplayer':
                                newEntity.name = 'AudioStreamPlayer';
                                newEntity.components.push({
                                        type: 'AudioStreamPlayer',
                                        stream: '',
                                        volume_db: 0,
                                        pitch_scale: 1.0,
                                        playing: false,
                                        autoplay: false,
                                        stream_paused: false
                                });
                                break;
                        case 'audiostreamplayer2d':
                                newEntity.name = 'AudioStreamPlayer2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'AudioStreamPlayer2D', stream: '', volume_db: 0, pitch_scale: 1.0, playing: false, autoplay: false, max_distance: 2000, attenuation: 1.0 }
                                ];
                                break;
                        case 'audiostreamplayer3d':
                                newEntity.name = 'AudioStreamPlayer3D';
                                newEntity.components.push({
                                        type: 'AudioStreamPlayer3D',
                                        stream: '',
                                        volume_db: 0,
                                        pitch_scale: 1.0,
                                        playing: false,
                                        autoplay: false,
                                        max_distance: 0,
                                        attenuation_model: 'InverseDistance',
                                        emission_angle_enabled: false,
                                        emission_angle_degrees: 45
                                });
                                break;
                        
                        // === ANIMATION ===
                        case 'animationplayer':
                                newEntity.name = 'AnimationPlayer';
                                newEntity.components.push({
                                        type: 'AnimationPlayer',
                                        current_animation: '',
                                        playback_speed: 1.0,
                                        autoplay: '',
                                        playback_active: true,
                                        playback_default_blend_time: 0.0
                                });
                                break;
                        case 'animationtree':
                                newEntity.name = 'AnimationTree';
                                newEntity.components.push({
                                        type: 'AnimationTree',
                                        tree_root: '',
                                        anim_player: '',
                                        active: false,
                                        process_callback: 'Idle'
                                });
                                break;
                        case 'tween':
                                newEntity.name = 'Tween';
                                newEntity.components.push({
                                        type: 'Tween',
                                        active: false,
                                        speed_scale: 1.0
                                });
                                break;
                        
                        // === NAVIGATION ===
                        case 'navigationregion3d':
                                newEntity.name = 'NavigationRegion3D';
                                newEntity.components.push({
                                        type: 'NavigationRegion3D',
                                        enabled: true,
                                        navigation_layers: 1,
                                        enter_cost: 0.0,
                                        travel_cost: 1.0
                                });
                                break;
                        case 'navigationagent3d':
                                newEntity.name = 'NavigationAgent3D';
                                newEntity.components.push({
                                        type: 'NavigationAgent3D',
                                        target_position: [0, 0, 0],
                                        path_desired_distance: 1.0,
                                        target_desired_distance: 1.0,
                                        radius: 0.5,
                                        height: 2.0,
                                        max_speed: 10.0,
                                        avoidance_enabled: false
                                });
                                break;
                        case 'navigationobstacle3d':
                                newEntity.name = 'NavigationObstacle3D';
                                newEntity.components.push({
                                        type: 'NavigationObstacle3D',
                                        radius: 0.5,
                                        height: 2.0,
                                        avoidance_enabled: false,
                                        velocity: [0, 0, 0]
                                });
                                break;
                        case 'navigationregion2d':
                                newEntity.name = 'NavigationRegion2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'NavigationRegion2D', enabled: true, navigation_layers: 1, enter_cost: 0.0, travel_cost: 1.0 }
                                ];
                                break;
                        case 'navigationagent2d':
                                newEntity.name = 'NavigationAgent2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'NavigationAgent2D', target_position: [0, 0], path_desired_distance: 1.0, target_desired_distance: 1.0, radius: 10, max_speed: 200, avoidance_enabled: false }
                                ];
                                break;
                        case 'navigationobstacle2d':
                                newEntity.name = 'NavigationObstacle2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'NavigationObstacle2D', radius: 10, avoidance_enabled: false, velocity: [0, 0] }
                                ];
                                break;
                        
                        // === ENVIRONMENT ===
                        case 'worldenvironment':
                                newEntity.name = 'WorldEnvironment';
                                newEntity.components.push({
                                        type: 'WorldEnvironment',
                                        environment: '',
                                        camera_attributes: '',
                                        background_mode: 'Sky',
                                        background_color: [0.11, 0.13, 0.17, 1],
                                        gradient_top: [0.22, 0.30, 0.41, 1],
                                        gradient_bottom: [0.56, 0.61, 0.67, 1],
                                        ambient_light_energy: 0.42,
                                        ambient_light_color: [0.44, 0.47, 0.52, 1],
                                        ambient_light_sky_contribution: 0.9,
                                        reflected_light_energy: 0.95,
                                        tonemap_mode: 'Filmic',
                                        tonemap_exposure: 0.88,
                                        tonemap_white: 1.25,
                                        ssao_enabled: false,
                                        ssao_intensity: 1.0,
                                        ssao_radius: 1.0,
                                        glow_enabled: false,
                                        glow_intensity: 0.15,
                                        glow_threshold: 1.25,
                                        post_bloom_enabled: false,
                                        post_bloom_intensity: 0.15,
                                        post_bloom_threshold: 1.25,
                                        post_ao_enabled: false,
                                        post_ao_intensity: 1.0,
                                        post_ao_radius: 1.0,
                                        color_grading_enabled: false,
                                        color_grading_temperature: 0.0,
                                        color_grading_contrast: 1.0,
                                        color_grading_saturation: 1.0,
                                        shadow_profile: 'high',
                                        render_debug_view: 'final',
                                        sky_material: 'ProceduralSky',
                                        radiance_size: 'Size1024',
                                        sky_top_color: [0.20, 0.33, 0.56, 1],
                                        sky_horizon_color: [0.66, 0.74, 0.84, 1],
                                        sky_curve: 0.58,
                                        sky_energy: 1.02,
                                        ground_bottom_color: [0.12, 0.10, 0.08, 1],
                                        ground_horizon_color: [0.32, 0.30, 0.26, 1],
                                        ground_curve: 0.52,
                                        ground_energy: 0.96,
                                        sun_enabled: true,
                                        sun_angle_min: 0.28,
                                        sun_angle_max: 1.45,
                                        sun_curve: 0.04,
                                        sun_energy: 4.2,
                                        sun_color: [1.0, 0.94, 0.82, 1],
                                        sun_position: [0.38, 0.78, -0.28],
                                        clouds_enabled: true,
                                        clouds_color: [0.95, 0.95, 0.93, 1],
                                        clouds_density: 0.42,
                                        clouds_speed: 0.015,
                                        clouds_height: 1300,
                                        clouds_coverage: 0.58,
                                        clouds_thickness: 260,
                                        clouds_layer1_speed: 1.0,
                                        clouds_layer2_speed: 0.62,
                                        clouds_detail_strength: 1.0,
                                        fog_enabled: true,
                                        fog_density: 0.00035,
                                        fog_depth_begin: 80,
                                        fog_depth_end: 3500,
                                        fog_color: [0.68, 0.72, 0.78, 1]
                                });
                                break;
                        case 'sky':
                                newEntity.name = 'WorldEnvironment';
                                newEntity.components.push({
                                        type: 'WorldEnvironment',
                                        environment: '',
                                        camera_attributes: '',
                                        background_mode: 'Sky',
                                        background_color: [0.11, 0.13, 0.17, 1],
                                        gradient_top: [0.22, 0.30, 0.41, 1],
                                        gradient_bottom: [0.56, 0.61, 0.67, 1],
                                        ambient_light_energy: 0.42,
                                        ambient_light_color: [0.44, 0.47, 0.52, 1],
                                        ambient_light_sky_contribution: 0.9,
                                        reflected_light_energy: 0.95,
                                        tonemap_mode: 'Filmic',
                                        tonemap_exposure: 0.88,
                                        tonemap_white: 1.25,
                                        ssao_enabled: false,
                                        ssao_intensity: 1.0,
                                        ssao_radius: 1.0,
                                        glow_enabled: false,
                                        glow_intensity: 0.15,
                                        glow_threshold: 1.25,
                                        post_bloom_enabled: false,
                                        post_bloom_intensity: 0.15,
                                        post_bloom_threshold: 1.25,
                                        post_ao_enabled: false,
                                        post_ao_intensity: 1.0,
                                        post_ao_radius: 1.0,
                                        color_grading_enabled: false,
                                        color_grading_temperature: 0.0,
                                        color_grading_contrast: 1.0,
                                        color_grading_saturation: 1.0,
                                        shadow_profile: 'high',
                                        render_debug_view: 'final',
                                        sky_material: 'ProceduralSky',
                                        radiance_size: 'Size1024',
                                        sky_top_color: [0.20, 0.33, 0.56, 1],
                                        sky_horizon_color: [0.66, 0.74, 0.84, 1],
                                        sky_curve: 0.58,
                                        sky_energy: 1.02,
                                        ground_bottom_color: [0.12, 0.10, 0.08, 1],
                                        ground_horizon_color: [0.32, 0.30, 0.26, 1],
                                        ground_curve: 0.52,
                                        ground_energy: 0.96,
                                        sun_enabled: true,
                                        sun_angle_min: 0.28,
                                        sun_angle_max: 1.45,
                                        sun_curve: 0.04,
                                        sun_energy: 4.2,
                                        sun_color: [1.0, 0.94, 0.82, 1],
                                        sun_position: [0.38, 0.78, -0.28],
                                        clouds_enabled: true,
                                        clouds_color: [0.95, 0.95, 0.93, 1],
                                        clouds_density: 0.42,
                                        clouds_speed: 0.015,
                                        clouds_height: 1300,
                                        clouds_coverage: 0.58,
                                        clouds_thickness: 260,
                                        clouds_layer1_speed: 1.0,
                                        clouds_layer2_speed: 0.62,
                                        clouds_detail_strength: 1.0,
                                        fog_enabled: true,
                                        fog_density: 0.00035,
                                        fog_depth_begin: 80,
                                        fog_depth_end: 3500,
                                        fog_color: [0.68, 0.72, 0.78, 1]
                                });
                                break;
                        case 'fogvolume':
                                newEntity.name = 'FogVolume';
                                newEntity.components.push({
                                        type: 'FogVolume',
                                        density: 1.0,
                                        albedo: [1, 1, 1],
                                        emission: [0, 0, 0],
                                        height_falloff: 0.0
                                });
                                break;
                        case 'reflectionprobe':
                                newEntity.name = 'ReflectionProbe';
                                newEntity.components.push({
                                        type: 'ReflectionProbe',
                                        update_mode: 'Once',
                                        intensity: 1.0,
                                        max_distance: 0,
                                        extents: [1, 1, 1],
                                        origin_offset: [0, 0, 0],
                                        box_projection: false,
                                        enable_shadows: false
                                });
                                break;
                        
                        // === UTILITIES ===
                        case 'timer':
                                newEntity.name = 'Timer';
                                newEntity.components.push({
                                        type: 'Timer',
                                        wait_time: 1.0,
                                        one_shot: false,
                                        autostart: false,
                                        time_left: 0,
                                        paused: false
                                });
                                break;
                        case 'path3d':
                                newEntity.name = 'Path3D';
                                newEntity.components.push({
                                        type: 'Path3D',
                                        curve: ''
                                });
                                break;
                        case 'pathfollow3d':
                                newEntity.name = 'PathFollow3D';
                                newEntity.components.push({
                                        type: 'PathFollow3D',
                                        progress: 0,
                                        progress_ratio: 0,
                                        h_offset: 0,
                                        v_offset: 0,
                                        rotation_mode: 'XYZ',
                                        cubic_interp: true,
                                        loop: true
                                });
                                break;
                        case 'path2d':
                                newEntity.name = 'Path2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'Path2D', curve: '' }
                                ];
                                break;
                        case 'pathfollow2d':
                                newEntity.name = 'PathFollow2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'PathFollow2D', progress: 0, progress_ratio: 0, h_offset: 0, v_offset: 0, rotates: true, cubic_interp: true, loop: true }
                                ];
                                break;
                        case 'remotetransform3d':
                                newEntity.name = 'RemoteTransform3D';
                                newEntity.components.push({
                                        type: 'RemoteTransform3D',
                                        remote_path: '',
                                        use_global_coordinates: true,
                                        update_position: true,
                                        update_rotation: true,
                                        update_scale: true
                                });
                                break;
                        case 'remotetransform2d':
                                newEntity.name = 'RemoteTransform2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'RemoteTransform2D', remote_path: '', use_global_coordinates: true, update_position: true, update_rotation: true, update_scale: true }
                                ];
                                break;
                        case 'marker3d':
                                newEntity.name = 'Marker3D';
                                newEntity.components.push({
                                        type: 'Marker3D',
                                        gizmo_extents: 1.0
                                });
                                break;
                        case 'visibleonscreennotifier3d':
                                newEntity.name = 'VisibleOnScreenNotifier3D';
                                newEntity.components.push({
                                        type: 'VisibleOnScreenNotifier3D',
                                        aabb: [-1, -1, -1, 1, 1, 1]
                                });
                                break;
                        case 'visibleonscreennotifier2d':
                                newEntity.name = 'VisibleOnScreenNotifier2D';
                                newEntity.components = [
                                        { type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
                                        { type: 'VisibleOnScreenNotifier2D', rect: [-10, -10, 20, 20] }
                                ];
                                break;
                        
                        // === SPECIAL ===
                        case 'viewport':
                                newEntity.name = 'Viewport';
                                newEntity.components.push({
                                        type: 'Viewport',
                                        size: [512, 512],
                                        transparent_bg: false,
                                        msaa: 'Disabled',
                                        screen_space_aa: 'Disabled',
                                        use_debanding: false,
                                        use_occlusion_culling: false
                                });
                                break;
                        case 'subviewport':
                                newEntity.name = 'SubViewport';
                                newEntity.components.push({
                                        type: 'SubViewport',
                                        size: [512, 512],
                                        render_target_update_mode: 'WhenVisible'
                                });
                                break;
                        case 'canvaslayer':
                                newEntity.name = 'CanvasLayer';
                                newEntity.components.push({
                                        type: 'CanvasLayer',
                                        layer: 1,
                                        offset: [0, 0],
                                        rotation: 0,
                                        scale: [1, 1],
                                        follow_viewport_enabled: false
                                });
                                break;
                        case 'skeleton3d':
                                newEntity.name = 'Skeleton3D';
                                newEntity.components.push({
                                        type: 'Skeleton3D',
                                        bones: [],
                                        bone_poses: []
                                });
                                break;
                        case 'boneattachment3d':
                                newEntity.name = 'BoneAttachment3D';
                                newEntity.components.push({
                                        type: 'BoneAttachment3D',
                                        bone_name: '',
                                        bone_idx: -1
                                });
                                break;
                }

                // Add to parent or root
                if (parentId) {
                        const parent = this.findEntity(this._scene.entities, parentId);
                        if (parent) {
                                parent.children.push(newEntity);
                        } else {
                                this._scene.entities.push(newEntity);
                        }
                } else {
                        this._scene.entities.push(newEntity);
                }

                // Serialize and update
                this._raw = VecnParser.serialize(this._scene);
                this._hash = this.hash(this._raw);

                this._onSceneUpdated.fire({
                        entities: this._scene.entities,
                        raw: this._raw,
                        source: 'inspector',
                        timestamp: Date.now(),
                });

                this.scheduleSave();
                return newEntity;
        }

        // ================================================================
        // 6. Delete entity
        // ================================================================
        public deleteEntity(entityId: string): boolean {
                if (!this._scene) return false;
                if (!this.findEntity(this._scene.entities, entityId)) return false;
                this.pushUndoSnapshot();

                const removed = this.removeEntityFromTree(this._scene.entities, entityId);
                if (!removed) return false;

                // Serialize and update
                this._raw = VecnParser.serialize(this._scene);
                this._hash = this.hash(this._raw);

                this._onSceneUpdated.fire({
                        entities: this._scene.entities,
                        raw: this._raw,
                        source: 'inspector',
                        timestamp: Date.now(),
                });

                this.scheduleSave();
                return true;
        }

        // ================================================================
        // 7. Reparent entity (drag & drop)
        // ================================================================
        public reparentEntity(entityId: string, newParentId: string): boolean {
                if (!this._scene) return false;

                // Find and remove from current parent
                const entity = this.findEntity(this._scene.entities, entityId);
                if (!entity) return false;
                this.pushUndoSnapshot();

                const removed = this.removeEntityFromTree(this._scene.entities, entityId);
                if (!removed) return false;

                // Add to new parent
                const newParent = this.findEntity(this._scene.entities, newParentId);
                if (newParent) {
                        newParent.children.push(entity);
                } else {
                        this._scene.entities.push(entity);
                }

                // Serialize and update
                this._raw = VecnParser.serialize(this._scene);
                this._hash = this.hash(this._raw);

                this._onSceneUpdated.fire({
                        entities: this._scene.entities,
                        raw: this._raw,
                        source: 'inspector',
                        timestamp: Date.now(),
                });

                this.scheduleSave();
                return true;
        }

        // ================================================================
        // 7.5 Duplicate entity
        // ================================================================
        public duplicateEntity(entityId: string): Entity | null {
                if (!this._scene) return null;

                const entity = this.findEntity(this._scene.entities, entityId);
                if (!entity) return null;
                this.pushUndoSnapshot();

                // Deep clone the entity
                const clone = JSON.parse(JSON.stringify(entity)) as Entity;
                
                // Generate new ID and unique name
                clone.id = this.generateId();
                clone.name = entity.name + ' (copy)';
                
                // Recursively generate new IDs for children
                const regenerateIds = (ent: Entity) => {
                        ent.id = this.generateId();
                        for (const child of ent.children) {
                                regenerateIds(child);
                        }
                };
                for (const child of clone.children) {
                        regenerateIds(child);
                }

                // Add to same parent or root
                const parent = this.findParent(this._scene.entities, entityId);
                if (parent) {
                        parent.children.push(clone);
                } else {
                        this._scene.entities.push(clone);
                }

                // Serialize and update
                this._raw = VecnParser.serialize(this._scene);
                this._hash = this.hash(this._raw);

                this._onSceneUpdated.fire({
                        entities: this._scene.entities,
                        raw: this._raw,
                        source: 'inspector',
                        timestamp: Date.now(),
                });

                this.scheduleSave();
                return clone;
        }

        // Find parent of an entity
        private findParent(entities: Entity[], entityId: string, parent: Entity | null = null): Entity | null {
                for (const entity of entities) {
                        if (entity.id === entityId) return parent;
                        const found = this.findParent(entity.children, entityId, entity);
                        if (found !== null) return found;
                }
                return null;
        }

        // ================================================================
        // 8. Toggle entity visibility
        // ================================================================
        public toggleEntityVisibility(entityId: string): boolean {
                if (!this._scene) return false;

                const entity = this.findEntity(this._scene.entities, entityId);
                if (!entity) return false;
                this.pushUndoSnapshot();

                entity.visible = !entity.visible;

                // Serialize and update
                this._raw = VecnParser.serialize(this._scene);
                this._hash = this.hash(this._raw);

                this._onSceneUpdated.fire({
                        entities: this._scene.entities,
                        raw: this._raw,
                        source: 'inspector',
                        timestamp: Date.now(),
                });

                this.scheduleSave();
                return true;
        }

        // ================================================================
        // 9. Update entity name (rename)
        // ================================================================
        public updateEntityName(entityId: string, newName: string): boolean {
                if (!this._scene) return false;

                const entity = this.findEntity(this._scene.entities, entityId);
                if (!entity) return false;
                this.pushUndoSnapshot();

                entity.name = newName;

                // Serialize and update
                this._raw = VecnParser.serialize(this._scene);
                this._hash = this.hash(this._raw);

                this._onSceneUpdated.fire({
                        entities: this._scene.entities,
                        raw: this._raw,
                        source: 'inspector',
                        timestamp: Date.now(),
                });

                this.scheduleSave();
                return true;
        }

        // ================================================================
        // 10. Undo / Redo
        // ================================================================
        public undo(): boolean {
                if (!this._scene || this._undoStack.length === 0) {
                        return false;
                }

                const previous = this._undoStack.pop()!;
                this._redoStack.push({
                        raw: this._raw,
                        selectedEntityId: this._selectedEntityId,
                });

                const restored = this.restoreSnapshot(previous);
                this.emitHistoryState();
                return restored;
        }

        public redo(): boolean {
                if (!this._scene || this._redoStack.length === 0) {
                        return false;
                }

                const next = this._redoStack.pop()!;
                this._undoStack.push({
                        raw: this._raw,
                        selectedEntityId: this._selectedEntityId,
                });

                const restored = this.restoreSnapshot(next);
                this.emitHistoryState();
                return restored;
        }

        // ================================================================
        // Private: Find entity in tree
        // ================================================================
        public findEntity(list: Entity[], id: string): Entity | null {
                for (const e of list) {
                        if (e.id === id) return e;
                        const found = this.findEntity(e.children, id);
                        if (found) return found;
                }
                return null;
        }

        // ================================================================
        // Private: Remove entity from tree
        // ================================================================
        private removeEntityFromTree(list: Entity[], id: string): boolean {
                for (let i = 0; i < list.length; i++) {
                        if (list[i].id === id) {
                                list.splice(i, 1);
                                return true;
                        }
                        if (this.removeEntityFromTree(list[i].children, id)) {
                                return true;
                        }
                }
                return false;
        }

        // ================================================================
        // Private: Generate unique ID
        // ================================================================
        private generateId(): string {
                return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        private deepClone<T>(value: T): T {
                return JSON.parse(JSON.stringify(value)) as T;
        }

        // ================================================================
        // Private: Debounced save
        // ================================================================
        private scheduleSave(): void {
                if (this._saveTimer) clearTimeout(this._saveTimer);
                this._saveTimer = setTimeout(() => {
                        if (this._uri) {
                                this._onNeedsSave.fire({ uri: this._uri, content: this._raw });
                        }
                }, 200);
        }

        private resetHistoryToCurrentScene(): void {
                this._undoStack.length = 0;
                this._redoStack.length = 0;
                this._transformHistoryArmed = true;
                if (this._transformHistoryTimer) {
                        clearTimeout(this._transformHistoryTimer);
                        this._transformHistoryTimer = null;
                }
                this.emitHistoryState();
        }

        private pushTransformUndoSnapshotOnce(): void {
                if (this._transformHistoryArmed) {
                        this.pushUndoSnapshot();
                        this._transformHistoryArmed = false;
                }

                if (this._transformHistoryTimer) {
                        clearTimeout(this._transformHistoryTimer);
                }
                this._transformHistoryTimer = setTimeout(() => {
                        this._transformHistoryArmed = true;
                        this._transformHistoryTimer = null;
                }, 280);
        }

        private pushUndoSnapshot(): void {
                if (!this._scene || !this._raw.trim()) {
                        return;
                }

                const top = this._undoStack[this._undoStack.length - 1];
                if (top && top.raw === this._raw) {
                        return;
                }

                this._undoStack.push({
                        raw: this._raw,
                        selectedEntityId: this._selectedEntityId,
                });
                if (this._undoStack.length > this.historyLimit) {
                        this._undoStack.shift();
                }
                this._redoStack.length = 0;
                this.emitHistoryState();
        }

        private restoreSnapshot(snapshot: BridgeHistorySnapshot): boolean {
                const parsed = VecnParser.parse(snapshot.raw);
                if (!parsed) {
                        return false;
                }

                this._scene = parsed;
                this._raw = snapshot.raw;
                this._hash = this.hash(snapshot.raw);

                this._validation = validateVecnScene(snapshot.raw);
                this._onValidationChanged.fire(this._validation);

                this._selectedEntityId = snapshot.selectedEntityId;

                this._onSceneUpdated.fire({
                        entities: this._scene.entities,
                        raw: this._raw,
                        source: 'history',
                        timestamp: Date.now(),
                });
                this._onEntitySelected.fire(this._selectedEntityId);
                this.scheduleSave();
                return true;
        }

        private emitHistoryState(): void {
                this._onHistoryChanged.fire(this.getHistoryState());
        }

        // ================================================================
        // Private: Regex patcher for Transform (fast, preserves formatting)
        // ================================================================
        private patchRawTRS(raw: string, p: TransformPatch): string {
                const esc = p.entityId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const idRe = new RegExp(`id:\\s*"${esc}"`);
                const m = idRe.exec(raw);
                if (!m) return raw;

                const start = m.index;
                const sub = raw.slice(start);

                const trRe = /Transform\s*\(/;
                const trM = trRe.exec(sub);
                if (!trM || trM.index > 2000) return raw;

                const trStart = start + trM.index;
                let depth = 0, trEnd = trStart;
                const slice = raw.slice(trStart);
                for (let i = 0; i < slice.length; i++) {
                        if (slice[i] === '(') depth++;
                        if (slice[i] === ')') { depth--; if (depth === 0) { trEnd = trStart + i + 1; break; } }
                }

                let block = raw.slice(trStart, trEnd);

                const patch = (key: string, val: string) => {
                        const re1 = new RegExp(`${key}:\\s*\\([^)]+\\)`);
                        const re2 = new RegExp(`${key}:\\s*Some\\(\\([^)]+\\)\\)`);
                        if (re2.test(block)) block = block.replace(re2, `${key}: Some((${val}))`);
                        else if (re1.test(block)) block = block.replace(re1, `${key}: (${val})`);
                };

                patch('translation', `${p.translation[0].toFixed(4)}, ${p.translation[1].toFixed(4)}, ${p.translation[2].toFixed(4)}`);
                patch('rotation', `${p.rotation[0].toFixed(6)}, ${p.rotation[1].toFixed(6)}, ${p.rotation[2].toFixed(6)}, ${p.rotation[3].toFixed(6)}`);
                patch('scale', `${p.scale[0].toFixed(4)}, ${p.scale[1].toFixed(4)}, ${p.scale[2].toFixed(4)}`);

                return raw.slice(0, trStart) + block + raw.slice(trEnd);
        }

        private hash(s: string): number {
                let h = 0;
                for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
                return h;
        }

        override dispose(): void {
                if (this._saveTimer) clearTimeout(this._saveTimer);
                if (this._transformHistoryTimer) clearTimeout(this._transformHistoryTimer);
                this._onSceneUpdated.dispose();
                this._onNeedsSave.dispose();
                this._onEntitySelected.dispose();
                this._onValidationChanged.dispose();
                this._onHistoryChanged.dispose();
                super.dispose();
        }
}

// ── Singleton ──
export const sceneBridge = new SceneBridge();

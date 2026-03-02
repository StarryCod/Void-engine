import { Entity } from './vecnTypes.js';

export interface VecnScene {
        version: string;
        mode: 'Scene3D' | 'Scene2D';
        entities: Entity[];
        resources: any[];
}

export class VecnParser {

        // ====================================================================
        // PARSE
        // ====================================================================

        static parse(content: string): VecnScene | null {
                try {
                        const clean = this.stripComments(content);

                        const version = clean.match(/version:\s*"([^"]+)"/)?.[1] ?? '1.0';
                        const modeRaw = clean.match(/mode:\s*(\w+)/)?.[1] ?? 'Scene3D';
                        const mode = (modeRaw === 'Scene2D' ? 'Scene2D' : 'Scene3D') as 'Scene3D' | 'Scene2D';

                        const entities: Entity[] = [];
                        const resources: any[] = [];

                        const entitiesContent = this.extractRONList(clean, 'entities') ?? '';
                        if (entitiesContent.trim().length) {
                                // New format: anonymous tuples "( ... )"
                                for (const block of this.extractAnonymousTuples(entitiesContent)) {
                                        const e = this.parseEntityBlock(block);
                                        if (e) entities.push(e);
                                }
                                // Back-compat: Entity( ... )
                                for (const block of this.extractNamedStructs(entitiesContent, 'Entity')) {
                                        const e = this.parseEntityBlock(block);
                                        if (e) entities.push(e);
                                }
                        }

                        const resourcesContent = this.extractRONList(clean, 'resources') ?? '';
                        if (resourcesContent.trim().length) {
                                // Minimal: keep raw resources as simple objects (type + some parsed fields)
                                resources.push(...this.parseResources(resourcesContent));
                        }

                        return { version, mode, entities, resources };
                } catch (err) {
                        console.error('[VecnParser] parse failed:', err);
                        return null;
                }
        }

        // ====================================================================
        // SERIALIZE
        // ====================================================================

        static serialize(scene: VecnScene): string {
                const lines: string[] = [];
                lines.push('// Void Engine Scene Format (.vecn)');
                lines.push(`// Version ${scene.version}`);
                lines.push('');
                lines.push('VoidScene(');
                lines.push(`    version: "${scene.version}",`);
                lines.push(`    mode: ${scene.mode},`);
                lines.push('');
                lines.push('    entities: [');
                for (const e of scene.entities) {
                        this.serializeEntity(lines, e, 2);
                }
                lines.push('    ],');
                lines.push('');
                lines.push('    resources: [');
                for (const r of scene.resources) {
                        this.serializeResource(lines, r, 2);
                }
                lines.push('    ],');
                lines.push(')');
                lines.push('');
                return lines.join('\n');
        }

        /**
         * Update only the transform of specific entities in raw text.
         * This preserves formatting, comments, and unrelated content.
         * Returns null if it can't safely do a partial update (caller should full-serialize).
         */
        static patchTransforms(rawContent: string, entities: Entity[]): string | null {
                let content = rawContent;
                let anyPatched = false;

                for (const entity of entities) {
                        const tr = entity.components.find(c => c.type === 'Transform');
                        if (!tr || tr.type !== 'Transform') continue;

                        // Find this entity's block by its unique id
                        const idPattern = `id:\\s*"${this.escapeRegex(entity.id)}"`;
                        const idRegex = new RegExp(idPattern);
                        const idMatch = idRegex.exec(content);
                        if (!idMatch) continue;

                        // Find the Transform block that belongs to this entity
                        // We search forward from the id match position
                        const searchStart = idMatch.index;
                        const remainingContent = content.substring(searchStart);

                        // Find translation, rotation, scale within reasonable distance
                        const translationRegex = /translation:\s*\([^)]+\)/;
                        const rotationRegex = /rotation:\s*\([^)]+\)/;
                        const scaleRegex = /scale:\s*\([^)]+\)/;

                        const tMatch = translationRegex.exec(remainingContent);
                        const rMatch = rotationRegex.exec(remainingContent);
                        const sMatch = scaleRegex.exec(remainingContent);

                        // Safety: all matches should be within ~500 chars of the id
                        const MAX_DISTANCE = 800;

                        if (tMatch && tMatch.index < MAX_DISTANCE) {
                                const globalIdx = searchStart + tMatch.index;
                                const replacement = `translation: (${tr.translation[0]}, ${tr.translation[1]}, ${tr.translation[2]})`;
                                content = content.substring(0, globalIdx) + replacement + content.substring(globalIdx + tMatch[0].length);
                                anyPatched = true;
                        }

                        if (rMatch && rMatch.index < MAX_DISTANCE) {
                                // Re-search since content may have shifted
                                const reSearch = content.substring(searchStart);
                                const rMatch2 = rotationRegex.exec(reSearch);
                                if (rMatch2 && rMatch2.index < MAX_DISTANCE) {
                                        const globalIdx = searchStart + rMatch2.index;
                                        const r = tr.rotation;
                                        const replacement = `rotation: (${r[0].toFixed(6)}, ${r[1].toFixed(6)}, ${r[2].toFixed(6)}, ${r[3].toFixed(6)})`;
                                        content = content.substring(0, globalIdx) + replacement + content.substring(globalIdx + rMatch2[0].length);
                                        anyPatched = true;
                                }
                        }

                        if (sMatch && sMatch.index < MAX_DISTANCE) {
                                const reSearch = content.substring(searchStart);
                                const sMatch2 = scaleRegex.exec(reSearch);
                                if (sMatch2 && sMatch2.index < MAX_DISTANCE) {
                                        const globalIdx = searchStart + sMatch2.index;
                                        const replacement = `scale: (${tr.scale[0].toFixed(4)}, ${tr.scale[1].toFixed(4)}, ${tr.scale[2].toFixed(4)})`;
                                        content = content.substring(0, globalIdx) + replacement + content.substring(globalIdx + sMatch2[0].length);
                                        anyPatched = true;
                                }
                        }
                }

                return anyPatched ? content : null;
        }

        // ====================================================================
        // Serialization helpers (private)
        // ====================================================================

        private static serializeEntity(lines: string[], entity: Entity, indent: number): void {
                const pad = '    '.repeat(indent);
                lines.push(`${pad}(`);
                lines.push(`${pad}    id: "${entity.id}",`);
                lines.push(`${pad}    name: "${entity.name}",`);
                lines.push(`${pad}    visible: ${entity.visible},`);
                lines.push(`${pad}    components: [`);
                for (const c of entity.components) {
                        this.serializeComponent(lines, c, indent + 2);
                }
                lines.push(`${pad}    ],`);
                lines.push(`${pad}    children: [`);
                for (const child of entity.children) {
                        this.serializeEntity(lines, child, indent + 2);
                }
                lines.push(`${pad}    ],`);
                lines.push(`${pad}),`);
        }

        private static serializeComponent(lines: string[], c: any, indent: number): void {
                const pad = '    '.repeat(indent);
                switch (c.type) {
                        case 'Transform':
                                lines.push(`${pad}Transform(`);
                                lines.push(`${pad}    translation: (${c.translation.join(', ')}),`);
                                lines.push(`${pad}    rotation: (${c.rotation.map((v: number) => v.toFixed(6)).join(', ')}),`);
                                lines.push(`${pad}    scale: (${c.scale.map((v: number) => v.toFixed(4)).join(', ')}),`);
                                lines.push(`${pad}),`);
                                break;
                        case 'Mesh': {
                                const s = c.shape;
                                if (!s) {
                                        lines.push(`${pad}Mesh( shape: Cube(size: 1) ),`); // Защита
                                        break;
                                }

                                // ПРОВЕРЯЕМ ВСЕ ТИПЫ
                                if (s.type === 'Sphere') {
                                        lines.push(`${pad}Mesh( shape: Sphere(radius: ${s.radius ?? 1}) ),`);
                                } else if (s.type === 'Plane') {
                                        lines.push(`${pad}Mesh( shape: Plane(size: ${s.size ?? 10}) ),`);
                                } else if (s.type === 'Cylinder') {
                                        lines.push(`${pad}Mesh( shape: Cylinder(radius: ${s.radius ?? 0.5}, height: ${s.height ?? 1}) ),`);
                                } else if (s.type === 'Cone') {
                                        lines.push(`${pad}Mesh( shape: Cone(radius: ${s.radius ?? 0.5}, height: ${s.height ?? 1}) ),`);
                                } else if (s.type === 'Torus') {
                                        lines.push(`${pad}Mesh( shape: Torus(radius: ${s.radius ?? 1}, tube: ${s.tube ?? 0.3}) ),`);
                                } else if (s.type === 'Capsule') {
                                        lines.push(`${pad}Mesh( shape: Capsule(radius: ${s.radius ?? 0.5}, height: ${s.height ?? 1.0}) ),`);
                                } else {
                                        // Cube по умолчанию
                                        lines.push(`${pad}Mesh( shape: Cube(size: ${s.size ?? 1}) ),`);
                                }
                                break;
                        }
                        case 'Material':
                                lines.push(`${pad}Material(`);
                                lines.push(`${pad}    color: (${c.color.join(', ')}),`);
                                lines.push(`${pad}    metallic: ${c.metallic},`);
                                lines.push(`${pad}    roughness: ${c.roughness},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'PointLight':
                                lines.push(`${pad}PointLight(`);
                                lines.push(`${pad}    color: (${c.color.join(', ')}),`);
                                lines.push(`${pad}    intensity: ${c.intensity},`);
                                lines.push(`${pad}    range: ${c.range},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'DirectionalLight':
                                lines.push(`${pad}DirectionalLight(`);
                                lines.push(`${pad}    color: (${c.color.join(', ')}),`);
                                lines.push(`${pad}    illuminance: ${c.illuminance},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'SpotLight':
                                lines.push(`${pad}SpotLight(`);
                                lines.push(`${pad}    color: (${c.color.join(', ')}),`);
                                lines.push(`${pad}    intensity: ${c.intensity},`);
                                lines.push(`${pad}    range: ${c.range},`);
                                lines.push(`${pad}    angle: ${c.angle},`);
                                lines.push(`${pad}    attenuation: ${c.attenuation},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'Camera':
                                lines.push(`${pad}Camera(`);
                                lines.push(`${pad}    fov: ${c.fov ?? 60},`);
                                lines.push(`${pad}    near: ${c.near ?? 0.1},`);
                                lines.push(`${pad}    far: ${c.far ?? 1000},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'CollisionShape': {
                                const s = c.shape;
                                if (!s) break;
                                lines.push(`${pad}CollisionShape(`);
                                if (s.type === 'Box') {
                                        lines.push(`${pad}    shape: Box(size: ${s.size}),`);
                                } else if (s.type === 'Sphere') {
                                        lines.push(`${pad}    shape: Sphere(radius: ${s.radius}),`);
                                } else if (s.type === 'Capsule') {
                                        lines.push(`${pad}    shape: Capsule(radius: ${s.radius}, height: ${s.height}),`);
                                } else if (s.type === 'Cylinder') {
                                        lines.push(`${pad}    shape: Cylinder(radius: ${s.radius}, height: ${s.height}),`);
                                }
                                lines.push(`${pad}),`);
                                break;
                        }
                        case 'CharacterBody':
                                lines.push(`${pad}CharacterBody(`);
                                lines.push(`${pad}    mass: ${c.mass},`);
                                lines.push(`${pad}    gravity_scale: ${c.gravity_scale},`);
                                lines.push(`${pad}    lock_rotation: ${c.lock_rotation},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'RigidBody':
                                lines.push(`${pad}RigidBody(`);
                                lines.push(`${pad}    mass: ${c.mass},`);
                                lines.push(`${pad}    gravity_scale: ${c.gravity_scale},`);
                                lines.push(`${pad}    linear_damping: ${c.linear_damping},`);
                                lines.push(`${pad}    angular_damping: ${c.angular_damping},`);
                                lines.push(`${pad}    lock_rotation_x: ${c.lock_rotation_x},`);
                                lines.push(`${pad}    lock_rotation_y: ${c.lock_rotation_y},`);
                                lines.push(`${pad}    lock_rotation_z: ${c.lock_rotation_z},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'StaticBody':
                                lines.push(`${pad}StaticBody(`);
                                lines.push(`${pad}    friction: ${c.friction},`);
                                lines.push(`${pad}    restitution: ${c.restitution},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'Area':
                                lines.push(`${pad}Area(`);
                                lines.push(`${pad}    monitoring: ${c.monitoring},`);
                                lines.push(`${pad}    monitorable: ${c.monitorable},`);
                                lines.push(`${pad}    priority: ${c.priority},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'RayCast':
                                lines.push(`${pad}RayCast(`);
                                lines.push(`${pad}    enabled: ${c.enabled},`);
                                lines.push(`${pad}    target_position: (${c.target_position.join(', ')}),`);
                                lines.push(`${pad}    collision_mask: ${c.collision_mask},`);
                                lines.push(`${pad}    hit_from_inside: ${c.hit_from_inside},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'ShapeCast': {
                                const s = c.shape;
                                lines.push(`${pad}ShapeCast(`);
                                lines.push(`${pad}    enabled: ${c.enabled},`);
                                if (s) {
                                        if (s.type === 'Box') {
                                                lines.push(`${pad}    shape: Box(size: ${s.size}),`);
                                        } else if (s.type === 'Sphere') {
                                                lines.push(`${pad}    shape: Sphere(radius: ${s.radius}),`);
                                        } else if (s.type === 'Capsule') {
                                                lines.push(`${pad}    shape: Capsule(radius: ${s.radius}, height: ${s.height}),`);
                                        }
                                }
                                lines.push(`${pad}    target_position: (${c.target_position.join(', ')}),`);
                                lines.push(`${pad}    collision_mask: ${c.collision_mask},`);
                                lines.push(`${pad}    max_results: ${c.max_results},`);
                                lines.push(`${pad}),`);
                                break;
                        }
                        // Audio components
                        case 'AudioStreamPlayer':
                                lines.push(`${pad}AudioStreamPlayer(`);
                                lines.push(`${pad}    stream: "${c.stream}",`);
                                lines.push(`${pad}    volume_db: ${c.volume_db},`);
                                lines.push(`${pad}    pitch_scale: ${c.pitch_scale},`);
                                lines.push(`${pad}    playing: ${c.playing},`);
                                lines.push(`${pad}    autoplay: ${c.autoplay},`);
                                lines.push(`${pad}    stream_paused: ${c.stream_paused},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'AudioStreamPlayer2D':
                                lines.push(`${pad}AudioStreamPlayer2D(`);
                                lines.push(`${pad}    stream: "${c.stream}",`);
                                lines.push(`${pad}    volume_db: ${c.volume_db},`);
                                lines.push(`${pad}    pitch_scale: ${c.pitch_scale},`);
                                lines.push(`${pad}    playing: ${c.playing},`);
                                lines.push(`${pad}    autoplay: ${c.autoplay},`);
                                lines.push(`${pad}    max_distance: ${c.max_distance},`);
                                lines.push(`${pad}    attenuation: ${c.attenuation},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'AudioStreamPlayer3D':
                                lines.push(`${pad}AudioStreamPlayer3D(`);
                                lines.push(`${pad}    stream: "${c.stream}",`);
                                lines.push(`${pad}    volume_db: ${c.volume_db},`);
                                lines.push(`${pad}    pitch_scale: ${c.pitch_scale},`);
                                lines.push(`${pad}    playing: ${c.playing},`);
                                lines.push(`${pad}    autoplay: ${c.autoplay},`);
                                lines.push(`${pad}    max_distance: ${c.max_distance},`);
                                lines.push(`${pad}    attenuation_model: "${c.attenuation_model}",`);
                                lines.push(`${pad}    emission_angle_enabled: ${c.emission_angle_enabled},`);
                                lines.push(`${pad}    emission_angle_degrees: ${c.emission_angle_degrees},`);
                                lines.push(`${pad}),`);
                                break;
                        // Animation components
                        case 'AnimationPlayer':
                                lines.push(`${pad}AnimationPlayer(`);
                                lines.push(`${pad}    current_animation: "${c.current_animation}",`);
                                lines.push(`${pad}    playback_speed: ${c.playback_speed},`);
                                lines.push(`${pad}    autoplay: "${c.autoplay}",`);
                                lines.push(`${pad}    playback_active: ${c.playback_active},`);
                                lines.push(`${pad}    playback_default_blend_time: ${c.playback_default_blend_time},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'AnimationTree':
                                lines.push(`${pad}AnimationTree(`);
                                lines.push(`${pad}    tree_root: "${c.tree_root}",`);
                                lines.push(`${pad}    anim_player: "${c.anim_player}",`);
                                lines.push(`${pad}    active: ${c.active},`);
                                lines.push(`${pad}    process_callback: "${c.process_callback}",`);
                                lines.push(`${pad}),`);
                                break;
                        case 'Tween':
                                lines.push(`${pad}Tween(`);
                                lines.push(`${pad}    active: ${c.active},`);
                                lines.push(`${pad}    speed_scale: ${c.speed_scale},`);
                                lines.push(`${pad}),`);
                                break;
                        // Navigation components
                        case 'NavigationRegion3D':
                                lines.push(`${pad}NavigationRegion3D(`);
                                lines.push(`${pad}    enabled: ${c.enabled},`);
                                lines.push(`${pad}    navigation_layers: ${c.navigation_layers},`);
                                lines.push(`${pad}    enter_cost: ${c.enter_cost},`);
                                lines.push(`${pad}    travel_cost: ${c.travel_cost},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'NavigationAgent3D':
                                lines.push(`${pad}NavigationAgent3D(`);
                                lines.push(`${pad}    target_position: (${c.target_position.join(', ')}),`);
                                lines.push(`${pad}    path_desired_distance: ${c.path_desired_distance},`);
                                lines.push(`${pad}    target_desired_distance: ${c.target_desired_distance},`);
                                lines.push(`${pad}    radius: ${c.radius},`);
                                lines.push(`${pad}    height: ${c.height},`);
                                lines.push(`${pad}    max_speed: ${c.max_speed},`);
                                lines.push(`${pad}    avoidance_enabled: ${c.avoidance_enabled},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'NavigationObstacle3D':
                                lines.push(`${pad}NavigationObstacle3D(`);
                                lines.push(`${pad}    radius: ${c.radius},`);
                                lines.push(`${pad}    height: ${c.height},`);
                                lines.push(`${pad}    avoidance_enabled: ${c.avoidance_enabled},`);
                                lines.push(`${pad}    velocity: (${c.velocity.join(', ')}),`);
                                lines.push(`${pad}),`);
                                break;
                        // Utility components
                        case 'Timer':
                                lines.push(`${pad}Timer(`);
                                lines.push(`${pad}    wait_time: ${c.wait_time},`);
                                lines.push(`${pad}    one_shot: ${c.one_shot},`);
                                lines.push(`${pad}    autostart: ${c.autostart},`);
                                lines.push(`${pad}    time_left: ${c.time_left},`);
                                lines.push(`${pad}    paused: ${c.paused},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'Path3D':
                                lines.push(`${pad}Path3D(`);
                                lines.push(`${pad}    curve: "${c.curve}",`);
                                lines.push(`${pad}),`);
                                break;
                        case 'PathFollow3D':
                                lines.push(`${pad}PathFollow3D(`);
                                lines.push(`${pad}    progress: ${c.progress},`);
                                lines.push(`${pad}    progress_ratio: ${c.progress_ratio},`);
                                lines.push(`${pad}    h_offset: ${c.h_offset},`);
                                lines.push(`${pad}    v_offset: ${c.v_offset},`);
                                lines.push(`${pad}    rotation_mode: "${c.rotation_mode}",`);
                                lines.push(`${pad}    cubic_interp: ${c.cubic_interp},`);
                                lines.push(`${pad}    loop: ${c.loop},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'Marker3D':
                                lines.push(`${pad}Marker3D(`);
                                lines.push(`${pad}    gizmo_extents: ${c.gizmo_extents},`);
                                lines.push(`${pad}),`);
                                break;
                        // Environment components
                        case 'WorldEnvironment':
                                lines.push(`${pad}WorldEnvironment(`);
                                lines.push(`${pad}    environment: "${c.environment ?? ''}",`);
                                lines.push(`${pad}    camera_attributes: "${c.camera_attributes ?? ''}",`);
                                lines.push(`${pad}    background_mode: "${c.background_mode ?? 'Sky'}",`);
                                lines.push(`${pad}    background_color: (${(c.background_color ?? [0.05, 0.05, 0.1, 1]).join(', ')}),`);
                                lines.push(`${pad}    gradient_top: (${(c.gradient_top ?? [0.4, 0.4, 0.5, 1]).join(', ')}),`);
                                lines.push(`${pad}    gradient_bottom: (${(c.gradient_bottom ?? [0.15, 0.15, 0.18, 1]).join(', ')}),`);
                                lines.push(`${pad}    ambient_light_energy: ${c.ambient_light_energy ?? 1.0},`);
                                lines.push(`${pad}    ambient_light_color: (${(c.ambient_light_color ?? [0.5, 0.5, 0.55, 1]).join(', ')}),`);
                                lines.push(`${pad}    ambient_light_sky_contribution: ${c.ambient_light_sky_contribution ?? 1.0},`);
                                lines.push(`${pad}    reflected_light_energy: ${c.reflected_light_energy ?? 1.0},`);
                                lines.push(`${pad}    tonemap_mode: "${c.tonemap_mode ?? 'Filmic'}",`);
                                lines.push(`${pad}    tonemap_exposure: ${c.tonemap_exposure ?? 1.0},`);
                                lines.push(`${pad}    tonemap_white: ${c.tonemap_white ?? 1.0},`);
                                lines.push(`${pad}    ssao_enabled: ${c.ssao_enabled ?? false},`);
                                lines.push(`${pad}    ssao_intensity: ${c.ssao_intensity ?? 1.0},`);
                                lines.push(`${pad}    ssao_radius: ${c.ssao_radius ?? 1.0},`);
                                lines.push(`${pad}    glow_enabled: ${c.glow_enabled ?? false},`);
                                lines.push(`${pad}    glow_intensity: ${c.glow_intensity ?? 0.8},`);
                                lines.push(`${pad}    glow_threshold: ${c.glow_threshold ?? 0.9},`);
                                lines.push(`${pad}    sky_material: "${c.sky_material ?? 'ProceduralSky'}",`);
                                lines.push(`${pad}    radiance_size: "${c.radiance_size ?? 'Size1024'}",`);
                                lines.push(`${pad}    sky_top_color: (${(c.sky_top_color ?? [0.35, 0.55, 0.85, 1]).join(', ')}),`);
                                lines.push(`${pad}    sky_horizon_color: (${(c.sky_horizon_color ?? [0.65, 0.78, 0.90, 1]).join(', ')}),`);
                                lines.push(`${pad}    sky_curve: ${c.sky_curve ?? 0.15},`);
                                lines.push(`${pad}    sky_energy: ${c.sky_energy ?? 1.0},`);
                                lines.push(`${pad}    ground_bottom_color: (${(c.ground_bottom_color ?? [0.12, 0.10, 0.08, 1]).join(', ')}),`);
                                lines.push(`${pad}    ground_horizon_color: (${(c.ground_horizon_color ?? [0.35, 0.30, 0.25, 1]).join(', ')}),`);
                                lines.push(`${pad}    ground_curve: ${c.ground_curve ?? 0.1},`);
                                lines.push(`${pad}    ground_energy: ${c.ground_energy ?? 1.0},`);
                                lines.push(`${pad}    sun_enabled: ${c.sun_enabled ?? true},`);
                                lines.push(`${pad}    sun_angle_min: ${c.sun_angle_min ?? 0.5},`);
                                lines.push(`${pad}    sun_angle_max: ${c.sun_angle_max ?? 2.0},`);
                                lines.push(`${pad}    sun_curve: ${c.sun_curve ?? 0.05},`);
                                lines.push(`${pad}    sun_energy: ${c.sun_energy ?? 16.0},`);
                                lines.push(`${pad}    sun_color: (${(c.sun_color ?? [1.0, 0.95, 0.85, 1]).join(', ')}),`);
                                lines.push(`${pad}    sun_position: (${(c.sun_position ?? [0.5, 0.8, -0.3]).join(', ')}),`);
                                lines.push(`${pad}    clouds_enabled: ${c.clouds_enabled ?? false},`);
                                lines.push(`${pad}    clouds_color: (${(c.clouds_color ?? [1.0, 1.0, 1.0, 1]).join(', ')}),`);
                                lines.push(`${pad}    clouds_density: ${c.clouds_density ?? 0.5},`);
                                lines.push(`${pad}    clouds_speed: ${c.clouds_speed ?? 0.1},`);
                                lines.push(`${pad}    clouds_height: ${c.clouds_height ?? 500.0},`);
                                lines.push(`${pad}    clouds_coverage: ${c.clouds_coverage ?? 0.5},`);
                                lines.push(`${pad}    clouds_thickness: ${c.clouds_thickness ?? 100.0},`);
                                lines.push(`${pad}    fog_enabled: ${c.fog_enabled ?? false},`);
                                lines.push(`${pad}    fog_density: ${c.fog_density ?? 0.001},`);
                                lines.push(`${pad}    fog_depth_begin: ${c.fog_depth_begin ?? 10.0},`);
                                lines.push(`${pad}    fog_depth_end: ${c.fog_depth_end ?? 100.0},`);
                                lines.push(`${pad}    fog_color: (${(c.fog_color ?? [0.7, 0.75, 0.8, 1]).join(', ')}),`);
                                lines.push(`${pad}),`);
                                break;
                        case 'FogVolume':
                                lines.push(`${pad}FogVolume(`);
                                lines.push(`${pad}    density: ${c.density},`);
                                lines.push(`${pad}    albedo: (${c.albedo.join(', ')}),`);
                                lines.push(`${pad}    emission: (${c.emission.join(', ')}),`);
                                lines.push(`${pad}    height_falloff: ${c.height_falloff},`);
                                lines.push(`${pad}),`);
                                break;
                        // Special components
                        case 'Skeleton3D':
                                lines.push(`${pad}Skeleton3D(`);
                                lines.push(`${pad}    bones: [${c.bones.map((b: string) => `"${b}"`).join(', ')}],`);
                                lines.push(`${pad}    bone_poses: [],`);
                                lines.push(`${pad}),`);
                                break;
                        case 'BoneAttachment3D':
                                lines.push(`${pad}BoneAttachment3D(`);
                                lines.push(`${pad}    bone_name: "${c.bone_name}",`);
                                lines.push(`${pad}    bone_idx: ${c.bone_idx},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'Viewport':
                                lines.push(`${pad}Viewport(`);
                                lines.push(`${pad}    size: (${c.size.join(', ')}),`);
                                lines.push(`${pad}    transparent_bg: ${c.transparent_bg},`);
                                lines.push(`${pad}    msaa: "${c.msaa}",`);
                                lines.push(`${pad}    screen_space_aa: "${c.screen_space_aa}",`);
                                lines.push(`${pad}    use_debanding: ${c.use_debanding},`);
                                lines.push(`${pad}    use_occlusion_culling: ${c.use_occlusion_culling},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'SubViewport':
                                lines.push(`${pad}SubViewport(`);
                                lines.push(`${pad}    size: (${c.size.join(', ')}),`);
                                lines.push(`${pad}    render_target_update_mode: "${c.render_target_update_mode}",`);
                                lines.push(`${pad}),`);
                                break;
                        // 2D Components
                        case 'Transform2D':
                                lines.push(`${pad}Transform2D(`);
                                lines.push(`${pad}    position: (${c.position.join(', ')}),`);
                                lines.push(`${pad}    rotation: ${c.rotation},`);
                                lines.push(`${pad}    scale: (${c.scale.join(', ')}),`);
                                lines.push(`${pad}),`);
                                break;
                        case 'Sprite2D':
                                lines.push(`${pad}Sprite2D(`);
                                lines.push(`${pad}    texture: "${c.texture}",`);
                                lines.push(`${pad}    region_enabled: ${c.region_enabled},`);
                                lines.push(`${pad}    region_rect: (${c.region_rect.join(', ')}),`);
                                lines.push(`${pad}    offset: (${c.offset.join(', ')}),`);
                                lines.push(`${pad}),`);
                                break;
                        case 'AnimatedSprite2D':
                                lines.push(`${pad}AnimatedSprite2D(`);
                                lines.push(`${pad}    sprite_frames: "${c.sprite_frames}",`);
                                lines.push(`${pad}    animation: "${c.animation}",`);
                                lines.push(`${pad}    frame: ${c.frame},`);
                                lines.push(`${pad}    playing: ${c.playing},`);
                                lines.push(`${pad}    speed_scale: ${c.speed_scale},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'CharacterBody2D':
                                lines.push(`${pad}CharacterBody2D(`);
                                lines.push(`${pad}    motion_mode: "${c.motion_mode}",`);
                                lines.push(`${pad}    up_direction: (${c.up_direction.join(', ')}),`);
                                lines.push(`${pad}    velocity: (${c.velocity.join(', ')}),`);
                                lines.push(`${pad}    max_slides: ${c.max_slides},`);
                                lines.push(`${pad}    floor_stop_on_slope: ${c.floor_stop_on_slope},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'RigidBody2D':
                                lines.push(`${pad}RigidBody2D(`);
                                lines.push(`${pad}    mass: ${c.mass},`);
                                lines.push(`${pad}    gravity_scale: ${c.gravity_scale},`);
                                lines.push(`${pad}    linear_damp: ${c.linear_damp},`);
                                lines.push(`${pad}    angular_damp: ${c.angular_damp},`);
                                lines.push(`${pad}    lock_rotation: ${c.lock_rotation},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'StaticBody2D':
                                lines.push(`${pad}StaticBody2D(`);
                                lines.push(`${pad}    friction: ${c.friction},`);
                                lines.push(`${pad}    bounce: ${c.bounce},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'Area2D':
                                lines.push(`${pad}Area2D(`);
                                lines.push(`${pad}    monitoring: ${c.monitoring},`);
                                lines.push(`${pad}    monitorable: ${c.monitorable},`);
                                lines.push(`${pad}    priority: ${c.priority},`);
                                lines.push(`${pad}    gravity_space_override: "${c.gravity_space_override}",`);
                                lines.push(`${pad}),`);
                                break;
                        case 'CollisionShape2D': {
                                const s = c.shape;
                                lines.push(`${pad}CollisionShape2D(`);
                                if (s) {
                                        if (s.type === 'Rectangle') {
                                                lines.push(`${pad}    shape: Rectangle(size: (${s.size.join(', ')})),`);
                                        } else if (s.type === 'Circle') {
                                                lines.push(`${pad}    shape: Circle(radius: ${s.radius}),`);
                                        } else if (s.type === 'Capsule') {
                                                lines.push(`${pad}    shape: Capsule(radius: ${s.radius}, height: ${s.height}),`);
                                        }
                                }
                                lines.push(`${pad}    disabled: ${c.disabled},`);
                                lines.push(`${pad}    one_way_collision: ${c.one_way_collision},`);
                                lines.push(`${pad}),`);
                                break;
                        }
                        case 'RayCast2D':
                                lines.push(`${pad}RayCast2D(`);
                                lines.push(`${pad}    enabled: ${c.enabled},`);
                                lines.push(`${pad}    target_position: (${c.target_position.join(', ')}),`);
                                lines.push(`${pad}    collision_mask: ${c.collision_mask},`);
                                lines.push(`${pad}    hit_from_inside: ${c.hit_from_inside},`);
                                lines.push(`${pad}),`);
                                break;
                        // 3D Visual Components
                        case 'Sprite3D':
                                lines.push(`${pad}Sprite3D(`);
                                lines.push(`${pad}    texture: "${c.texture}",`);
                                lines.push(`${pad}    billboard: "${c.billboard}",`);
                                lines.push(`${pad}    transparent: ${c.transparent},`);
                                lines.push(`${pad}    shaded: ${c.shaded},`);
                                lines.push(`${pad}    double_sided: ${c.double_sided},`);
                                lines.push(`${pad}    alpha_cut: ${c.alpha_cut},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'AnimatedSprite3D':
                                lines.push(`${pad}AnimatedSprite3D(`);
                                lines.push(`${pad}    sprite_frames: "${c.sprite_frames}",`);
                                lines.push(`${pad}    animation: "${c.animation}",`);
                                lines.push(`${pad}    frame: ${c.frame},`);
                                lines.push(`${pad}    playing: ${c.playing},`);
                                lines.push(`${pad}    billboard: "${c.billboard}",`);
                                lines.push(`${pad}),`);
                                break;
                        case 'Label3D':
                                lines.push(`${pad}Label3D(`);
                                lines.push(`${pad}    text: "${c.text}",`);
                                lines.push(`${pad}    font_size: ${c.font_size},`);
                                lines.push(`${pad}    outline_size: ${c.outline_size},`);
                                lines.push(`${pad}    modulate: (${c.modulate.join(', ')}),`);
                                lines.push(`${pad}    billboard: "${c.billboard}",`);
                                lines.push(`${pad}),`);
                                break;
                        case 'GPUParticles3D':
                                lines.push(`${pad}GPUParticles3D(`);
                                lines.push(`${pad}    emitting: ${c.emitting},`);
                                lines.push(`${pad}    amount: ${c.amount},`);
                                lines.push(`${pad}    lifetime: ${c.lifetime},`);
                                lines.push(`${pad}    one_shot: ${c.one_shot},`);
                                lines.push(`${pad}    explosiveness: ${c.explosiveness},`);
                                lines.push(`${pad}    randomness: ${c.randomness},`);
                                lines.push(`${pad}    visibility_aabb: (${c.visibility_aabb.join(', ')}),`);
                                lines.push(`${pad}),`);
                                break;
                        case 'CPUParticles3D':
                                lines.push(`${pad}CPUParticles3D(`);
                                lines.push(`${pad}    emitting: ${c.emitting},`);
                                lines.push(`${pad}    amount: ${c.amount},`);
                                lines.push(`${pad}    lifetime: ${c.lifetime},`);
                                lines.push(`${pad}    one_shot: ${c.one_shot},`);
                                lines.push(`${pad}    explosiveness: ${c.explosiveness},`);
                                lines.push(`${pad}    randomness: ${c.randomness},`);
                                lines.push(`${pad}    emission_shape: "${c.emission_shape}",`);
                                lines.push(`${pad}),`);
                                break;
                        case 'MultiMeshInstance3D':
                                lines.push(`${pad}MultiMeshInstance3D(`);
                                lines.push(`${pad}    instance_count: ${c.instance_count},`);
                                lines.push(`${pad}    visible_instance_count: ${c.visible_instance_count},`);
                                lines.push(`${pad}    mesh: "${c.mesh}",`);
                                lines.push(`${pad}    transform_format: "${c.transform_format}",`);
                                lines.push(`${pad}),`);
                                break;
                        // Additional Navigation 2D
                        case 'NavigationRegion2D':
                                lines.push(`${pad}NavigationRegion2D(`);
                                lines.push(`${pad}    enabled: ${c.enabled},`);
                                lines.push(`${pad}    navigation_layers: ${c.navigation_layers},`);
                                lines.push(`${pad}    enter_cost: ${c.enter_cost},`);
                                lines.push(`${pad}    travel_cost: ${c.travel_cost},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'NavigationAgent2D':
                                lines.push(`${pad}NavigationAgent2D(`);
                                lines.push(`${pad}    target_position: (${c.target_position.join(', ')}),`);
                                lines.push(`${pad}    path_desired_distance: ${c.path_desired_distance},`);
                                lines.push(`${pad}    target_desired_distance: ${c.target_desired_distance},`);
                                lines.push(`${pad}    radius: ${c.radius},`);
                                lines.push(`${pad}    max_speed: ${c.max_speed},`);
                                lines.push(`${pad}    avoidance_enabled: ${c.avoidance_enabled},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'NavigationObstacle2D':
                                lines.push(`${pad}NavigationObstacle2D(`);
                                lines.push(`${pad}    radius: ${c.radius},`);
                                lines.push(`${pad}    avoidance_enabled: ${c.avoidance_enabled},`);
                                lines.push(`${pad}    velocity: (${c.velocity.join(', ')}),`);
                                lines.push(`${pad}),`);
                                break;
                        // Additional Environment
                        case 'Sky':
                                lines.push(`${pad}Sky(`);
                                lines.push(`${pad}    sky_material: "${c.sky_material ?? 'ProceduralSky'}",`);
                                lines.push(`${pad}    radiance_size: "${c.radiance_size ?? 'Size1024'}",`);
                                // Sky colors
                                const skyTop = c.sky_top_color ?? [0.35, 0.55, 0.85, 1];
                                const skyHorizon = c.sky_horizon_color ?? [0.65, 0.78, 0.90, 1];
                                lines.push(`${pad}    sky_top_color: (${skyTop.join(', ')}),`);
                                lines.push(`${pad}    sky_horizon_color: (${skyHorizon.join(', ')}),`);
                                lines.push(`${pad}    sky_curve: ${c.sky_curve ?? 0.15},`);
                                lines.push(`${pad}    sky_energy: ${c.sky_energy ?? 1.0},`);
                                // Ground
                                const groundBottom = c.ground_bottom_color ?? [0.12, 0.10, 0.08, 1];
                                const groundHorizon = c.ground_horizon_color ?? [0.35, 0.30, 0.25, 1];
                                lines.push(`${pad}    ground_bottom_color: (${groundBottom.join(', ')}),`);
                                lines.push(`${pad}    ground_horizon_color: (${groundHorizon.join(', ')}),`);
                                lines.push(`${pad}    ground_curve: ${c.ground_curve ?? 0.1},`);
                                lines.push(`${pad}    ground_energy: ${c.ground_energy ?? 1.0},`);
                                // Sun
                                lines.push(`${pad}    sun_enabled: ${c.sun_enabled ?? true},`);
                                const sunPos = c.sun_position ?? [0.5, 0.8, -0.3];
                                const sunCol = c.sun_color ?? [1.0, 0.95, 0.85, 1];
                                lines.push(`${pad}    sun_position: (${sunPos.join(', ')}),`);
                                lines.push(`${pad}    sun_color: (${sunCol.join(', ')}),`);
                                lines.push(`${pad}    sun_energy: ${c.sun_energy ?? 16.0},`);
                                lines.push(`${pad}    sun_angle_min: ${c.sun_angle_min ?? 0.5},`);
                                lines.push(`${pad}    sun_angle_max: ${c.sun_angle_max ?? 2.0},`);
                                // Clouds
                                lines.push(`${pad}    clouds_enabled: ${c.clouds_enabled ?? false},`);
                                const cloudsCol = c.clouds_color ?? [1.0, 1.0, 1.0, 1];
                                lines.push(`${pad}    clouds_color: (${cloudsCol.join(', ')}),`);
                                lines.push(`${pad}    clouds_density: ${c.clouds_density ?? 0.5},`);
                                lines.push(`${pad}    clouds_speed: ${c.clouds_speed ?? 0.1},`);
                                lines.push(`${pad}    clouds_height: ${c.clouds_height ?? 500},`);
                                lines.push(`${pad}    clouds_coverage: ${c.clouds_coverage ?? 0.5},`);
                                lines.push(`${pad}    clouds_thickness: ${c.clouds_thickness ?? 100},`);
                                // Fog
                                lines.push(`${pad}    fog_enabled: ${c.fog_enabled ?? false},`);
                                const fogCol = c.fog_color ?? [0.7, 0.75, 0.80, 1];
                                lines.push(`${pad}    fog_color: (${fogCol.join(', ')}),`);
                                lines.push(`${pad}    fog_density: ${c.fog_density ?? 0.001},`);
                                lines.push(`${pad}    fog_depth_begin: ${c.fog_depth_begin ?? 10},`);
                                lines.push(`${pad}    fog_depth_end: ${c.fog_depth_end ?? 100},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'ReflectionProbe':
                                lines.push(`${pad}ReflectionProbe(`);
                                lines.push(`${pad}    update_mode: "${c.update_mode}",`);
                                lines.push(`${pad}    intensity: ${c.intensity},`);
                                lines.push(`${pad}    max_distance: ${c.max_distance},`);
                                lines.push(`${pad}    extents: (${c.extents.join(', ')}),`);
                                lines.push(`${pad}    origin_offset: (${c.origin_offset.join(', ')}),`);
                                lines.push(`${pad}    box_projection: ${c.box_projection},`);
                                lines.push(`${pad}    enable_shadows: ${c.enable_shadows},`);
                                lines.push(`${pad}),`);
                                break;
                        // Additional Utility
                        case 'Path2D':
                                lines.push(`${pad}Path2D(`);
                                lines.push(`${pad}    curve: "${c.curve}",`);
                                lines.push(`${pad}),`);
                                break;
                        case 'PathFollow2D':
                                lines.push(`${pad}PathFollow2D(`);
                                lines.push(`${pad}    progress: ${c.progress},`);
                                lines.push(`${pad}    progress_ratio: ${c.progress_ratio},`);
                                lines.push(`${pad}    h_offset: ${c.h_offset},`);
                                lines.push(`${pad}    v_offset: ${c.v_offset},`);
                                lines.push(`${pad}    rotates: ${c.rotates},`);
                                lines.push(`${pad}    cubic_interp: ${c.cubic_interp},`);
                                lines.push(`${pad}    loop: ${c.loop},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'RemoteTransform3D':
                                lines.push(`${pad}RemoteTransform3D(`);
                                lines.push(`${pad}    remote_path: "${c.remote_path}",`);
                                lines.push(`${pad}    use_global_coordinates: ${c.use_global_coordinates},`);
                                lines.push(`${pad}    update_position: ${c.update_position},`);
                                lines.push(`${pad}    update_rotation: ${c.update_rotation},`);
                                lines.push(`${pad}    update_scale: ${c.update_scale},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'RemoteTransform2D':
                                lines.push(`${pad}RemoteTransform2D(`);
                                lines.push(`${pad}    remote_path: "${c.remote_path}",`);
                                lines.push(`${pad}    use_global_coordinates: ${c.use_global_coordinates},`);
                                lines.push(`${pad}    update_position: ${c.update_position},`);
                                lines.push(`${pad}    update_rotation: ${c.update_rotation},`);
                                lines.push(`${pad}    update_scale: ${c.update_scale},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'Marker2D':
                                lines.push(`${pad}Marker2D(`);
                                lines.push(`${pad}    gizmo_extents: ${c.gizmo_extents},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'VisibleOnScreenNotifier3D':
                                lines.push(`${pad}VisibleOnScreenNotifier3D(`);
                                lines.push(`${pad}    aabb: (${c.aabb.join(', ')}),`);
                                lines.push(`${pad}),`);
                                break;
                        case 'VisibleOnScreenNotifier2D':
                                lines.push(`${pad}VisibleOnScreenNotifier2D(`);
                                lines.push(`${pad}    rect: (${c.rect.join(', ')}),`);
                                lines.push(`${pad}),`);
                                break;
                        case 'CanvasLayer':
                                lines.push(`${pad}CanvasLayer(`);
                                lines.push(`${pad}    layer: ${c.layer},`);
                                lines.push(`${pad}    offset: (${c.offset.join(', ')}),`);
                                lines.push(`${pad}    rotation: ${c.rotation},`);
                                lines.push(`${pad}    scale: (${c.scale.join(', ')}),`);
                                lines.push(`${pad}    follow_viewport_enabled: ${c.follow_viewport_enabled},`);
                                lines.push(`${pad}),`);
                                break;
                }
        }

        private static serializeResource(lines: string[], r: any, indent: number): void {
                const pad = '    '.repeat(indent);
                switch (r.type) {
                        case 'AmbientLight':
                                lines.push(`${pad}AmbientLight(`);
                                lines.push(`${pad}    color: (${r.color.join(', ')}),`);
                                lines.push(`${pad}    brightness: ${r.brightness},`);
                                lines.push(`${pad}),`);
                                break;
                        case 'ClearColor':
                                lines.push(`${pad}ClearColor(`);
                                lines.push(`${pad}    color: (${r.color.join(', ')}),`);
                                lines.push(`${pad}),`);
                                break;
                }
        }

        // ---------------------------
        // Entity parsing
        // ---------------------------

        private static parseEntityBlock(block: string): Entity | null {
                const id = block.match(/id:\s*"([^"]+)"/)?.[1];
                const name = block.match(/name:\s*"([^"]+)"/)?.[1];
                const visible = (block.match(/visible:\s*(true|false)/)?.[1] ?? 'true') === 'true';

                if (!id || !name) {
                        return null;
                }

                const entity: Entity = {
                        id,
                        name,
                        visible,
                        components: [],
                        children: []
                };

                const compContent = this.extractRONList(block, 'components') ?? '';
                if (compContent.trim().length) {

                        for (const tb of this.extractNamedStructs(compContent, 'Transform')) {
                                entity.components.push({
                                        type: 'Transform',
                                        translation: this.parseTuple3(tb, 'translation'),
                                        rotation: this.parseTuple4(tb, 'rotation'),
                                        scale: this.parseTuple3(tb, 'scale'),
                                });
                        }

                        for (const mb of this.extractNamedStructs(compContent, 'Mesh')) {
                                entity.components.push({
                                        type: 'Mesh',
                                        shape: this.parseShapeFromMeshBlock(mb)
                                });
                        }

                        for (const mtb of this.extractNamedStructs(compContent, 'Material')) {
                                entity.components.push({
                                        type: 'Material',
                                        color: this.parseTuple4(mtb, 'color'),
                                        metallic: this.parseFloat(mtb, 'metallic', 0),
                                        roughness: this.parseFloat(mtb, 'roughness', 1),
                                });
                        }

                        for (const lb of this.extractNamedStructs(compContent, 'PointLight')) {
                                entity.components.push({
                                        type: 'PointLight',
                                        color: this.parseTuple3(lb, 'color'),
                                        intensity: this.parseFloat(lb, 'intensity', 1000),
                                        range: this.parseFloat(lb, 'range', 10),
                                });
                        }

                        for (const lb of this.extractNamedStructs(compContent, 'DirectionalLight')) {
                                entity.components.push({
                                        type: 'DirectionalLight',
                                        color: this.parseTuple3(lb, 'color'),
                                        illuminance: this.parseFloat(lb, 'illuminance', 10000),
                                });
                        }

                        for (const slb of this.extractNamedStructs(compContent, 'SpotLight')) {
                                entity.components.push({
                                        type: 'SpotLight',
                                        color: this.parseTuple3(slb, 'color'),
                                        intensity: this.parseFloat(slb, 'intensity', 800),
                                        range: this.parseFloat(slb, 'range', 20),
                                        angle: this.parseFloat(slb, 'angle', 45),
                                        attenuation: this.parseFloat(slb, 'attenuation', 1.0),
                                });
                        }

                        for (const cb of this.extractNamedStructs(compContent, 'Camera')) {
                                entity.components.push({
                                        type: 'Camera',
                                        fov: this.parseFloat(cb, 'fov', 60),
                                        near: this.parseFloat(cb, 'near', 0.1),
                                        far: this.parseFloat(cb, 'far', 1000),
                                });
                        }

                        for (const csb of this.extractNamedStructs(compContent, 'CollisionShape')) {
                                entity.components.push({
                                        type: 'CollisionShape',
                                        shape: this.parseCollisionShapeFromBlock(csb)
                                });
                        }

                        // Physics components
                        for (const chb of this.extractNamedStructs(compContent, 'CharacterBody')) {
                                entity.components.push({
                                        type: 'CharacterBody',
                                        mass: this.parseFloat(chb, 'mass', 1.0),
                                        gravity_scale: this.parseFloat(chb, 'gravity_scale', 1.0),
                                        lock_rotation: this.parseBool(chb, 'lock_rotation', true),
                                });
                        }

                        for (const rb of this.extractNamedStructs(compContent, 'RigidBody')) {
                                entity.components.push({
                                        type: 'RigidBody',
                                        mass: this.parseFloat(rb, 'mass', 1.0),
                                        gravity_scale: this.parseFloat(rb, 'gravity_scale', 1.0),
                                        linear_damping: this.parseFloat(rb, 'linear_damping', 0.0),
                                        angular_damping: this.parseFloat(rb, 'angular_damping', 0.0),
                                        lock_rotation_x: this.parseBool(rb, 'lock_rotation_x', false),
                                        lock_rotation_y: this.parseBool(rb, 'lock_rotation_y', false),
                                        lock_rotation_z: this.parseBool(rb, 'lock_rotation_z', false),
                                });
                        }

                        for (const sb of this.extractNamedStructs(compContent, 'StaticBody')) {
                                entity.components.push({
                                        type: 'StaticBody',
                                        friction: this.parseFloat(sb, 'friction', 0.5),
                                        restitution: this.parseFloat(sb, 'restitution', 0.0),
                                });
                        }

                        for (const ab of this.extractNamedStructs(compContent, 'Area')) {
                                entity.components.push({
                                        type: 'Area',
                                        monitoring: this.parseBool(ab, 'monitoring', true),
                                        monitorable: this.parseBool(ab, 'monitorable', true),
                                        priority: this.parseInt(ab, 'priority', 0),
                                });
                        }

                        for (const rcb of this.extractNamedStructs(compContent, 'RayCast')) {
                                entity.components.push({
                                        type: 'RayCast',
                                        enabled: this.parseBool(rcb, 'enabled', true),
                                        target_position: this.parseTuple3(rcb, 'target_position'),
                                        collision_mask: this.parseInt(rcb, 'collision_mask', 0xFFFFFFFF),
                                        hit_from_inside: this.parseBool(rcb, 'hit_from_inside', false),
                                });
                        }

                        for (const scb of this.extractNamedStructs(compContent, 'ShapeCast')) {
                                entity.components.push({
                                        type: 'ShapeCast',
                                        enabled: this.parseBool(scb, 'enabled', true),
                                        shape: this.parseCollisionShapeFromBlock(scb),
                                        target_position: this.parseTuple3(scb, 'target_position'),
                                        collision_mask: this.parseInt(scb, 'collision_mask', 0xFFFFFFFF),
                                        max_results: this.parseInt(scb, 'max_results', 32),
                                });
                        }

                        // Audio components
                        for (const asp of this.extractNamedStructs(compContent, 'AudioStreamPlayer')) {
                                entity.components.push({
                                        type: 'AudioStreamPlayer',
                                        stream: this.parseString(asp, 'stream', ''),
                                        volume_db: this.parseFloat(asp, 'volume_db', 0.0),
                                        pitch_scale: this.parseFloat(asp, 'pitch_scale', 1.0),
                                        playing: this.parseBool(asp, 'playing', false),
                                        autoplay: this.parseBool(asp, 'autoplay', false),
                                        stream_paused: this.parseBool(asp, 'stream_paused', false),
                                });
                        }

                        for (const asp2d of this.extractNamedStructs(compContent, 'AudioStreamPlayer2D')) {
                                entity.components.push({
                                        type: 'AudioStreamPlayer2D',
                                        stream: this.parseString(asp2d, 'stream', ''),
                                        volume_db: this.parseFloat(asp2d, 'volume_db', 0.0),
                                        pitch_scale: this.parseFloat(asp2d, 'pitch_scale', 1.0),
                                        playing: this.parseBool(asp2d, 'playing', false),
                                        autoplay: this.parseBool(asp2d, 'autoplay', false),
                                        max_distance: this.parseFloat(asp2d, 'max_distance', 2000.0),
                                        attenuation: this.parseFloat(asp2d, 'attenuation', 1.0),
                                });
                        }

                        for (const asp3d of this.extractNamedStructs(compContent, 'AudioStreamPlayer3D')) {
                                entity.components.push({
                                        type: 'AudioStreamPlayer3D',
                                        stream: this.parseString(asp3d, 'stream', ''),
                                        volume_db: this.parseFloat(asp3d, 'volume_db', 0.0),
                                        pitch_scale: this.parseFloat(asp3d, 'pitch_scale', 1.0),
                                        playing: this.parseBool(asp3d, 'playing', false),
                                        autoplay: this.parseBool(asp3d, 'autoplay', false),
                                        max_distance: this.parseFloat(asp3d, 'max_distance', 100.0),
                                        attenuation_model: this.parseString(asp3d, 'attenuation_model', 'InverseSquareDistance') as 'InverseDistance' | 'InverseSquareDistance' | 'Logarithmic',
                                        emission_angle_enabled: this.parseBool(asp3d, 'emission_angle_enabled', false),
                                        emission_angle_degrees: this.parseFloat(asp3d, 'emission_angle_degrees', 45.0),
                                });
                        }

                        // Animation components
                        for (const ap of this.extractNamedStructs(compContent, 'AnimationPlayer')) {
                                entity.components.push({
                                        type: 'AnimationPlayer',
                                        current_animation: this.parseString(ap, 'current_animation', ''),
                                        playback_speed: this.parseFloat(ap, 'playback_speed', 1.0),
                                        autoplay: this.parseString(ap, 'autoplay', ''),
                                        playback_active: this.parseBool(ap, 'playback_active', false),
                                        playback_default_blend_time: this.parseFloat(ap, 'playback_default_blend_time', 0.0),
                                });
                        }

                        for (const at of this.extractNamedStructs(compContent, 'AnimationTree')) {
                                entity.components.push({
                                        type: 'AnimationTree',
                                        tree_root: this.parseString(at, 'tree_root', ''),
                                        anim_player: this.parseString(at, 'anim_player', ''),
                                        active: this.parseBool(at, 'active', false),
                                        process_callback: this.parseString(at, 'process_callback', 'Idle') as 'Physics' | 'Idle' | 'Manual',
                                });
                        }

                        for (const tw of this.extractNamedStructs(compContent, 'Tween')) {
                                entity.components.push({
                                        type: 'Tween',
                                        active: this.parseBool(tw, 'active', false),
                                        speed_scale: this.parseFloat(tw, 'speed_scale', 1.0),
                                });
                        }

                        // Navigation components
                        for (const nr3d of this.extractNamedStructs(compContent, 'NavigationRegion3D')) {
                                entity.components.push({
                                        type: 'NavigationRegion3D',
                                        enabled: this.parseBool(nr3d, 'enabled', true),
                                        navigation_layers: this.parseInt(nr3d, 'navigation_layers', 1),
                                        enter_cost: this.parseFloat(nr3d, 'enter_cost', 0.0),
                                        travel_cost: this.parseFloat(nr3d, 'travel_cost', 1.0),
                                });
                        }

                        for (const na3d of this.extractNamedStructs(compContent, 'NavigationAgent3D')) {
                                entity.components.push({
                                        type: 'NavigationAgent3D',
                                        target_position: this.parseTuple3(na3d, 'target_position'),
                                        path_desired_distance: this.parseFloat(na3d, 'path_desired_distance', 1.0),
                                        target_desired_distance: this.parseFloat(na3d, 'target_desired_distance', 0.5),
                                        radius: this.parseFloat(na3d, 'radius', 0.5),
                                        height: this.parseFloat(na3d, 'height', 2.0),
                                        max_speed: this.parseFloat(na3d, 'max_speed', 5.0),
                                        avoidance_enabled: this.parseBool(na3d, 'avoidance_enabled', true),
                                });
                        }

                        for (const no3d of this.extractNamedStructs(compContent, 'NavigationObstacle3D')) {
                                entity.components.push({
                                        type: 'NavigationObstacle3D',
                                        radius: this.parseFloat(no3d, 'radius', 0.5),
                                        height: this.parseFloat(no3d, 'height', 2.0),
                                        avoidance_enabled: this.parseBool(no3d, 'avoidance_enabled', true),
                                        velocity: this.parseTuple3(no3d, 'velocity'),
                                });
                        }

                        // Utility components
                        for (const tm of this.extractNamedStructs(compContent, 'Timer')) {
                                entity.components.push({
                                        type: 'Timer',
                                        wait_time: this.parseFloat(tm, 'wait_time', 1.0),
                                        one_shot: this.parseBool(tm, 'one_shot', false),
                                        autostart: this.parseBool(tm, 'autostart', false),
                                        time_left: this.parseFloat(tm, 'time_left', 0.0),
                                        paused: this.parseBool(tm, 'paused', false),
                                });
                        }

                        for (const p3d of this.extractNamedStructs(compContent, 'Path3D')) {
                                entity.components.push({
                                        type: 'Path3D',
                                        curve: this.parseString(p3d, 'curve', ''),
                                });
                        }

                        for (const pf3d of this.extractNamedStructs(compContent, 'PathFollow3D')) {
                                entity.components.push({
                                        type: 'PathFollow3D',
                                        progress: this.parseFloat(pf3d, 'progress', 0.0),
                                        progress_ratio: this.parseFloat(pf3d, 'progress_ratio', 0.0),
                                        h_offset: this.parseFloat(pf3d, 'h_offset', 0.0),
                                        v_offset: this.parseFloat(pf3d, 'v_offset', 0.0),
                                        rotation_mode: this.parseString(pf3d, 'rotation_mode', 'XYZ') as 'None' | 'Y' | 'XY' | 'XYZ' | 'Oriented',
                                        cubic_interp: this.parseBool(pf3d, 'cubic_interp', true),
                                        loop: this.parseBool(pf3d, 'loop', false),
                                });
                        }

                        for (const m3d of this.extractNamedStructs(compContent, 'Marker3D')) {
                                entity.components.push({
                                        type: 'Marker3D',
                                        gizmo_extents: this.parseFloat(m3d, 'gizmo_extents', 0.25),
                                });
                        }

                        // Environment components
                        for (const we of this.extractNamedStructs(compContent, 'WorldEnvironment')) {
                                entity.components.push({
                                        type: 'WorldEnvironment',
                                        environment: this.parseString(we, 'environment', ''),
                                        camera_attributes: this.parseString(we, 'camera_attributes', ''),
                                        // Background
                                        background_mode: this.parseString(we, 'background_mode', 'Sky') as 'Sky' | 'Color' | 'Gradient' | 'Canvas' | 'Keep',
                                        background_color: this.parseColor4(we, 'background_color', [0.2, 0.2, 0.2, 1.0]),
                                        gradient_top: this.parseColor4(we, 'gradient_top', [0.4, 0.4, 0.5, 1.0]),
                                        gradient_bottom: this.parseColor4(we, 'gradient_bottom', [0.15, 0.15, 0.18, 1.0]),
                                        // Ambient Light
                                        ambient_light_energy: this.parseFloat(we, 'ambient_light_energy', 1.0),
                                        ambient_light_color: this.parseColor4(we, 'ambient_light_color', [0.5, 0.5, 0.5, 1.0]),
                                        ambient_light_sky_contribution: this.parseFloat(we, 'ambient_light_sky_contribution', 1.0),
                                        // Reflected Light
                                        reflected_light_energy: this.parseFloat(we, 'reflected_light_energy', 1.0),
                                        // Tonemap
                                        tonemap_mode: this.parseString(we, 'tonemap_mode', 'Linear') as 'Linear' | 'Reinhard' | 'Filmic' | 'ACES',
                                        tonemap_exposure: this.parseFloat(we, 'tonemap_exposure', 1.0),
                                        tonemap_white: this.parseFloat(we, 'tonemap_white', 1.0),
                                        // SSAO
                                        ssao_enabled: this.parseBool(we, 'ssao_enabled', false),
                                        ssao_intensity: this.parseFloat(we, 'ssao_intensity', 1.0),
                                        ssao_radius: this.parseFloat(we, 'ssao_radius', 1.0),
                                        // Glow/Bloom
                                        glow_enabled: this.parseBool(we, 'glow_enabled', false),
                                        glow_intensity: this.parseFloat(we, 'glow_intensity', 0.8),
                                        glow_threshold: this.parseFloat(we, 'glow_threshold', 0.9),
                                        // Sky (merged in WorldEnvironment)
                                        sky_material: this.parseString(we, 'sky_material', 'ProceduralSky') as 'ProceduralSky' | 'PanoramaSky' | 'PhysicalSky',
                                        radiance_size: this.parseString(we, 'radiance_size', 'Size1024') as 'Size256' | 'Size512' | 'Size1024' | 'Size2048',
                                        sky_top_color: this.parseColor4(we, 'sky_top_color', [0.35, 0.55, 0.85, 1.0]),
                                        sky_horizon_color: this.parseColor4(we, 'sky_horizon_color', [0.65, 0.78, 0.90, 1.0]),
                                        sky_curve: this.parseFloat(we, 'sky_curve', 0.15),
                                        sky_energy: this.parseFloat(we, 'sky_energy', 1.0),
                                        ground_bottom_color: this.parseColor4(we, 'ground_bottom_color', [0.12, 0.10, 0.08, 1.0]),
                                        ground_horizon_color: this.parseColor4(we, 'ground_horizon_color', [0.35, 0.30, 0.25, 1.0]),
                                        ground_curve: this.parseFloat(we, 'ground_curve', 0.1),
                                        ground_energy: this.parseFloat(we, 'ground_energy', 1.0),
                                        sun_enabled: this.parseBool(we, 'sun_enabled', true),
                                        sun_angle_min: this.parseFloat(we, 'sun_angle_min', 0.5),
                                        sun_angle_max: this.parseFloat(we, 'sun_angle_max', 2.0),
                                        sun_curve: this.parseFloat(we, 'sun_curve', 0.05),
                                        sun_energy: this.parseFloat(we, 'sun_energy', 16.0),
                                        sun_color: this.parseColor4(we, 'sun_color', [1.0, 0.95, 0.85, 1.0]),
                                        sun_position: this.parseTuple3Default(we, 'sun_position', [0.5, 0.8, -0.3]),
                                        clouds_enabled: this.parseBool(we, 'clouds_enabled', false),
                                        clouds_color: this.parseColor4(we, 'clouds_color', [1.0, 1.0, 1.0, 1.0]),
                                        clouds_density: this.parseFloat(we, 'clouds_density', 0.5),
                                        clouds_speed: this.parseFloat(we, 'clouds_speed', 0.1),
                                        clouds_height: this.parseFloat(we, 'clouds_height', 500.0),
                                        clouds_coverage: this.parseFloat(we, 'clouds_coverage', 0.5),
                                        clouds_thickness: this.parseFloat(we, 'clouds_thickness', 100.0),
                                        fog_enabled: this.parseBool(we, 'fog_enabled', false),
                                        fog_density: this.parseFloat(we, 'fog_density', 0.001),
                                        fog_depth_begin: this.parseFloat(we, 'fog_depth_begin', 10.0),
                                        fog_depth_end: this.parseFloat(we, 'fog_depth_end', 100.0),
                                        fog_color: this.parseColor4(we, 'fog_color', [0.7, 0.75, 0.80, 1.0]),
                                });
                        }

                        for (const fv of this.extractNamedStructs(compContent, 'FogVolume')) {
                                entity.components.push({
                                        type: 'FogVolume',
                                        density: this.parseFloat(fv, 'density', 0.1),
                                        albedo: this.parseTuple3(fv, 'albedo'),
                                        emission: this.parseTuple3(fv, 'emission'),
                                        height_falloff: this.parseFloat(fv, 'height_falloff', 0.0),
                                });
                        }

                        // Special components
                        for (const sk3d of this.extractNamedStructs(compContent, 'Skeleton3D')) {
                                entity.components.push({
                                        type: 'Skeleton3D',
                                        bones: this.parseStringArray(sk3d, 'bones'),
                                        bone_poses: [], // TODO: parse bone poses
                                });
                        }

                        for (const ba3d of this.extractNamedStructs(compContent, 'BoneAttachment3D')) {
                                entity.components.push({
                                        type: 'BoneAttachment3D',
                                        bone_name: this.parseString(ba3d, 'bone_name', ''),
                                        bone_idx: this.parseInt(ba3d, 'bone_idx', 0),
                                });
                        }

                        for (const vp of this.extractNamedStructs(compContent, 'Viewport')) {
                                entity.components.push({
                                        type: 'Viewport',
                                        size: this.parseTuple2(vp, 'size'),
                                        transparent_bg: this.parseBool(vp, 'transparent_bg', false),
                                        msaa: this.parseString(vp, 'msaa', 'Disabled') as 'Disabled' | 'MSAA2x' | 'MSAA4x' | 'MSAA8x',
                                        screen_space_aa: this.parseString(vp, 'screen_space_aa', 'Disabled') as 'Disabled' | 'FXAA',
                                        use_debanding: this.parseBool(vp, 'use_debanding', false),
                                        use_occlusion_culling: this.parseBool(vp, 'use_occlusion_culling', false),
                                });
                        }

                        for (const svp of this.extractNamedStructs(compContent, 'SubViewport')) {
                                entity.components.push({
                                        type: 'SubViewport',
                                        size: this.parseTuple2(svp, 'size'),
                                        render_target_update_mode: this.parseString(svp, 'render_target_update_mode', 'WhenVisible') as 'Disabled' | 'Once' | 'WhenVisible' | 'WhenParentVisible' | 'Always',
                                });
                        }

                        // 2D Components
                        for (const t2d of this.extractNamedStructs(compContent, 'Transform2D')) {
                                entity.components.push({
                                        type: 'Transform2D',
                                        position: this.parseTuple2(t2d, 'position'),
                                        rotation: this.parseFloat(t2d, 'rotation', 0.0),
                                        scale: this.parseTuple2(t2d, 'scale'),
                                });
                        }

                        for (const s2d of this.extractNamedStructs(compContent, 'Sprite2D')) {
                                entity.components.push({
                                        type: 'Sprite2D',
                                        texture: this.parseString(s2d, 'texture', ''),
                                        region_enabled: this.parseBool(s2d, 'region_enabled', false),
                                        region_rect: this.parseTupleN(s2d, 'region_rect', 4, [0, 0, 0, 0]) as [number, number, number, number],
                                        offset: this.parseTuple2(s2d, 'offset'),
                                });
                        }

                        for (const as2d of this.extractNamedStructs(compContent, 'AnimatedSprite2D')) {
                                entity.components.push({
                                        type: 'AnimatedSprite2D',
                                        sprite_frames: this.parseString(as2d, 'sprite_frames', ''),
                                        animation: this.parseString(as2d, 'animation', 'default'),
                                        frame: this.parseInt(as2d, 'frame', 0),
                                        playing: this.parseBool(as2d, 'playing', false),
                                        speed_scale: this.parseFloat(as2d, 'speed_scale', 1.0),
                                });
                        }

                        for (const cb2d of this.extractNamedStructs(compContent, 'CharacterBody2D')) {
                                entity.components.push({
                                        type: 'CharacterBody2D',
                                        motion_mode: this.parseString(cb2d, 'motion_mode', 'Grounded') as 'Grounded' | 'Floating',
                                        up_direction: this.parseTuple2(cb2d, 'up_direction'),
                                        velocity: this.parseTuple2(cb2d, 'velocity'),
                                        max_slides: this.parseInt(cb2d, 'max_slides', 4),
                                        floor_stop_on_slope: this.parseBool(cb2d, 'floor_stop_on_slope', true),
                                });
                        }

                        for (const rb2d of this.extractNamedStructs(compContent, 'RigidBody2D')) {
                                entity.components.push({
                                        type: 'RigidBody2D',
                                        mass: this.parseFloat(rb2d, 'mass', 1.0),
                                        gravity_scale: this.parseFloat(rb2d, 'gravity_scale', 1.0),
                                        linear_damp: this.parseFloat(rb2d, 'linear_damp', 0.0),
                                        angular_damp: this.parseFloat(rb2d, 'angular_damp', 0.0),
                                        lock_rotation: this.parseBool(rb2d, 'lock_rotation', false),
                                });
                        }

                        for (const sb2d of this.extractNamedStructs(compContent, 'StaticBody2D')) {
                                entity.components.push({
                                        type: 'StaticBody2D',
                                        friction: this.parseFloat(sb2d, 'friction', 0.5),
                                        bounce: this.parseFloat(sb2d, 'bounce', 0.0),
                                });
                        }

                        for (const a2d of this.extractNamedStructs(compContent, 'Area2D')) {
                                entity.components.push({
                                        type: 'Area2D',
                                        monitoring: this.parseBool(a2d, 'monitoring', true),
                                        monitorable: this.parseBool(a2d, 'monitorable', true),
                                        priority: this.parseInt(a2d, 'priority', 0),
                                        gravity_space_override: this.parseString(a2d, 'gravity_space_override', 'Disabled') as 'Disabled' | 'Combine' | 'Replace',
                                });
                        }

                        for (const cs2d of this.extractNamedStructs(compContent, 'CollisionShape2D')) {
                                entity.components.push({
                                        type: 'CollisionShape2D',
                                        shape: this.parseCollisionShape2DFromBlock(cs2d),
                                        disabled: this.parseBool(cs2d, 'disabled', false),
                                        one_way_collision: this.parseBool(cs2d, 'one_way_collision', false),
                                });
                        }

                        for (const rc2d of this.extractNamedStructs(compContent, 'RayCast2D')) {
                                entity.components.push({
                                        type: 'RayCast2D',
                                        enabled: this.parseBool(rc2d, 'enabled', true),
                                        target_position: this.parseTuple2(rc2d, 'target_position'),
                                        collision_mask: this.parseInt(rc2d, 'collision_mask', 0xFFFFFFFF),
                                        hit_from_inside: this.parseBool(rc2d, 'hit_from_inside', false),
                                });
                        }

                        // 3D Visual Components
                        for (const s3d of this.extractNamedStructs(compContent, 'Sprite3D')) {
                                entity.components.push({
                                        type: 'Sprite3D',
                                        texture: this.parseString(s3d, 'texture', ''),
                                        billboard: this.parseString(s3d, 'billboard', 'Disabled') as 'Disabled' | 'Enabled' | 'YBillboard',
                                        transparent: this.parseBool(s3d, 'transparent', true),
                                        shaded: this.parseBool(s3d, 'shaded', false),
                                        double_sided: this.parseBool(s3d, 'double_sided', true),
                                        alpha_cut: this.parseFloat(s3d, 'alpha_cut', 0.5),
                                });
                        }

                        for (const as3d of this.extractNamedStructs(compContent, 'AnimatedSprite3D')) {
                                entity.components.push({
                                        type: 'AnimatedSprite3D',
                                        sprite_frames: this.parseString(as3d, 'sprite_frames', ''),
                                        animation: this.parseString(as3d, 'animation', 'default'),
                                        frame: this.parseInt(as3d, 'frame', 0),
                                        playing: this.parseBool(as3d, 'playing', false),
                                        billboard: this.parseString(as3d, 'billboard', 'Disabled') as 'Disabled' | 'Enabled' | 'YBillboard',
                                });
                        }

                        for (const l3d of this.extractNamedStructs(compContent, 'Label3D')) {
                                entity.components.push({
                                        type: 'Label3D',
                                        text: this.parseString(l3d, 'text', ''),
                                        font_size: this.parseInt(l3d, 'font_size', 16),
                                        outline_size: this.parseInt(l3d, 'outline_size', 0),
                                        modulate: this.parseTuple4(l3d, 'modulate'),
                                        billboard: this.parseString(l3d, 'billboard', 'Disabled') as 'Disabled' | 'Enabled' | 'YBillboard',
                                });
                        }

                        for (const gp3d of this.extractNamedStructs(compContent, 'GPUParticles3D')) {
                                entity.components.push({
                                        type: 'GPUParticles3D',
                                        emitting: this.parseBool(gp3d, 'emitting', false),
                                        amount: this.parseInt(gp3d, 'amount', 8),
                                        lifetime: this.parseFloat(gp3d, 'lifetime', 1.0),
                                        one_shot: this.parseBool(gp3d, 'one_shot', false),
                                        explosiveness: this.parseFloat(gp3d, 'explosiveness', 0.0),
                                        randomness: this.parseFloat(gp3d, 'randomness', 0.0),
                                        visibility_aabb: this.parseTupleN(gp3d, 'visibility_aabb', 6, [-4, -4, -4, 8, 8, 8]) as [number, number, number, number, number, number],
                                });
                        }

                        for (const cp3d of this.extractNamedStructs(compContent, 'CPUParticles3D')) {
                                entity.components.push({
                                        type: 'CPUParticles3D',
                                        emitting: this.parseBool(cp3d, 'emitting', false),
                                        amount: this.parseInt(cp3d, 'amount', 8),
                                        lifetime: this.parseFloat(cp3d, 'lifetime', 1.0),
                                        one_shot: this.parseBool(cp3d, 'one_shot', false),
                                        explosiveness: this.parseFloat(cp3d, 'explosiveness', 0.0),
                                        randomness: this.parseFloat(cp3d, 'randomness', 0.0),
                                        emission_shape: this.parseString(cp3d, 'emission_shape', 'Point') as 'Point' | 'Sphere' | 'Box' | 'Points' | 'DirectedPoints',
                                });
                        }

                        for (const mmi3d of this.extractNamedStructs(compContent, 'MultiMeshInstance3D')) {
                                entity.components.push({
                                        type: 'MultiMeshInstance3D',
                                        instance_count: this.parseInt(mmi3d, 'instance_count', 0),
                                        visible_instance_count: this.parseInt(mmi3d, 'visible_instance_count', -1),
                                        mesh: this.parseString(mmi3d, 'mesh', ''),
                                        transform_format: this.parseString(mmi3d, 'transform_format', '3D') as '2D' | '3D',
                                });
                        }

                        // Additional Navigation 2D
                        for (const nr2d of this.extractNamedStructs(compContent, 'NavigationRegion2D')) {
                                entity.components.push({
                                        type: 'NavigationRegion2D',
                                        enabled: this.parseBool(nr2d, 'enabled', true),
                                        navigation_layers: this.parseInt(nr2d, 'navigation_layers', 1),
                                        enter_cost: this.parseFloat(nr2d, 'enter_cost', 0.0),
                                        travel_cost: this.parseFloat(nr2d, 'travel_cost', 1.0),
                                });
                        }

                        for (const na2d of this.extractNamedStructs(compContent, 'NavigationAgent2D')) {
                                entity.components.push({
                                        type: 'NavigationAgent2D',
                                        target_position: this.parseTuple2(na2d, 'target_position'),
                                        path_desired_distance: this.parseFloat(na2d, 'path_desired_distance', 1.0),
                                        target_desired_distance: this.parseFloat(na2d, 'target_desired_distance', 0.5),
                                        radius: this.parseFloat(na2d, 'radius', 0.5),
                                        max_speed: this.parseFloat(na2d, 'max_speed', 5.0),
                                        avoidance_enabled: this.parseBool(na2d, 'avoidance_enabled', true),
                                });
                        }

                        for (const no2d of this.extractNamedStructs(compContent, 'NavigationObstacle2D')) {
                                entity.components.push({
                                        type: 'NavigationObstacle2D',
                                        radius: this.parseFloat(no2d, 'radius', 0.5),
                                        avoidance_enabled: this.parseBool(no2d, 'avoidance_enabled', true),
                                        velocity: this.parseTuple2(no2d, 'velocity'),
                                });
                        }

                        // Additional Environment
                        for (const sky of this.extractNamedStructs(compContent, 'Sky')) {
                                let world = entity.components.find(c => c.type === 'WorldEnvironment') as any;
                                if (!world) {
                                        world = {
                                                type: 'WorldEnvironment',
                                                environment: '',
                                                camera_attributes: '',
                                                background_mode: 'Sky',
                                                background_color: [0.05, 0.05, 0.1, 1.0],
                                                gradient_top: [0.4, 0.4, 0.5, 1.0],
                                                gradient_bottom: [0.15, 0.15, 0.18, 1.0],
                                                ambient_light_energy: 1.0,
                                                ambient_light_color: [0.5, 0.5, 0.55, 1.0],
                                                ambient_light_sky_contribution: 1.0,
                                                reflected_light_energy: 1.0,
                                                tonemap_mode: 'Filmic',
                                                tonemap_exposure: 1.0,
                                                tonemap_white: 1.0,
                                                ssao_enabled: false,
                                                ssao_intensity: 1.0,
                                                ssao_radius: 1.0,
                                                glow_enabled: false,
                                                glow_intensity: 0.8,
                                                glow_threshold: 0.9,
                                        };
                                        entity.components.push(world);
                                }

                                const skyMat = this.parseString(sky, 'sky_material', 'ProceduralSky');
                                world.sky_material = (skyMat === 'ProceduralSky' || skyMat === 'PanoramaSky' || skyMat === 'PhysicalSky')
                                        ? skyMat : 'ProceduralSky';
                                world.radiance_size = this.parseString(sky, 'radiance_size', 'Size256');
                                world.sky_top_color = this.parseColor4(sky, 'sky_top_color', [0.35, 0.55, 0.85, 1.0]);
                                world.sky_horizon_color = this.parseColor4(sky, 'sky_horizon_color', [0.65, 0.78, 0.90, 1.0]);
                                world.sky_curve = this.parseFloat(sky, 'sky_curve', 0.15);
                                world.sky_energy = this.parseFloat(sky, 'sky_energy', 1.0);
                                world.ground_bottom_color = this.parseColor4(sky, 'ground_bottom_color', [0.12, 0.10, 0.08, 1.0]);
                                world.ground_horizon_color = this.parseColor4(sky, 'ground_horizon_color', [0.35, 0.30, 0.25, 1.0]);
                                world.ground_curve = this.parseFloat(sky, 'ground_curve', 0.1);
                                world.ground_energy = this.parseFloat(sky, 'ground_energy', 1.0);
                                world.sun_enabled = this.parseBool(sky, 'sun_enabled', true);
                                world.sun_angle_min = this.parseFloat(sky, 'sun_angle_min', 0.5);
                                world.sun_angle_max = this.parseFloat(sky, 'sun_angle_max', 2.0);
                                world.sun_curve = this.parseFloat(sky, 'sun_curve', 0.05);
                                world.sun_energy = this.parseFloat(sky, 'sun_energy', 16.0);
                                world.sun_color = this.parseColor4(sky, 'sun_color', [1.0, 0.95, 0.85, 1.0]);
                                world.sun_position = this.parseTuple3Default(sky, 'sun_position', [0.5, 0.8, -0.3]);
                                world.clouds_enabled = this.parseBool(sky, 'clouds_enabled', false);
                                world.clouds_color = this.parseColor4(sky, 'clouds_color', [1.0, 1.0, 1.0, 1.0]);
                                world.clouds_density = this.parseFloat(sky, 'clouds_density', 0.5);
                                world.clouds_speed = this.parseFloat(sky, 'clouds_speed', 0.1);
                                world.clouds_height = this.parseFloat(sky, 'clouds_height', 500.0);
                                world.clouds_coverage = this.parseFloat(sky, 'clouds_coverage', 0.5);
                                world.clouds_thickness = this.parseFloat(sky, 'clouds_thickness', 100.0);
                                world.fog_enabled = this.parseBool(sky, 'fog_enabled', false);
                                world.fog_density = this.parseFloat(sky, 'fog_density', 0.001);
                                world.fog_depth_begin = this.parseFloat(sky, 'fog_depth_begin', 10.0);
                                world.fog_depth_end = this.parseFloat(sky, 'fog_depth_end', 100.0);
                                world.fog_color = this.parseColor4(sky, 'fog_color', [0.7, 0.75, 0.80, 1.0]);
                        }

                        for (const rp of this.extractNamedStructs(compContent, 'ReflectionProbe')) {
                                entity.components.push({
                                        type: 'ReflectionProbe',
                                        update_mode: this.parseString(rp, 'update_mode', 'Once') as 'Once' | 'Always',
                                        intensity: this.parseFloat(rp, 'intensity', 1.0),
                                        max_distance: this.parseFloat(rp, 'max_distance', 0.0),
                                        extents: this.parseTuple3(rp, 'extents'),
                                        origin_offset: this.parseTuple3(rp, 'origin_offset'),
                                        box_projection: this.parseBool(rp, 'box_projection', false),
                                        enable_shadows: this.parseBool(rp, 'enable_shadows', false),
                                });
                        }

                        // Additional Utility
                        for (const p2d of this.extractNamedStructs(compContent, 'Path2D')) {
                                entity.components.push({
                                        type: 'Path2D',
                                        curve: this.parseString(p2d, 'curve', ''),
                                });
                        }

                        for (const pf2d of this.extractNamedStructs(compContent, 'PathFollow2D')) {
                                entity.components.push({
                                        type: 'PathFollow2D',
                                        progress: this.parseFloat(pf2d, 'progress', 0.0),
                                        progress_ratio: this.parseFloat(pf2d, 'progress_ratio', 0.0),
                                        h_offset: this.parseFloat(pf2d, 'h_offset', 0.0),
                                        v_offset: this.parseFloat(pf2d, 'v_offset', 0.0),
                                        rotates: this.parseBool(pf2d, 'rotates', true),
                                        cubic_interp: this.parseBool(pf2d, 'cubic_interp', true),
                                        loop: this.parseBool(pf2d, 'loop', false),
                                });
                        }

                        for (const rt3d of this.extractNamedStructs(compContent, 'RemoteTransform3D')) {
                                entity.components.push({
                                        type: 'RemoteTransform3D',
                                        remote_path: this.parseString(rt3d, 'remote_path', ''),
                                        use_global_coordinates: this.parseBool(rt3d, 'use_global_coordinates', true),
                                        update_position: this.parseBool(rt3d, 'update_position', true),
                                        update_rotation: this.parseBool(rt3d, 'update_rotation', true),
                                        update_scale: this.parseBool(rt3d, 'update_scale', true),
                                });
                        }

                        for (const rt2d of this.extractNamedStructs(compContent, 'RemoteTransform2D')) {
                                entity.components.push({
                                        type: 'RemoteTransform2D',
                                        remote_path: this.parseString(rt2d, 'remote_path', ''),
                                        use_global_coordinates: this.parseBool(rt2d, 'use_global_coordinates', true),
                                        update_position: this.parseBool(rt2d, 'update_position', true),
                                        update_rotation: this.parseBool(rt2d, 'update_rotation', true),
                                        update_scale: this.parseBool(rt2d, 'update_scale', true),
                                });
                        }

                        for (const m2d of this.extractNamedStructs(compContent, 'Marker2D')) {
                                entity.components.push({
                                        type: 'Marker2D',
                                        gizmo_extents: this.parseFloat(m2d, 'gizmo_extents', 10.0),
                                });
                        }

                        for (const vosn3d of this.extractNamedStructs(compContent, 'VisibleOnScreenNotifier3D')) {
                                entity.components.push({
                                        type: 'VisibleOnScreenNotifier3D',
                                        aabb: this.parseTupleN(vosn3d, 'aabb', 6, [-1, -1, -1, 2, 2, 2]) as [number, number, number, number, number, number],
                                });
                        }

                        for (const vosn2d of this.extractNamedStructs(compContent, 'VisibleOnScreenNotifier2D')) {
                                entity.components.push({
                                        type: 'VisibleOnScreenNotifier2D',
                                        rect: this.parseTupleN(vosn2d, 'rect', 4, [0, 0, 0, 0]) as [number, number, number, number],
                                });
                        }

                        for (const cl of this.extractNamedStructs(compContent, 'CanvasLayer')) {
                                entity.components.push({
                                        type: 'CanvasLayer',
                                        layer: this.parseInt(cl, 'layer', 1),
                                        offset: this.parseTuple2(cl, 'offset'),
                                        rotation: this.parseFloat(cl, 'rotation', 0.0),
                                        scale: this.parseTuple2(cl, 'scale'),
                                        follow_viewport_enabled: this.parseBool(cl, 'follow_viewport_enabled', false),
                                });
                        }
                }

                const childrenContent = this.extractRONList(block, 'children') ?? '';
                if (childrenContent.trim().length) {
                        for (const cb of this.extractAnonymousTuples(childrenContent)) {
                                const child = this.parseEntityBlock(cb);
                                if (child) entity.children.push(child);
                        }
                        for (const cb of this.extractNamedStructs(childrenContent, 'Entity')) {
                                const child = this.parseEntityBlock(cb);
                                if (child) entity.children.push(child);
                        }
                }

                return entity;
        }

        private static parseShapeFromMeshBlock(meshInner: string): any {
                const cube = this.extractNamedStructs(meshInner, 'Cube');
                if (cube.length) {
                        return { type: 'Cube', size: this.parseFloat(cube[0], 'size', 1) };
                }

                const plane = this.extractNamedStructs(meshInner, 'Plane');
                if (plane.length) {
                        return { type: 'Plane', size: this.parseFloat(plane[0], 'size', 1) };
                }

                const sphere = this.extractNamedStructs(meshInner, 'Sphere');
                if (sphere.length) {
                        return { type: 'Sphere', radius: this.parseFloat(sphere[0], 'radius', 1) };
                }

                const cylinder = this.extractNamedStructs(meshInner, 'Cylinder');
                if (cylinder.length) {
                        return {
                                type: 'Cylinder',
                                radius: this.parseFloat(cylinder[0], 'radius', 0.5),
                                height: this.parseFloat(cylinder[0], 'height', 1)
                        };
                }

                const cone = this.extractNamedStructs(meshInner, 'Cone');
                if (cone.length) {
                        return {
                                type: 'Cone',
                                radius: this.parseFloat(cone[0], 'radius', 0.5),
                                height: this.parseFloat(cone[0], 'height', 1)
                        };
                }

                const torus = this.extractNamedStructs(meshInner, 'Torus');
                if (torus.length) {
                        return {
                                type: 'Torus',
                                radius: this.parseFloat(torus[0], 'radius', 1),
                                tube: this.parseFloat(torus[0], 'tube', 0.3)
                        };
                }

                const capsule = this.extractNamedStructs(meshInner, 'Capsule');
                if (capsule.length) {
                        return {
                                type: 'Capsule',
                                radius: this.parseFloat(capsule[0], 'radius', 0.5),
                                height: this.parseFloat(capsule[0], 'height', 1.0)
                        };
                }

                // Fallback: shape name without args
                const name = meshInner.match(/shape:\s*(\w+)/)?.[1];
                if (name === 'Cube') return { type: 'Cube', size: 1 };
                if (name === 'Plane') return { type: 'Plane', size: 1 };
                if (name === 'Sphere') return { type: 'Sphere', radius: 1 };
                if (name === 'Cylinder') return { type: 'Cylinder', radius: 0.5, height: 1 };
                if (name === 'Cone') return { type: 'Cone', radius: 0.5, height: 1 };
                if (name === 'Torus') return { type: 'Torus', radius: 1, tube: 0.3 };
                if (name === 'Capsule') return { type: 'Capsule', radius: 0.5, height: 1.0 };

                return { type: 'Cube', size: 1 };
        }

        private static parseCollisionShapeFromBlock(csInner: string): any {
                const box = this.extractNamedStructs(csInner, 'Box');
                if (box.length) {
                        return { type: 'Box', size: this.parseFloat(box[0], 'size', 1) };
                }

                const sphere = this.extractNamedStructs(csInner, 'Sphere');
                if (sphere.length) {
                        return { type: 'Sphere', radius: this.parseFloat(sphere[0], 'radius', 0.5) };
                }

                const capsule = this.extractNamedStructs(csInner, 'Capsule');
                if (capsule.length) {
                        return {
                                type: 'Capsule',
                                radius: this.parseFloat(capsule[0], 'radius', 0.5),
                                height: this.parseFloat(capsule[0], 'height', 1.0)
                        };
                }

                const cylinder = this.extractNamedStructs(csInner, 'Cylinder');
                if (cylinder.length) {
                        return {
                                type: 'Cylinder',
                                radius: this.parseFloat(cylinder[0], 'radius', 0.5),
                                height: this.parseFloat(cylinder[0], 'height', 1.0)
                        };
                }

                // Fallback
                return { type: 'Box', size: 1 };
        }

        private static parseCollisionShape2DFromBlock(csInner: string): any {
                const rectangle = this.extractNamedStructs(csInner, 'Rectangle');
                if (rectangle.length) {
                        return { type: 'Rectangle', size: this.parseTuple2(rectangle[0], 'size') };
                }

                const circle = this.extractNamedStructs(csInner, 'Circle');
                if (circle.length) {
                        return { type: 'Circle', radius: this.parseFloat(circle[0], 'radius', 0.5) };
                }

                const capsule = this.extractNamedStructs(csInner, 'Capsule');
                if (capsule.length) {
                        return {
                                type: 'Capsule',
                                radius: this.parseFloat(capsule[0], 'radius', 0.5),
                                height: this.parseFloat(capsule[0], 'height', 1.0)
                        };
                }

                // Fallback
                return { type: 'Rectangle', size: [1, 1] };
        }

        // ---------------------------
        // Resources (minimal)
        // ---------------------------

        private static parseResources(resourcesInner: string): any[] {
                const res: any[] = [];

                for (const a of this.extractNamedStructs(resourcesInner, 'AmbientLight')) {
                        res.push({
                                type: 'AmbientLight',
                                color: this.parseTuple3(a, 'color'),
                                brightness: this.parseFloat(a, 'brightness', 0.3),
                        });
                }
                for (const c of this.extractNamedStructs(resourcesInner, 'ClearColor')) {
                        res.push({
                                type: 'ClearColor',
                                color: this.parseTuple4(c, 'color'),
                        });
                }
                for (const f of this.extractNamedStructs(resourcesInner, 'Fog')) {
                        res.push({ type: 'Fog', raw: f });
                }

                return res;
        }

        // ---------------------------
        // Lexing helpers
        // ---------------------------

        private static stripComments(s: string): string {
                // line comments
                s = s.replace(/\/\/.*$/gm, '');
                // block comments
                s = s.replace(/\/\*[\s\S]*?\*\//g, '');
                return s;
        }

        private static escapeRegex(str: string): string {
                return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        private static extractRONList(content: string, fieldName: string): string | null {
                const pattern = new RegExp(`${fieldName}\\s*:\\s*\\[`);
                const match = pattern.exec(content);
                if (!match) return null;

                let depth = 1;
                let i = match.index + match[0].length;
                const start = i;

                while (i < content.length && depth > 0) {
                        const ch = content[i];

                        if (ch === '[') depth++;
                        else if (ch === ']') depth--;
                        else if (ch === '"') {
                                i++;
                                while (i < content.length && content[i] !== '"') {
                                        if (content[i] === '\\') i++;
                                        i++;
                                }
                        }

                        i++;
                }

                return content.substring(start, i - 1);
        }

        private static extractAnonymousTuples(listContent: string): string[] {
                const tuples: string[] = [];
                let i = 0;

                while (i < listContent.length) {
                        // skip ws, commas
                        while (i < listContent.length) {
                                const ch = listContent[i];
                                if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === ',') i++;
                                else break;
                        }
                        if (i >= listContent.length) break;

                        if (listContent[i] !== '(') {
                                i++;
                                continue;
                        }

                        const start = i + 1;
                        let depth = 1;
                        i++;

                        while (i < listContent.length && depth > 0) {
                                const ch = listContent[i];

                                if (ch === '(') depth++;
                                else if (ch === ')') depth--;
                                else if (ch === '"') {
                                        i++;
                                        while (i < listContent.length && listContent[i] !== '"') {
                                                if (listContent[i] === '\\') i++;
                                                i++;
                                        }
                                } else if (ch === '[') {
                                        let b = 1;
                                        i++;
                                        while (i < listContent.length && b > 0) {
                                                if (listContent[i] === '[') b++;
                                                else if (listContent[i] === ']') b--;
                                                else if (listContent[i] === '"') {
                                                        i++;
                                                        while (i < listContent.length && listContent[i] !== '"') {
                                                                if (listContent[i] === '\\') i++;
                                                                i++;
                                                        }
                                                }
                                                i++;
                                        }
                                        continue;
                                }

                                i++;
                        }

                        tuples.push(listContent.substring(start, i - 1));
                }

                return tuples;
        }

        private static extractNamedStructs(content: string, structName: string): string[] {
                const blocks: string[] = [];
                const pattern = new RegExp(`(?:^|[^a-zA-Z0-9_])${structName}\\s*\\(`, 'g');
                let match: RegExpExecArray | null;

                while ((match = pattern.exec(content)) !== null) {
                        const matchStr = match[0];
                        const parenIdx = matchStr.lastIndexOf('(');
                        const innerStart = match.index + parenIdx + 1;

                        let depth = 1;
                        let i = innerStart;

                        while (i < content.length && depth > 0) {
                                const ch = content[i];

                                if (ch === '(') depth++;
                                else if (ch === ')') depth--;
                                else if (ch === '"') {
                                        i++;
                                        while (i < content.length && content[i] !== '"') {
                                                if (content[i] === '\\') i++;
                                                i++;
                                        }
                                } else if (ch === '[') {
                                        let b = 1;
                                        i++;
                                        while (i < content.length && b > 0) {
                                                if (content[i] === '[') b++;
                                                else if (content[i] === ']') b--;
                                                else if (content[i] === '"') {
                                                        i++;
                                                        while (i < content.length && content[i] !== '"') {
                                                                if (content[i] === '\\') i++;
                                                                i++;
                                                        }
                                                }
                                                i++;
                                        }
                                        continue;
                                }

                                i++;
                        }

                        blocks.push(content.substring(innerStart, i - 1));
                        pattern.lastIndex = i;
                }

                return blocks;
        }

        // ---------------------------
        // Value parsing helpers
        // ---------------------------

        private static parseFloat(text: string, name: string, def: number): number {
                let m = text.match(new RegExp(`${name}:\\s*Some\\(([-+]?[\\d.eE]+)\\)`));
                if (!m) m = text.match(new RegExp(`${name}:\\s*([-+]?[\\d.eE]+)`));
                if (!m) return def;
                const v = Number.parseFloat(m[1]);
                return Number.isFinite(v) ? v : def;
        }

        private static parseInt(text: string, name: string, def: number): number {
                let m = text.match(new RegExp(`${name}:\\s*Some\\(([-+]?\\d+)\\)`));
                if (!m) m = text.match(new RegExp(`${name}:\\s*([-+]?\\d+)`));
                if (!m) return def;
                const v = Number.parseInt(m[1], 10);
                return Number.isFinite(v) ? v : def;
        }

        private static parseBool(text: string, name: string, def: boolean): boolean {
                let m = text.match(new RegExp(`${name}:\\s*Some\\((true|false)\\)`));
                if (!m) m = text.match(new RegExp(`${name}:\\s*(true|false)`));
                if (!m) return def;
                return m[1] === 'true';
        }

        private static parseString(text: string, name: string, def: string): string {
                let m = text.match(new RegExp(`${name}:\\s*Some\\("([^"]*)"\\)`));
                if (!m) m = text.match(new RegExp(`${name}:\\s*"([^"]*)"`));
                if (!m) return def;
                return m[1];
        }

        private static parseStringArray(text: string, name: string): string[] {
                const m = text.match(new RegExp(`${name}:\\s*\\[([^\\]]+)\\]`));
                if (!m) return [];
                return m[1].split(',').map(s => {
                        const trimmed = s.trim();
                        const quoted = trimmed.match(/"([^"]*)"/);
                        return quoted ? quoted[1] : trimmed;
                }).filter(s => s.length > 0);
        }

        private static parseTuple2(text: string, name: string): [number, number] {
                const t = this.parseTupleN(text, name, 2, [0, 0]);
                return [t[0], t[1]];
        }

        private static parseTuple3(text: string, name: string): [number, number, number] {
                const t = this.parseTupleN(text, name, 3, [0, 0, 0]);
                return [t[0], t[1], t[2]];
        }

        private static parseTuple3Default(text: string, name: string, def: [number, number, number]): [number, number, number] {
                const t = this.parseTupleN(text, name, 3, def);
                return [t[0], t[1], t[2]];
        }

        private static parseTuple4(text: string, name: string): [number, number, number, number] {
                const t = this.parseTupleN(text, name, 4, [0, 0, 0, 1]);
                return [t[0], t[1], t[2], t[3]];
        }

        private static parseColor4(text: string, name: string, def: [number, number, number, number]): [number, number, number, number] {
                const t = this.parseTupleN(text, name, 4, def);
                return [t[0], t[1], t[2], t[3]];
        }

        private static parseTupleN(text: string, name: string, n: number, def: number[]): number[] {
                // Some((...)) and (...)
                let m = text.match(new RegExp(`${name}:\\s*Some\\(\\(([^)]+)\\)\\)`));
                if (!m) m = text.match(new RegExp(`${name}:\\s*\\(([^)]+)\\)`));
                if (!m) return def.slice(0, n);

                const parts = m[1].split(',').map(s => Number.parseFloat(s.trim()));
                const out: number[] = [];
                for (let i = 0; i < n; i++) out.push(Number.isFinite(parts[i]) ? parts[i] : def[i]);
                return out;
        }
}

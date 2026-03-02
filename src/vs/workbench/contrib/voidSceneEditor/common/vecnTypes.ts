/*---------------------------------------------------------------------------------------------
 *  Void Engine Scene Format (.vecn) - TypeScript Types
 *--------------------------------------------------------------------------------------------*/

export interface VoidScene {
        version: string;
        mode: 'Scene3D' | 'Scene2D';
        entities: Entity[];
        resources: Resource[];
}

export interface Entity {
        id: string;
        name: string;
        visible: boolean;
        components: Component[];
        children: Entity[];
}

export type Component = 
        | TransformComponent
        | MeshComponent
        | MaterialComponent
        | PointLightComponent
        | DirectionalLightComponent
        | SpotLightComponent
        | CameraComponent
        | CollisionShapeComponent
        | CharacterBodyComponent
        | RigidBodyComponent
        | StaticBodyComponent
        | AreaComponent
        | RayCastComponent
        | ShapeCastComponent
        // 2D Components
        | Transform2DComponent
        | Sprite2DComponent
        | AnimatedSprite2DComponent
        | CharacterBody2DComponent
        | RigidBody2DComponent
        | StaticBody2DComponent
        | Area2DComponent
        | CollisionShape2DComponent
        | RayCast2DComponent
        // 3D Visual
        | Sprite3DComponent
        | AnimatedSprite3DComponent
        | Label3DComponent
        | GPUParticles3DComponent
        | CPUParticles3DComponent
        | MultiMeshInstance3DComponent
        // Audio
        | AudioStreamPlayerComponent
        | AudioStreamPlayer2DComponent
        | AudioStreamPlayer3DComponent
        // Animation
        | AnimationPlayerComponent
        | AnimationTreeComponent
        | TweenComponent
        // Navigation
        | NavigationRegion3DComponent
        | NavigationRegion2DComponent
        | NavigationAgent3DComponent
        | NavigationAgent2DComponent
        | NavigationObstacle3DComponent
        | NavigationObstacle2DComponent
        // Environment
        | WorldEnvironmentComponent
        | SkyComponent
        | FogVolumeComponent
        | ReflectionProbeComponent
        // Utilities
        | TimerComponent
        | Path3DComponent
        | Path2DComponent
        | PathFollow3DComponent
        | PathFollow2DComponent
        | RemoteTransform3DComponent
        | RemoteTransform2DComponent
        | Marker3DComponent
        | Marker2DComponent
        | VisibleOnScreenNotifier3DComponent
        | VisibleOnScreenNotifier2DComponent
        // Special
        | ViewportComponent
        | SubViewportComponent
        | CanvasLayerComponent
        | Skeleton3DComponent
        | BoneAttachment3DComponent;

export interface TransformComponent {
        type: 'Transform';
        translation: [number, number, number];
        rotation: [number, number, number, number];
        scale: [number, number, number];
}

export interface MeshComponent {
        type: 'Mesh';
        shape: MeshShape;
}

export type MeshShape = 
        | { type: 'Cube'; size: number }
        | { type: 'Plane'; size: number }
        | { type: 'Sphere'; radius: number }
        | { type: 'Cylinder'; radius: number; height: number }
        | { type: 'Cone'; radius: number; height: number }
        | { type: 'Torus'; radius: number; tube: number }
        | { type: 'Capsule'; radius: number; height: number };

export interface MaterialComponent {
        type: 'Material';
        color: [number, number, number, number];
        metallic: number;
        roughness: number;
}

export interface PointLightComponent {
        type: 'PointLight';
        color: [number, number, number];
        intensity: number;
        range: number;
}

export interface DirectionalLightComponent {
        type: 'DirectionalLight';
        color: [number, number, number];
        illuminance: number;
}

export interface CameraComponent {
        type: 'Camera';
        fov?: number;
        near?: number;
        far?: number;
}

export interface CollisionShapeComponent {
        type: 'CollisionShape';
        shape: CollisionShape;
}

export type CollisionShape =
        | { type: 'Box'; size: number }
        | { type: 'Sphere'; radius: number }
        | { type: 'Capsule'; radius: number; height: number }
        | { type: 'Cylinder'; radius: number; height: number };

export type Resource = 
        | AmbientLightResource
        | ClearColorResource;

export interface AmbientLightResource {
        type: 'AmbientLight';
        color: [number, number, number];
        brightness: number;
}

export interface ClearColorResource {
        type: 'ClearColor';
        color: [number, number, number, number];
}


// ===== PHYSICS COMPONENTS =====

export interface CharacterBodyComponent {
        type: 'CharacterBody';
        mass: number;
        gravity_scale: number;
        lock_rotation: boolean;
}

export interface RigidBodyComponent {
        type: 'RigidBody';
        mass: number;
        gravity_scale: number;
        linear_damping: number;
        angular_damping: number;
        lock_rotation_x: boolean;
        lock_rotation_y: boolean;
        lock_rotation_z: boolean;
}

export interface StaticBodyComponent {
        type: 'StaticBody';
        friction: number;
        restitution: number;
}

export interface AreaComponent {
        type: 'Area';
        monitoring: boolean;
        monitorable: boolean;
        priority: number;
}

// ===== ADDITIONAL LIGHTING =====

export interface SpotLightComponent {
        type: 'SpotLight';
        color: [number, number, number];
        intensity: number;
        range: number;
        angle: number;
        attenuation: number;
}

// ===== RAYCAST =====

export interface RayCastComponent {
        type: 'RayCast';
        enabled: boolean;
        target_position: [number, number, number];
        collision_mask: number;
        hit_from_inside: boolean;
}

// ===== SHAPE CAST =====

export interface ShapeCastComponent {
        type: 'ShapeCast';
        enabled: boolean;
        shape: CollisionShape;
        target_position: [number, number, number];
        collision_mask: number;
        max_results: number;
}

// ===== 2D COMPONENTS =====

export interface Transform2DComponent {
        type: 'Transform2D';
        position: [number, number];
        rotation: number;
        scale: [number, number];
}

export interface Sprite2DComponent {
        type: 'Sprite2D';
        texture: string;
        region_enabled: boolean;
        region_rect: [number, number, number, number];
        offset: [number, number];
}

export interface AnimatedSprite2DComponent {
        type: 'AnimatedSprite2D';
        sprite_frames: string;
        animation: string;
        frame: number;
        playing: boolean;
        speed_scale: number;
}

export interface CharacterBody2DComponent {
        type: 'CharacterBody2D';
        motion_mode: 'Grounded' | 'Floating';
        up_direction: [number, number];
        velocity: [number, number];
        max_slides: number;
        floor_stop_on_slope: boolean;
}

export interface RigidBody2DComponent {
        type: 'RigidBody2D';
        mass: number;
        gravity_scale: number;
        linear_damp: number;
        angular_damp: number;
        lock_rotation: boolean;
}

export interface StaticBody2DComponent {
        type: 'StaticBody2D';
        friction: number;
        bounce: number;
}

export interface Area2DComponent {
        type: 'Area2D';
        monitoring: boolean;
        monitorable: boolean;
        priority: number;
        gravity_space_override: 'Disabled' | 'Combine' | 'Replace';
}

export interface CollisionShape2DComponent {
        type: 'CollisionShape2D';
        shape: CollisionShape2D;
        disabled: boolean;
        one_way_collision: boolean;
}

export type CollisionShape2D =
        | { type: 'Rectangle'; size: [number, number] }
        | { type: 'Circle'; radius: number }
        | { type: 'Capsule'; radius: number; height: number };

export interface RayCast2DComponent {
        type: 'RayCast2D';
        enabled: boolean;
        target_position: [number, number];
        collision_mask: number;
        hit_from_inside: boolean;
}

// ===== 3D VISUAL COMPONENTS =====

export interface Sprite3DComponent {
        type: 'Sprite3D';
        texture: string;
        billboard: 'Disabled' | 'Enabled' | 'YBillboard';
        transparent: boolean;
        shaded: boolean;
        double_sided: boolean;
        alpha_cut: number;
}

export interface AnimatedSprite3DComponent {
        type: 'AnimatedSprite3D';
        sprite_frames: string;
        animation: string;
        frame: number;
        playing: boolean;
        billboard: 'Disabled' | 'Enabled' | 'YBillboard';
}

export interface Label3DComponent {
        type: 'Label3D';
        text: string;
        font_size: number;
        outline_size: number;
        modulate: [number, number, number, number];
        billboard: 'Disabled' | 'Enabled' | 'YBillboard';
}

export interface GPUParticles3DComponent {
        type: 'GPUParticles3D';
        emitting: boolean;
        amount: number;
        lifetime: number;
        one_shot: boolean;
        explosiveness: number;
        randomness: number;
        visibility_aabb: [number, number, number, number, number, number];
}

export interface CPUParticles3DComponent {
        type: 'CPUParticles3D';
        emitting: boolean;
        amount: number;
        lifetime: number;
        one_shot: boolean;
        explosiveness: number;
        randomness: number;
        emission_shape: 'Point' | 'Sphere' | 'Box' | 'Points' | 'DirectedPoints';
}

export interface MultiMeshInstance3DComponent {
        type: 'MultiMeshInstance3D';
        instance_count: number;
        visible_instance_count: number;
        mesh: string;
        transform_format: '2D' | '3D';
}

// ===== AUDIO COMPONENTS =====

export interface AudioStreamPlayerComponent {
        type: 'AudioStreamPlayer';
        stream: string;
        volume_db: number;
        pitch_scale: number;
        playing: boolean;
        autoplay: boolean;
        stream_paused: boolean;
}

export interface AudioStreamPlayer2DComponent {
        type: 'AudioStreamPlayer2D';
        stream: string;
        volume_db: number;
        pitch_scale: number;
        playing: boolean;
        autoplay: boolean;
        max_distance: number;
        attenuation: number;
}

export interface AudioStreamPlayer3DComponent {
        type: 'AudioStreamPlayer3D';
        stream: string;
        volume_db: number;
        pitch_scale: number;
        playing: boolean;
        autoplay: boolean;
        max_distance: number;
        attenuation_model: 'InverseDistance' | 'InverseSquareDistance' | 'Logarithmic';
        emission_angle_enabled: boolean;
        emission_angle_degrees: number;
}

// ===== ANIMATION COMPONENTS =====

export interface AnimationPlayerComponent {
        type: 'AnimationPlayer';
        current_animation: string;
        playback_speed: number;
        autoplay: string;
        playback_active: boolean;
        playback_default_blend_time: number;
}

export interface AnimationTreeComponent {
        type: 'AnimationTree';
        tree_root: string;
        anim_player: string;
        active: boolean;
        process_callback: 'Physics' | 'Idle' | 'Manual';
}

export interface TweenComponent {
        type: 'Tween';
        active: boolean;
        speed_scale: number;
}

// ===== NAVIGATION COMPONENTS =====

export interface NavigationRegion3DComponent {
        type: 'NavigationRegion3D';
        enabled: boolean;
        navigation_layers: number;
        enter_cost: number;
        travel_cost: number;
}

export interface NavigationRegion2DComponent {
        type: 'NavigationRegion2D';
        enabled: boolean;
        navigation_layers: number;
        enter_cost: number;
        travel_cost: number;
}

export interface NavigationAgent3DComponent {
        type: 'NavigationAgent3D';
        target_position: [number, number, number];
        path_desired_distance: number;
        target_desired_distance: number;
        radius: number;
        height: number;
        max_speed: number;
        avoidance_enabled: boolean;
}

export interface NavigationAgent2DComponent {
        type: 'NavigationAgent2D';
        target_position: [number, number];
        path_desired_distance: number;
        target_desired_distance: number;
        radius: number;
        max_speed: number;
        avoidance_enabled: boolean;
}

export interface NavigationObstacle3DComponent {
        type: 'NavigationObstacle3D';
        radius: number;
        height: number;
        avoidance_enabled: boolean;
        velocity: [number, number, number];
}

export interface NavigationObstacle2DComponent {
        type: 'NavigationObstacle2D';
        radius: number;
        avoidance_enabled: boolean;
        velocity: [number, number];
}

// ===== ENVIRONMENT COMPONENTS =====

export interface WorldEnvironmentComponent {
        type: 'WorldEnvironment';
        environment: string;
        camera_attributes: string;
        // Background
        background_mode: 'Sky' | 'Color' | 'Gradient' | 'Canvas' | 'Keep';
        background_color: [number, number, number, number];
        gradient_top?: [number, number, number, number];      // For Gradient mode
        gradient_bottom?: [number, number, number, number];   // For Gradient mode
        // Ambient Light
        ambient_light_energy: number;
        ambient_light_color: [number, number, number, number];
        ambient_light_sky_contribution: number;
        // Reflected Light
        reflected_light_energy: number;
        // Tonemap
        tonemap_mode: 'Linear' | 'Reinhard' | 'Filmic' | 'ACES';
        tonemap_exposure: number;
        tonemap_white: number;
        // SSAO
        ssao_enabled: boolean;
        ssao_intensity: number;
        ssao_radius: number;
        // Glow/Bloom
        glow_enabled: boolean;
        glow_intensity: number;
        glow_threshold: number;
        // Sky settings (merged from Sky node for single-node workflow)
        sky_material?: 'ProceduralSky' | 'PanoramaSky' | 'PhysicalSky';
        radiance_size?: 'Size256' | 'Size512' | 'Size1024' | 'Size2048';
        sky_top_color?: [number, number, number, number];
        sky_horizon_color?: [number, number, number, number];
        sky_curve?: number;
        sky_energy?: number;
        ground_bottom_color?: [number, number, number, number];
        ground_horizon_color?: [number, number, number, number];
        ground_curve?: number;
        ground_energy?: number;
        sun_enabled?: boolean;
        sun_angle_min?: number;
        sun_angle_max?: number;
        sun_curve?: number;
        sun_energy?: number;
        sun_color?: [number, number, number, number];
        sun_position?: [number, number, number];
        clouds_enabled?: boolean;
        clouds_color?: [number, number, number, number];
        clouds_density?: number;
        clouds_speed?: number;
        clouds_height?: number;
        clouds_coverage?: number;
        clouds_thickness?: number;
        fog_enabled?: boolean;
        fog_density?: number;
        fog_depth_begin?: number;
        fog_depth_end?: number;
        fog_color?: [number, number, number, number];
}

export interface SkyComponent {
        type: 'Sky';
        sky_material: 'ProceduralSky' | 'PanoramaSky' | 'PhysicalSky';
        radiance_size: 'Size256' | 'Size512' | 'Size1024' | 'Size2048';
        // Procedural Sky Colors
        sky_top_color: [number, number, number, number];
        sky_horizon_color: [number, number, number, number];
        sky_curve: number;
        sky_energy: number;
        // Ground
        ground_bottom_color: [number, number, number, number];
        ground_horizon_color: [number, number, number, number];
        ground_curve: number;
        ground_energy: number;
        // Sun
        sun_enabled: boolean;           // NEW: Enable/disable sun
        sun_angle_min: number;
        sun_angle_max: number;
        sun_curve: number;
        sun_energy: number;
        sun_color: [number, number, number, number];
        sun_position: [number, number, number];  // Direction vector
        // Clouds
        clouds_enabled: boolean;
        clouds_color: [number, number, number, number];
        clouds_density: number;
        clouds_speed: number;
        clouds_height: number;
        clouds_coverage: number;
        clouds_thickness: number;
        // Fog
        fog_enabled: boolean;
        fog_density: number;
        fog_depth_begin: number;
        fog_depth_end: number;
        fog_color: [number, number, number, number];
}

export interface FogVolumeComponent {
        type: 'FogVolume';
        density: number;
        albedo: [number, number, number];
        emission: [number, number, number];
        height_falloff: number;
}

export interface ReflectionProbeComponent {
        type: 'ReflectionProbe';
        update_mode: 'Once' | 'Always';
        intensity: number;
        max_distance: number;
        extents: [number, number, number];
        origin_offset: [number, number, number];
        box_projection: boolean;
        enable_shadows: boolean;
}

// ===== UTILITY COMPONENTS =====

export interface TimerComponent {
        type: 'Timer';
        wait_time: number;
        one_shot: boolean;
        autostart: boolean;
        time_left: number;
        paused: boolean;
}

export interface Path3DComponent {
        type: 'Path3D';
        curve: string;
}

export interface Path2DComponent {
        type: 'Path2D';
        curve: string;
}

export interface PathFollow3DComponent {
        type: 'PathFollow3D';
        progress: number;
        progress_ratio: number;
        h_offset: number;
        v_offset: number;
        rotation_mode: 'None' | 'Y' | 'XY' | 'XYZ' | 'Oriented';
        cubic_interp: boolean;
        loop: boolean;
}

export interface PathFollow2DComponent {
        type: 'PathFollow2D';
        progress: number;
        progress_ratio: number;
        h_offset: number;
        v_offset: number;
        rotates: boolean;
        cubic_interp: boolean;
        loop: boolean;
}

export interface RemoteTransform3DComponent {
        type: 'RemoteTransform3D';
        remote_path: string;
        use_global_coordinates: boolean;
        update_position: boolean;
        update_rotation: boolean;
        update_scale: boolean;
}

export interface RemoteTransform2DComponent {
        type: 'RemoteTransform2D';
        remote_path: string;
        use_global_coordinates: boolean;
        update_position: boolean;
        update_rotation: boolean;
        update_scale: boolean;
}

export interface Marker3DComponent {
        type: 'Marker3D';
        gizmo_extents: number;
}

export interface Marker2DComponent {
        type: 'Marker2D';
        gizmo_extents: number;
}

export interface VisibleOnScreenNotifier3DComponent {
        type: 'VisibleOnScreenNotifier3D';
        aabb: [number, number, number, number, number, number];
}

export interface VisibleOnScreenNotifier2DComponent {
        type: 'VisibleOnScreenNotifier2D';
        rect: [number, number, number, number];
}

// ===== SPECIAL COMPONENTS =====

export interface ViewportComponent {
        type: 'Viewport';
        size: [number, number];
        transparent_bg: boolean;
        msaa: 'Disabled' | 'MSAA2x' | 'MSAA4x' | 'MSAA8x';
        screen_space_aa: 'Disabled' | 'FXAA';
        use_debanding: boolean;
        use_occlusion_culling: boolean;
}

export interface SubViewportComponent {
        type: 'SubViewport';
        size: [number, number];
        render_target_update_mode: 'Disabled' | 'Once' | 'WhenVisible' | 'WhenParentVisible' | 'Always';
}

export interface CanvasLayerComponent {
        type: 'CanvasLayer';
        layer: number;
        offset: [number, number];
        rotation: number;
        scale: [number, number];
        follow_viewport_enabled: boolean;
}

export interface Skeleton3DComponent {
        type: 'Skeleton3D';
        bones: string[];
        bone_poses: any[];
}

export interface BoneAttachment3DComponent {
        type: 'BoneAttachment3D';
        bone_name: string;
        bone_idx: number;
}

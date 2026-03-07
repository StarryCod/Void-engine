//! Void Engine Components
//! 
//! All component definitions for the .vecn scene format
//! Many fields are unused (stubs) but needed for deserialization

#![allow(dead_code)]

use serde::Deserialize;

// ============================================================================
// LIGHTING COMPONENTS
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
pub struct SpotLightComponent {
    pub color: (f32, f32, f32),
    pub intensity: f32,
    pub range: f32,
    pub angle: f32,
    pub attenuation: f32,
}

// ============================================================================
// PHYSICS COMPONENTS (3D)
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
pub struct CharacterBodyComponent {
    pub mass: f32,
    pub gravity_scale: f32,
    pub lock_rotation: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RigidBodyComponent {
    pub mass: f32,
    pub gravity_scale: f32,
    pub linear_damping: f32,
    pub angular_damping: f32,
    pub lock_rotation_x: bool,
    pub lock_rotation_y: bool,
    pub lock_rotation_z: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct StaticBodyComponent {
    pub friction: f32,
    pub restitution: f32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AreaComponent {
    pub monitoring: bool,
    pub monitorable: bool,
    pub priority: i32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RayCastComponent {
    pub enabled: bool,
    pub target_position: (f32, f32, f32),
    pub collision_mask: u32,
    pub hit_from_inside: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ShapeCastComponent {
    pub enabled: bool,
    pub shape: CollisionShape,
    pub target_position: (f32, f32, f32),
    pub collision_mask: u32,
    pub max_results: i32,
}

#[derive(Debug, Deserialize, Clone)]
pub enum CollisionShape {
    Box { size: f32 },
    Sphere { radius: f32 },
    Capsule { radius: f32, height: f32 },
    Cylinder { radius: f32, height: f32 },
}

// ============================================================================
// AUDIO COMPONENTS
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
pub struct AudioStreamPlayerComponent {
    pub stream: String,
    pub volume_db: f32,
    pub pitch_scale: f32,
    pub playing: bool,
    pub autoplay: bool,
    pub stream_paused: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AudioStreamPlayer2DComponent {
    pub stream: String,
    pub volume_db: f32,
    pub pitch_scale: f32,
    pub playing: bool,
    pub autoplay: bool,
    pub max_distance: f32,
    pub attenuation: f32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AudioStreamPlayer3DComponent {
    pub stream: String,
    pub volume_db: f32,
    pub pitch_scale: f32,
    pub playing: bool,
    pub autoplay: bool,
    pub max_distance: f32,
    pub attenuation_model: String,
    pub emission_angle_enabled: bool,
    pub emission_angle_degrees: f32,
}

// ============================================================================
// ANIMATION COMPONENTS
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
pub struct AnimationPlayerComponent {
    pub current_animation: String,
    pub playback_speed: f32,
    pub autoplay: String,
    pub playback_active: bool,
    pub playback_default_blend_time: f32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AnimationTreeComponent {
    pub tree_root: String,
    pub anim_player: String,
    pub active: bool,
    pub process_callback: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TweenComponent {
    pub active: bool,
    pub speed_scale: f32,
}

// ============================================================================
// NAVIGATION COMPONENTS (3D)
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
pub struct NavigationRegion3DComponent {
    pub enabled: bool,
    pub navigation_layers: u32,
    pub enter_cost: f32,
    pub travel_cost: f32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct NavigationAgent3DComponent {
    pub target_position: (f32, f32, f32),
    pub path_desired_distance: f32,
    pub target_desired_distance: f32,
    pub radius: f32,
    pub height: f32,
    pub max_speed: f32,
    pub avoidance_enabled: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct NavigationObstacle3DComponent {
    pub radius: f32,
    pub height: f32,
    pub avoidance_enabled: bool,
    pub velocity: (f32, f32, f32),
}

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
pub struct TimerComponent {
    pub wait_time: f32,
    pub one_shot: bool,
    pub autostart: bool,
    pub time_left: f32,
    pub paused: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Path3DComponent {
    pub curve: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct PathFollow3DComponent {
    pub progress: f32,
    pub progress_ratio: f32,
    pub h_offset: f32,
    pub v_offset: f32,
    pub rotation_mode: String,
    pub cubic_interp: bool,
    pub loop_path: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Marker3DComponent {
    pub gizmo_extents: f32,
}

// ============================================================================
// ENVIRONMENT COMPONENTS
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
pub struct WorldEnvironmentComponent {
    pub environment: String,
    pub camera_attributes: String,
    #[serde(default)]
    pub background_mode: Option<String>,
    #[serde(default)]
    pub background_color: Option<(f32, f32, f32, f32)>,
    #[serde(default)]
    pub ambient_light_energy: Option<f32>,
    #[serde(default)]
    pub ambient_light_color: Option<(f32, f32, f32, f32)>,
    #[serde(default)]
    pub tonemap_mode: Option<String>,
    #[serde(default)]
    pub tonemap_exposure: Option<f32>,
    #[serde(default)]
    pub tonemap_white: Option<f32>,
    #[serde(default)]
    pub post_bloom_enabled: Option<bool>,
    #[serde(default)]
    pub post_bloom_intensity: Option<f32>,
    #[serde(default)]
    pub post_bloom_threshold: Option<f32>,
    #[serde(default)]
    pub post_ao_enabled: Option<bool>,
    #[serde(default)]
    pub post_ao_intensity: Option<f32>,
    #[serde(default)]
    pub post_ao_radius: Option<f32>,
    #[serde(default)]
    pub color_grading_enabled: Option<bool>,
    #[serde(default)]
    pub color_grading_temperature: Option<f32>,
    #[serde(default)]
    pub color_grading_contrast: Option<f32>,
    #[serde(default)]
    pub color_grading_saturation: Option<f32>,
    #[serde(default)]
    pub shadow_profile: Option<String>,
    #[serde(default)]
    pub render_debug_view: Option<String>,
    #[serde(default)]
    pub sun_enabled: Option<bool>,
    #[serde(default)]
    pub sun_energy: Option<f32>,
    #[serde(default)]
    pub sun_color: Option<(f32, f32, f32, f32)>,
    #[serde(default)]
    pub sun_position: Option<(f32, f32, f32)>,
    #[serde(default)]
    pub clouds_enabled: Option<bool>,
    #[serde(default)]
    pub clouds_color: Option<(f32, f32, f32, f32)>,
    #[serde(default)]
    pub clouds_density: Option<f32>,
    #[serde(default)]
    pub clouds_speed: Option<f32>,
    #[serde(default)]
    pub clouds_coverage: Option<f32>,
    #[serde(default)]
    pub clouds_thickness: Option<f32>,
    #[serde(default)]
    pub clouds_layer1_speed: Option<f32>,
    #[serde(default)]
    pub clouds_layer2_speed: Option<f32>,
    #[serde(default)]
    pub clouds_detail_strength: Option<f32>,
    #[serde(default)]
    pub fog_enabled: Option<bool>,
    #[serde(default)]
    pub fog_density: Option<f32>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct FogVolumeComponent {
    pub density: f32,
    pub albedo: (f32, f32, f32),
    pub emission: (f32, f32, f32),
    pub height_falloff: f32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SkyComponent {
    pub sky_material: String,
    pub radiance_size: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ReflectionProbeComponent {
    pub update_mode: String,
    pub intensity: f32,
    pub max_distance: f32,
    pub extents: (f32, f32, f32),
    pub origin_offset: (f32, f32, f32),
    pub box_projection: bool,
    pub enable_shadows: bool,
}

// ============================================================================
// SPECIAL COMPONENTS
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
pub struct Skeleton3DComponent {
    pub bones: Vec<String>,
    pub bone_poses: Vec<String>, // Simplified for now
}

#[derive(Debug, Deserialize, Clone)]
pub struct BoneAttachment3DComponent {
    pub bone_name: String,
    pub bone_idx: i32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ViewportComponent {
    pub size: (f32, f32),
    pub transparent_bg: bool,
    pub msaa: String,
    pub screen_space_aa: String,
    pub use_debanding: bool,
    pub use_occlusion_culling: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SubViewportComponent {
    pub size: (f32, f32),
    pub render_target_update_mode: String,
}

// ============================================================================
// 2D COMPONENTS
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
pub struct Transform2DComponent {
    pub position: (f32, f32),
    pub rotation: f32,
    pub scale: (f32, f32),
}

#[derive(Debug, Deserialize, Clone)]
pub struct Sprite2DComponent {
    pub texture: String,
    pub region_enabled: bool,
    pub region_rect: (f32, f32, f32, f32),
    pub offset: (f32, f32),
}

#[derive(Debug, Deserialize, Clone)]
pub struct AnimatedSprite2DComponent {
    pub sprite_frames: String,
    pub animation: String,
    pub frame: i32,
    pub playing: bool,
    pub speed_scale: f32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CharacterBody2DComponent {
    pub motion_mode: String,
    pub up_direction: (f32, f32),
    pub velocity: (f32, f32),
    pub max_slides: i32,
    pub floor_stop_on_slope: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RigidBody2DComponent {
    pub mass: f32,
    pub gravity_scale: f32,
    pub linear_damp: f32,
    pub angular_damp: f32,
    pub lock_rotation: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct StaticBody2DComponent {
    pub friction: f32,
    pub bounce: f32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Area2DComponent {
    pub monitoring: bool,
    pub monitorable: bool,
    pub priority: i32,
    pub gravity_space_override: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CollisionShape2DComponent {
    pub shape: CollisionShape2D,
    pub disabled: bool,
    pub one_way_collision: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub enum CollisionShape2D {
    Rectangle { size: (f32, f32) },
    Circle { radius: f32 },
    Capsule { radius: f32, height: f32 },
}

#[derive(Debug, Deserialize, Clone)]
pub struct RayCast2DComponent {
    pub enabled: bool,
    pub target_position: (f32, f32),
    pub collision_mask: u32,
    pub hit_from_inside: bool,
}

// ============================================================================
// 3D VISUAL COMPONENTS
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
pub struct Sprite3DComponent {
    pub texture: String,
    pub billboard: String,
    pub transparent: bool,
    pub shaded: bool,
    pub double_sided: bool,
    pub alpha_cut: f32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AnimatedSprite3DComponent {
    pub sprite_frames: String,
    pub animation: String,
    pub frame: i32,
    pub playing: bool,
    pub billboard: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Label3DComponent {
    pub text: String,
    pub font_size: i32,
    pub outline_size: i32,
    pub modulate: (f32, f32, f32, f32),
    pub billboard: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct GPUParticles3DComponent {
    pub emitting: bool,
    pub amount: i32,
    pub lifetime: f32,
    pub one_shot: bool,
    pub explosiveness: f32,
    pub randomness: f32,
    pub visibility_aabb: (f32, f32, f32, f32, f32, f32),
}

#[derive(Debug, Deserialize, Clone)]
pub struct CPUParticles3DComponent {
    pub emitting: bool,
    pub amount: i32,
    pub lifetime: f32,
    pub one_shot: bool,
    pub explosiveness: f32,
    pub randomness: f32,
    pub emission_shape: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MultiMeshInstance3DComponent {
    pub instance_count: i32,
    pub visible_instance_count: i32,
    pub mesh: String,
    pub transform_format: String,
}

// ============================================================================
// NAVIGATION COMPONENTS (2D)
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
pub struct NavigationRegion2DComponent {
    pub enabled: bool,
    pub navigation_layers: u32,
    pub enter_cost: f32,
    pub travel_cost: f32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct NavigationAgent2DComponent {
    pub target_position: (f32, f32),
    pub path_desired_distance: f32,
    pub target_desired_distance: f32,
    pub radius: f32,
    pub max_speed: f32,
    pub avoidance_enabled: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct NavigationObstacle2DComponent {
    pub radius: f32,
    pub avoidance_enabled: bool,
    pub velocity: (f32, f32),
}

// ============================================================================
// ADDITIONAL UTILITY COMPONENTS
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
pub struct Path2DComponent {
    pub curve: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct PathFollow2DComponent {
    pub progress: f32,
    pub progress_ratio: f32,
    pub h_offset: f32,
    pub v_offset: f32,
    pub rotates: bool,
    pub cubic_interp: bool,
    pub loop_path: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RemoteTransform3DComponent {
    pub remote_path: String,
    pub use_global_coordinates: bool,
    pub update_position: bool,
    pub update_rotation: bool,
    pub update_scale: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RemoteTransform2DComponent {
    pub remote_path: String,
    pub use_global_coordinates: bool,
    pub update_position: bool,
    pub update_rotation: bool,
    pub update_scale: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Marker2DComponent {
    pub gizmo_extents: f32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct VisibleOnScreenNotifier3DComponent {
    pub aabb: (f32, f32, f32, f32, f32, f32),
}

#[derive(Debug, Deserialize, Clone)]
pub struct VisibleOnScreenNotifier2DComponent {
    pub rect: (f32, f32, f32, f32),
}

#[derive(Debug, Deserialize, Clone)]
pub struct CanvasLayerComponent {
    pub layer: i32,
    pub offset: (f32, f32),
    pub rotation: f32,
    pub scale: (f32, f32),
    pub follow_viewport_enabled: bool,
}

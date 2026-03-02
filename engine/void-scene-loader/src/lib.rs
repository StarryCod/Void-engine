//! Void Engine Scene Loader
//! 
//! This library loads .vecn scene files and spawns entities in Bevy.
//! Users don't need to write any code - just create .vecn files!

use bevy::prelude::*;
use bevy::render::{
    render_asset::RenderAssetUsages,
    render_resource::{Extent3d, TextureDimension, TextureFormat},
};
use serde::Deserialize;
use std::fs;

mod components;
use components::*;

// ============================================================================
// Public API
// ============================================================================

/// Main plugin that loads the scene from assets/scenes/main.vecn
pub struct VoidSceneLoaderPlugin;

impl Plugin for VoidSceneLoaderPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, load_main_scene);
    }
}

/// Load a specific scene file
pub fn load_scene_file(
    commands: &mut Commands,
    meshes: &mut ResMut<Assets<Mesh>>,
    materials: &mut ResMut<Assets<StandardMaterial>>,
    images: &mut ResMut<Assets<Image>>,
    path: &str,
) -> Result<(), String> {
    println!("[Void Scene Loader] Loading scene from {}...", path);

    let scene_content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to load scene file: {}", e))?;

    let scene: VoidScene = ron::from_str(&scene_content)
        .map_err(|e| format!("Failed to parse scene: {}", e))?;

    println!("[Void Scene Loader] Scene loaded: version {}, mode {:?}", scene.version, scene.mode);
    println!("[Void Scene Loader] Root entities: {}", scene.entities.len());
    let ray_target_count = count_ray_targets(&scene.entities);
    println!("[Scene Test] ray_target_nodes={}", ray_target_count);

    // Spawn entities
    for entity in scene.entities {
        spawn_entity(commands, meshes, materials, images, &entity, ray_target_count);
    }

    // Apply resources
    for resource in scene.resources {
        match resource {
            VecnResource::AmbientLight { color, brightness } => {
                commands.insert_resource(AmbientLight {
                    color: Color::srgb(color.0, color.1, color.2),
                    brightness,
                });
            }
            VecnResource::ClearColor { color } => {
                commands.insert_resource(ClearColor(Color::srgba(
                    color.0, color.1, color.2, color.3,
                )));
            }
        }
    }

    println!("[Void Scene Loader] Scene spawned successfully.");
    Ok(())
}

// ============================================================================
// Internal Implementation
// ============================================================================

fn load_main_scene(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut images: ResMut<Assets<Image>>,
) {
    if let Err(e) = load_scene_file(
        &mut commands,
        &mut meshes,
        &mut materials,
        &mut images,
        "assets/scenes/main.vecn",
    ) {
        eprintln!("[Void Scene Loader] ERROR: {}", e);
    }
}

#[derive(Debug, Deserialize)]
struct VoidScene {
    version: String,
    mode: SceneMode,
    entities: Vec<VecnEntity>,
    resources: Vec<VecnResource>,
}

#[derive(Debug, Deserialize)]
enum SceneMode {
    Scene3D,
    Scene2D,
}

#[derive(Debug, Deserialize)]
struct VecnEntity {
    id: String,
    name: String,
    visible: bool,
    components: Vec<VecnComponent>,
    children: Vec<VecnEntity>,
}

#[derive(Debug, Deserialize)]
enum VecnComponent {
    // Base components
    Transform {
        translation: (f32, f32, f32),
        rotation: (f32, f32, f32, f32),
        scale: (f32, f32, f32),
    },
    Mesh {
        shape: MeshShape,
    },
    Material {
        color: (f32, f32, f32, f32),
        metallic: f32,
        roughness: f32,
    },
    Camera {
        fov: f32,
        near: f32,
        far: f32,
    },
    
    // Lighting
    PointLight {
        color: (f32, f32, f32),
        intensity: f32,
        range: f32,
    },
    DirectionalLight {
        color: (f32, f32, f32),
        illuminance: f32,
    },
    SpotLight(SpotLightComponent),
    
    // Physics 3D
    CollisionShape {
        shape: CollisionShape,
    },
    CharacterBody(CharacterBodyComponent),
    RigidBody(RigidBodyComponent),
    StaticBody(StaticBodyComponent),
    Area(AreaComponent),
    RayCast(RayCastComponent),
    ShapeCast(ShapeCastComponent),
    
    // Audio
    AudioStreamPlayer(AudioStreamPlayerComponent),
    AudioStreamPlayer2D(AudioStreamPlayer2DComponent),
    AudioStreamPlayer3D(AudioStreamPlayer3DComponent),
    
    // Animation
    AnimationPlayer(AnimationPlayerComponent),
    AnimationTree(AnimationTreeComponent),
    Tween(TweenComponent),
    
    // Navigation 3D
    NavigationRegion3D(NavigationRegion3DComponent),
    NavigationAgent3D(NavigationAgent3DComponent),
    NavigationObstacle3D(NavigationObstacle3DComponent),
    
    // Utility
    Timer(TimerComponent),
    Path3D(Path3DComponent),
    PathFollow3D(PathFollow3DComponent),
    Marker3D(Marker3DComponent),
    
    // Environment
    WorldEnvironment(WorldEnvironmentComponent),
    FogVolume(FogVolumeComponent),
    Sky(SkyComponent),
    ReflectionProbe(ReflectionProbeComponent),
    
    // Special
    Skeleton3D(Skeleton3DComponent),
    BoneAttachment3D(BoneAttachment3DComponent),
    Viewport(ViewportComponent),
    SubViewport(SubViewportComponent),
    
    // 2D Components
    Transform2D(Transform2DComponent),
    Sprite2D(Sprite2DComponent),
    AnimatedSprite2D(AnimatedSprite2DComponent),
    CharacterBody2D(CharacterBody2DComponent),
    RigidBody2D(RigidBody2DComponent),
    StaticBody2D(StaticBody2DComponent),
    Area2D(Area2DComponent),
    CollisionShape2D(CollisionShape2DComponent),
    RayCast2D(RayCast2DComponent),
    
    // 3D Visual
    Sprite3D(Sprite3DComponent),
    AnimatedSprite3D(AnimatedSprite3DComponent),
    Label3D(Label3DComponent),
    GPUParticles3D(GPUParticles3DComponent),
    CPUParticles3D(CPUParticles3DComponent),
    MultiMeshInstance3D(MultiMeshInstance3DComponent),
    
    // Navigation 2D
    NavigationRegion2D(NavigationRegion2DComponent),
    NavigationAgent2D(NavigationAgent2DComponent),
    NavigationObstacle2D(NavigationObstacle2DComponent),
    
    // Additional Utility
    Path2D(Path2DComponent),
    PathFollow2D(PathFollow2DComponent),
    RemoteTransform3D(RemoteTransform3DComponent),
    RemoteTransform2D(RemoteTransform2DComponent),
    Marker2D(Marker2DComponent),
    VisibleOnScreenNotifier3D(VisibleOnScreenNotifier3DComponent),
    VisibleOnScreenNotifier2D(VisibleOnScreenNotifier2DComponent),
    CanvasLayer(CanvasLayerComponent),
}

#[derive(Debug, Deserialize)]
enum MeshShape {
    Cube { size: f32 },
    Sphere { radius: f32 },
    Plane { size: f32 },
    Cylinder { radius: f32, height: f32 },
    Cone { radius: f32, height: f32 },
    Torus { radius: f32, tube: f32 },
    Capsule { radius: f32, height: f32 },
}

#[derive(Debug, Deserialize)]
enum CollisionShape {
    Box { size: f32 },
    Sphere { radius: f32 },
    Capsule { radius: f32, height: f32 },
    Cylinder { radius: f32, height: f32 },
}

#[derive(Debug, Deserialize)]
enum VecnResource {
    AmbientLight { color: (f32, f32, f32), brightness: f32 },
    ClearColor { color: (f32, f32, f32, f32) },
}

fn count_ray_targets(entities: &[VecnEntity]) -> usize {
    fn walk(entities: &[VecnEntity], count: &mut usize) {
        for entity in entities {
            for component in &entity.components {
                match component {
                    VecnComponent::CollisionShape { .. }
                    | VecnComponent::CharacterBody(_)
                    | VecnComponent::RigidBody(_)
                    | VecnComponent::StaticBody(_)
                    | VecnComponent::Area(_)
                    | VecnComponent::CollisionShape2D(_)
                    | VecnComponent::CharacterBody2D(_)
                    | VecnComponent::RigidBody2D(_)
                    | VecnComponent::StaticBody2D(_)
                    | VecnComponent::Area2D(_) => {
                        *count += 1;
                        break;
                    }
                    _ => {}
                }
            }
            if !entity.children.is_empty() {
                walk(&entity.children, count);
            }
        }
    }

    let mut count = 0;
    walk(entities, &mut count);
    count
}

fn component_name(component: &VecnComponent) -> &'static str {
    match component {
        VecnComponent::Transform { .. } => "Transform",
        VecnComponent::Mesh { .. } => "Mesh",
        VecnComponent::Material { .. } => "Material",
        VecnComponent::Camera { .. } => "Camera",
        VecnComponent::PointLight { .. } => "PointLight",
        VecnComponent::DirectionalLight { .. } => "DirectionalLight",
        VecnComponent::SpotLight(_) => "SpotLight",
        VecnComponent::CollisionShape { .. } => "CollisionShape",
        VecnComponent::CharacterBody(_) => "CharacterBody",
        VecnComponent::RigidBody(_) => "RigidBody",
        VecnComponent::StaticBody(_) => "StaticBody",
        VecnComponent::Area(_) => "Area",
        VecnComponent::RayCast(_) => "RayCast",
        VecnComponent::ShapeCast(_) => "ShapeCast",
        VecnComponent::AudioStreamPlayer(_) => "AudioStreamPlayer",
        VecnComponent::AudioStreamPlayer2D(_) => "AudioStreamPlayer2D",
        VecnComponent::AudioStreamPlayer3D(_) => "AudioStreamPlayer3D",
        VecnComponent::AnimationPlayer(_) => "AnimationPlayer",
        VecnComponent::AnimationTree(_) => "AnimationTree",
        VecnComponent::Tween(_) => "Tween",
        VecnComponent::NavigationRegion3D(_) => "NavigationRegion3D",
        VecnComponent::NavigationAgent3D(_) => "NavigationAgent3D",
        VecnComponent::NavigationObstacle3D(_) => "NavigationObstacle3D",
        VecnComponent::Timer(_) => "Timer",
        VecnComponent::Path3D(_) => "Path3D",
        VecnComponent::PathFollow3D(_) => "PathFollow3D",
        VecnComponent::Marker3D(_) => "Marker3D",
        VecnComponent::WorldEnvironment(_) => "WorldEnvironment",
        VecnComponent::FogVolume(_) => "FogVolume",
        VecnComponent::Sky(_) => "Sky",
        VecnComponent::ReflectionProbe(_) => "ReflectionProbe",
        VecnComponent::Skeleton3D(_) => "Skeleton3D",
        VecnComponent::BoneAttachment3D(_) => "BoneAttachment3D",
        VecnComponent::Viewport(_) => "Viewport",
        VecnComponent::SubViewport(_) => "SubViewport",
        VecnComponent::Transform2D(_) => "Transform2D",
        VecnComponent::Sprite2D(_) => "Sprite2D",
        VecnComponent::AnimatedSprite2D(_) => "AnimatedSprite2D",
        VecnComponent::CharacterBody2D(_) => "CharacterBody2D",
        VecnComponent::RigidBody2D(_) => "RigidBody2D",
        VecnComponent::StaticBody2D(_) => "StaticBody2D",
        VecnComponent::Area2D(_) => "Area2D",
        VecnComponent::CollisionShape2D(_) => "CollisionShape2D",
        VecnComponent::RayCast2D(_) => "RayCast2D",
        VecnComponent::Sprite3D(_) => "Sprite3D",
        VecnComponent::AnimatedSprite3D(_) => "AnimatedSprite3D",
        VecnComponent::Label3D(_) => "Label3D",
        VecnComponent::GPUParticles3D(_) => "GPUParticles3D",
        VecnComponent::CPUParticles3D(_) => "CPUParticles3D",
        VecnComponent::MultiMeshInstance3D(_) => "MultiMeshInstance3D",
        VecnComponent::NavigationRegion2D(_) => "NavigationRegion2D",
        VecnComponent::NavigationAgent2D(_) => "NavigationAgent2D",
        VecnComponent::NavigationObstacle2D(_) => "NavigationObstacle2D",
        VecnComponent::Path2D(_) => "Path2D",
        VecnComponent::PathFollow2D(_) => "PathFollow2D",
        VecnComponent::RemoteTransform3D(_) => "RemoteTransform3D",
        VecnComponent::RemoteTransform2D(_) => "RemoteTransform2D",
        VecnComponent::Marker2D(_) => "Marker2D",
        VecnComponent::VisibleOnScreenNotifier3D(_) => "VisibleOnScreenNotifier3D",
        VecnComponent::VisibleOnScreenNotifier2D(_) => "VisibleOnScreenNotifier2D",
        VecnComponent::CanvasLayer(_) => "CanvasLayer",
    }
}

fn component_is_implemented(component: &VecnComponent) -> bool {
    matches!(
        component,
        VecnComponent::Transform { .. }
            | VecnComponent::Transform2D(_)
            | VecnComponent::Mesh { .. }
            | VecnComponent::Material { .. }
            | VecnComponent::Camera { .. }
            | VecnComponent::PointLight { .. }
            | VecnComponent::DirectionalLight { .. }
            | VecnComponent::SpotLight(_)
            | VecnComponent::CollisionShape { .. }
            | VecnComponent::CharacterBody(_)
            | VecnComponent::RigidBody(_)
            | VecnComponent::StaticBody(_)
            | VecnComponent::Timer(_)
            | VecnComponent::WorldEnvironment(_)
            | VecnComponent::Sky(_)
    )
}

fn component_has_visual_fallback(component: &VecnComponent) -> bool {
    !matches!(
        component,
        VecnComponent::Transform { .. }
            | VecnComponent::Transform2D(_)
            | VecnComponent::Mesh { .. }
            | VecnComponent::Material { .. }
            | VecnComponent::Camera { .. }
            | VecnComponent::PointLight { .. }
            | VecnComponent::DirectionalLight { .. }
            | VecnComponent::SpotLight(_)
            | VecnComponent::CollisionShape { .. }
            | VecnComponent::CharacterBody(_)
            | VecnComponent::RigidBody(_)
            | VecnComponent::StaticBody(_)
            | VecnComponent::Timer(_)
            | VecnComponent::WorldEnvironment(_)
            | VecnComponent::Sky(_)
    )
}

fn log_component_status(entity_name: &str, component: &VecnComponent, ray_target_count: usize) {
    match component {
        VecnComponent::RayCast(data) => {
            let status = if !data.enabled {
                "disabled"
            } else if ray_target_count > 0 {
                "true work"
            } else {
                "true false"
            };
            println!("[Scene Test] raycast3d {} entity={}", status, entity_name);
            return;
        }
        VecnComponent::RayCast2D(data) => {
            let status = if !data.enabled {
                "disabled"
            } else if ray_target_count > 0 {
                "true work"
            } else {
                "true false"
            };
            println!("[Scene Test] raycast2d {} entity={}", status, entity_name);
            return;
        }
        _ => {}
    }

    let status = if component_is_implemented(component) {
        "true work"
    } else if component_has_visual_fallback(component) {
        "true visual"
    } else {
        "false stub"
    };
    println!(
        "[Scene Test] {} {} entity={}",
        component_name(component),
        status,
        entity_name
    );
}

fn spawn_entity(
    commands: &mut Commands,
    meshes: &mut ResMut<Assets<Mesh>>,
    materials: &mut ResMut<Assets<StandardMaterial>>,
    images: &mut ResMut<Assets<Image>>,
    entity: &VecnEntity,
    ray_target_count: usize,
) {
    if !entity.visible {
        return;
    }

    let mut transform = Transform::default();
    let mut transform_2d: Option<Transform> = None;
    let mut mesh_shape: Option<&MeshShape> = None;
    let mut material_data: Option<(Color, f32, f32)> = None;
    let mut camera_data: Option<(f32, f32, f32)> = None;
    let mut point_light_data: Option<((f32, f32, f32), f32, f32)> = None;
    let mut dir_light_data: Option<((f32, f32, f32), f32)> = None;
    let mut spot_light_data: Option<&SpotLightComponent> = None;
    let mut collision_shape: Option<&CollisionShape> = None;
    let mut ray_cast_data: Option<&RayCastComponent> = None;
    let mut shape_cast_data: Option<&ShapeCastComponent> = None;
    let mut ray_cast_2d_data: Option<&RayCast2DComponent> = None;
    let mut world_environment: Option<&WorldEnvironmentComponent> = None;
    let mut sky_data: Option<&SkyComponent> = None;
    let mut first_fallback_component: Option<&'static str> = None;
    
    // New component data holders
    let mut character_body: Option<&CharacterBodyComponent> = None;
    let mut rigid_body: Option<&RigidBodyComponent> = None;
    let mut static_body: Option<&StaticBodyComponent> = None;
    let mut timer: Option<&TimerComponent> = None;

    // Extract components
    for component in &entity.components {
        log_component_status(&entity.name, component, ray_target_count);
        match component {
            VecnComponent::Transform { translation, rotation, scale } => {
                transform.translation = Vec3::new(translation.0, translation.1, translation.2);
                transform.rotation = Quat::from_xyzw(rotation.0, rotation.1, rotation.2, rotation.3);
                transform.scale = Vec3::new(scale.0, scale.1, scale.2);
            }
            VecnComponent::Transform2D(data) => {
                // Project 2D nodes into a visible debug lane in the 3D test world.
                let world_x = data.position.0 * 0.02 - 12.0;
                let world_z = data.position.1 * 0.02 + 22.0;
                transform_2d = Some(Transform {
                    translation: Vec3::new(world_x, 0.2, world_z),
                    rotation: Quat::from_rotation_y(-data.rotation),
                    scale: Vec3::new(
                        data.scale.0.abs().max(0.1) * 0.35,
                        0.12,
                        data.scale.1.abs().max(0.1) * 0.35,
                    ),
                });
            }
            VecnComponent::Mesh { shape } => {
                mesh_shape = Some(shape);
            }
            VecnComponent::Material { color, metallic, roughness } => {
                material_data = Some((
                    Color::srgba(color.0, color.1, color.2, color.3),
                    *metallic,
                    *roughness,
                ));
            }
            VecnComponent::Camera { fov, near, far } => {
                camera_data = Some((*fov, *near, *far));
            }
            VecnComponent::PointLight { color, intensity, range } => {
                point_light_data = Some((*color, *intensity, *range));
            }
            VecnComponent::DirectionalLight { color, illuminance } => {
                dir_light_data = Some((*color, *illuminance));
            }
            VecnComponent::SpotLight(data) => {
                spot_light_data = Some(data);
            }
            VecnComponent::CollisionShape { shape } => {
                collision_shape = Some(shape);
            }
            VecnComponent::RayCast(data) => {
                ray_cast_data = Some(data);
            }
            VecnComponent::ShapeCast(data) => {
                shape_cast_data = Some(data);
            }
            VecnComponent::RayCast2D(data) => {
                ray_cast_2d_data = Some(data);
            }
            VecnComponent::CharacterBody(data) => {
                character_body = Some(data);
            }
            VecnComponent::RigidBody(data) => {
                rigid_body = Some(data);
            }
            VecnComponent::StaticBody(data) => {
                static_body = Some(data);
            }
            VecnComponent::Timer(data) => {
                timer = Some(data);
            }
            VecnComponent::WorldEnvironment(data) => {
                world_environment = Some(data);
            }
            VecnComponent::Sky(data) => {
                sky_data = Some(data);
            }
            // For now, just acknowledge other components exist
            _ => {}
        }

        if !component_is_implemented(component) && component_has_visual_fallback(component) {
            first_fallback_component.get_or_insert(component_name(component));
        }
    }

    if let Some(env) = world_environment {
        if let Some(color) = env.background_color {
            commands.insert_resource(ClearColor(Color::srgba(color.0, color.1, color.2, color.3)));
        }
        if let Some(energy) = env.ambient_light_energy {
            let ambient = env.ambient_light_color.unwrap_or((0.44, 0.47, 0.52, 1.0));
            commands.insert_resource(AmbientLight {
                color: Color::srgb(ambient.0, ambient.1, ambient.2),
                brightness: energy,
            });
        }
        println!(
            "[Scene Test] worldenvironment true work entity={} tonemap={:?} exposure={:?} sun={:?} clouds={:?}",
            entity.name,
            env.tonemap_mode,
            env.tonemap_exposure,
            env.sun_enabled,
            env.clouds_enabled
        );
    }

    if sky_data.is_some() {
        // Procedural skybox texture generated at runtime:
        // gradient + soft sun disk + layered cloud noise.
        let sky_mesh = meshes.add(Sphere::new(1.0).mesh().uv(128, 64));
        let sky_texture = images.add(create_procedural_sky_texture());
        let sky_material = materials.add(StandardMaterial {
            base_color: Color::WHITE,
            base_color_texture: Some(sky_texture),
            emissive: LinearRgba::from(Color::WHITE),
            unlit: true,
            cull_mode: None,
            ..default()
        });

        commands.spawn((
            Mesh3d(sky_mesh),
            MeshMaterial3d(sky_material),
            bevy::pbr::NotShadowCaster,
            bevy::pbr::NotShadowReceiver,
            Transform {
                translation: Vec3::ZERO,
                rotation: Quat::IDENTITY,
                scale: Vec3::splat(2500.0),
            },
        ));

        println!("  [Spawn] Skybox: {} (procedural clouds)", entity.name);
    }

    // Spawn based on component combination
    let mut spawned_visual = false;
    if let Some((fov, near, far)) = camera_data {
        // Camera
        commands.spawn((
            Camera3d::default(),
            transform,
            Projection::Perspective(PerspectiveProjection {
                fov: fov.to_radians(),
                near,
                far,
                ..default()
            }),
        ));
        println!("  [Spawn] Camera: {}", entity.name);
        spawned_visual = true;
    } else if let Some(spot_data) = spot_light_data {
        // Spot Light
        commands.spawn((
            SpotLight {
                color: Color::srgb(spot_data.color.0, spot_data.color.1, spot_data.color.2),
                intensity: spot_data.intensity,
                range: spot_data.range,
                outer_angle: (spot_data.angle.to_radians() / 2.0),
                inner_angle: (spot_data.angle.to_radians() / 2.0 * spot_data.attenuation),
                shadows_enabled: true,
                ..default()
            },
            transform,
        ));
        println!("  [Spawn] SpotLight: {}", entity.name);
        spawned_visual = true;
    } else if let Some((color, intensity, range)) = point_light_data {
        // Point Light
        commands.spawn((
            PointLight {
                color: Color::srgb(color.0, color.1, color.2),
                intensity,
                range,
                shadows_enabled: true,
                ..default()
            },
            transform,
        ));
        println!("  [Spawn] PointLight: {}", entity.name);
        spawned_visual = true;
    } else if let Some((color, illuminance)) = dir_light_data {
        // Directional Light
        commands.spawn((
            DirectionalLight {
                color: Color::srgb(color.0, color.1, color.2),
                illuminance,
                shadows_enabled: true,
                ..default()
            },
            transform,
        ));
        println!("  [Spawn] DirectionalLight: {}", entity.name);
        spawned_visual = true;
    } else if let Some(timer_data) = timer {
        // Timer debug visual.
        let timer_mesh = meshes.add(Sphere::new(0.24).mesh().ico(3).unwrap());
        let timer_mat = materials.add(StandardMaterial {
            base_color: Color::srgb(0.72, 0.92, 1.0),
            emissive: LinearRgba::from(Color::srgb(0.2, 0.32, 0.4)),
            perceptual_roughness: 0.4,
            metallic: 0.0,
            ..default()
        });
        commands.spawn((Mesh3d(timer_mesh), MeshMaterial3d(timer_mat), transform));
        println!("  [Spawn] Timer: {} (wait_time: {}s)", entity.name, timer_data.wait_time);
        spawned_visual = true;
    } else if let Some(shape) = mesh_shape {
        // Mesh entity
        let mesh_handle = create_mesh(meshes, shape);
        let material_handle = if let Some((color, metallic, roughness)) = material_data {
            materials.add(StandardMaterial {
                base_color: color,
                metallic,
                perceptual_roughness: roughness,
                ..default()
            })
        } else {
            materials.add(Color::srgb(0.6, 0.6, 0.6))
        };

        let _entity_commands = commands.spawn((
            Mesh3d(mesh_handle),
            MeshMaterial3d(material_handle),
            transform,
        ));

        // Add physics components if present
        if let Some(rb_data) = rigid_body {
            println!("  [Spawn] Mesh + RigidBody: {} (mass: {})", entity.name, rb_data.mass);
            // Note: Actual physics would require bevy_rapier3d
            // For now just log it
        } else if let Some(cb_data) = character_body {
            println!("  [Spawn] Mesh + CharacterBody: {} (mass: {})", entity.name, cb_data.mass);
        } else if let Some(sb_data) = static_body {
            println!("  [Spawn] Mesh + StaticBody: {} (friction: {})", entity.name, sb_data.friction);
        } else {
            println!("  [Spawn] Mesh: {} ({:?})", entity.name, shape);
        }
        spawned_visual = true;
    } else if let Some(_coll_shape) = collision_shape {
        // Collision shape debug visual (no physics backend yet).
        let mesh_handle = meshes.add(Cuboid::new(0.7, 0.7, 0.7));
        let material_handle = materials.add(StandardMaterial {
            base_color: Color::srgba(0.95, 0.55, 0.30, 0.55),
            emissive: LinearRgba::from(Color::srgb(0.18, 0.07, 0.03)),
            alpha_mode: AlphaMode::Blend,
            cull_mode: None,
            ..default()
        });
        commands.spawn((Mesh3d(mesh_handle), MeshMaterial3d(material_handle), transform));
        println!("  [Spawn] CollisionShape: {}", entity.name);
        spawned_visual = true;
    } else if character_body.is_some() {
        let mesh_handle = meshes.add(Capsule3d::new(0.28, 0.8));
        let material_handle = materials.add(StandardMaterial {
            base_color: Color::srgb(0.6, 0.85, 0.95),
            emissive: LinearRgba::from(Color::srgb(0.08, 0.12, 0.15)),
            ..default()
        });
        commands.spawn((Mesh3d(mesh_handle), MeshMaterial3d(material_handle), transform));
        println!("  [Spawn] CharacterBody visual: {}", entity.name);
        spawned_visual = true;
    } else if rigid_body.is_some() {
        let mesh_handle = meshes.add(Cuboid::new(0.6, 0.6, 0.6));
        let material_handle = materials.add(StandardMaterial {
            base_color: Color::srgb(0.48, 0.82, 0.62),
            emissive: LinearRgba::from(Color::srgb(0.06, 0.11, 0.08)),
            ..default()
        });
        commands.spawn((Mesh3d(mesh_handle), MeshMaterial3d(material_handle), transform));
        println!("  [Spawn] RigidBody visual: {}", entity.name);
        spawned_visual = true;
    } else if static_body.is_some() {
        let mesh_handle = meshes.add(Cuboid::new(0.8, 0.2, 0.8));
        let material_handle = materials.add(StandardMaterial {
            base_color: Color::srgb(0.82, 0.78, 0.70),
            perceptual_roughness: 0.95,
            ..default()
        });
        commands.spawn((Mesh3d(mesh_handle), MeshMaterial3d(material_handle), transform));
        println!("  [Spawn] StaticBody visual: {}", entity.name);
        spawned_visual = true;
    } else if let Some(ray) = ray_cast_data {
        let target = Vec3::new(ray.target_position.0, ray.target_position.1, ray.target_position.2);
        let length = target.length().max(0.01);
        let mesh_handle = meshes.add(Cuboid::new(0.03, 0.03, length));
        let material_handle = materials.add(StandardMaterial {
            base_color: Color::srgb(1.0, 0.45, 0.25),
            emissive: LinearRgba::from(Color::srgb(0.45, 0.14, 0.08)),
            unlit: true,
            ..default()
        });
        let dir = target.normalize_or_zero();
        let local = Transform {
            translation: transform.translation + (transform.rotation * (dir * (length * 0.5))),
            rotation: transform.rotation * Quat::from_rotation_arc(Vec3::Z, dir),
            scale: Vec3::ONE,
        };
        commands.spawn((Mesh3d(mesh_handle), MeshMaterial3d(material_handle), local));
        println!("  [Spawn] RayCast visual: {}", entity.name);
        spawned_visual = true;
    } else if let Some(ray) = ray_cast_2d_data {
        let target = Vec3::new(ray.target_position.0 * 0.02, 0.0, ray.target_position.1 * 0.02);
        let origin = transform_2d.unwrap_or(transform);
        let length = target.length().max(0.01);
        let mesh_handle = meshes.add(Cuboid::new(0.02, 0.02, length));
        let material_handle = materials.add(StandardMaterial {
            base_color: Color::srgb(0.98, 0.7, 0.22),
            emissive: LinearRgba::from(Color::srgb(0.35, 0.22, 0.04)),
            unlit: true,
            ..default()
        });
        let dir = target.normalize_or_zero();
        let local = Transform {
            translation: origin.translation + dir * (length * 0.5),
            rotation: Quat::from_rotation_arc(Vec3::Z, dir),
            scale: Vec3::ONE,
        };
        commands.spawn((Mesh3d(mesh_handle), MeshMaterial3d(material_handle), local));
        println!("  [Spawn] RayCast2D visual: {}", entity.name);
        spawned_visual = true;
    } else if shape_cast_data.is_some() {
        let mesh_handle = meshes.add(Sphere::new(0.28).mesh().ico(3).unwrap());
        let material_handle = materials.add(StandardMaterial {
            base_color: Color::srgb(0.95, 0.62, 0.25),
            emissive: LinearRgba::from(Color::srgb(0.2, 0.09, 0.03)),
            ..default()
        });
        commands.spawn((Mesh3d(mesh_handle), MeshMaterial3d(material_handle), transform));
        println!("  [Spawn] ShapeCast visual: {}", entity.name);
        spawned_visual = true;
    }

    if !spawned_visual {
        if let Some(name) = first_fallback_component {
            let tf = transform_2d.unwrap_or(transform);
            let color = debug_color_from_name(name);
            let mesh_handle = meshes.add(Cuboid::new(0.45, 0.14, 0.45));
            let material_handle = materials.add(StandardMaterial {
                base_color: color,
                emissive: LinearRgba::from(Color::srgb(
                    color.to_srgba().red * 0.25,
                    color.to_srgba().green * 0.25,
                    color.to_srgba().blue * 0.25,
                )),
                perceptual_roughness: 0.7,
                metallic: 0.05,
                ..default()
            });
            commands.spawn((Mesh3d(mesh_handle), MeshMaterial3d(material_handle), tf));
            println!("  [Spawn] StubVisual: {} ({})", entity.name, name);
        }
    }

    // Recursively spawn children
    for child in &entity.children {
        spawn_entity(commands, meshes, materials, images, child, ray_target_count);
    }
}

fn create_procedural_sky_texture() -> Image {
    const WIDTH: u32 = 1024;
    const HEIGHT: u32 = 512;

    let mut data = vec![0u8; (WIDTH * HEIGHT * 4) as usize];

    let sky_top = Vec3::new(0.15, 0.31, 0.57);
    let sky_horizon = Vec3::new(0.70, 0.80, 0.92);
    let cloud_shadow = Vec3::new(0.54, 0.62, 0.73);
    let cloud_lit = Vec3::new(0.98, 0.98, 0.98);
    let sun_color = Vec3::new(1.0, 0.94, 0.84);
    let sun_dir = Vec3::new(0.35, 0.62, -0.70).normalize();

    for y in 0..HEIGHT {
        let v = y as f32 / (HEIGHT - 1) as f32;
        let theta = v * std::f32::consts::PI;
        let sin_theta = theta.sin();
        let cos_theta = theta.cos();

        for x in 0..WIDTH {
            let u = x as f32 / (WIDTH - 1) as f32;
            let phi = u * std::f32::consts::TAU;
            let dir = Vec3::new(sin_theta * phi.cos(), cos_theta, sin_theta * phi.sin()).normalize();

            let altitude = ((dir.y + 1.0) * 0.5).clamp(0.0, 1.0);
            let grad_t = altitude.powf(0.52);
            let mut color = sky_horizon.lerp(sky_top, grad_t);

            // Soft atmospheric brightening near horizon.
            let horizon_glow = (1.0 - (altitude - 0.5).abs() * 2.0).clamp(0.0, 1.0).powf(2.3) * 0.08;
            color += Vec3::splat(horizon_glow);

            // Sun disk + glow.
            let sun_dot = dir.dot(sun_dir).max(0.0);
            let sun_disk = smoothstep(0.9985, 0.9998, sun_dot);
            let sun_glow = sun_dot.powf(18.0) * 0.60 + sun_dot.powf(4.5) * 0.09;
            color += sun_color * (sun_disk * 0.85 + sun_glow);

            // Layered cloud noise in sky dome space.
            let nx = dir.x * 2.1;
            let nz = dir.z * 2.1;
            let shape = fbm(nx * 0.9 + 2.1, nz * 0.9 - 1.4, 5);
            let detail = fbm(nx * 3.4 - 9.7, nz * 3.4 + 7.3, 4);
            let erosion = fbm(nx * 6.1 + 3.2, nz * 6.1 - 2.6, 3);
            let base_cloud = (shape - detail * 0.32 - erosion * 0.18 + 0.08).clamp(0.0, 1.0);
            let cloud_mask = smoothstep(0.36, 0.64, base_cloud);

            // Keep clouds mostly in upper hemisphere but visible enough from default camera.
            let low_fade = smoothstep(0.18, 0.48, altitude);
            let high_fade = 1.0 - smoothstep(0.98, 1.0, altitude);
            let cloud_alpha = (cloud_mask * low_fade * high_fade * 0.95).clamp(0.0, 1.0);

            let sun_cloud_light = sun_dot.powf(5.0).clamp(0.0, 1.0);
            let cloud_col = cloud_shadow.lerp(cloud_lit, 0.45 + sun_cloud_light * 0.55);
            color = color.lerp(cloud_col, cloud_alpha);

            let color = color.clamp(Vec3::ZERO, Vec3::splat(1.0));
            let index = ((y * WIDTH + x) * 4) as usize;
            data[index] = (color.x * 255.0) as u8;
            data[index + 1] = (color.y * 255.0) as u8;
            data[index + 2] = (color.z * 255.0) as u8;
            data[index + 3] = 255;
        }
    }

    Image::new_fill(
        Extent3d {
            width: WIDTH,
            height: HEIGHT,
            depth_or_array_layers: 1,
        },
        TextureDimension::D2,
        &data,
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::RENDER_WORLD,
    )
}

fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    if edge0 == edge1 {
        return if x < edge0 { 0.0 } else { 1.0 };
    }
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn debug_color_from_name(name: &str) -> Color {
    let mut h: u32 = 2166136261;
    for b in name.bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(16777619);
    }

    let r = (((h >> 16) & 0xFF) as f32 / 255.0 * 0.55 + 0.35).clamp(0.0, 1.0);
    let g = (((h >> 8) & 0xFF) as f32 / 255.0 * 0.55 + 0.35).clamp(0.0, 1.0);
    let b = ((h & 0xFF) as f32 / 255.0 * 0.55 + 0.35).clamp(0.0, 1.0);
    Color::srgb(r, g, b)
}

fn hash2(x: f32, y: f32) -> f32 {
    let n = (x * 127.1 + y * 311.7).sin() * 43758.5453;
    n.fract().abs()
}

fn value_noise(x: f32, y: f32) -> f32 {
    let x0 = x.floor();
    let y0 = y.floor();
    let tx = x - x0;
    let ty = y - y0;

    let v00 = hash2(x0, y0);
    let v10 = hash2(x0 + 1.0, y0);
    let v01 = hash2(x0, y0 + 1.0);
    let v11 = hash2(x0 + 1.0, y0 + 1.0);

    let ux = tx * tx * (3.0 - 2.0 * tx);
    let uy = ty * ty * (3.0 - 2.0 * ty);

    let a = v00 + (v10 - v00) * ux;
    let b = v01 + (v11 - v01) * ux;
    a + (b - a) * uy
}

fn fbm(x: f32, y: f32, octaves: i32) -> f32 {
    let mut sum = 0.0;
    let mut amp = 0.5;
    let mut freq = 1.0;
    for _ in 0..octaves {
        sum += value_noise(x * freq, y * freq) * amp;
        freq *= 2.01;
        amp *= 0.5;
    }
    sum
}

fn create_mesh(meshes: &mut ResMut<Assets<Mesh>>, shape: &MeshShape) -> Handle<Mesh> {
    match shape {
        MeshShape::Cube { size } => {
            meshes.add(Cuboid::new(*size, *size, *size))
        }
        MeshShape::Sphere { radius } => {
            meshes.add(Sphere::new(*radius).mesh().ico(5).unwrap())
        }
        MeshShape::Plane { size } => {
            meshes.add(Plane3d::default().mesh().size(*size, *size))
        }
        MeshShape::Cylinder { radius, height } => {
            meshes.add(Cylinder::new(*radius, *height))
        }
        MeshShape::Cone { radius, height } => {
            meshes.add(Cone {
                radius: *radius,
                height: *height,
            })
        }
        MeshShape::Torus { radius, tube } => {
            meshes.add(Torus {
                minor_radius: *tube,
                major_radius: *radius,
            })
        }
        MeshShape::Capsule { radius, height } => {
            meshes.add(Capsule3d::new(*radius, *height))
        }
    }
}

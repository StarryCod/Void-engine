//! Void Engine Scene Loader
//! 
//! This library loads .vecn scene files and spawns entities in Bevy.
//! Users don't need to write any code - just create .vecn files!

use bevy::prelude::*;
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
    path: &str,
) -> Result<(), String> {
    println!("🎮 Void Engine - Loading scene from {}...", path);

    let scene_content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to load scene file: {}", e))?;

    let scene: VoidScene = ron::from_str(&scene_content)
        .map_err(|e| format!("Failed to parse scene: {}", e))?;

    println!("✅ Scene loaded: version {}, mode {:?}", scene.version, scene.mode);
    println!("   Entities: {}", scene.entities.len());

    // Spawn entities
    for entity in scene.entities {
        spawn_entity(commands, meshes, materials, &entity);
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

    println!("✅ Scene spawned successfully!");
    Ok(())
}

// ============================================================================
// Internal Implementation
// ============================================================================

fn load_main_scene(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    if let Err(e) = load_scene_file(&mut commands, &mut meshes, &mut materials, "assets/scenes/main.vecn") {
        eprintln!("❌ {}", e);
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

fn spawn_entity(
    commands: &mut Commands,
    meshes: &mut ResMut<Assets<Mesh>>,
    materials: &mut ResMut<Assets<StandardMaterial>>,
    entity: &VecnEntity,
) {
    if !entity.visible {
        return;
    }

    let mut transform = Transform::default();
    let mut mesh_shape: Option<&MeshShape> = None;
    let mut material_data: Option<(Color, f32, f32)> = None;
    let mut camera_data: Option<(f32, f32, f32)> = None;
    let mut point_light_data: Option<((f32, f32, f32), f32, f32)> = None;
    let mut dir_light_data: Option<((f32, f32, f32), f32)> = None;
    let mut spot_light_data: Option<&SpotLightComponent> = None;
    let mut collision_shape: Option<&CollisionShape> = None;
    
    // New component data holders
    let mut character_body: Option<&CharacterBodyComponent> = None;
    let mut rigid_body: Option<&RigidBodyComponent> = None;
    let mut static_body: Option<&StaticBodyComponent> = None;
    let mut timer: Option<&TimerComponent> = None;

    // Extract components
    for component in &entity.components {
        match component {
            VecnComponent::Transform { translation, rotation, scale } => {
                transform.translation = Vec3::new(translation.0, translation.1, translation.2);
                transform.rotation = Quat::from_xyzw(rotation.0, rotation.1, rotation.2, rotation.3);
                transform.scale = Vec3::new(scale.0, scale.1, scale.2);
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
            // For now, just acknowledge other components exist
            _ => {}
        }
    }

    // Spawn based on component combination
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
        println!("  📷 Spawned camera: {}", entity.name);
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
        println!("  🔦 Spawned spot light: {}", entity.name);
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
        println!("  💡 Spawned point light: {}", entity.name);
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
        println!("  ☀️ Spawned directional light: {}", entity.name);
    } else if let Some(timer_data) = timer {
        // Timer component (marker for now)
        println!("  ⏱️ Spawned timer: {} (wait_time: {}s)", entity.name, timer_data.wait_time);
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

        let mut entity_commands = commands.spawn((
            Mesh3d(mesh_handle),
            MeshMaterial3d(material_handle),
            transform,
        ));

        // Add physics components if present
        if let Some(rb_data) = rigid_body {
            println!("  🎲 Spawned mesh with RigidBody: {} (mass: {})", entity.name, rb_data.mass);
            // Note: Actual physics would require bevy_rapier3d
            // For now just log it
        } else if let Some(cb_data) = character_body {
            println!("  🎲 Spawned mesh with CharacterBody: {} (mass: {})", entity.name, cb_data.mass);
        } else if let Some(sb_data) = static_body {
            println!("  🎲 Spawned mesh with StaticBody: {} (friction: {})", entity.name, sb_data.friction);
        } else {
            println!("  🎲 Spawned mesh: {} ({:?})", entity.name, shape);
        }
    } else if let Some(_coll_shape) = collision_shape {
        // Collision shape - just a marker for now (no physics yet)
        // In a real game, you'd add Collider component from bevy_rapier or similar
        println!("  🔷 Spawned collision shape: {}", entity.name);
    }

    // Recursively spawn children
    for child in &entity.children {
        spawn_entity(commands, meshes, materials, child);
    }
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

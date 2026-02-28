# Void Engine - Available Nodes

Complete list of all node types available in Void Engine scene editor.

## 3D Nodes

### Basic 3D
- **empty** - Node3D (empty transform node)
- **meshinstance3d** - MeshInstance3D (3D mesh with material)

### 3D Primitives
- **cube** - Cube mesh
- **sphere** - Sphere mesh
- **cylinder** - Cylinder mesh
- **cone** - Cone mesh
- **torus** - Torus mesh
- **plane** - Plane mesh

### 3D Lighting
- **point light** - Point Light (omnidirectional)
- **directional light** - Sun Light (directional)
- **spotlight** - SpotLight3D (cone-shaped)

### 3D Camera
- **perspective camera** - Camera (perspective projection)

### 3D Physics
- **characterbody3d** - CharacterBody3D (kinematic character controller)
- **rigidbody3d** - RigidBody3D (dynamic physics body)
- **staticbody3d** - StaticBody3D (static collision)
- **area3d** - Area3D (trigger zone)
- **collisionshape3d** - CollisionShape3D (collision shape)
- **raycast3d** - RayCast3D (ray collision detection)
- **shapecast3d** - ShapeCast3D (shape-based collision detection)

### 3D Visual Effects
- **sprite3d** - Sprite3D (2D sprite in 3D space)
- **animatedsprite3d** - AnimatedSprite3D (animated 2D sprite in 3D)
- **label3d** - Label3D (3D text label)
- **gpuparticles3d** - GPUParticles3D (GPU-based particle system)
- **cpuparticles3d** - CPUParticles3D (CPU-based particle system)
- **multimeshinstance3d** - MultiMeshInstance3D (instanced rendering)

## 2D Nodes

### Basic 2D
- **node2d** - Node2D (2D transform node)
- **sprite2d** - Sprite2D (2D sprite)
- **animatedsprite2d** - AnimatedSprite2D (animated sprite)
- **marker2d** - Marker2D (2D position marker)

### 2D Physics
- **characterbody2d** - CharacterBody2D (2D character controller)
- **rigidbody2d** - RigidBody2D (2D dynamic physics)
- **staticbody2d** - StaticBody2D (2D static collision)
- **area2d** - Area2D (2D trigger zone)
- **collisionshape2d** - CollisionShape2D (2D collision shape)
- **raycast2d** - RayCast2D (2D ray collision)

## Audio Nodes

- **audiostreamplayer** - AudioStreamPlayer (non-positional audio)
- **audiostreamplayer2d** - AudioStreamPlayer2D (2D positional audio)
- **audiostreamplayer3d** - AudioStreamPlayer3D (3D positional audio)

## Animation Nodes

- **animationplayer** - AnimationPlayer (animation controller)
- **animationtree** - AnimationTree (animation state machine)
- **tween** - Tween (property animation)

## Navigation Nodes

### 3D Navigation
- **navigationregion3d** - NavigationRegion3D (3D navigation mesh)
- **navigationagent3d** - NavigationAgent3D (3D pathfinding agent)
- **navigationobstacle3d** - NavigationObstacle3D (3D navigation obstacle)

### 2D Navigation
- **navigationregion2d** - NavigationRegion2D (2D navigation mesh)
- **navigationagent2d** - NavigationAgent2D (2D pathfinding agent)
- **navigationobstacle2d** - NavigationObstacle2D (2D navigation obstacle)

## Environment Nodes

- **worldenvironment** - WorldEnvironment (scene environment settings)
- **sky** - Sky (procedural sky with sun, clouds, fog)
- **fogvolume** - FogVolume (volumetric fog)
- **reflectionprobe** - ReflectionProbe (reflection capture)

## Utility Nodes

### Path Following
- **path3d** - Path3D (3D path curve)
- **pathfollow3d** - PathFollow3D (3D path follower)
- **path2d** - Path2D (2D path curve)
- **pathfollow2d** - PathFollow2D (2D path follower)

### Transform
- **remotetransform3d** - RemoteTransform3D (remote 3D transform control)
- **remotetransform2d** - RemoteTransform2D (remote 2D transform control)

### Markers & Notifiers
- **marker3d** - Marker3D (3D position marker)
- **visibleonscreennotifier3d** - VisibleOnScreenNotifier3D (3D visibility detection)
- **visibleonscreennotifier2d** - VisibleOnScreenNotifier2D (2D visibility detection)

### Timing
- **timer** - Timer (countdown timer)

## Special Nodes

- **viewport** - Viewport (render target)
- **subviewport** - SubViewport (embedded viewport)
- **canvaslayer** - CanvasLayer (2D rendering layer)
- **skeleton3d** - Skeleton3D (3D skeletal animation)
- **boneattachment3d** - BoneAttachment3D (bone attachment point)

---

Total: 78 node types

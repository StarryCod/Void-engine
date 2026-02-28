# Void Engine Documentation

**Version**: 1.1.0  
**Last Updated**: February 2025  
**Repository**: https://github.com/StarryCod/Void-engine

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [File Format (.vecn)](#3-file-format-vecn)
4. [Node Types (Components)](#4-node-types-components)
5. [Viewport System](#5-viewport-system)
6. [Inspector System](#6-inspector-system)
7. [Scene Bridge](#7-scene-bridge)
8. [WorldEnvironment & Sky](#8-worldenvironment--sky)
9. [Gizmo System](#9-gizmo-system)
10. [Running the Project](#10-running-the-project)

---

## 1. Overview

**Void Engine** is a fork of VS Code with an integrated game engine based on **Bevy ECS (Rust)**. The key feature is a built-in scene editor with a 3D WebGL2 viewport for editing `.vecn` files (RON-like format).

### Key Features

- **3D Viewport**: Pure WebGL2 rendering (no Three.js dependency)
- **Scene Editor**: Godot-style hierarchy and inspector
- **50+ Node Types**: 2D, 3D, Physics, Audio, Animation, Navigation, etc.
- **Procedural Sky**: UE5-inspired sky shader with atmospheric scattering, realistic sun, volumetric clouds
- **Transform Gizmos**: Translate, rotate, scale tools
- **ECS Architecture**: Bevy-compatible component system

---

## 2. Architecture

### Directory Structure

```
src/vs/workbench/contrib/voidSceneEditor/
├── browser/
│   ├── threeViewport.ts      # Main 3D viewport (WebGL2)
│   ├── inspectorView.ts      # Godot-style property inspector
│   ├── gizmoHelpers.ts       # Gizmo geometry generators
│   ├── sceneActions.ts       # Scene manipulation actions
│   └── vecnEditorProvider.ts # .vecn file editor provider
└── common/
    ├── vecnParser.ts         # .vecn file parser/serializer
    ├── vecnTypes.ts          # TypeScript type definitions
    ├── voidSceneBridge.ts    # Singleton - scene data manager
    └── vecnSceneBus.ts       # Scene event bus
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     SceneBridge (Singleton)                 │
│  _scene: VecnScene | _raw: string | _hash: number          │
│                                                             │
│  Events:                                                    │
│  • onSceneUpdated → notifies Viewport + Inspector          │
│  • onNeedsSave → triggers file save                        │
│  • onEntitySelected → entity selection                     │
└─────────────────────────────────────────────────────────────┘
         ▲              ▲              ▲
         │              │              │
    Viewport        Inspector      Text Editor
    (gizmo drag)    (edit props)   (typing)
```

---

## 3. File Format (.vecn)

### Overview

`.vecn` uses RON-like syntax (Rusty Object Notation) to describe scene hierarchies.

### Structure

```ron
VoidScene(
    version: "1.0",
    mode: Scene3D,
    
    entities: [
        (
            id: "entity-uuid",
            name: "Player",
            visible: true,
            components: [
                Transform(
                    translation: (0, 1, 0),
                    rotation: (0, 0, 0, 1),  // quaternion
                    scale: (1, 1, 1),
                ),
                Mesh( shape: Cube(size: 1) ),
                Material(
                    color: (0.6, 0.6, 0.6, 1.0),
                    metallic: 0,
                    roughness: 0.8,
                ),
            ],
            children: [],
        ),
    ],
    
    resources: [],
)
```

---

## 4. Node Types (Components)

### Categories

| Category | Components |
|----------|------------|
| **Transform** | `Transform`, `Transform2D` |
| **Mesh** | `Mesh` (Cube, Sphere, Cylinder, Cone, Torus, Capsule, Plane) |
| **Material** | `Material` (color, metallic, roughness) |
| **Lighting** | `PointLight`, `DirectionalLight`, `SpotLight` |
| **Camera** | `Camera`, `Viewport`, `SubViewport` |
| **Physics 3D** | `CharacterBody`, `RigidBody`, `StaticBody`, `Area`, `RayCast`, `ShapeCast`, `CollisionShape` |
| **Physics 2D** | `CharacterBody2D`, `RigidBody2D`, `StaticBody2D`, `Area2D`, `RayCast2D`, `CollisionShape2D` |
| **Audio** | `AudioStreamPlayer`, `AudioStreamPlayer2D`, `AudioStreamPlayer3D` |
| **Animation** | `AnimationPlayer`, `AnimationTree`, `Tween` |
| **Navigation** | `NavigationRegion3D/2D`, `NavigationAgent3D/2D`, `NavigationObstacle3D/2D` |
| **Particles** | `GPUParticles3D`, `CPUParticles3D` |
| **Environment** | `WorldEnvironment`, `Sky`, `FogVolume`, `ReflectionProbe` |
| **Utility** | `Timer`, `Path3D/2D`, `PathFollow3D/2D`, `Marker3D/2D`, `RemoteTransform3D/2D` |
| **Skeleton** | `Skeleton3D`, `BoneAttachment3D` |

---

## 5. Viewport System

### ThreeViewport Class

Location: `threeViewport.ts`

Key features:
- Pure WebGL2 rendering
- Procedural sky shader with atmospheric effects
- Transform gizmos (translate, rotate, scale)
- GPU picking for entity selection
- Compass 3D orientation widget

---

## 6. Inspector System

### InspectorView Class

Location: `inspectorView.ts`

Godot-style property inspector with:
- Collapsible sections per component
- Color pickers
- Sliders with drag-to-change
- Dropdown selectors
- Vector editors

---

## 7. Scene Bridge

### Overview

`voidSceneBridge.ts` implements a singleton that acts as the **Single Source of Truth** for scene data.

### API

```typescript
class SceneBridge {
    getEntities(): Entity[]
    getRaw(): string
    loadFromText(content: string, source: Source): boolean
    updateTransform(patch: TransformPatch): void
    commitInspectorEdit(): void
    createEntity(type: string, parentId?: string): Entity | null
    selectEntity(id: string | null): void
}
```

---

## 8. WorldEnvironment & Sky

### WorldEnvironment Component

Controls the overall scene environment:

```typescript
interface WorldEnvironmentComponent {
    type: 'WorldEnvironment';
    // Background
    background_mode: 'Sky' | 'Color' | 'Gradient' | 'Canvas' | 'Keep';
    background_color: [number, number, number, number];
    gradient_top?: [number, number, number, number];     // For Gradient mode
    gradient_bottom?: [number, number, number, number];  // For Gradient mode
    // Ambient Light
    ambient_light_energy: number;
    ambient_light_color: [number, number, number, number];
    // Tonemap
    tonemap_mode: 'Linear' | 'Reinhard' | 'Filmic' | 'ACES';
    tonemap_exposure: number;
    // SSAO
    ssao_enabled: boolean;
    ssao_intensity: number;
    ssao_radius: number;
    // Glow/Bloom
    glow_enabled: boolean;
    glow_intensity: number;
    glow_threshold: number;
}
```

### Sky Component

Procedural sky with realistic sun and volumetric clouds:

```typescript
interface SkyComponent {
    type: 'Sky';
    sky_material: 'ProceduralSky' | 'PanoramaSky' | 'PhysicalSky';
    // Sky colors
    sky_top_color: [number, number, number, number];
    sky_horizon_color: [number, number, number, number];
    sky_curve: number;
    sky_energy: number;
    // Ground colors
    ground_bottom_color: [number, number, number, number];
    ground_horizon_color: [number, number, number, number];
    ground_curve: number;
    ground_energy: number;
    // Sun (enable/disable toggle)
    sun_enabled: boolean;
    sun_position: [number, number, number];
    sun_color: [number, number, number, number];
    sun_energy: number;
    sun_angle_min: number;
    sun_angle_max: number;
    // Clouds (volumetric)
    clouds_enabled: boolean;
    clouds_color: [number, number, number, number];
    clouds_density: number;
    clouds_speed: number;
    clouds_height: number;
    clouds_coverage: number;
    clouds_thickness: number;
    // Fog (depth-based)
    fog_enabled: boolean;
    fog_color: [number, number, number, number];
    fog_density: number;
    fog_depth_begin: number;
    fog_depth_end: number;
}
```

### Background Modes

| Mode | Description | Settings |
|------|-------------|----------|
| **Sky** | Full procedural sky | All Sky settings active |
| **Color** | Solid background | `background_color` |
| **Gradient** | Vertical gradient | `gradient_top`, `gradient_bottom` |
| **Canvas** | Canvas-based | Custom |
| **Keep** | Preserve frame | None |

### Sky Shader Features (v1.1)

**Atmospheric Scattering**:
- Rayleigh scattering (blue sky tint near sun)
- Mie scattering (sun glow/halo)
- Henyey-Greenstein phase function

**Realistic Sun Disk**:
- Limb darkening (edges darker than center)
- Multi-layer soft glow
- Enable/disable toggle

**Volumetric Clouds**:
- 6-octave FBM noise
- Multi-layer wind animation
- Coverage and density control
- Height-based density falloff
- Sun-facing illumination

**Tone Mapping**:
- ACES Filmic (cinematic look)

---

## 9. Gizmo System

### Overview

`gizmoHelpers.ts` provides wireframe geometry generators for visualizing all node types.

### Available Gizmos

- **Camera**: Frustum pyramid
- **Lights**: Spheres, cones, sun rays
- **Physics**: Capsules, boxes, ray indicators
- **Audio**: Speaker icons
- **Navigation**: Grid regions, agent markers
- **Particles**: Emitter cones
- **Timers**: Clock faces
- **Markers**: Axis crosses

### Colors

Godot-inspired:
- X-axis: Red `#ff6b6b`
- Y-axis: Green `#69db7c`
- Z-axis: Blue `#74c0fc`
- Selection: Orange `#f39919`

---

## 10. Running the Project

```bash
# Install dependencies
npm install

# Development
npm run watch

# Production build
npm run compile
```

---

## Changelog

### 2025-02-27 (v1.1)
- **Sky Shader Overhaul**:
  - Realistic sun disk with limb darkening
  - Atmospheric scattering (Rayleigh + Mie)
  - Improved volumetric clouds
  - ACES Filmic tone mapping
  - `sun_enabled` toggle
- **WorldEnvironment**:
  - `gradient_top`, `gradient_bottom` for Gradient mode
- **Inspector**:
  - Mode-specific settings
  - Collapsible sun settings when disabled
- **Parser**:
  - Full Sky serialization
  - Gradient color parsing

---

*This documentation is maintained as part of the Void Engine project.*

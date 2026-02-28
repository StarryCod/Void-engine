# Void Scene Loader

Built-in scene loader for Void Engine. This library automatically loads `.vecn` scene files and spawns entities in Bevy.

## Usage

Add to your `Cargo.toml`:

```toml
[dependencies]
void-scene-loader = { path = "../../engine/void-scene-loader" }
```

In your `main.rs`:

```rust
use bevy::prelude::*;
use void_scene_loader::VoidSceneLoaderPlugin;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_plugins(VoidSceneLoaderPlugin)
        .run();
}
```

That's it! The plugin will automatically load `assets/scenes/main.vecn` on startup.

## Features

- Automatic scene loading from `.vecn` files
- Support for 3D and 2D scenes
- All Bevy primitives: Cube, Sphere, Plane, Cylinder, Cone, Torus
- Cameras, lights (Point, Directional), materials
- Ambient lighting and clear color
- No code needed - just edit `.vecn` files!

## Scene Format

See `assets/scenes/main.vecn` for examples.

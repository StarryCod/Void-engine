//! Void Engine Test World
//! 
//! This is a test project that demonstrates all node types working in Bevy.
//! No Rust code needed - all scene data is in assets/scenes/main.vecn

use bevy::prelude::*;
use void_scene_loader::VoidSceneLoaderPlugin;

fn main() {
    App::new()
        // Bevy default plugins
        .add_plugins(DefaultPlugins)
        // Void Engine scene loader - loads main.vecn automatically
        .add_plugins(VoidSceneLoaderPlugin)
        .run();
}

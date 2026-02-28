# Void Engine - Scene Editor MVP Plan

## 🎯 Цель
Создать встроенный редактор сцен в VSCode с форматом `.vecn` (Void Engine Scene), полностью интегрированный с Bevy и поддерживающий live preview.

---

## 📋 Основные компоненты

### 1. Формат сцены `.vecn` (Void Engine Scene)
**Приоритет: КРИТИЧЕСКИЙ**

#### Структура формата
```ron
// example.vecn - RON (Rusty Object Notation) формат
VoidScene(
    version: "1.0",
    mode: Scene3D, // Scene3D | Scene2D
    entities: [
        Entity(
            id: "player_1",
            components: [
                Transform(
                    translation: (0.0, 0.0, 0.0),
                    rotation: (0.0, 0.0, 0.0, 1.0),
                    scale: (1.0, 1.0, 1.0),
                ),
                Mesh(
                    path: "assets/models/player.gltf",
                ),
                Material(
                    color: (1.0, 0.0, 0.0, 1.0),
                    metallic: 0.5,
                    roughness: 0.5,
                ),
                RigidBody(
                    body_type: Dynamic,
                    mass: 1.0,
                ),
            ],
            children: [],
        ),
    ],
    resources: [
        AmbientLight(
            color: (1.0, 1.0, 1.0),
            brightness: 0.3,
        ),
    ],
)
```

**Почему RON?**
- Нативный для Rust/Bevy
- Читаемый человеком
- Поддержка комментариев
- Типобезопасность
- Serde integration из коробки

#### Rust-сторона (Bevy plugin)
```rust
// void_engine/src/scene/mod.rs
use bevy::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct VoidScene {
    pub version: String,
    pub mode: SceneMode,
    pub entities: Vec<VoidEntity>,
    pub resources: Vec<VoidResource>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SceneMode {
    Scene3D,
    Scene2D,
}

// Bevy plugin для загрузки .vecn
pub struct VoidScenePlugin;

impl Plugin for VoidScenePlugin {
    fn build(&self, app: &mut App) {
        app
            .add_asset::<VoidScene>()
            .init_asset_loader::<VoidSceneLoader>()
            .add_system(hot_reload_scenes);
    }
}
```

---

### 2. UI редактора (VSCode Extension)
**Приоритет: ВЫСОКИЙ**

#### 2.1 Верхняя панель переключения режимов
```
┌─────────────────────────────────────────┐
│  [3D] [2D] [Script]  |  Scene: main.vecn│
└─────────────────────────────────────────┘
```

**Расположение:** Над основной рабочей областью (как в Godot)

**Реализация:**
- Custom WebView Panel в VSCode
- Три кнопки-табы: 3D, 2D, Script
- При клике на 3D/2D → открывается viewport
- При клике на Script → открывается текстовый редактор .vecn

#### 2.2 3D Viewport (WebGL/Three.js)
```
┌─────────────────────────────────────────┐
│  Toolbar: [Select] [Move] [Rotate]     │
├─────────────────────────────────────────┤
│                                         │
│         [3D Scene Preview]              │
│                                         │
│  Camera controls: WASD + Mouse         │
└─────────────────────────────────────────┘
```

**Технологии:**
- **Three.js** для рендеринга (легковесный, хорошо документирован)
- **OrbitControls** для камеры
- **TransformControls** для манипуляции объектами
- WebSocket для связи с Bevy

#### 2.3 2D Viewport (Canvas API)
```
┌─────────────────────────────────────────┐
│  Toolbar: [Select] [Move] [Scale]      │
├─────────────────────────────────────────┤
│                                         │
│         [2D Scene Preview]              │
│                                         │
│  Pan: Middle Mouse, Zoom: Scroll       │
└─────────────────────────────────────────┘
```

**Технологии:**
- Canvas 2D API (нативный, быстрый)
- Pixi.js для сложных 2D сцен (опционально)

#### 2.4 Hierarchy Panel (Слева)
```
┌─────────────────┐
│ Scene Hierarchy │
├─────────────────┤
│ ▼ Root          │
│   ▼ Player      │
│     - Mesh      │
│     - Collider  │
│   - Enemy       │
│   ▼ Lights      │
│     - Sun       │
└─────────────────┘
```

**Функции:**
- Drag & Drop для реорганизации
- Контекстное меню (Add Child, Delete, Duplicate)
- Поиск по имени

#### 2.5 Inspector Panel (Справа)
```
┌─────────────────────┐
│ Inspector           │
├─────────────────────┤
│ Entity: Player      │
│                     │
│ ▼ Transform         │
│   Position: 0,0,0   │
│   Rotation: 0,0,0   │
│   Scale: 1,1,1      │
│                     │
│ ▼ Mesh              │
│   Path: [Browse]    │
│                     │
│ [+ Add Component]   │
└─────────────────────┘
```

**Функции:**
- Редактирование всех компонентов
- Числовые поля с drag-to-change
- Color picker для цветов
- File browser для ассетов

---

### 3. Live Preview (Hot Reload)
**Приоритет: КРИТИЧЕСКИЙ**

#### Архитектура
```
VSCode Extension (TypeScript)
    ↓ WebSocket
Bevy Game (Rust)
    ↓ File Watcher
.vecn файлы
```

#### Реализация

**VSCode сторона:**
```typescript
// vscode/src/vs/workbench/contrib/voidSceneEditor/browser/sceneEditor.ts

class VoidSceneEditor {
    private ws: WebSocket;
    
    constructor() {
        // Connect to Bevy game
        this.ws = new WebSocket('ws://localhost:9001');
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleBevyMessage(data);
        };
    }
    
    // Send scene updates to Bevy
    updateEntity(entityId: string, component: any) {
        this.ws.send(JSON.stringify({
            type: 'UpdateEntity',
            entityId,
            component
        }));
    }
}
```

**Bevy сторона:**
```rust
// void_engine/src/editor/mod.rs

use bevy::prelude::*;
use tokio_tungstenite::accept_async;

pub struct EditorServerPlugin;

impl Plugin for EditorServerPlugin {
    fn build(&self, app: &mut App) {
        app
            .add_system(editor_server_system)
            .add_system(hot_reload_system);
    }
}

fn editor_server_system(/* ... */) {
    // WebSocket server на порту 9001
    // Принимает команды от VSCode
    // Обновляет сцену в реальном времени
}

fn hot_reload_system(
    mut events: EventReader<AssetEvent<VoidScene>>,
    // ...
) {
    for event in events.iter() {
        match event {
            AssetEvent::Modified { handle } => {
                // Reload scene
                info!("Scene modified, reloading...");
            }
            _ => {}
        }
    }
}
```

---

### 4. Интеграция с Bevy
**Приоритет: КРИТИЧЕСКИЙ**

#### 4.1 Модификации движка

**Добавить в Bevy:**
1. **VoidScenePlugin** - загрузка .vecn файлов
2. **EditorServerPlugin** - WebSocket сервер для VSCode
3. **HotReloadPlugin** - автоматическая перезагрузка сцен
4. **GizmoPlugin** - визуальные манипуляторы (стрелки, круги)

**Структура проекта:**
```
void_engine/
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── scene/
│   │   ├── mod.rs          # VoidScene struct
│   │   ├── loader.rs       # AssetLoader для .vecn
│   │   └── serializer.rs   # RON serialization
│   ├── editor/
│   │   ├── mod.rs          # EditorServerPlugin
│   │   ├── websocket.rs    # WebSocket server
│   │   └── gizmos.rs       # Visual gizmos
│   └── hot_reload/
│       └── mod.rs          # Hot reload system
```

#### 4.2 Пример использования в игре
```rust
// main.rs
use bevy::prelude::*;
use void_engine::prelude::*;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_plugin(VoidScenePlugin)
        .add_plugin(EditorServerPlugin) // Только в dev mode
        .add_plugin(HotReloadPlugin)
        .add_startup_system(load_scene)
        .run();
}

fn load_scene(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
) {
    // Загружаем сцену из .vecn
    let scene_handle: Handle<VoidScene> = asset_server.load("scenes/main.vecn");
    commands.spawn_bundle(VoidSceneBundle {
        scene: scene_handle,
        ..default()
    });
}
```

---

## 🚀 План реализации (MVP)

### Phase 1: Формат и базовая загрузка (1-2 недели)
- [ ] Создать структуру `VoidScene` в Rust
- [ ] Реализовать RON serialization/deserialization
- [ ] Создать `VoidSceneLoader` (Bevy AssetLoader)
- [ ] Тесты: загрузка простой сцены с 1 кубом

### Phase 2: VSCode Extension базовая структура (1 неделя)
- [ ] Создать extension `voidSceneEditor`
- [ ] Регистрация `.vecn` файлов
- [ ] Верхняя панель с кнопками [3D] [2D] [Script]
- [ ] Открытие текстового редактора при клике на Script

### Phase 3: 3D Viewport (2-3 недели)
- [ ] WebView с Three.js
- [ ] Загрузка и отображение простых мешей (куб, сфера)
- [ ] OrbitControls для камеры
- [ ] TransformControls для перемещения объектов
- [ ] Синхронизация изменений с .vecn файлом

### Phase 4: Hierarchy + Inspector (1-2 недели)
- [ ] Hierarchy panel (TreeView)
- [ ] Inspector panel (Property Grid)
- [ ] Редактирование Transform компонента
- [ ] Добавление/удаление entities

### Phase 5: Live Preview (2-3 недели)
- [ ] WebSocket сервер в Bevy
- [ ] Подключение VSCode к Bevy
- [ ] Hot reload при изменении .vecn
- [ ] Двусторонняя синхронизация (VSCode ↔ Bevy)

### Phase 6: 2D Viewport (1-2 недели)
- [ ] Canvas 2D viewport
- [ ] 2D Transform controls
- [ ] Sprites и 2D компоненты

---

## 🎨 UI Mockup

```
┌────────────────────────────────────────────────────────────────┐
│ VSCode Window                                                  │
├────────────────────────────────────────────────────────────────┤
│ File  Edit  View  ...                                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  [3D] [2D] [Script]          Scene: main.vecn                 │
│                                                                │
├──────────┬─────────────────────────────────────┬──────────────┤
│          │                                     │              │
│ Hierarchy│         3D Viewport                 │  Inspector   │
│          │                                     │              │
│ ▼ Root   │    ┌─────────────────────┐        │ Entity: Cube │
│   - Cube │    │                     │        │              │
│   - Light│    │    [3D Scene]       │        │ ▼ Transform  │
│          │    │                     │        │   Pos: 0,0,0 │
│          │    │                     │        │   Rot: 0,0,0 │
│          │    └─────────────────────┘        │   Scale: 1,1 │
│          │                                     │              │
│          │  [Select] [Move] [Rotate] [Scale]  │ ▼ Mesh       │
│          │                                     │   ...        │
└──────────┴─────────────────────────────────────┴──────────────┘
```

---

## 💡 Мои мысли и рекомендации

### ✅ Что делать ПРАВИЛЬНО:

1. **Использовать RON формат** - идеально для Rust/Bevy, читаемый, типобезопасный

2. **WebSocket для live preview** - стандартный подход, работает отлично

3. **Three.js для 3D** - проверенная библиотека, огромное комьюнити

4. **Модульная архитектура** - каждый компонент независим

5. **Начать с MVP** - сначала базовый функционал, потом улучшения

### ⚠️ Потенциальные проблемы:

1. **Производительность WebSocket** - для больших сцен может быть медленно
   - **Решение:** Батчинг обновлений, дебаунсинг

2. **Синхронизация состояния** - VSCode и Bevy могут рассинхронизироваться
   - **Решение:** Single source of truth (.vecn файл), версионирование

3. **Сложность Three.js ↔ Bevy** - разные системы координат, форматы
   - **Решение:** Адаптеры, конвертеры

4. **Hot reload может ломать игровое состояние**
   - **Решение:** Сохранение runtime state, умный merge

### 🔧 Нужно ли менять сам движок?

**ДА, но минимально:**

1. **Добавить плагины** (не менять core Bevy):
   - `VoidScenePlugin`
   - `EditorServerPlugin`
   - `HotReloadPlugin`

2. **Создать форк Bevy** НЕ НУЖНО - используем plugin систему

3. **Кастомные компоненты** - да, для editor-specific данных

### 🎯 Рекомендуемый стек:

**Frontend (VSCode):**
- TypeScript
- Three.js (3D)
- Canvas API (2D)
- WebSocket client

**Backend (Bevy):**
- Rust
- Bevy 0.12+
- RON (serde)
- tokio-tungstenite (WebSocket)
- notify (file watcher)

---

## 📦 Структура файлов проекта

```
void_engine_project/
├── void_engine/              # Rust/Bevy движок
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── scene/
│   │   ├── editor/
│   │   └── hot_reload/
│   └── assets/
│       └── scenes/
│           └── main.vecn     # Сцены
│
└── vscode/                   # VSCode fork
    └── src/vs/workbench/contrib/
        └── voidSceneEditor/
            ├── browser/
            │   ├── sceneEditor.ts
            │   ├── viewport3d.ts
            │   ├── viewport2d.ts
            │   ├── hierarchy.ts
            │   └── inspector.ts
            ├── common/
            │   └── sceneFormat.ts
            └── media/
                ├── sceneEditor.css
                └── three.min.js
```

---

## 🎬 Следующие шаги

1. **Создать прототип .vecn формата** - простая сцена с кубом
2. **Реализовать VoidSceneLoader в Bevy** - загрузка и парсинг
3. **Создать базовый VSCode extension** - открытие .vecn файлов
4. **Добавить Three.js viewport** - отображение куба
5. **WebSocket связь** - синхронизация VSCode ↔ Bevy

**Хочешь начать с какого-то конкретного этапа?**

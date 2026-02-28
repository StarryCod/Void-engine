# Scene Scripts System

## Обзор

Система позволяет привязывать Rust скрипты к `.vecn` сценам и управлять главной сценой проекта.

## Возможности

### 1. Установка главной сцены

**Как использовать:**
1. Правый клик на `.vecn` файл в Explorer
2. Выбрать "Set as Main Scene"
3. Эта сцена будет загружаться при запуске игры

**Где хранится:**
```json
// void.config.json
{
  "name": "MyProject",
  "template": "vecn-3d",
  "mainScene": "assets/scenes/main.vecn"  ← Главная сцена
}
```

### 2. Создание скрипта для сцены

**Как использовать:**
1. Правый клик на `.vecn` файл в Explorer
2. Выбрать "Create Script for Scene"
3. Автоматически создается `src/scripts/scene_name.rs`

**Структура проекта:**
```
MyProject/
├── assets/
│   └── scenes/
│       ├── main.vecn          ← Главная сцена
│       ├── level1.vecn         ← Дополнительная сцена
│       └── menu.vecn           ← Дополнительная сцена
├── src/
│   ├── scripts/
│   │   ├── mod.rs              ← Автогенерируется
│   │   ├── main.rs             ← Скрипт для main.vecn
│   │   ├── level1.rs           ← Скрипт для level1.vecn
│   │   └── menu.rs             ← Скрипт для menu.vecn
│   └── main.rs
└── void.config.json
```

### 3. Шаблон скрипта

При создании скрипта генерируется:

```rust
// src/scripts/main.rs
use bevy::prelude::*;

#[derive(Component)]
pub struct MainBehavior {
    // Add your custom fields here
}

pub fn setup_main(
    mut commands: Commands,
) {
    println!("Setting up scene: main");
    
    // Add your setup logic here
}

pub fn update_main(
    time: Res<Time>,
    mut query: Query<&mut Transform, With<MainBehavior>>,
) {
    // Add your update logic here
    for mut transform in query.iter_mut() {
        // Example: rotate objects
        // transform.rotate_y(time.delta_seconds());
    }
}

// Register this script in your main.rs:
// .add_systems(Startup, scripts::main::setup_main)
// .add_systems(Update, scripts::main::update_main)
```

## Workflow

### Создание многосценного проекта

1. **Создать проект:**
   ```
   File > New Project > VECN 3D Scene > "MyGame"
   ```

2. **Создать дополнительные сцены:**
   ```
   assets/scenes/
   ├── main.vecn    (главная - меню)
   ├── level1.vecn  (уровень 1)
   └── level2.vecn  (уровень 2)
   ```

3. **Установить главную сцену:**
   - Правый клик на `main.vecn`
   - "Set as Main Scene"

4. **Создать скрипты для сцен:**
   - Правый клик на `level1.vecn` → "Create Script for Scene"
   - Правый клик на `level2.vecn` → "Create Script for Scene"

5. **Редактировать скрипты:**
   ```rust
   // src/scripts/level1.rs
   pub fn setup_level1(mut commands: Commands) {
       // Логика инициализации уровня 1
   }
   
   pub fn update_level1(time: Res<Time>) {
       // Логика обновления уровня 1
   }
   ```

6. **Зарегистрировать в main.rs:**
   ```rust
   mod scripts;
   
   fn main() {
       App::new()
           .add_plugins(DefaultPlugins)
           .add_systems(Startup, (
               load_scene,
               scripts::level1::setup_level1,
           ))
           .add_systems(Update, scripts::level1::update_level1)
           .run();
   }
   ```

## Переключение сцен

### Вариант 1: Через код

```rust
use bevy::prelude::*;

#[derive(Resource)]
struct CurrentScene {
    name: String,
}

fn switch_scene(
    mut commands: Commands,
    keyboard: Res<ButtonInput<KeyCode>>,
    mut current: ResMut<CurrentScene>,
) {
    if keyboard.just_pressed(KeyCode::F1) {
        current.name = "level1".to_string();
        // Загрузить level1.vecn
    }
    if keyboard.just_pressed(KeyCode::F2) {
        current.name = "level2".to_string();
        // Загрузить level2.vecn
    }
}
```

### Вариант 2: Через UI

Установить другую сцену как главную:
1. Правый клик на `level1.vecn`
2. "Set as Main Scene"
3. Перезапустить игру

## Примеры использования

### Пример 1: Меню + Уровни

```
assets/scenes/
├── menu.vecn     (главная - стартовое меню)
├── level1.vecn   (игровой уровень 1)
└── level2.vecn   (игровой уровень 2)
```

**Скрипт меню:**
```rust
// src/scripts/menu.rs
pub fn setup_menu(mut commands: Commands) {
    // Создать UI кнопки
}

pub fn handle_menu_input(keyboard: Res<ButtonInput<KeyCode>>) {
    if keyboard.just_pressed(KeyCode::Enter) {
        // Загрузить level1.vecn
    }
}
```

### Пример 2: Процедурная генерация

```rust
// src/scripts/level1.rs
pub fn setup_level1(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    // Загрузить базовую сцену из level1.vecn
    // Затем процедурно добавить объекты
    
    for i in 0..10 {
        commands.spawn(PbrBundle {
            mesh: meshes.add(Cuboid::new(1.0, 1.0, 1.0)),
            material: materials.add(Color::srgb(0.8, 0.2, 0.2)),
            transform: Transform::from_xyz(i as f32 * 2.0, 0.0, 0.0),
            ..default()
        });
    }
}
```

### Пример 3: Анимированные объекты

```rust
// src/scripts/main.rs
#[derive(Component)]
pub struct MainBehavior {
    pub rotation_speed: f32,
}

pub fn setup_main(mut commands: Commands) {
    // Найти все кубы в сцене и добавить поведение
}

pub fn update_main(
    time: Res<Time>,
    mut query: Query<&mut Transform, With<MainBehavior>>,
) {
    for mut transform in query.iter_mut() {
        transform.rotate_y(time.delta_seconds());
    }
}
```

## Преимущества

✅ **Разделение логики** - каждая сцена имеет свой скрипт
✅ **Переиспользование** - одна сцена может использоваться в разных контекстах
✅ **Модульность** - легко добавлять/удалять сцены
✅ **Визуальное редактирование** - сцены редактируются в Scene Editor
✅ **Программная логика** - скрипты добавляют поведение

## Roadmap

### v1.0 (Текущая версия)
- ✅ Установка главной сцены
- ✅ Создание скриптов для сцен
- ✅ Автогенерация mod.rs

### v1.1 (Планируется)
- 🔄 Автоматическая привязка скриптов к сценам
- 🔄 Hot reload скриптов без перекомпиляции
- 🔄 Scene Manager для переключения сцен

### v2.0 (Будущее)
- 📋 Visual scripting в Scene Editor
- 📋 Prefab система с скриптами
- 📋 Scene transitions (fade, slide, etc.)

## FAQ

**Q: Можно ли иметь несколько главных сцен?**
A: Нет, только одна главная сцена загружается при старте. Остальные загружаются программно.

**Q: Как загрузить другую сцену из кода?**
A: Используй `load_scene("assets/scenes/level1.vecn")` в своем скрипте.

**Q: Нужно ли создавать скрипт для каждой сцены?**
A: Нет, скрипты опциональны. Сцены работают и без скриптов.

**Q: Можно ли использовать один скрипт для нескольких сцен?**
A: Да, просто импортируй функции из одного скрипта в другой.

## Заключение

Система Scene Scripts позволяет комбинировать визуальное редактирование сцен с программной логикой, создавая мощный и гибкий workflow для разработки игр!

**Void Engine - Visual Scenes + Code Logic! 🎮**

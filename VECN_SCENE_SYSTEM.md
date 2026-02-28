# VECN Scene System - No Code Game Development

## Концепция

Void Engine поддерживает два подхода к разработке игр:

1. **Code-based** (Bevy 2D/3D) - традиционный подход с Rust кодом
2. **Scene-based** (VECN 3D/2D) - визуальная разработка БЕЗ кода

## VECN Templates

### VECN 3D Scene (🎮)
- **Файлы**: Только `assets/scenes/main.vecn`
- **Код**: НЕТ! Никакого `main.rs`
- **Редактирование**: Визуально в Scene Editor
- **Запуск**: Через Game Runner (компилируется автоматически)

### VECN 2D Scene (🕹️)
- **Файлы**: Только `assets/scenes/main.vecn`
- **Код**: НЕТ! Никакого `main.rs`
- **Редактирование**: Визуально в Scene Editor
- **Запуск**: Через Game Runner (компилируется автоматически)

## Как это работает

### 1. Создание проекта
```
File > New Project > Select "VECN 3D Scene" or "VECN 2D Scene"
```

Создается структура:
```
MyProject/
├── assets/
│   └── scenes/
│       └── main.vecn    ← ЕДИНСТВЕННЫЙ файл!
└── README.md
```

### 2. Редактирование сцены
- Открыть `main.vecn` в VS Code
- Нажать кнопку **3D** или **2D** в тулбаре
- Добавлять объекты через Scene Hierarchy
- Двигать, вращать, масштабировать через Gizmo
- Настраивать свойства в Inspector

### 3. Запуск игры
- Нажать кнопку **▶ Play** в Game Runner
- Движок автоматически:
  1. Генерирует `main.rs` с загрузчиком сцены
  2. Компилирует проект
  3. Запускает игру

## Формат .vecn файла

```ron
VoidScene(
    version: "1.1",
    mode: Scene3D,  // или Scene2D
    
    entities: [
        (
            id: "unique_id",
            name: "My Object",
            visible: true,
            components: [
                Transform(
                    translation: (0.0, 1.0, 0.0),
                    rotation: (0.0, 0.0, 0.0, 1.0),
                    scale: (1.0, 1.0, 1.0),
                ),
                Mesh(shape: Cube(size: 1.0)),
                Material(
                    color: (0.9, 0.2, 0.2, 1.0),
                    metallic: 0.5,
                    roughness: 0.3,
                ),
            ],
            children: [],
        ),
    ],
    
    resources: [
        AmbientLight(
            color: (0.8, 0.85, 1.0),
            brightness: 0.15,
        ),
        ClearColor(
            color: (0.05, 0.05, 0.08, 1.0),
        ),
    ],
)
```

## Поддерживаемые компоненты

### 3D Components
- `Transform` - позиция, поворот, масштаб
- `Mesh` - геометрия (Cube, Sphere, Cylinder, Cone, Torus, Plane)
- `Material` - цвет, металличность, шероховатость
- `Camera` - камера с FOV, near, far
- `PointLight` - точечный свет
- `DirectionalLight` - направленный свет (солнце)

### 2D Components
- `Transform` - позиция, поворот, масштаб
- `Sprite` - 2D спрайт с цветом
- `Camera` - ортографическая камера

### Resources
- `AmbientLight` - общее освещение сцены
- `ClearColor` - цвет фона
- `Fog` - туман (опционально)

## Преимущества VECN подхода

✅ **Нет кода** - не нужно знать Rust
✅ **Визуальное редактирование** - drag & drop, gizmo
✅ **Быстрая итерация** - изменения видны сразу
✅ **Декларативность** - сцена описана в одном файле
✅ **Версионность** - `.vecn` файлы легко коммитить в Git

## Когда использовать Code vs VECN

### Используй VECN когда:
- Создаешь статичные сцены
- Не нужна сложная логика
- Хочешь быстро прототипировать
- Работаешь с дизайнерами без программирования

### Используй Code (Bevy) когда:
- Нужна сложная игровая логика
- Требуется физика, AI, сетевой код
- Нужен полный контроль над системами
- Разрабатываешь большую игру

## Roadmap

### Текущая версия (v1.0)
- ✅ Создание VECN проектов
- ✅ Визуальное редактирование в Scene Editor
- ✅ Автоматическая компиляция и запуск
- ✅ Поддержка 3D и 2D сцен

### Планируется (v1.1)
- 🔄 Привязка Rust скриптов к entities
- 🔄 Hot reload сцен без перекомпиляции
- 🔄 Prefab система (переиспользуемые объекты)
- 🔄 Анимации в .vecn формате

### Будущее (v2.0)
- 📋 Visual scripting (node-based)
- 📋 Particle systems в .vecn
- 📋 UI система в .vecn
- 📋 Audio в .vecn

## Примеры

### Простая 3D сцена
```bash
# Создать проект
File > New Project > VECN 3D Scene > "MyGame"

# Открыть сцену
Open: MyGame/assets/scenes/main.vecn

# Добавить объекты
Scene Hierarchy > + > Cube
Scene Hierarchy > + > Point Light

# Запустить
Game Runner > ▶ Play
```

### Новогодняя сцена (снеговик + ёлка)
См. `MyProject/assets/scenes/main.vecn` - полный пример с:
- Снеговиком из 3 сфер
- Ёлкой из конусов
- Новогодними шариками
- Освещением

## Технические детали

### Автогенерация main.rs

При запуске VECN проекта, Game Runner автоматически создает:

```rust
// Автогенерированный main.rs
use bevy::prelude::*;
use serde::Deserialize;

// ... типы для парсинга .vecn ...

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_systems(Startup, load_scene)
        .run();
}

fn load_scene(/* ... */) {
    // Загрузка assets/scenes/main.vecn
    // Парсинг RON формата
    // Создание entities в Bevy
}
```

### Компиляция

1. Проверяется наличие `src/main.rs`
2. Если нет - генерируется автоматически
3. Добавляются зависимости: `bevy`, `serde`, `ron`
4. Компиляция через `cargo build --release`
5. Запуск скомпилированного бинарника

### Кеширование

- Первая компиляция: ~30-60 секунд (Bevy)
- Повторные: ~2-5 секунд (только изменения)
- Изменения в `.vecn` НЕ требуют перекомпиляции (hot reload)

## FAQ

**Q: Можно ли добавить свой код в VECN проект?**
A: Да! Создай `src/main.rs` вручную и используй `.vecn` как данные.

**Q: Как добавить физику в VECN сцену?**
A: Пока нужен код. В v1.1 будет поддержка физики в .vecn.

**Q: Можно ли конвертировать VECN в Code проект?**
A: Да, просто создай `src/main.rs` и загружай сцену программно.

**Q: Поддерживаются ли скрипты на других языках?**
A: Пока только Rust. В будущем планируется Lua/Python.

## Заключение

VECN система делает разработку игр доступной для всех - от дизайнеров до программистов. Начни с визуального редактирования, добавь код когда понадобится!

**Void Engine - No Code, Just Create! 🎮**

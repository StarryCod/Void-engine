# Новые возможности Void Engine 🚀

## MeshInstance3D и CollisionShape3D

### Что изменилось?

**Раньше:**
- Cube, Sphere, Cylinder и т.д. были отдельными объектами
- Нельзя было менять форму после создания

**Теперь:**
- **MeshInstance3D** - универсальный 3D объект
- Форму можно выбрать в Inspector
- **CollisionShape3D** - отдельный узел для коллизий
- Как в Godot! 🎮

### Доступные формы

#### MeshInstance3D:
- 🟦 Cube (куб)
- 🔵 Sphere (сфера)
- 💊 **Capsule** (капсула) - НОВОЕ!
- 🥫 Cylinder (цилиндр)
- 🔺 Cone (конус)
- 🍩 Torus (тор)
- ⬜ Plane (плоскость)

#### CollisionShape3D:
- 🟦 Box (коробка)
- 🔵 Sphere (сфера)
- 💊 **Capsule** (капсула) - НОВОЕ!
- 🥫 Cylinder (цилиндр)

### Как создать объект с коллизией?

1. **Создай MeshInstance3D:**
   - Правый клик в Scene Hierarchy
   - "Create New Node" → MeshInstance3D
   - В Inspector выбери форму (например, Capsule)

2. **Добавь коллизию:**
   - Создай CollisionShape3D как дочерний узел
   - В Inspector выбери форму коллизии
   - Готово! Коллизия отобразится голубым полупрозрачным

### Пример сцены

```ron
// Игрок с капсулой и коллизией
(
    id: "player",
    name: "Игрок",
    visible: true,
    components: [
        Transform(
            translation: (0.0, 1.0, 0.0),
            rotation: (0.0, 0.0, 0.0, 1.0),
            scale: (1.0, 1.0, 1.0),
        ),
        Mesh( shape: Capsule(radius: 0.5, height: 1.8) ),
        Material(
            color: (0.8, 0.3, 0.3, 1.0),
            metallic: 0.2,
            roughness: 0.7,
        ),
    ],
    children: [
        // Коллизия - дочерний узел
        (
            id: "player_collision",
            name: "Коллизия игрока",
            visible: true,
            components: [
                Transform(
                    translation: (0.0, 0.0, 0.0),
                    rotation: (0.0, 0.0, 0.0, 1.0),
                    scale: (1.0, 1.0, 1.0),
                ),
                CollisionShape( shape: Capsule(radius: 0.5, height: 1.8) ),
            ],
            children: [],
        ),
    ],
),
```

## Улучшенное освещение ☀️

### Что изменилось?

**Раньше:**
- Сцены были темные
- Плохо видно объекты

**Теперь:**
- DirectionalLight: **25000** illuminance (было 10000)
- PointLight: **5000** intensity (было 2000)
- Яркие, красивые сцены! 🌟

### Рекомендуемые настройки света

```ron
// Солнце (основной свет)
DirectionalLight(
    color: (1.0, 0.98, 0.95),
    illuminance: 25000.0,
),

// Заполняющий свет
PointLight(
    color: (0.9, 0.95, 1.0),
    intensity: 5000.0,
    range: 25.0,
),

// Ambient (фоновый свет)
AmbientLight(
    color: (0.15, 0.15, 0.18),
    brightness: 0.3,
),
```

## Визуализация коллизий

- **Mesh** - обычный рендеринг с материалом
- **CollisionShape** - полупрозрачный голубой (#4080FF, 40%) с сеткой
- Легко видеть где коллизия! 👀

## Тестовая сцена

Создана тестовая сцена: `tests/test_capsule.vecn`

Содержит:
- ✅ Игрок (Capsule + CollisionShape)
- ✅ Куб (Cube + Box collision)
- ✅ Сфера (Sphere + Sphere collision)
- ✅ Улучшенное освещение
- ✅ Земля

## Что дальше?

Для полноценной игры нужно добавить:
- 🎮 Физику (bevy_rapier3d)
- 🏃 Контроллер игрока
- 🔫 Систему оружия
- 👾 AI врагов
- 📊 UI

Но основа готова! Можно создавать сцены с коллизиями прямо сейчас.

---

**Приятной разработки! 🚀**

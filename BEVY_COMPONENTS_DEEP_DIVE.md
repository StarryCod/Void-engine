# Bevy Components Deep Dive - Полное Руководство Компонентов

**Дата**: Февраль 2026  
**Версия**: 1.0  
**Статус**: Завершено

---

## Введение в Bevy ECS

### Entity Component System (ECS)

**Концепция:**
- **Entity** - уникальный идентификатор объекта
- **Component** - данные, прикрепленные к Entity
- **System** - логика, обрабатывающая компоненты

**Пример:**
```rust
// Entity с компонентами
Entity {
    id: 42,
    components: [
        Transform { translation: Vec3::ZERO, ... },
        Mesh3d { ... },
        MeshMaterial3d { ... },
        Velocity { linvel: Vec3::new(1.0, 0.0, 0.0), ... },
    ]
}
```

### Преимущества ECS

1. **Производительность** - кэш-дружественная структура
2. **Гибкость** - легко добавлять/удалять компоненты
3. **Масштабируемость** - параллельная обработка
4. **Переиспользование** - компоненты работают везде

---

## Основные Компоненты

### Transform

**Назначение:** Позиция, ротация, масштаб в локальном пространстве

**Структура:**
```rust
#[derive(Component, Default, Clone, Copy, Debug, PartialEq)]
pub struct Transform {
    pub translation: Vec3,  // Позиция (X, Y, Z)
    pub rotation: Quat,     // Ротация (кватернион)
    pub scale: Vec3,        // Масштаб (X, Y, Z)
}
```

**Методы:**
```rust
// Создание
Transform::from_xyz(0.0, 1.0, 0.0)
Transform::from_rotation(Quat::from_axis_angle(Vec3::Y, angle))
Transform::from_scale(Vec3::new(2.0, 2.0, 2.0))

// Операции
transform.translate(Vec3::new(1.0, 0.0, 0.0))
transform.rotate_axis(Vec3::Y, angle)
transform.scale_uniform(2.0)

// Преобразования
transform.looking_at(target, up)
transform.with_translation(Vec3::ZERO)
transform.with_rotation(Quat::IDENTITY)
```

**Важно:** Bevy использует **кватернионы**, а не углы Эйлера!

---

### GlobalTransform

**Назначение:** Позиция, ротация, масштаб в мировом пространстве (вычисляется автоматически)

**Структура:**
```rust
#[derive(Component, Default, Clone, Copy, Debug, PartialEq)]
pub struct GlobalTransform {
    pub affine: Affine3A,  // Матрица трансформации 4x4
}
```

**Методы:**
```rust
// Получение компонентов
global_transform.translation()
global_transform.rotation()
global_transform.scale()

// Преобразования
global_transform.forward()
global_transform.right()
global_transform.up()
```

**Автоматическое обновление:**
- Bevy автоматически вычисляет GlobalTransform из Transform и родительских трансформаций
- Не нужно вручную обновлять!

---

### Visibility

**Назначение:** Видимость узла в иерархии

**Структура:**
```rust
#[derive(Component, Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct Visibility {
    pub is_visible_in_hierarchy: bool,
}

#[derive(Component, Clone, Copy, Debug, PartialEq, Eq)]
pub struct InheritedVisibility {
    pub get: bool,
}
```

**Использование:**
```rust
// Скрыть узел
visibility.is_visible_in_hierarchy = false;

// Проверить видимость
if inherited_visibility.get {
    // Узел видим
}
```

---

## Визуальные Компоненты

### Mesh3d

**Назначение:** Ссылка на 3D меш для рендеринга

**Структура:**
```rust
#[derive(Component, Clone)]
pub struct Mesh3d(pub Handle<Mesh>);
```

**Использование:**
```rust
// Создание куба
let mesh = meshes.add(Mesh::from(shape::Cube { size: 1.0 }));
commands.spawn(Mesh3d(mesh));

// Создание сферы
let mesh = meshes.add(Mesh::from(shape::UVSphere {
    radius: 0.5,
    sectors: 32,
    stacks: 16,
}));
commands.spawn(Mesh3d(mesh));

// Создание капсулы
let mesh = meshes.add(Mesh::from(shape::Capsule {
    radius: 0.5,
    rings: 0,
    depth: 2.0,
    latitudes: 16,
    longitudes: 32,
}));
commands.spawn(Mesh3d(mesh));
```

**Доступные формы:**
- Cube, Sphere, Capsule, Cylinder, Cone, Torus, Plane
- UVSphere, Icosphere, Tetrahedron, Octahedron, Dodecahedron

---

### MeshMaterial3d

**Назначение:** Материал для 3D меша

**Структура:**
```rust
#[derive(Component, Clone)]
pub struct MeshMaterial3d<M: Material>(pub Handle<M>);
```

**Использование:**
```rust
// StandardMaterial
let material = StandardMaterial {
    base_color: Color::rgb(1.0, 0.5, 0.2),
    metallic: 0.5,
    perceptual_roughness: 0.8,
    ..default()
};
let handle = materials.add(material);
commands.spawn(MeshMaterial3d(handle));
```

---

### StandardMaterial (60+ полей!)

**Основные свойства:**

```rust
pub struct StandardMaterial {
    // Цвет и текстура
    pub base_color: Color,
    pub base_color_texture: Option<Handle<Image>>,
    
    // Металлик и шероховатость
    pub metallic: f32,              // 0.0-1.0
    pub perceptual_roughness: f32,  // 0.0-1.0
    pub metallic_roughness_texture: Option<Handle<Image>>,
    
    // Излучение (свечение)
    pub emissive: LinearRgba,
    pub emissive_texture: Option<Handle<Image>>,
    pub emissive_exposure_weight: f32,
    
    // Отражение
    pub reflectance: f32,           // 0.0-1.0
    pub specular_tint: Color,
    
    // Нормаль-мап
    pub normal_map_texture: Option<Handle<Image>>,
    pub flip_normal_map_y: bool,
    
    // Окклюзия
    pub occlusion_texture: Option<Handle<Image>>,
    
    // Прозрачность
    pub alpha_mode: AlphaMode,      // Opaque, Mask, Blend
    
    // Рендеринг
    pub double_sided: bool,
    pub cull_mode: Option<Face>,    // Back, Front
    pub unlit: bool,
    pub fog_enabled: bool,
    
    // Параллакс-маппинг
    pub depth_map: Option<Handle<Image>>,
    pub parallax_depth_scale: f32,
    
    // Передача света (стекло, вода)
    pub diffuse_transmission: f32,
    pub specular_transmission: f32,
    pub ior: f32,                   // Index of Refraction
    pub attenuation_distance: f32,
    pub attenuation_color: Color,
    
    // Многослойный материал
    pub clearcoat: f32,
    pub clearcoat_perceptual_roughness: f32,
    pub clearcoat_texture: Option<Handle<Image>>,
    pub clearcoat_normal_texture: Option<Handle<Image>>,
    
    // Анизотропия
    pub anisotropy_strength: f32,
    pub anisotropy_rotation: f32,
    pub anisotropy_texture: Option<Handle<Image>>,
}
```

**Примеры:**

```rust
// Металл
let material = StandardMaterial {
    base_color: Color::rgb(0.8, 0.8, 0.8),
    metallic: 1.0,
    perceptual_roughness: 0.2,
    ..default()
};

// Дерево
let material = StandardMaterial {
    base_color: Color::rgb(0.6, 0.4, 0.2),
    metallic: 0.0,
    perceptual_roughness: 0.8,
    ..default()
};

// Стекло
let material = StandardMaterial {
    base_color: Color::rgba(1.0, 1.0, 1.0, 0.1),
    alpha_mode: AlphaMode::Blend,
    specular_transmission: 1.0,
    ior: 1.5,
    ..default()
};

// Светящийся материал
let material = StandardMaterial {
    base_color: Color::rgb(1.0, 0.0, 0.0),
    emissive: LinearRgba::rgb(10.0, 0.0, 0.0),
    ..default()
};
```

---

## Физические Компоненты (Rapier3D)

### RigidBody

**Назначение:** Физическое тело

**Структура:**
```rust
#[derive(Component, Clone, Copy, Debug, PartialEq, Eq)]
pub enum RigidBody {
    Dynamic,           // Движется под физикой
    Fixed,             // Статичное (не движется)
    KinematicPositionBased,  // Управляется позицией
    KinematicVelocityBased,  // Управляется скоростью
}
```

**Использование:**
```rust
// Динамическое тело
commands.spawn(RigidBody::Dynamic);

// Статическое тело
commands.spawn(RigidBody::Fixed);

// Кинематическое тело (персонаж)
commands.spawn(RigidBody::KinematicPositionBased);
```

---

### Velocity

**Назначение:** Линейная и угловая скорость

**Структура:**
```rust
#[derive(Component, Clone, Copy, Debug, Default, PartialEq)]
pub struct Velocity {
    pub linvel: Vec3,  // Линейная скорость
    pub angvel: Vec3,  // Угловая скорость
}
```

**Использование:**
```rust
// Движение вперед
velocity.linvel = Vec3::new(5.0, 0.0, 0.0);

// Вращение
velocity.angvel = Vec3::new(0.0, 1.0, 0.0);

// Комбинированное движение
velocity.linvel = Vec3::new(5.0, 0.0, 0.0);
velocity.angvel = Vec3::new(0.0, 2.0, 0.0);
```

---

### Collider

**Назначение:** Форма коллизии

**Структура:**
```rust
#[derive(Component, Clone)]
pub struct Collider {
    pub shape: ColliderShape,
    pub density: f32,
    pub friction: f32,
    pub restitution: f32,
    pub collision_groups: CollisionGroups,
    pub active_events: ActiveEvents,
}

pub enum ColliderShape {
    Cuboid(Vec3),
    Sphere(f32),
    Capsule(f32, f32),
    Cylinder(f32, f32),
    Cone(f32, f32),
    ConvexPolyhedron(Vec<Vec3>),
    TriMesh(Vec<Vec3>, Vec<[u32; 3]>),
}
```

**Использование:**
```rust
// Куб
Collider::cuboid(1.0, 1.0, 1.0)

// Сфера
Collider::sphere(0.5)

// Капсула
Collider::capsule_y(0.5, 1.0)

// Цилиндр
Collider::cylinder(0.5, 1.0)

// Конус
Collider::cone(0.5, 1.0)

// С параметрами
Collider::cuboid(1.0, 1.0, 1.0)
    .with_density(2.0)
    .with_friction(0.5)
    .with_restitution(0.8)
```

---

### Damping

**Назначение:** Затухание движения

**Структура:**
```rust
#[derive(Component, Clone, Copy, Debug, Default, PartialEq)]
pub struct Damping {
    pub linear_damping: f32,   // 0.0+
    pub angular_damping: f32,  // 0.0+
}
```

**Использование:**
```rust
// Воздушное сопротивление
Damping {
    linear_damping: 0.1,
    angular_damping: 0.1,
}

// Вязкая жидкость
Damping {
    linear_damping: 0.5,
    angular_damping: 0.5,
}
```

---

### Sensor

**Назначение:** Триггер (не участвует в физике, только детекция)

**Структура:**
```rust
#[derive(Component, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Sensor;
```

**Использование:**
```rust
// Триггер зона
commands.spawn((
    Sensor,
    Collider::cuboid(2.0, 2.0, 2.0),
    ActiveEvents::COLLISION_EVENTS,
));
```

---

## Световые Компоненты

### DirectionalLight

**Назначение:** Направленный свет (солнце)

**Структура:**
```rust
#[derive(Component, Clone, Copy, Debug)]
pub struct DirectionalLight {
    pub color: Color,
    pub illuminance: f32,           // lux (default: 10000.0)
    pub shadows_enabled: bool,
    pub shadow_depth_bias: f32,
    pub shadow_normal_bias: f32,
}
```

**Использование:**
```rust
commands.spawn((
    DirectionalLight {
        color: Color::WHITE,
        illuminance: 10000.0,
        shadows_enabled: true,
        shadow_depth_bias: 0.0,
        shadow_normal_bias: 0.0,
    },
    Transform::from_xyz(0.0, 10.0, 0.0)
        .looking_at(Vec3::ZERO, Vec3::Y),
));
```

---

### PointLight

**Назначение:** Точечный свет

**Структура:**
```rust
#[derive(Component, Clone, Copy, Debug)]
pub struct PointLight {
    pub color: Color,
    pub intensity: f32,             // lumens (default: 800.0)
    pub range: f32,                 // distance (default: 20.0)
    pub radius: f32,                // for soft shadows
    pub shadows_enabled: bool,
    pub shadow_depth_bias: f32,
    pub shadow_normal_bias: f32,
}
```

**Использование:**
```rust
commands.spawn((
    PointLight {
        color: Color::WHITE,
        intensity: 800.0,
        range: 20.0,
        radius: 0.0,
        shadows_enabled: true,
        ..default()
    },
    Transform::from_xyz(0.0, 5.0, 0.0),
));
```

---

### SpotLight

**Назначение:** Прожектор

**Структура:**
```rust
#[derive(Component, Clone, Copy, Debug)]
pub struct SpotLight {
    pub color: Color,
    pub intensity: f32,
    pub range: f32,
    pub radius: f32,
    pub shadows_enabled: bool,
    pub shadow_depth_bias: f32,
    pub shadow_normal_bias: f32,
    pub outer_angle: f32,           // radians
    pub inner_angle: f32,           // radians
}
```

**Использование:**
```rust
commands.spawn((
    SpotLight {
        color: Color::WHITE,
        intensity: 800.0,
        range: 20.0,
        outer_angle: (45.0_f32.to_radians() / 2.0),
        inner_angle: (30.0_f32.to_radians() / 2.0),
        shadows_enabled: true,
        ..default()
    },
    Transform::from_xyz(0.0, 5.0, 0.0)
        .looking_at(Vec3::ZERO, Vec3::Y),
));
```

---

## Камерные Компоненты

### Camera3d

**Назначение:** 3D камера

**Структура:**
```rust
#[derive(Component, Clone, Debug)]
pub struct Camera3d {
    pub viewport_rect: Option<UVec4>,
    pub order: isize,
    pub target: RenderTarget,
    pub physical_viewport_size: Option<UVec2>,
    pub hdr: bool,
    pub msaa_writeback: bool,
}
```

**Использование:**
```rust
commands.spawn((
    Camera3d::default(),
    PerspectiveProjection {
        fov: 75.0_f32.to_radians(),
        aspect_ratio: 16.0 / 9.0,
        near: 0.1,
        far: 1000.0,
    },
    Transform::from_xyz(0.0, 5.0, 10.0)
        .looking_at(Vec3::ZERO, Vec3::Y),
));
```

---

### PerspectiveProjection

**Назначение:** Перспективная проекция

**Структура:**
```rust
#[derive(Component, Clone, Debug)]
pub struct PerspectiveProjection {
    pub fov: f32,           // radians
    pub aspect_ratio: f32,
    pub near: f32,
    pub far: f32,
}
```

---

## Ресурсы (Resources)

### AmbientLight

**Назначение:** Окружающий свет для всей сцены

**Структура:**
```rust
#[derive(Resource, Clone, Copy, Debug)]
pub struct AmbientLight {
    pub color: Color,
    pub brightness: f32,
}
```

**Использование:**
```rust
commands.insert_resource(AmbientLight {
    color: Color::WHITE,
    brightness: 0.5,
});
```

---

### ClearColor

**Назначение:** Цвет фона

**Структура:**
```rust
#[derive(Resource, Clone, Copy, Debug)]
pub struct ClearColor(pub Color);
```

**Использование:**
```rust
commands.insert_resource(ClearColor(Color::rgb(0.1, 0.1, 0.1)));
```

---

## Заключение

Этот справочник охватывает:

✅ **Основные компоненты** (Transform, Visibility)
✅ **Визуальные компоненты** (Mesh3d, Material)
✅ **Физические компоненты** (RigidBody, Collider, Velocity)
✅ **Световые компоненты** (DirectionalLight, PointLight, SpotLight)
✅ **Камерные компоненты** (Camera3d, Projection)
✅ **Ресурсы** (AmbientLight, ClearColor)

**Дата завершения**: Февраль 18, 2026
**Статус**: ✅ ПОЛНЫЙ СПРАВОЧНИК ЗАВЕРШЕН


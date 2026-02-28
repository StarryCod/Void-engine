# MeshInstance3D & CollisionShape3D Guide

## Overview

Void Engine теперь использует Godot-style систему объектов:
- **MeshInstance3D** - 3D меш с выбором формы в Inspector
- **CollisionShape3D** - форма коллизии (дочерний узел)

## Доступные формы

### MeshInstance3D Shapes:
- Cube
- Sphere
- Capsule ⭐ NEW
- Cylinder
- Cone
- Torus
- Plane

### CollisionShape3D Shapes:
- Box
- Sphere
- Capsule
- Cylinder

## Как использовать

### 1. Создание MeshInstance3D

1. Правый клик в Scene Hierarchy → "Create New Node"
2. Выбрать **MeshInstance3D**
3. В Inspector выбрать форму (Shape)
4. Настроить параметры (size, radius, height)

### 2. Добавление коллизии

1. Создать **CollisionShape3D** как дочерний узел MeshInstance3D
2. В Inspector выбрать форму коллизии
3. Collision shape отображается полупрозрачным голубым с сеткой

## Пример .vecn файла

```ron
(
    id: "player",
    name: "Player",
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
        (
            id: "player_collision",
            name: "PlayerCollision",
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

## Визуальное отображение

- **Mesh** - обычный рендеринг с материалом
- **CollisionShape** - полупрозрачный голубой (#4080FF, 40% opacity) с сеткой

## Улучшенное освещение

Шаблон void-3d теперь имеет улучшенное освещение:
- DirectionalLight (Sun): 25000 illuminance
- PointLight (Fill): 5000 intensity
- Ambient light для мягких теней

Сцены больше не темные! 🌟

# Scene Editor - Текущий статус

## ✅ Реализовано (Phase 2)

### Toolbar
- Кнопки [3D] [2D] [Script] с SVG иконками
- Переключение режимов работает
- Цветовая схема: White (#FFFFFF) + Void Purple (#8B5CF6)

### Viewport Container
- Создается и управляется корректно
- Переключается между 3D/2D/Script режимами
- Логирование работает

### Компиляция
- Все TypeScript ошибки исправлены
- Watcher работает стабильно
- Нет runtime ошибок

## 🚧 В процессе (Phase 3)

### Scene Hierarchy Tree
- Нужно создать дерево слева от viewport
- Парсить .vecn файлы
- Показывать entities и components

### 3D Viewport
- Добавить Three.js
- Рендерить сцену из .vecn
- OrbitControls для камеры

## 📋 План Phase 3

### 1. Парсер .vecn файлов
```typescript
interface VoidScene {
    version: string;
    mode: 'Scene3D' | 'Scene2D';
    entities: Entity[];
    resources: Resource[];
}

interface Entity {
    id: string;
    name: string;
    components: Component[];
    children: Entity[];
}
```

### 2. Scene Hierarchy Tree
- Показывать entities в виде дерева
- Иконки для разных типов (Entity, Component)
- Клик для выбора entity
- Highlight выбранного entity

### 3. Three.js Viewport
- Базовая сцена с камерой и светом
- Рендеринг Cube, Plane из .vecn
- OrbitControls
- Grid helper

## 📄 Пример .vecn файла

Файл: `void_engine/assets/scenes/main.vecn`

Содержит:
- Red Cube (Transform + Mesh + Material)
- Ground Plane
- Point Light
- Ambient Light
- Clear Color

## 🎯 Следующие шаги

1. Создать VecnParser для парсинга RON формата
2. Создать SceneHierarchyTree компонент
3. Интегрировать Three.js в Viewport3D
4. Загружать и рендерить main.vecn

## 🔧 Технические детали

### Формат .vecn (RON)
- Rust Object Notation
- Простой парсинг через regex
- Поддержка вложенных структур

### Three.js интеграция
- Использовать CDN или bundled версию
- PerspectiveCamera
- WebGLRenderer
- OrbitControls из examples

### Архитектура
```
SceneEditorContainer
├── SceneHierarchyTree (left, 250px)
│   └── Parsed .vecn entities
└── Viewport3D (right, flex: 1)
    └── Three.js scene
```

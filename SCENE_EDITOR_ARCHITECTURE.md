# Scene Editor Architecture - Three.js Based

## Цель
Полноценный 3D редактор как в Godot/Unity, встроенный в VS Code.

## Архитектура

### 1. Custom Editor для .vecn файлов
```typescript
// Регистрируем custom editor
vscode.window.registerCustomEditorProvider('voidEngine.vecnEditor', {
  resolveCustomEditor(document, webviewPanel) {
    // Создаем Three.js viewport вместо текстового редактора
  }
});
```

### 2. Three.js Viewport (WebView)
```
WebView Panel
├── Three.js Scene
│   ├── Entities из .vecn
│   ├── Lights
│   ├── Camera
│   └── Grid/Axes
│
├── TransformControls (gizmos)
│   ├── Translate (стрелочки)
│   ├── Rotate (круги)
│   └── Scale (кубики)
│
└── OrbitControls (camera)
```

### 3. Двусторонняя синхронизация

**VS Code → Three.js**:
- Парсим .vecn файл
- Создаем Three.js объекты
- Рендерим сцену

**Three.js → VS Code**:
- Пользователь двигает объект
- Обновляем transform
- Сериализуем обратно в .vecn
- Сохраняем файл

### 4. Компоненты

#### VecnEditorProvider (TypeScript)
- Custom editor provider
- Управляет webview
- Парсит/сериализует .vecn

#### ThreeViewport (WebView HTML/JS)
- Three.js сцена
- Transform gizmos
- Raycasting для выделения
- Camera controls

#### SceneHierarchy (уже есть)
- Дерево entities
- Синхронизация с viewport
- Выделение

## Технологии

### Three.js
```javascript
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
```

### Загрузка моделей
- GLTFLoader - для .gltf/.glb
- FBXLoader - для .fbx
- OBJLoader - для .obj
- Примитивы - BoxGeometry, SphereGeometry, PlaneGeometry

### Материалы
- MeshStandardMaterial (PBR)
- Поддержка текстур
- Metallic/Roughness

## Workflow

### Открытие .vecn файла
1. VS Code открывает файл
2. VecnEditorProvider создает webview
3. Парсим .vecn → JSON
4. Отправляем в webview
5. Three.js создает сцену

### Редактирование
1. Пользователь кликает на объект
2. Raycasting определяет объект
3. TransformControls появляются
4. Пользователь двигает
5. onChange → отправляем transform в VS Code
6. VS Code обновляет .vecn файл

### Сохранение
1. Ctrl+S в VS Code
2. Сериализуем Three.js сцену → .vecn
3. Записываем файл
4. Hot reload в Bevy (если запущен)

## Преимущества

✅ Не нужен Bevy для редактирования
✅ Мгновенный feedback
✅ Работает в браузере (webview)
✅ Поддержка импорта моделей
✅ Transform gizmos из коробки
✅ Как в Godot/Unity

## Следующие шаги

1. Создать VecnEditorProvider
2. Создать Three.js webview
3. Парсер .vecn → Three.js
4. Transform gizmos
5. Сериализация обратно в .vecn

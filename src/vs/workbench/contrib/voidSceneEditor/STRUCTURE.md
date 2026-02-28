# Void Scene Editor - Структура проекта

## 📁 Организация файлов

```
voidSceneEditor/
├── common/
│   └── voidSceneEditor.ts          # Интерфейсы, типы, константы
│
├── browser/
│   ├── voidSceneEditor.contribution.ts  # Главный entry point
│   ├── voidSceneEditorToolbar.ts        # Toolbar [3D|2D|Script]
│   │
│   ├── views/                           # Компоненты UI
│   │   ├── sceneEditorContainer.ts      # Главный контейнер
│   │   └── (TODO) inspectorView.ts      # Панель свойств
│   │
│   ├── viewport3D.ts                    # 3D viewport (Three.js)
│   ├── viewport2D.ts                    # 2D viewport (Canvas)
│   │
│   └── media/
│       └── voidSceneEditorToolbar.css   # Стили
│
└── electron-sandbox/
    └── (TODO) sceneFileService.ts       # Работа с .vecn файлами
```

## 🔄 Поток данных

```
User clicks button
       ↓
VoidSceneEditorToolbar
       ↓ (onModeChanged event)
VoidSceneEditorContribution
       ↓
SceneEditorContainer.switchMode()
       ↓
┌──────────────┬──────────────┬──────────────┐
│   3D Mode    │   2D Mode    │ Script Mode  │
├──────────────┼──────────────┼──────────────┤
│ Explorer +   │ Explorer +   │ Explorer +   │
│ Viewport3D   │ Viewport2D   │ Normal Editor│
└──────────────┴──────────────┴──────────────┘
```

## 📦 Компоненты

### 1. VoidSceneEditorContribution
**Файл:** `voidSceneEditor.contribution.ts`
**Роль:** Главный контроллер
- Создает toolbar и container
- Слушает события переключения режимов
- Координирует работу всех компонентов

### 2. VoidSceneEditorToolbar
**Файл:** `voidSceneEditorToolbar.ts`
**Роль:** Верхняя панель с кнопками
- Отображает кнопки [3D] [2D] [Script]
- SVG иконки для каждого режима
- Эмитит события при переключении
- Показывает имя текущей сцены

### 3. SceneEditorContainer
**Файл:** `views/sceneEditorContainer.ts`
**Роль:** Главный контейнер для viewport
- Управляет viewport (3D/2D)
- Переключает между режимами
- **Использует встроенный Explorer VSCode** вместо кастомного дерева
- Управляет видимостью sidebar

### 4. Viewport3D
**Файл:** `viewport3D.ts`
**Роль:** 3D рендеринг
- Three.js canvas
- OrbitControls (TODO Phase 3)
- Отображение сцены из .vecn (TODO)

### 5. Viewport2D
**Файл:** `viewport2D.ts`
**Роль:** 2D рендеринг
- Canvas 2D API
- Pan/Zoom (TODO Phase 6)
- Отображение 2D сцены (TODO)

## 🎯 Режимы работы

### 3D Mode
```
┌─────────────────────────────────────────┐
│  [3D] [2D] [Script]  |  Scene: main.vecn│
├──────────┬──────────────────────────────┤
│          │                              │
│ Explorer │      3D Viewport             │
│ (VSCode) │      (Three.js)              │
│          │                              │
│ - src/   │      [Cube preview]          │
│ - assets/│                              │
│ - main.rs│                              │
│          │                              │
└──────────┴──────────────────────────────┘
```

### 2D Mode
```
┌─────────────────────────────────────────┐
│  [3D] [2D] [Script]  |  Scene: main.vecn│
├──────────┬──────────────────────────────┤
│          │                              │
│ Explorer │      2D Viewport             │
│ (VSCode) │      (Canvas)                │
│          │                              │
│ - src/   │      [Sprite preview]        │
│ - assets/│                              │
│ - main.rs│                              │
│          │                              │
└──────────┴──────────────────────────────┘
```

### Script Mode
```
┌─────────────────────────────────────────┐
│  [3D] [2D] [Script]  |  Scene: main.vecn│
├──────────┬──────────────────────────────┤
│          │                              │
│ Explorer │  Normal VSCode editor        │
│ (VSCode) │  (Scene viewport hidden)     │
│          │                              │
│ - src/   │  fn main() {                 │
│ - assets/│      println!("Hello");      │
│ - main.rs│  }                           │
│          │                              │
└──────────┴──────────────────────────────┘
```

## 🔧 Lifecycle

### Initialization
1. `VoidSceneEditorContribution` создается при старте workbench
2. Через 500ms создается `VoidSceneEditorToolbar`
3. Создается `SceneEditorContainer` (скрыт)
4. По умолчанию показывается 3D режим
5. **Explorer VSCode уже существует и используется как есть**

### Mode Switch
1. User кликает на кнопку (например, 2D)
2. `VoidSceneEditorToolbar` эмитит `onModeChanged(Scene2D)`
3. `VoidSceneEditorContribution` получает событие
4. Вызывает `SceneEditorContainer.switchMode(Scene2D)`
5. Container очищает старый viewport
6. Создает новый viewport для 2D режима
7. **Explorer остается видимым (встроенный VSCode)**

### Cleanup
1. При dispose contribution
2. Viewport компоненты удаляются
3. Container удаляется из DOM
4. Toolbar удаляется
5. **Explorer восстанавливается**

## 📝 TODO

### Phase 3 (Current)
- [x] Базовая структура
- [x] Переключение режимов
- [x] Использование встроенного Explorer
- [x] Viewport placeholders
- [ ] Three.js integration
- [ ] Загрузка .vecn файлов
- [ ] Inspector panel

### Phase 4
- [ ] Редактирование свойств
- [ ] Контекстное меню
- [ ] Undo/Redo

### Phase 5
- [ ] WebSocket с Bevy
- [ ] Live preview
- [ ] Hot reload

### Phase 6
- [ ] 2D viewport полный функционал
- [ ] Sprite editor
- [ ] Tilemap support

## 🎨 Стили

Все стили в `media/voidSceneEditorToolbar.css`:
- Белый - главный акцент
- Фиолетовый (#8B5CF6) - подакцент для активных иконок
- Без неона/glow эффектов
- Минималистичный дизайн

## 🚀 Как добавить новый компонент

1. Создать файл в `views/` или корне `browser/`
2. Наследоваться от `Disposable`
3. Реализовать `create()` и `dispose()`
4. Добавить в `SceneEditorContainer` если нужно
5. Зарегистрировать через `_register()` для cleanup

## ⚠️ Важно

- **НЕ создавать кастомное дерево файлов** - используем встроенный Explorer VSCode
- Explorer управляется через показ/скрытие sidebar
- В 3D/2D режимах Explorer показывает структуру проекта
- В Script режиме Explorer тоже виден, просто viewport скрыт

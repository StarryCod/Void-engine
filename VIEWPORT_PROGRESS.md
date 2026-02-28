# Viewport Progress Summary

## ✅ Что сделано

### 1. Формат .vecn (Bevy)
- ✅ Расширенный формат с полными данными (visible, shadows, materials, PBR)
- ✅ Bevy рендерит красный кубик с освещением
- ✅ RON парсер работает
- ✅ Компиляция успешна

### 2. Bevy Viewport (НЕ используется для редактора)
- ✅ WebSocket сервер на порту 9002
- ✅ Frame capture и отправка кадров
- ✅ Headless rendering
- ⚠️ Это для Game Runner, НЕ для Scene Editor!

### 3. Three.js Scene Editor (ПРАВИЛЬНЫЙ подход)
- ✅ `ThreeViewport.ts` - iframe с Three.js
- ✅ `VecnEditorProvider.ts` - custom editor provider
- ✅ Transform gizmos (translate, rotate, scale)
- ✅ Orbit controls
- ✅ Raycasting для выделения
- ✅ Grid, Axes, Lights
- ✅ Real-time sync (viewport → .vecn)
- ✅ Компиляция 0 ошибок

## 📋 Что осталось

### Критично
1. **Зарегистрировать custom editor** в contribution.ts
2. **Парсер .vecn → Three.js** (сейчас mock)
3. **Сериализация Three.js → .vecn** (сейчас заглушка)
4. **Подключить к Scene Hierarchy** (клик в дереве → выделение в viewport)

### Дополнительно
5. Properties panel (справа)
6. Импорт моделей (GLTF, FBX, OBJ)
7. Текстуры и материалы
8. Undo/Redo
9. Snap to grid
10. Duplicate, Delete shortcuts

## 🎯 Архитектура (финальная)

```
VS Code открывает .vecn файл
    ↓
VecnEditorProvider создает webview
    ↓
ThreeViewport (iframe с Three.js)
    ├── Парсит .vecn → Three.js сцена
    ├── Рендерит с gizmos
    ├── Пользователь двигает объект
    ├── onChange → отправка в VS Code
    └── VS Code сохраняет .vecn
```

## 📁 Файлы

### Созданные
- `vscode/src/vs/workbench/contrib/voidSceneEditor/browser/threeViewport.ts` ✅
- `vscode/src/vs/workbench/contrib/voidSceneEditor/browser/vecnEditorProvider.ts` ✅
- `vscode/SCENE_EDITOR_ARCHITECTURE.md` ✅
- `vscode/VIEWPORT_INTEGRATION_PLAN.md` ✅
- `void_engine/src/viewport/` (mod.rs, headless.rs, frame_capture.rs, ipc_server.rs) ✅

### Нужно обновить
- `vscode/src/vs/workbench/contrib/voidSceneEditor/browser/voidSceneEditor.contribution.ts` - зарегистрировать editor
- `vscode/src/vs/workbench/contrib/voidSceneEditor/common/vecnParser.ts` - реальный парсер

## 🔧 Технологии

- **Three.js** - через CDN (https://cdn.jsdelivr.net/npm/three@0.160.0)
- **OrbitControls** - camera
- **TransformControls** - gizmos
- **Raycaster** - selection
- **iframe** - изоляция Three.js от VS Code

## 💡 Ключевые решения

1. **НЕ используем Bevy для редактора** - только для Game Runner
2. **Three.js в iframe** - чистая изоляция, CDN загрузка
3. **Custom editor provider** - заменяет текстовый редактор
4. **Real-time sync** - изменения сразу в файл
5. **Как в Godot/Unity** - полноценный 3D редактор

## 🚀 Следующий шаг

Зарегистрировать custom editor в `voidSceneEditor.contribution.ts`:

```typescript
// Register custom editor for .vecn files
registerSingleton(IVecnEditorService, VecnEditorService);

// Register editor provider
Registry.as<IEditorRegistry>(EditorExtensions.Editors).registerEditor(
    EditorDescriptor.create(
        VecnEditor,
        VecnEditor.ID,
        'VECN Scene Editor'
    ),
    [new SyncDescriptor(VecnEditorInput)]
);
```

---

**Watcher**: ✅ Running (process 3)
**Compilation**: ✅ 0 errors
**Context**: 36% remaining

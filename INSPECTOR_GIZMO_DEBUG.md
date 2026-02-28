# 🔍 Отладка Inspector и Gizmo

## ✅ Что исправлено:

### 1. Inspector еще компактнее
- **Ширина**: 220px (было 260px)
- **Высота**: max 400px (было calc(100vh - 120px))
- **Шрифт**: 11px (было 12px)
- **Padding**: 8px (было 12px)
- **Header**: 6px padding, 9px font

### 2. Real-time обновление Inspector
Добавлен метод `updateFromViewport()` который вызывается при каждом изменении transform:

```typescript
// inspectorView.ts
public updateFromViewport(): void {
    if (!this.selectedEntityId) return;
    this.render(); // Перерисовываем с текущими данными
}

// contribution.ts
this._register(this.viewport.onTransformEditedTRS(e => {
    this.handleTransformEditTRS(e.entityId, e.translation, e.rotation, e.scale);
    // Real-time inspector update
    if (this.inspector) {
        this.inspector.updateFromViewport();
    }
}));
```

### 3. Логирование для отладки гизмо

Добавлено подробное логирование:

```typescript
// При переключении режима (W/E/R)
console.log('[Viewport] Switching to ROTATE mode');

// При рендеринге гизмо
console.log('[Viewport] renderGizmo called, mode:', this.gizmoMode);
console.log('[Viewport] Rendering ROTATE gizmo');

// При рендеринге колец
console.log('[Viewport] renderGizmoRotate START, torusGeo:', !!this.torusGeo);
console.log('[Viewport] Rendering rotate rings, scale:', ringScale);
console.log('[Viewport] renderGizmoRotate COMPLETE');

// При клике мыши
console.log('[Viewport] Trying gizmo pick, mode:', this.gizmoMode);
```

## 🐛 Диагностика проблем

### Проблема: Гизмо E/R не рисуются

**Шаги отладки:**

1. **Открыть DevTools** (F12) → Console

2. **Выбрать объект** (LMB на plane)

3. **Нажать E** (rotate mode)
   - Должно появиться: `[Viewport] Switching to ROTATE mode`

4. **Проверить рендеринг** (каждый кадр):
   ```
   [Viewport] renderGizmo called, mode: rotate, pickMode: false
   [Viewport] Rendering ROTATE gizmo
   [Viewport] renderGizmoRotate START, torusGeo: true, flatProgram: true
   [Viewport] Rendering rotate rings, scale: 0.255
   [Viewport] renderGizmoRotate COMPLETE
   ```

5. **Если torusGeo: false**:
   - Проблема: Torus геометрия не создана
   - Проверить `initWebGL()` → `this.torusGeo = createTorusGeo(...)`

6. **Если flatProgram: false**:
   - Проблема: Shader не скомпилирован
   - Проверить `initWebGL()` → `this.flatProgram = createProgram(...)`

7. **Если логи есть, но ничего не видно**:
   - Проблема: Размер слишком маленький или цвет сливается с фоном
   - Увеличить `ringScale` в `renderGizmoRotate()`

### Проблема: Inspector не обновляется

**Шаги отладки:**

1. **Открыть DevTools** (F12) → Console

2. **Выбрать объект** → **Потянуть за стрелку**

3. **Проверить логи**:
   ```
   [VoidSceneEditor] Transform edited: plane_1
   [VoidSceneEditor] handleTransformEditTRS called: plane_1
   [Inspector] Scene update received
   ```

4. **Если нет "Transform edited"**:
   - Проблема: Событие `onTransformEditedTRS` не срабатывает
   - Проверить `updateGizmoDrag()` → `this._onTransformEditedTRS.fire(...)`

5. **Если нет "handleTransformEditTRS"**:
   - Проблема: Подписка не работает
   - Проверить `contribution.ts` → `this.viewport.onTransformEditedTRS(...)`

6. **Если нет "Scene update"**:
   - Проблема: Inspector не получает обновления
   - Проверить `inspector.updateFromViewport()` вызывается

### Проблема: Автосохранение не работает

**Шаги отладки:**

1. **Открыть DevTools** (F12) → Console

2. **Потянуть за гизмо**

3. **Проверить логи**:
   ```
   [VoidSceneEditor] handleTransformEditTRS called: plane_1
   [VoidSceneEditor] Patching model, scheduling auto-save
   [VoidSceneEditor] Auto-save timer fired
   [VoidSceneEditor] Auto-saved: file:///path/to/scene.vecn
   ```

4. **Если нет "Patching model"**:
   - Проблема: `findVecnModel()` не находит модель
   - Проверить что .vecn файл открыт в редакторе

5. **Если нет "Auto-save timer fired"**:
   - Проблема: Таймер не срабатывает
   - Подождать 500ms после последнего изменения

6. **Если нет "Auto-saved"**:
   - Проблема: `saveModelToDisk()` падает
   - Проверить ошибки в Console

## 📝 Чеклист проверки

### Inspector
- [ ] Размер 220x400px
- [ ] Floating overlay (не сжимает viewport)
- [ ] Полупрозрачный фон с blur
- [ ] Координаты обновляются при drag гизмо
- [ ] Показывает Transform компонент

### Gizmo
- [ ] W → Стрелки (translate)
- [ ] E → Кольца (rotate)
- [ ] R → Стрелки с кубиками (scale)
- [ ] Центральная сфера видна
- [ ] Размер адекватный (не слишком большой)

### Синхронизация
- [ ] Drag гизмо → Inspector обновляется
- [ ] Drag гизмо → HUD обновляется
- [ ] Drag гизмо → Файл патчится
- [ ] Через 500ms → Автосохранение

### Логи в Console
- [ ] `[Viewport] Switching to X mode` при W/E/R
- [ ] `[Viewport] renderGizmo called` каждый кадр
- [ ] `[Viewport] Rendering X gizmo` каждый кадр
- [ ] `[VoidSceneEditor] Transform edited` при drag
- [ ] `[VoidSceneEditor] Auto-save timer fired` через 500ms

## 🔧 Быстрые фиксы

### Гизмо не видно
```typescript
// threeViewport.ts - увеличить размер
const L = Math.max(0.5, dist * 0.18); // Было 0.12
const ringScale = S * 1.0; // Было 0.85
```

### Inspector слишком большой
```typescript
// inspectorView.ts
width: 200px;  // Было 220px
max-height: 350px;  // Было 400px
font-size: 10px;  // Было 11px
```

### Координаты не обновляются
```typescript
// contribution.ts - добавить прямое обновление
this._register(this.viewport.onTransformEditedTRS(e => {
    this.handleTransformEditTRS(e.entityId, e.translation, e.rotation, e.scale);
    if (this.inspector) {
        this.inspector.updateFromViewport(); // ← Это должно быть
    }
}));
```

## 🎯 Ожидаемое поведение

1. **Выбрать объект** → Inspector показывает свойства
2. **Нажать W** → Появляются стрелки (красная/зеленая/синяя)
3. **Нажать E** → Появляются кольца (красное/зеленое/синее)
4. **Нажать R** → Появляются стрелки с кубиками
5. **Потянуть за гизмо** → Inspector обновляется в реальном времени
6. **Подождать 500ms** → Файл автоматически сохраняется

**Если что-то не работает — смотри логи в Console!** 🔍

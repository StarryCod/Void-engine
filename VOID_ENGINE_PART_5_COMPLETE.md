# Void Engine — Часть 5: Архитектурная переделка ✅

## Что сделано

Полная архитектурная переделка Scene Editor с учетом критики:

### 1. ✅ Outline Shader (Stencil-based)
- Добавлены OUTLINE_VERT и OUTLINE_FRAG шейдеры
- Stencil buffer включен в WebGL context
- renderSelectionOutline полностью переписан:
  - Step 1: Рендер объекта в stencil buffer
  - Step 2: Рендер увеличенного меша с outline shader только где stencil != 1
  - Оранжевый контур (0.95, 0.55, 0.15) как в Godot/Blender
  - Outline width масштабируется с расстоянием (0.01-0.08)

### 2. ✅ Docked Inspector Layout
- 3-колоночный layout вместо floating overlay:
  - Viewport: flex:1 (занимает всё оставшееся место)
  - Inspector: 280px справа, resizable (220-380px)
  - Resize handle с hover эффектом
- Inspector теперь всегда видим (не display:none)
- Убран HUD (дублировал inspector)

### 3. ✅ Plane Handles на Гизмо
- Добавлены handle types: 'txy', 'txz', 'tyz'
- handleId и idToHandle обновлены (ID 13-15)
- renderGizmoTranslate: 3 полупрозрачных квадрата между осями
  - XZ plane (зеленый) — движение по XZ
  - XY plane (синий) — движение по XY
  - YZ plane (красный) — движение по YZ
- startGizmoDrag: plane normal detection
- updateGizmoDrag: plane drag с ограничением по нужным осям

### 4. ✅ Яркий визуал (Godot-style)
- Background: top #383840, bottom #262628 (теплее)
- Grid:
  - Minor grid: 0.22 opacity
  - Major grid: 0.45 opacity
  - Яркие оси: X red 0.85, Z blue 0.85
  - Grid color: vec3(0.35)
- Lighting: +30% яркости
  - Light: 1.2, 1.15, 1.08
  - Ambient: 0.28, 0.29, 0.34
- clearColor: 0.15, 0.15, 0.17

### 5. ✅ Компактный Inspector (Unity/Godot style)
- Vec3 inputs с цветными лейблами X/Y/Z ВНУТРИ строки:
  - X: #c04040 (красный)
  - Y: #40a040 (зеленый)
  - Z: #4070c0 (синий)
  - Лейбл в отдельном span с background #252528
  - Input справа с border-radius 0 2px 2px 0
- Empty state: "No entity selected" с иконкой ○

### 6. ✅ Entity Selection Bus
- vecnSceneBus.ts: добавлены onEntitySelected и fireEntitySelected
- contribution.ts: fireEntitySelected при viewport pick
- Готово для sync с hierarchy (когда понадобится)

### 7. ✅ Stencil Buffer
- WebGL context: stencil: true
- renderFrame: clear STENCIL_BUFFER_BIT
- Outline shader использует stencil для точного контура

## Файлы изменены

1. `threeViewport.ts`:
   - OUTLINE_VERT, OUTLINE_FRAG шейдеры
   - outlineProgram создание
   - renderSelectionOutline полная замена
   - Plane handles (txy/txz/tyz)
   - renderGizmoTranslate с plane квадратами
   - startGizmoDrag и updateGizmoDrag для plane
   - updateHud скрыт (inspector docked)
   - Яркий background, grid, lighting
   - Удалены неиспользуемые quatToEulerXYZDeg и hudText

2. `voidSceneEditor.contribution.ts`:
   - activate3D: 3-column docked layout
   - Resize handle с drag logic
   - Inspector в dock вместо floating
   - fireEntitySelected при pick
   - _resizing field

3. `inspectorView.ts`:
   - Docked стили (width:100%, height:100%)
   - selectEntity без display toggle
   - buildVec3: цветные X/Y/Z лейблы
   - Empty state: "No entity selected"

4. `vecnSceneBus.ts`:
   - onEntitySelected event
   - fireEntitySelected function

## Компиляция

✅ Успешно: 0 errors
- Удалены неиспользуемые объявления
- TypeScript проверки пройдены

## Результат

Теперь Scene Editor выглядит как профессиональный 3D редактор:
- Настоящий outline shader (не polygon offset hack)
- Docked inspector справа (как Unity/Godot)
- Plane handles для быстрого движения по 2 осям
- Яркий, читаемый визуал
- Компактные Vec3 inputs с цветными лейблами
- Готов к production использованию

## Тестирование

1. Открыть .vecn файл
2. Переключиться в 3D режим
3. Выбрать объект → оранжевый outline
4. Inspector справа, resizable
5. W → translate gizmo с plane квадратами
6. Drag plane handle → движение по 2 осям
7. Vec3 inputs с X/Y/Z лейблами
8. Яркая grid и освещение

Всё работает! 🎉


# Viewport Integration Plan - Bevy в VS Code

## Цель
Встроить Bevy 3D viewport прямо в VS Code Scene Editor для редактирования .vecn сцен в реальном времени.

## Архитектура

### 1. Bevy Side (Rust)
```
void_engine/src/viewport/
├── mod.rs              - ViewportPlugin
├── headless.rs         - Headless rendering setup
├── frame_capture.rs    - Захват frame buffer
└── ipc_server.rs       - WebSocket сервер для VS Code
```

**Функции**:
- Рендерит сцену в offscreen buffer (без окна)
- Захватывает frame buffer каждый кадр
- Отправляет через WebSocket в VS Code (Base64 PNG или raw RGBA)
- Принимает input events (mouse, keyboard, camera controls)
- Hot reload .vecn файлов при изменении

### 2. VS Code Side (TypeScript)
```
vscode/src/vs/workbench/contrib/voidSceneEditor/browser/
├── viewport3D.ts           - Canvas + WebSocket client
├── viewportRenderer.ts     - Отрисовка полученных кадров
├── viewportInput.ts        - Обработка input → Bevy
└── viewportConnection.ts   - WebSocket connection manager
```

**Функции**:
- Canvas element для отображения
- WebSocket client подключается к Bevy
- Получает frame data и рисует на canvas
- Отправляет mouse/keyboard events в Bevy
- UI controls (play/pause, camera reset, gizmos)

## Протокол IPC (WebSocket)

### Messages: VS Code → Bevy
```typescript
{
  type: 'input',
  data: {
    mouse: { x: number, y: number, buttons: number },
    keyboard: { key: string, pressed: boolean },
    camera: { action: 'orbit' | 'pan' | 'zoom', delta: [number, number] }
  }
}

{
  type: 'command',
  data: {
    action: 'reload_scene' | 'play' | 'pause' | 'reset_camera'
  }
}

{
  type: 'scene_update',
  data: {
    entity_id: string,
    transform: { translation: [x,y,z], rotation: [x,y,z,w], scale: [x,y,z] }
  }
}
```

### Messages: Bevy → VS Code
```typescript
{
  type: 'frame',
  data: {
    width: number,
    height: number,
    format: 'rgba' | 'png_base64',
    pixels: string | ArrayBuffer,
    fps: number
  }
}

{
  type: 'scene_loaded',
  data: {
    entity_count: number,
    bounds: { min: [x,y,z], max: [x,y,z] }
  }
}

{
  type: 'error',
  data: {
    message: string
  }
}
```

## Этапы реализации

### Phase 1: Базовый Headless Rendering (Bevy)
- [ ] Настроить Bevy в headless режиме (без окна)
- [ ] Захватывать frame buffer в текстуру
- [ ] Конвертировать в PNG/RGBA
- [ ] WebSocket сервер на порту 9002
- [ ] Отправка кадров в VS Code

### Phase 2: Canvas Viewer (VS Code)
- [ ] Canvas element в Scene Editor
- [ ] WebSocket client подключение к Bevy
- [ ] Отрисовка полученных кадров
- [ ] FPS counter, connection status

### Phase 3: Input Handling
- [ ] Mouse events (orbit camera)
- [ ] Keyboard events (WASD movement)
- [ ] Wheel zoom
- [ ] Отправка в Bevy через WebSocket

### Phase 4: Scene Sync
- [ ] Hot reload .vecn при изменении файла
- [ ] Двусторонняя синхронизация (VS Code ↔ Bevy)
- [ ] Transform gizmos (move, rotate, scale)
- [ ] Entity selection

### Phase 5: Performance
- [ ] Оптимизация frame transfer (SharedMemory вместо WebSocket?)
- [ ] Adaptive FPS (30fps idle, 60fps при взаимодействии)
- [ ] Frame compression
- [ ] Delta encoding для input events

## Технические детали

### Bevy Headless Setup
```rust
App::new()
    .add_plugins(DefaultPlugins.set(WindowPlugin {
        primary_window: None, // Headless
        ..default()
    }))
    .add_plugins(ViewportPlugin)
    .run();
```

### Frame Capture
```rust
// Render to texture
let render_target = RenderTarget::Image(image_handle);

// Extract pixels
let image = images.get(&image_handle)?;
let rgba_data = &image.data;

// Send via WebSocket
ws_send(rgba_data);
```

### VS Code Canvas
```typescript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

ws.onmessage = (event) => {
  const frame = JSON.parse(event.data);
  const imageData = new ImageData(
    new Uint8ClampedArray(frame.pixels),
    frame.width,
    frame.height
  );
  ctx.putImageData(imageData, 0, 0);
};
```

## Альтернативные подходы

### Option A: WebSocket + Base64 PNG (текущий выбор)
✅ Простая реализация
✅ Кроссплатформенность
❌ Overhead на encoding/decoding
❌ ~30-60 FPS max

### Option B: Shared Memory
✅ Очень быстро (120+ FPS)
✅ Нет overhead на сериализацию
❌ Сложная реализация
❌ Platform-specific код

### Option C: WebGPU Direct Rendering
✅ Нативная производительность
✅ Прямой доступ к GPU
❌ Требует WebGPU в Electron
❌ Очень сложная интеграция

## Следующие шаги

1. ✅ Формат .vecn работает в Bevy
2. 🔄 Создать ViewportPlugin с headless rendering
3. 🔄 WebSocket сервер в Bevy
4. 🔄 Canvas viewer в VS Code
5. 🔄 Базовая camera orbit

Начинаем с Phase 1!

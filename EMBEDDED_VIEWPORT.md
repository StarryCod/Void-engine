# 🎮 Void Game Runner - Separate Window Architecture

## Концепция

Игра запускается в **отдельном frameless окне** с кастомным UI, как в Unity/Unreal.

```
┌─────────────────────────────────────────┐
│ VSCode Main Window                      │
│ [Code Editor] [Terminal] [Chat]         │
└─────────────────────────────────────────┘
                  │ F5
                  ▼
┌─────────────────────────────────────────┐
│ ╔═══════════════════════════════════╗   │ ← Frameless Window
│ ║ [Viewport] [Terminal]         [X] ║   │ ← Custom titlebar
│ ╠═══════════════════════════════════╣   │
│ ║                                   ║   │
│ ║     🔥 Камин (компиляция)        ║   │
│ ║                                   ║   │
│ ║     или                           ║   │
│ ║                                   ║   │
│ ║     🎮 Игра (Bevy window)        ║   │
│ ║                                   ║   │
│ ╚═══════════════════════════════════╝   │
└─────────────────────────────────────────┘
```

## Преимущества

✅ **Простота** - не нужен сложный embedding
✅ **Производительность** - нативное окно Bevy
✅ **Гибкость** - можно перемещать, ресайзить
✅ **Кастомный UI** - свой дизайн titlebar
✅ **Независимость** - не блокирует главное окно

## Архитектура

### 1. Main Process (gameRunner.ts)
- Создает BrowserWindow с frame: false
- Загружает gameViewport.html
- Управляет процессом cargo
- Передает вывод в окно

### 2. Game Window (gameViewport.html)
- Кастомный titlebar с табами
- Viewport для игры
- Terminal для логов
- Управление окном (minimize/maximize/close)

### 3. IPC Communication
```
Main Window → Main Process: "void-create-game-window"
Main Process → Game Window: создает окно
Game Window → Main Process: "void-window-close"
Main Process → Game Window: "game-output", "compilation-progress"
```

## Реализация

### Создание окна
```typescript
const gameWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,           // Без стандартной рамки
    transparent: false,
    parent: parentWindow,   // Привязка к главному окну
    modal: false
});
```

### Кастомный titlebar
- Drag region для перемещения окна
- Кнопки minimize/maximize/close
- Табы Viewport/Terminal
- Стилизация под Void Engine

### Встраивание игры
Bevy создает свое окно как обычно, но:
- Окно появляется поверх viewport
- Можно передать parent window handle
- Или использовать window positioning

## Следующие шаги

1. ✅ Создать frameless window
2. ✅ Кастомный titlebar
3. ✅ Viewport и Terminal табы
4. ⏳ Интеграция с cargo build
5. ⏳ Передача прогресса компиляции
6. ⏳ Запуск Bevy игры
7. ⏳ Позиционирование Bevy окна

## Альтернативы

### Вариант A: Embedded (сложнее)
- Bevy рендерит в наш viewport через window handle
- Требует platform-specific код
- Больше контроля

### Вариант B: Separate Window (текущий) ⭐
- Bevy создает свое окно
- Проще реализация
- Нативная производительность

## Статус

- ✅ Frameless window создан
- ✅ Custom titlebar реализован
- ✅ Viewport/Terminal табы
- ✅ IPC handlers
- ⏳ Интеграция с cargo (в процессе)


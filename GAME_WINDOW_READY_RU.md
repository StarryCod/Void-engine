# 🎮 Окно игры готово к тестированию!

## Что было сделано

Мы создали **отдельное frameless окно** для Void Game Runner с полным кастомным UI:

### ✅ Реализованные функции

1. **Кастомный titlebar** с поддержкой перетаскивания
2. **Две вкладки**: Viewport (сцена компиляции) и Terminal (вывод cargo)
3. **Кнопки управления окном**: Minimize, Maximize, Close
4. **Прогресс компиляции** с progress bar и текстом статуса
5. **Terminal с авто-скроллом** и стилизованным оранжевым скроллбаром
6. **IPC коммуникация** для передачи прогресса в реальном времени

### 📁 Измененные файлы

- `gameRunner.ts` - Создание окна с inline HTML (обход ограничений file://)
- `gameViewportPreload.ts` - IPC мост для безопасной коммуникации
- `voidGameRunner.contribution.ts` - Вызов создания окна перед компиляцией
- `app.ts` - Регистрация IPC handlers

## 🧪 Как протестировать

### Шаг 1: Перезапустите VSCode
Закройте и откройте VSCode заново, чтобы загрузить новый скомпилированный код.

### Шаг 2: Откройте Rust/Bevy проект
Откройте любой workspace с файлом Cargo.toml.

### Шаг 3: Нажмите F5
Это должно:
1. Создать окно игры (появится сразу)
2. Начать компиляцию
3. Показать прогресс в окне
4. Вывести логи в terminal

## 🎯 Ожидаемое поведение

### Внешний вид окна
- Frameless окно с темным кастомным titlebar
- Заголовок: "🎮 Void Game Runner"
- Две вкладки: "Viewport" и "Terminal"
- Три кнопки управления (minimize, maximize, close)

### Вкладка Viewport (по умолчанию)
- Текст "Compiling..."
- Анимированный progress bar во время компиляции
- Обновляющийся текст статуса

### Вкладка Terminal
- Вывод компиляции cargo
- Авто-скролл вниз
- Оранжевый градиентный скроллбар
- Текст можно выделять (Ctrl+A работает)

### Управление окном
- **Minimize**: Сворачивает окно
- **Maximize**: Переключает maximize/restore
- **Close**: Закрывает окно и останавливает процесс игры

## ⚠️ Текущие ограничения

1. **Нет встроенного viewport игры**
   - Игра Bevy все еще открывается в своем нативном окне
   - Встраивание требует offscreen rendering (сложно, будущая работа)

2. **Передача прогресса**
   - IPC настроен, но нужно протестировать
   - Должен показывать прогресс cargo build в реальном времени

## 🔧 Технические детали

### Почему inline HTML?
Electron блокирует загрузку локальных HTML файлов через `file://` протокол из соображений безопасности. Мы используем `data:` URL протокол с inline HTML вместо этого.

### IPC каналы
Все каналы должны начинаться с префикса `vscode:` (требование безопасности VSCode):
- `vscode:void-create-game-window` - Создание окна
- `vscode:void-forward-progress` - Передача прогресса
- `vscode:void-launch-game` - Запуск игры
- `vscode:void-stop-game` - Остановка игры
- `vscode:void-close-game-window` - Закрытие окна
- `vscode:void-window-minimize` - Свернуть
- `vscode:void-window-maximize` - Развернуть
- `vscode:void-window-close` - Закрыть

### Preload Script
Экспортирует безопасные IPC методы в renderer:
- `window.electronAPI.minimizeWindow()`
- `window.electronAPI.maximizeWindow()`
- `window.electronAPI.closeWindow()`
- `window.electronAPI.onGameOutput(callback)`
- `window.electronAPI.onCompilationProgress(callback)`

## 🐛 Устранение неполадок

### Окно не появляется
- Проверьте DevTools консоль на ошибки (Help → Toggle Developer Tools)
- Проверьте, зарегистрированы ли IPC handlers (ищите логи "[Game Runner IPC]")

### Окно появляется, но нет UI
- Проверьте, скомпилирован ли preload script (должен быть в out/vs/code/electron-main/)
- Откройте консоль браузера в окне игры (Ctrl+Shift+I)

### Прогресс не обновляется
- Проверьте, работает ли IPC forwarding
- Ищите в консоли "[Game Runner] Game window created with ID:"

## 📊 Архитектура

```
Нажатие F5
   ↓
VoidGameRunnerContribution.buildAndRun()
   ↓
gameWindowService.createGameWindow()
   ↓
IPC: vscode:void-create-game-window
   ↓
gameRunner.ts создает BrowserWindow
   ↓
Загружает inline HTML (data: URL)
   ↓
Окно появляется с кастомным UI
   ↓
CargoService.runRelease() начинает компиляцию
   ↓
Прогресс → VoidGameRunnerContribution
   ↓
IPC: vscode:void-forward-progress
   ↓
gameRunner.ts → game window
   ↓
UI обновляется (progress bar, статус)
```

## 🚀 Следующие шаги

Если окно появляется и работает:
1. ✅ Протестировать переключение вкладок (Viewport ↔ Terminal)
2. ✅ Протестировать кнопки управления окном
3. ✅ Протестировать отображение прогресса компиляции
4. ✅ Протестировать вывод в terminal
5. 🔄 Будущее: Встроить реальный viewport игры Bevy (требует offscreen rendering)

## 💡 Что дальше?

После успешного тестирования можно:
- Добавить кнопку "Stop" для остановки игры
- Улучшить анимацию загрузки
- Добавить обработку ошибок компиляции
- Начать работу над встраиванием viewport Bevy (сложная задача)

---

**Статус**: ✅ Готово к тестированию  
**Компиляция**: ✅ Без ошибок  
**Watcher**: ✅ Работает  

Просто перезапустите VSCode и нажмите F5 в Rust проекте!

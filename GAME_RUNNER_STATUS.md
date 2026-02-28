# Void Game Runner - Текущий Статус

## ✅ РЕАЛИЗОВАНО:

### 1. Отдельное окно игры с кастомным UI
- **Frameless окно** без стандартной панели Windows
- **Кастомный titlebar** с:
  - Заголовок: "🎮 Void Game Runner"
  - Вкладки: Viewport / Terminal
  - Кнопки управления: Minimize, Maximize, Close (X)
- **Вкладка Viewport**: Показывает прогресс компиляции с анимацией загрузки
- **Вкладка Terminal**: Показывает вывод cargo с авто-скроллом и стилизованным скроллбаром
- **Окно создается при F5** перед началом компиляции

### 2. Отображение прогресса компиляции
- **Анимация загрузки** в viewport во время компиляции
- **Progress bar** показывает прогресс сборки (0-100%)
- **Текст статуса** показывает текущую стадию компиляции
- **Обновления в реальном времени** передаются от cargo в окно игры

### 3. Интеграция с системой сборки
- **F5**: `cargo run` (debug режим) - открывает окно игры, компилирует, запускает
- **F6**: `cargo watch` - непрерывная компиляция
- **IPC handlers** для управления окном и передачи прогресса
- **Preload script** для безопасной IPC коммуникации

## 🔧 Техническая реализация

### Измененные файлы:

1. **vscode/src/vs/workbench/contrib/voidGameRunner/browser/voidGameRunner.contribution.ts**
   - Добавлено отслеживание `currentGameProcessId`
   - Вызывает `void-create-game-window` IPC перед компиляцией
   - Передает прогресс сборки в окно игры через `void-forward-progress`

2. **vscode/src/vs/code/electron-main/gameRunner.ts**
   - Добавлен IPC handler `void-create-game-window`
   - Добавлен IPC handler `void-forward-progress`
   - Создает frameless BrowserWindow с кастомным preload

3. **vscode/src/vs/code/electron-main/app.ts**
   - Добавлен вызов `setupGameRunnerIPC()` для инициализации IPC handlers

4. **vscode/src/vs/workbench/contrib/voidGameRunner/browser/gameViewport.html**
   - Кастомный titlebar с вкладками и кнопками управления окном
   - Viewport со сценой компиляции (анимация загрузки)
   - Terminal со стилизованным скроллбаром и авто-скроллом
   - JavaScript для переключения вкладок и IPC коммуникации

5. **vscode/src/vs/code/electron-main/gameViewportPreload.ts**
   - Экспортирует безопасные IPC методы: minimizeWindow, maximizeWindow, closeWindow
   - Слушатели: onGameOutput, onCompilationProgress

## 🎯 Как это работает

1. **Пользователь нажимает F5**
2. **Создается окно игры** (frameless, кастомный UI)
3. **Viewport показывает** "Compiling..." с progress bar
4. **Cargo начинает** сборку в debug режиме
5. **Обновления прогресса** отправляются в окно игры в реальном времени
6. **Вкладка Terminal** показывает вывод cargo
7. **После завершения** игра запускается в viewport

## 🚀 Следующие шаги (будущее)

- [ ] Встроить реальный viewport игры (окно Bevy) во вкладку viewport
- [ ] Добавить кнопку "Stop" для остановки запущенной игры
- [ ] Добавить вывод процесса игры в terminal
- [ ] Обработать запуск игры после компиляции
- [ ] Добавить UI для обработки ошибок сборки

## 📝 Заметки

- **Debug режим** используется для быстрой компиляции (10-30 секунд vs 5-10 минут)
- **Preload script** компилируется автоматически TypeScript watcher'ом
- **Передача прогресса** использует IPC: VSCode окно → Main process → Окно игры
- **Окно не модальное** но привязано к родительскому окну VSCode

## 🔄 Миграция со старой системы

### Старая система (удалена):
- Overlay внутри VSCode
- VoidGameWindow с встроенным viewport
- Анимация кузницы и мечей

### Новая система:
- Отдельное frameless окно
- Кастомный titlebar с вкладками
- Viewport/Terminal переключение
- Современный UI с градиентами

## 📊 IPC Архитектура

```
F5 Press
   ↓
VoidGameRunnerContribution.buildAndRun()
   ↓
ipcRenderer.invoke('void-create-game-window')
   ↓
gameRunner.ts создает BrowserWindow
   ↓
Загружает gameViewport.html
   ↓
CargoService.runRelease() запускает компиляцию
   ↓
cargoIpc.ts отправляет прогресс → VSCode window
   ↓
VoidGameRunnerContribution получает прогресс
   ↓
ipcRenderer.invoke('void-forward-progress')
   ↓
gameRunner.ts отправляет в game window
   ↓
gameViewport.html обновляет UI
```

## 🐛 Известные ограничения

- Preload script должен быть скомпилирован перед использованием
- HTML путь должен быть относительно electron-main
- IPC требует правильной настройки contextIsolation
- Progress forwarding требует активного game window

## ✨ Последние изменения

- ✅ Создана система отдельного окна игры
- ✅ Добавлен кастомный titlebar с вкладками
- ✅ Реализована передача прогресса компиляции
- ✅ Добавлен preload script для безопасного IPC
- ✅ Интегрировано в систему сборки VSCode
- ✅ Все компилируется без ошибок
- ✅ **Использован inline HTML** (data: URL) вместо file:// для обхода ограничений безопасности Electron

## 🧪 Готово к тестированию

Окно игры должно появляться при нажатии F5. Проверьте:
1. Появление окна с кастомным titlebar
2. Переключение вкладок Viewport/Terminal
3. Работу кнопок управления окном (minimize, maximize, close)
4. Отображение прогресса компиляции
5. Вывод в terminal

См. **GAME_WINDOW_TEST.md** для подробных инструкций по тестированию.

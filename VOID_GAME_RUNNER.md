# Void Game Runner - Cargo Integration

Простая интеграция с Cargo для запуска и отладки Rust/Bevy проектов.

## Кнопки в тулбаре

### F5 - Run Release (▶️)
- **Команда**: `cargo run --release`
- **Описание**: Компилирует и запускает проект в release режиме
- **Иконка**: Треугольник (play button) с закругленными углами
- **Цвет**: Светло-серый (#cccccc), при наведении фон становится темнее

### F6 - Cargo Watch (🕐)
- **Команда**: `cargo watch -x run`
- **Описание**: Запускает cargo watch для автоматической перекомпиляции при изменении файлов
- **Иконка**: Часы (clock icon)
- **Цвет**: Светло-серый (#cccccc), при наведении фон становится темнее

## Архитектура

### Frontend (Renderer Process)
- **VoidGameRunnerToolbar** - UI кнопки в тулбаре
- **CargoService** (electron-sandbox) - Сервис для взаимодействия с main process через IPC

### Backend (Main Process)
- **cargoIpc.ts** - IPC обработчики для выполнения cargo команд
- Использует `child_process.spawn` для запуска cargo

## IPC Каналы

- `cargo-check-available` - Проверка доступности cargo
- `cargo-run-release` - Запуск `cargo run --release`
- `cargo-watch` - Запуск `cargo watch -x run`
- `cargo-stop` - Остановка всех процессов
- `cargo-cleanup` - Очистка при закрытии окна
- `cargo-build-progress` - События прогресса компиляции (от main к renderer)

## Файлы

### Browser (Renderer)
- `vscode/src/vs/workbench/contrib/voidGameRunner/browser/voidGameRunnerToolbar.ts`
- `vscode/src/vs/workbench/contrib/voidGameRunner/browser/voidGameRunner.contribution.ts`
- `vscode/src/vs/workbench/contrib/voidGameRunner/browser/media/voidGameRunnerToolbar.css`

### Electron Sandbox
- `vscode/src/vs/workbench/contrib/voidGameRunner/electron-sandbox/cargoService.ts`

### Common
- `vscode/src/vs/workbench/contrib/voidGameRunner/common/cargoService.ts`
- `vscode/src/vs/workbench/contrib/voidGameRunner/common/voidGameRunnerCommands.ts`

### Main Process
- `vscode/src/vs/code/electron-main/cargoIpc.ts`

## Использование

1. Открыть Rust/Bevy проект в VSCode
2. Нажать **F5** для запуска в release режиме
3. Нажать **F6** для запуска cargo watch (автоматическая перекомпиляция)

## Требования

- Rust и Cargo должны быть установлены
- Для F6 требуется `cargo-watch`: `cargo install cargo-watch`

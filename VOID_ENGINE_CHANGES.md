ут выдавать ошибки импорта.
Нужно будет либо:
1. Закомментировать импорты в других файлах
2. Создать пустые заглушки для удаленных модулей
3. Полностью удалить зависимости

Рекомендую сначала протестировать с закомментированными импортами.
- добавить индикатор состояния компиляции
5. **Удаление файлов** - физически удалить ненужные contribution файлы

## 📝 Команды для компиляции

```bash
cd vscode
npm install
npm run compile
npm run watch  # для разработки
```

## 🎨 Void Dark Theme

Тема уже оптимизирована для game development:
- Темный фон (#1a1a1a, #1e1e1e)
- Белые акценты (#ffffff)
- Минимальные цвета (черный/белый/серый/красный)
- Отличная контрастность
- Фокус на коде, а не на UI

## ⚠️ Важно

После удаления contributions некоторые файлы могтика

**Удалено модулей:** ~80+
**Осталось модулей:** ~30
**Сокращение:** ~73%

## 🎯 Результат

Void Engine теперь:
- ✅ Минималистичный и быстрый
- ✅ Сфокусирован на game development (Bevy + Rust)
- ✅ Кнопка Play всегда видна в тулбаре
- ✅ Нет лишних функций от VSCode
- ✅ Чистый интерфейс для творчества

## 🚀 Следующие шаги

1. **Компиляция проекта** - пересобрать VSCode с изменениями
2. **Тестирование** - проверить что все работает
3. **Тема void_dark** - сделать единственной темой по умолчанию
4. **Статус-бар**  `accessibility.contribution.js` - базовая доступность

#### Void Engine Specific
- ✅ `voidStartupLoader.contribution.js` - загрузчик
- ✅ `voidWelcome.contribution.js` - welcome screen
- ✅ `voidPlayButton.contribution.js` - **PLAY BUTTON**
- ✅ `voidMenu.contribution.js` - меню

#### Misc
- ✅ `url.contribution.js` - URL support
- ✅ `dropOrPasteInto.contribution.js` - drag & drop
- ✅ `editTelemetry.contribution.js` - базовая телеметрия редактирования
- ✅ `opener.contribution.js` - открытие файлов

## 📊 Статисcontribution.js` - сниппеты (Rust/Bevy)
- ✅ `folding.contribution.js` - сворачивание кода
- ✅ `inlineCompletions.contribution.js` - автодополнение
- ✅ `codeActions.contribution.js` - code actions
- ✅ `inlayHints` - подсказки

#### Outline & Navigation
- ✅ `outline.contribution.js` - outline view
- ✅ `documentSymbolsOutline.js`

#### Workspace
- ✅ `workspace.contribution.js` - базовая работа с workspace

#### UI & Layout
- ✅ `sash.contribution.js` - разделители панелей
- ✅ `list.contribution.js` - списки
- ✅earch.contribution.js` - поиск в файлах
- ✅ `searchView.js`

#### Terminal
- ✅ `terminal.all.js` - терминал (для cargo)

#### Output & Logs
- ✅ `output.contribution.js` - output panel
- ✅ `outputView.js`
- ✅ `logs.contribution.js`

#### Markers & Problems
- ✅ `markers.contribution.js` - проблемы/ошибки

#### Commands & Quick Access
- ✅ `commands.contribution.js`
- ✅ `quickAccess.contribution.js`

#### Preferences
- ✅ `preferences.contribution.js` - базовые настройки

#### Snippets & Code Features
- ✅ `snippets.звуковые сигналы
- ❌ `share.contribution.js` - шаринг
- ❌ `scrollLocking.contribution.js` - синхронная прокрутка

**Файл:** `vscode/src/vs/workbench/workbench.common.main.ts`

### 3. Что ОСТАЛОСЬ (минимальный набор для Void Engine)

#### Core Editor
- ✅ `editor.all.js` - базовый редактор
- ✅ `codeEditor.contribution.js` - code editor

#### File Management
- ✅ `explorerViewlet.js` - file explorer
- ✅ `fileActions.contribution.js`
- ✅ `files.contribution.js`
- ✅ `bulkEdit` - массовое редактирование

#### Search
- ✅ `s

#### Hierarchy & Navigation
- ❌ `callHierarchy.contribution.js` - call hierarchy
- ❌ `typeHierarchy.contribution.js` - type hierarchy

#### Authentication & Sync
- ❌ `authentication.contribution.js` - аутентификация
- ❌ `userDataSync.contribution.js` - синхронизация
- ❌ `userDataProfile.contribution.js` - профили
- ❌ `editSessions.contribution.js` - edit sessions

#### Workspaces
- ❌ `workspaces.contribution.js` - управление workspace

#### Accessibility & Misc
- ❌ `accessibilitySignals.contribution.js` - ## Formatting
- ❌ `format.contribution.js` - formatter help

#### Themes & UI
- ❌ `themes.contribution.js` - редактор тем (void_dark единственная тема)

#### Updates & Surveys
- ❌ `update.contribution.js` - проверка обновлений
- ❌ `nps.contribution.js` - NPS опросы
- ❌ `languageSurveys.contribution.js` - опросы по языкам

#### Welcome Screens
- ❌ `welcomeGettingStarted.contribution.js` (заменено на Void Welcome)
- ❌ `walkThrough.contribution.js`
- ❌ `viewsWelcome.contribution.js`
- ❌ `newFile.contribution.js`r)

#### Tasks & Build
- ❌ `tasks.contribution.js` - tasks (заменено на Void Play Button)
- ❌ `relauncher.contribution.js`

#### Language Features
- ❌ `emmet.contribution.js` - Emmet
- ❌ `markdown.contribution.js` - Markdown
- ❌ `languageDetection.contribution.js` - определение языка
- ❌ `languageStatus.contribution.js` - статус языка

#### Keybindings & Preferences
- ❌ `keybindings.contribution.js` - редактор горячих клавиш
- ❌ `keybindingsEditorContribution.js`
- ❌ `preferencesSearch.js` - поиск в настройках

##ion.js` - process explorer

#### Comments & Collaboration
- ❌ `comments.contribution.js` - комментарии в коде

#### Webview & Extensions
- ❌ `webview.contribution.js` - webview
- ❌ `webviewPanel.contribution.js`
- ❌ `webviewView.contribution.js`
- ❌ `customEditor.contribution.js`
- ❌ `extensions.contribution.js` - marketplace расширений
- ❌ `extensionsViewlet.js`

#### External & Remote
- ❌ `externalUriOpener.contribution.js`
- ❌ `externalTerminal.contribution.js`
- ❌ `remote.contribution.js` (common & browse❌ `localHistory.contribution.js` - локальная история

#### Debug
- ❌ `debug.contribution.js` - отладчик (заменен на Void Play Button)
- ❌ `debugEditorContribution.js`
- ❌ `breakpointEditorContribution.js`
- ❌ `callStackEditorContribution.js`
- ❌ `repl.js` - debug REPL
- ❌ `debugViewlet.js`

#### Search & Diff
- ❌ `searchEditor.contribution.js` - редактор поиска
- ❌ `mergeEditor.contribution.js` - merge editor
- ❌ `multiDiffEditor.contribution.js` - multi diff

#### Process & System
- ❌ `processExplorer.contributChat & AI
- ❌ `chat.contribution.js` - AI чат
- ❌ `inlineChat.contribution.js` - inline AI
- ❌ `mcp.contribution.js` - MCP протокол
- ❌ `chatSessions` - сессии чата
- ❌ `chatContext` - контекст чата
- ❌ `remoteCodingAgents` - удаленные AI агенты

#### Speech & Voice
- ❌ `speech.contribution.js` - голосовой ввод

#### Testing
- ❌ `testing.contribution.js` - фреймворк тестирования

#### Source Control & Git
- ❌ `scm.contribution.js` - source control management
- ❌ `timeline.contribution.js` - timeline view
- PlayButton.ts`

### 2. Очистка workbench.common.main.ts - Удалены ненужные модули

**Полностью удалены (закомментированы):**

#### Telemetry & Analytics
- ❌ `telemetry.contribution.js` - телеметрия
- ❌ `performance.contribution.js` - мониторинг производительности
- ❌ `bracketPairColorizer2Telemetry` - телеметрия скобок

#### Notebook & Interactive
- ❌ `notebook.contribution.js` - поддержка Jupyter notebooks
- ❌ `interactive.contribution.js` - интерактивные окна
- ❌ `repl.contribution.js` - REPL notebooks

#### VoidPlayButton - Исправлена видимость
**Проблема:** Кнопка Play не отображалась в тулбаре
**Решение:**
- Изменен MenuId с `z_end` на `navigation` (высокий приоритет)
- Добавлена регистрация в двух меню: `LayoutControlMenu` и `TitleBar`
- Убрано условие `when` - кнопка теперь ВСЕГДА видна
- Увеличен вес keybinding до 200 (максимальный приоритет)
- Добавлен Shift+F5 для остановки игры

**Файл:** `vscode/src/vs/workbench/contrib/voidPlayButton/browser/void# Void Engine - Изменения и Оптимизация

## ✅ Выполнено

### 1. 
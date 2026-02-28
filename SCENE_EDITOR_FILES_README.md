# Scene Editor - All Files

## Файл: SCENE_EDITOR_ALL_FILES.txt

Этот файл содержит **полное содержимое всех файлов** Scene Editor в одном месте.

### Что внутри:

#### Core Files (Основные)
1. **voidSceneEditor.contribution.ts** - главный контроллер, синхронизация, автосохранение
2. **voidSceneEditorToolbar.ts** - тулбар с кнопками Script/2D/3D
3. **inspectorView.ts** - инспектор свойств (справа вверху)
4. **threeViewport.ts** - 3D viewport с WebGL2, гизмо W/E/R
5. **viewport2D.ts** - 2D viewport (заглушка)
6. **viewport3D.ts** - 3D viewport (старая версия)
7. **vecnEditorProvider.ts** - провайдер для .vecn файлов
8. **addObjectDialog.ts** - диалог добавления объектов

#### Common Files (Общие)
9. **vecnParser.ts** - парсер .vecn формата
10. **vecnTypes.ts** - типы данных (Entity, Component, etc.)
11. **vecnSceneBus.ts** - event bus для синхронизации
12. **voidSceneEditor.ts** - общие типы и интерфейсы

#### UI Files (Интерфейс)
13. **voidSceneEditorToolbar.css** - стили тулбара
14. **sceneHierarchyView.ts** - древо сцены в Explorer
15. **sceneHierarchyView.css** - стили древа сцены

### Размер:
- **~182 KB** (186,738 bytes)
- **~5,000 строк кода**

### Структура файла:

```
================================================================================
FILE: путь/к/файлу.ts
Lines: количество строк
================================================================================

[полное содержимое файла]

================================================================================
FILE: следующий/файл.ts
...
```

### Как использовать:

1. **Просмотр кода** - открой в любом текстовом редакторе
2. **Поиск** - используй Ctrl+F для поиска по всем файлам сразу
3. **Копирование** - скопируй нужный файл целиком
4. **Бэкап** - сохрани этот файл как резервную копию

### Обновление:

Чтобы обновить файл с актуальным содержимым:

```powershell
cd vscode
# Запусти скрипт создания (см. ниже)
```

### Скрипт создания:

```powershell
$output = "SCENE_EDITOR_ALL_FILES.txt"

$files = @(
    "src/vs/workbench/contrib/voidSceneEditor/browser/voidSceneEditor.contribution.ts",
    "src/vs/workbench/contrib/voidSceneEditor/browser/voidSceneEditorToolbar.ts",
    "src/vs/workbench/contrib/voidSceneEditor/browser/inspectorView.ts",
    "src/vs/workbench/contrib/voidSceneEditor/browser/threeViewport.ts",
    # ... и т.д.
)

foreach ($file in $files) {
    $fullPath = $file
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw -Encoding UTF8
        $lineCount = ($content -split "`n").Count
        
        @"

================================================================================
FILE: $file
Lines: $lineCount
================================================================================

$content

"@ | Out-File -FilePath $output -Append -Encoding UTF8
    }
}
```

### Полезные команды:

#### Найти все использования функции:
```powershell
Select-String -Path "SCENE_EDITOR_ALL_FILES.txt" -Pattern "updateFromViewport"
```

#### Посчитать строки кода:
```powershell
(Get-Content "SCENE_EDITOR_ALL_FILES.txt" | Measure-Object -Line).Lines
```

#### Найти все TODO:
```powershell
Select-String -Path "SCENE_EDITOR_ALL_FILES.txt" -Pattern "TODO|FIXME"
```

### Что НЕ включено:

- Скомпилированные файлы (.js)
- Node modules
- Тесты
- Документация (MD файлы)

### Связанные файлы:

- `OPTIMIZATION_COMPLETE_RU.md` - документация по оптимизации
- `READY_TO_TEST_RU.md` - инструкции по тестированию
- `SCENE_EDITOR_STATUS.md` - статус разработки

---

**Создано**: 2026-02-12  
**Версия**: 1.0  
**Размер**: ~182 KB  
**Файлов**: 15

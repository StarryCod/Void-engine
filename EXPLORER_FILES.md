# VS Code Explorer (File Tree) - Все файлы

## Основные компоненты

### Views (Визуальная часть)
- `src/vs/workbench/contrib/files/browser/views/explorerView.ts` - Главный view с деревом файлов
- `src/vs/workbench/contrib/files/browser/views/explorerViewer.ts` - Рендеринг дерева (TreeRenderer)
- `src/vs/workbench/contrib/files/browser/views/explorerDecorationsProvider.ts` - Декорации (иконки, цвета)
- `src/vs/workbench/contrib/files/browser/views/emptyView.ts` - Пустое состояние
- `src/vs/workbench/contrib/files/browser/views/openEditorsView.ts` - Открытые редакторы

### Core (Логика)
- `src/vs/workbench/contrib/files/common/explorerModel.ts` - Модель данных дерева
- `src/vs/workbench/contrib/files/browser/explorerService.ts` - Сервис управления Explorer
- `src/vs/workbench/contrib/files/browser/explorerViewlet.ts` - Viewlet контейнер

### Actions (Действия)
- `src/vs/workbench/contrib/files/browser/fileActions.ts` - Действия с файлами
- `src/vs/workbench/contrib/files/browser/fileCommands.ts` - Команды
- `src/vs/workbench/contrib/files/browser/fileActions.contribution.ts` - Регистрация действий

### Contribution (Регистрация)
- `src/vs/workbench/contrib/files/browser/files.contribution.ts` - Главная регистрация
- `src/vs/workbench/contrib/files/browser/files.ts` - Константы и интерфейсы
- `src/vs/workbench/contrib/files/browser/fileConstants.ts` - Константы

### Дополнительно
- `src/vs/workbench/contrib/files/common/explorerFileNestingTrie.ts` - Вложенность файлов
- `src/vs/workbench/contrib/files/browser/explorerFileContrib.ts` - Дополнительный функционал
- `src/vs/workbench/contrib/files/browser/workspaceWatcher.ts` - Отслеживание изменений

## Структура

```
files/
├── browser/
│   ├── views/
│   │   ├── explorerView.ts          ← Главный view
│   │   ├── explorerViewer.ts        ← Рендеринг дерева
│   │   ├── explorerDecorationsProvider.ts
│   │   ├── emptyView.ts
│   │   └── openEditorsView.ts
│   ├── explorerService.ts           ← Сервис
│   ├── explorerViewlet.ts           ← Контейнер
│   ├── fileActions.ts
│   ├── fileCommands.ts
│   └── files.contribution.ts        ← Регистрация
└── common/
    ├── explorerModel.ts             ← Модель данных
    └── files.ts
```

## Как работает

1. **files.contribution.ts** регистрирует Explorer в workbench
2. **explorerViewlet.ts** создает контейнер для views
3. **explorerView.ts** создает дерево файлов
4. **explorerViewer.ts** рендерит элементы дерева
5. **explorerModel.ts** хранит данные о файлах/папках
6. **explorerService.ts** управляет состоянием и действиями

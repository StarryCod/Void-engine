# Explorer File Tree — Структура файлов

## Основные файлы древа файлов (Explorer)

### 1. **explorerView.ts** — Главный вид Explorer
**Путь**: `vscode/src/vs/workbench/contrib/files/browser/views/explorerView.ts`

**Что делает**:
- Главный класс `ExplorerView extends ViewPane`
- Управляет деревом файлов (WorkbenchCompressibleAsyncDataTree)
- Содержит Scene Hierarchy интеграцию (split view)
- Рендерит сущности сцены и компоненты
- Drag & Drop для сущностей
- Контекстное меню для объектов

**Ключевые компоненты**:
```typescript
export class ExplorerView extends ViewPane implements IExplorerView {
    private tree!: WorkbenchCompressibleAsyncDataTree<...>;
    private filter!: FilesFilter;
    private renderer!: FilesRenderer;
    
    // Scene Hierarchy
    private splitView!: SplitView;
    private sceneHierarchyContainer!: HTMLElement;
    private projectFilesContainer!: HTMLElement;
    private sceneManager!: SceneManager;
}
```

**Методы Scene Hierarchy**:
- `refreshSceneHierarchy()` — обновляет дерево сцены
- `renderEntity()` — рендерит сущность с drag&drop
- `renderComponent()` — рендерит компонент
- `showEntityContextMenu()` — контекстное меню
- `renderSceneHierarchy()` — создает UI панели

---

### 2. **explorerViewer.ts** — Рендереры и провайдеры данных
**Путь**: `vscode/src/vs/workbench/contrib/files/browser/views/explorerViewer.ts`

**Что делает**:
- `ExplorerDelegate` — высота элементов (22px)
- `ExplorerDataSource` — источник данных для дерева
- `FilesRenderer` — рендерер файлов/папок
- `FilesFilter` — фильтрация файлов
- `FileSorter` — сортировка
- `FileDragAndDrop` — drag & drop файлов
- `ExplorerFindProvider` — поиск в Explorer

**Ключевые классы**:
```typescript
export class ExplorerDelegate implements IListVirtualDelegate<ExplorerItem> {
    static readonly ITEM_HEIGHT = 22;
}

export class ExplorerDataSource implements IAsyncDataSource<...> {
    hasChildren(element): boolean
    getChildren(element): ExplorerItem[] | Promise<ExplorerItem[]>
}

export class FilesRenderer implements ICompressibleTreeRenderer<...> {
    renderTemplate(container): IFileTemplateData
    renderElement(node, index, templateData): void
}

export class ExplorerFindProvider implements IAsyncFindProvider<ExplorerItem> {
    // Поиск файлов в дереве
    find(pattern, toggles, token): Promise<IAsyncFindResult>
}
```

---

### 3. **explorerViewlet.ts** — Контейнер Explorer
**Путь**: `vscode/src/vs/workbench/contrib/files/browser/explorerViewlet.ts`

**Что делает**:
- `ExplorerViewPaneContainer` — контейнер для всех панелей Explorer
- Регистрация видов (ExplorerView, OpenEditorsView, EmptyView)
- Управление видимостью панелей

**Ключевые классы**:
```typescript
export class ExplorerViewPaneContainer extends ViewPaneContainer {
    getExplorerView(): ExplorerView
    getOpenEditorsView(): OpenEditorsView
}

export class ExplorerViewletViewsContribution {
    // Регистрирует виды в зависимости от состояния workspace
    private registerViews(): void
}
```

---

### 4. **explorerViewSplit.css** — Стили для split view
**Путь**: `vscode/src/vs/workbench/contrib/files/browser/views/explorerViewSplit.css`

Стили для Scene Hierarchy и Project Files split view.

---

## Связанные файлы

### 5. **sceneManager.ts** — Менеджер сцены
**Путь**: `vscode/src/vs/workbench/contrib/files/browser/sceneManager.ts`

Управляет загрузкой, сохранением и модификацией .vecn файлов.

### 6. **sceneHierarchyView.ts** (старый)
**Путь**: `vscode/src/vs/workbench/contrib/files/browser/views/sceneHierarchyView.ts`

Старая реализация Scene Hierarchy (может быть устаревшей).

### 7. **addObjectDialog.ts** — Диалог добавления объектов
**Путь**: `vscode/src/vs/workbench/contrib/files/browser/dialogs/addObjectDialog.ts`

Диалог для создания новых объектов в сцене.

---

## Архитектура Explorer Tree

```
ExplorerViewPaneContainer (explorerViewlet.ts)
    │
    ├─ OpenEditorsView
    │
    └─ ExplorerView (explorerView.ts)
        │
        ├─ SplitView
        │   ├─ Scene Hierarchy Container
        │   │   └─ SceneManager → renders entities/components
        │   │
        │   └─ Project Files Container
        │       └─ WorkbenchCompressibleAsyncDataTree
        │           ├─ ExplorerDelegate (height)
        │           ├─ ExplorerDataSource (data)
        │           ├─ FilesRenderer (render)
        │           ├─ FilesFilter (filter)
        │           ├─ FileSorter (sort)
        │           └─ FileDragAndDrop (dnd)
        │
        └─ ExplorerFindProvider (search)
```

---

## Как работает дерево файлов

1. **Инициализация**:
   - `ExplorerView.renderBody()` создает дерево
   - `WorkbenchCompressibleAsyncDataTree` — основной компонент дерева
   - Использует `ExplorerDataSource` для получения данных

2. **Рендеринг**:
   - `FilesRenderer.renderElement()` рендерит каждый файл/папку
   - Использует `ResourceLabels` для отображения имен
   - Применяет иконки и декорации

3. **Взаимодействие**:
   - Клики обрабатываются через `onDidOpen` event
   - Drag & Drop через `FileDragAndDrop`
   - Контекстное меню через `onContextMenu`

4. **Обновление**:
   - `ExplorerService.refresh()` обновляет дерево
   - `tree.rerender()` перерисовывает элементы
   - File watcher отслеживает изменения на диске

---

## Интеграция Scene Hierarchy

В `explorerView.ts` добавлен split view:

```typescript
// Split view for Scene Hierarchy + Project Files
private splitView!: SplitView;
private sceneHierarchyContainer!: HTMLElement;
private projectFilesContainer!: HTMLElement;
private sceneManager!: SceneManager;
```

**Методы**:
- `renderSceneHierarchy()` — создает UI панели Scene Hierarchy
- `refreshSceneHierarchy()` — обновляет дерево сцены
- `renderEntity()` — рендерит сущность с drag&drop
- `renderComponent()` — рендерит компонент сущности

---

## Ключевые интерфейсы

```typescript
interface ExplorerItem {
    resource: URI;
    name: string;
    isDirectory: boolean;
    children: Map<string, ExplorerItem>;
    parent: ExplorerItem | undefined;
}

interface IExplorerView {
    getContext(respectMultiSelection: boolean): ExplorerItem[];
    refresh(): Promise<void>;
    selectResource(resource: URI): Promise<void>;
}
```

---

## Полезные команды

- `workbench.files.action.focusFilesExplorer` — фокус на Explorer
- `workbench.files.action.refreshFilesExplorer` — обновить дерево
- `workbench.files.action.collapseExplorerFolders` — свернуть все папки

---

## Следующие шаги

Если нужно модифицировать дерево файлов:

1. **Изменить рендеринг** → `explorerViewer.ts` → `FilesRenderer`
2. **Изменить данные** → `explorerViewer.ts` → `ExplorerDataSource`
3. **Добавить функционал** → `explorerView.ts` → `ExplorerView`
4. **Изменить стили** → `explorerViewSplit.css`

Для Scene Hierarchy все уже интегрировано в `explorerView.ts`!

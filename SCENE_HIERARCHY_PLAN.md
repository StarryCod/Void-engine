# Scene Hierarchy в Explorer - План реализации

## Концепция

Разделить стандартный Explorer VS Code на 2 части:

```
┌─────────────────────────┐
│  SCENE HIERARCHY        │ ← 70-80% высоты
│  (Entities/Components)  │
│                         │
│  📦 Main Scene          │
│    └─ 🎮 Player         │
│       ├─ Transform      │
│       ├─ Mesh           │
│       └─ Material       │
│    └─ 💡 Light          │
│       ├─ Transform      │
│       └─ PointLight     │
├─────────────────────────┤ ← Разделитель (resizable)
│  PROJECT FILES          │ ← 20-30% высоты (свернутая)
│  📁 assets              │
│  📁 src                 │
│  📄 Cargo.toml          │
└─────────────────────────┘
```

## Структура для Bevy

### Entity (игровой объект)
```
🎮 Player
  ├─ Transform (position, rotation, scale)
  ├─ Mesh (геометрия)
  ├─ Material (цвет, текстура)
  └─ Script (поведение)
```

### Типы компонентов
- **Transform** - позиция, поворот, масштаб
- **Mesh** - 3D модель (Cube, Sphere, Plane, Custom)
- **Material** - материал (цвет, металличность, шероховатость)
- **Light** - освещение (Point, Directional, Spot)
- **Camera** - камера
- **Script** - пользовательская логика
- **Collider** - физика
- **RigidBody** - физическое тело

## Реализация

### 1. Создать новый View "Scene Hierarchy"

**Файл:** `src/vs/workbench/contrib/files/browser/views/sceneHierarchyView.ts`

```typescript
export class SceneHierarchyView extends ViewPane {
    // Дерево сцены
    private tree: WorkbenchAsyncDataTree;
    
    // Загрузка .vecn файла
    async loadScene(uri: URI): Promise<void> {
        const scene = await parseVecnFile(uri);
        this.tree.setInput(scene.entities);
    }
    
    // Создание нового Entity
    createEntity(name: string): void {
        // Добавить в сцену
    }
}
```

### 2. Модифицировать ExplorerView

**Файл:** `src/vs/workbench/contrib/files/browser/views/explorerView.ts`

Добавить:
- Разделитель (SplitView)
- Верхняя часть: SceneHierarchyView
- Нижняя часть: существующее дерево файлов

```typescript
export class ExplorerView extends ViewPane {
    private splitView: SplitView;
    private sceneHierarchy: SceneHierarchyView;
    private projectFiles: WorkbenchAsyncDataTree; // существующее дерево
    
    constructor() {
        this.splitView = new SplitView();
        this.splitView.addView(this.sceneHierarchy, 0.7); // 70%
        this.splitView.addView(this.projectFiles, 0.3);   // 30%
    }
}
```

### 3. Парсер .vecn файлов

Использовать существующий `VecnParser` из Scene Editor:
- `vscode/src/vs/workbench/contrib/voidSceneEditor/common/vecnParser.ts`
- `vscode/src/vs/workbench/contrib/voidSceneEditor/common/vecnTypes.ts`

### 4. Renderer для Entity/Components

```typescript
class EntityTreeRenderer implements ITreeRenderer {
    renderElement(element: Entity | Component) {
        if (element.type === 'Entity') {
            return `🎮 ${element.name}`;
        } else if (element.type === 'Transform') {
            return `📐 Transform`;
        } else if (element.type === 'Mesh') {
            return `🔷 Mesh`;
        }
        // и т.д.
    }
}
```

## Пустое состояние

Если сцены нет, показать:

```
┌─────────────────────────┐
│  SCENE HIERARCHY        │
│                         │
│  No scene loaded        │
│                         │
│  [Create Main Scene]    │ ← Кнопка
│                         │
└─────────────────────────┘
```

При клике создать файл `assets/scenes/main.vecn` с базовой структурой:

```ron
VoidScene(
    version: "1.0",
    mode: Scene3D,
    entities: [
        Entity(
            id: "root",
            name: "Root",
            components: [
                Transform(
                    translation: (0.0, 0.0, 0.0),
                    rotation: (0.0, 0.0, 0.0, 1.0),
                    scale: (1.0, 1.0, 1.0),
                ),
            ],
            children: [],
        ),
    ],
    resources: [
        AmbientLight(
            color: (1.0, 1.0, 1.0),
            brightness: 0.3,
        ),
    ],
)
```

## Действия (Actions)

### Контекстное меню Entity:
- **Add Child Entity** - добавить дочерний объект
- **Add Component** → Transform, Mesh, Material, Light...
- **Duplicate** - дублировать
- **Delete** - удалить
- **Rename** - переименовать

### Контекстное меню Component:
- **Edit Properties** - открыть в Inspector (справа)
- **Remove Component** - удалить компонент

## Интеграция с Inspector

Справа в панели Properties показывать свойства выбранного Entity/Component:

```
┌─────────────────────┐
│ INSPECTOR           │
│                     │
│ Entity: Player      │
│ ─────────────────── │
│ Transform           │
│   Position X: 0.0   │
│   Position Y: 1.0   │
│   Position Z: 0.0   │
│ ─────────────────── │
│ Mesh                │
│   Type: Cube        │
│   Size: 1.0         │
└─────────────────────┘
```

## Файлы для модификации

1. **explorerView.ts** - добавить SplitView
2. **sceneHierarchyView.ts** - новый view (создать)
3. **sceneHierarchyRenderer.ts** - рендеринг Entity/Components (создать)
4. **sceneHierarchyActions.ts** - действия (создать)
5. **files.contribution.ts** - регистрация нового view

## Следующие шаги

1. Создать SceneHierarchyView
2. Модифицировать ExplorerView для SplitView
3. Добавить парсинг .vecn
4. Реализовать рендеринг Entity/Components
5. Добавить действия (Add Entity, Add Component)
6. Интегрировать с Inspector


## Attach Script Workflow (как в Godot)

### UX Flow

1. **Наведение на Entity в дереве:**
   ```
   🎮 Player  [📜]  ← Иконка появляется при hover
   ```

2. **Клик на 📜 → Диалог создания скрипта:**
   ```
   ┌─────────────────────────────────────┐
   │  Attach Script to "Player"          │
   ├─────────────────────────────────────┤
   │                                     │
   │  Script Name:                       │
   │  ┌───────────────────────────────┐  │
   │  │ player_controller.rs          │  │
   │  └───────────────────────────────┘  │
   │                                     │
   │  Save Path:                         │
   │  ┌───────────────────────────────┐  │
   │  │ src/scripts/                  │📁│
   │  └───────────────────────────────┘  │
   │                                     │
   │  Template:                          │
   │  ○ Empty Script                     │
   │  ● Basic Component                  │
   │  ○ System Script                    │
   │                                     │
   │     [Cancel]  [Create & Attach]     │
   └─────────────────────────────────────┘
   ```

3. **После создания:**
   - Файл создается: `src/scripts/player_controller.rs`
   - Скрипт привязывается к Entity в .vecn:
     ```ron
     Entity(
         id: "player",
         name: "Player",
         components: [
             Transform(...),
             Mesh(...),
             Script(path: "src/scripts/player_controller.rs"),  ← Добавлено
         ],
     )
     ```
   - Автоматически открывается редактор с новым файлом

### Шаблоны скриптов

#### 1. Empty Script
```rust
// Empty script for Player
use bevy::prelude::*;

pub struct PlayerScript;

impl Plugin for PlayerScript {
    fn build(&self, app: &mut App) {
        // Add your systems here
    }
}
```

#### 2. Basic Component (рекомендуемый)
```rust
use bevy::prelude::*;

#[derive(Component)]
pub struct PlayerController {
    pub speed: f32,
    pub jump_force: f32,
}

impl Default for PlayerController {
    fn default() -> Self {
        Self {
            speed: 5.0,
            jump_force: 10.0,
        }
    }
}

pub fn player_movement_system(
    keyboard: Res<ButtonInput<KeyCode>>,
    mut query: Query<(&mut Transform, &PlayerController)>,
    time: Res<Time>,
) {
    for (mut transform, controller) in query.iter_mut() {
        let mut direction = Vec3::ZERO;
        
        if keyboard.pressed(KeyCode::KeyW) {
            direction.z -= 1.0;
        }
        if keyboard.pressed(KeyCode::KeyS) {
            direction.z += 1.0;
        }
        if keyboard.pressed(KeyCode::KeyA) {
            direction.x -= 1.0;
        }
        if keyboard.pressed(KeyCode::KeyD) {
            direction.x += 1.0;
        }
        
        if direction.length() > 0.0 {
            direction = direction.normalize();
            transform.translation += direction * controller.speed * time.delta_seconds();
        }
    }
}

pub struct PlayerControllerPlugin;

impl Plugin for PlayerControllerPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, player_movement_system);
    }
}
```

#### 3. System Script
```rust
use bevy::prelude::*;

pub fn player_system(
    // Add your queries and resources here
) {
    // System logic
}

pub struct PlayerSystemPlugin;

impl Plugin for PlayerSystemPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, player_system);
    }
}
```

### Визуальная индикация привязанного скрипта

После привязки скрипта Entity отображается с иконкой:

```
🎮 Player 📜  ← Скрипт привязан
  ├─ Transform
  ├─ Mesh
  ├─ Material
  └─ 📜 player_controller.rs  ← Компонент Script в дереве
```

### Действия со скриптом

**Клик на 📜 player_controller.rs:**
- **Open Script** - открыть в редакторе
- **Detach Script** - отвязать от Entity
- **Reload Script** - перезагрузить (hot reload)

**Двойной клик:**
- Сразу открывает скрипт в редакторе

### Диалог создания скрипта - Реализация

**Файл:** `src/vs/workbench/contrib/files/browser/dialogs/attachScriptDialog.ts`

```typescript
export class AttachScriptDialog extends Dialog {
    private scriptNameInput: InputBox;
    private pathInput: InputBox;
    private templateSelect: SelectBox;
    
    constructor(
        private entityName: string,
        @IFileService private fileService: IFileService,
        @IEditorService private editorService: IEditorService
    ) {
        super();
        this.create();
    }
    
    private create(): void {
        // Title
        this.title = `Attach Script to "${this.entityName}"`;
        
        // Script Name Input
        this.scriptNameInput = new InputBox({
            placeholder: 'player_controller.rs',
            value: this.generateScriptName(this.entityName)
        });
        
        // Path Input with Browse button
        this.pathInput = new InputBox({
            placeholder: 'src/scripts/',
            value: 'src/scripts/'
        });
        
        // Template Select
        this.templateSelect = new SelectBox([
            { text: 'Empty Script', value: 'empty' },
            { text: 'Basic Component', value: 'component' },
            { text: 'System Script', value: 'system' }
        ], 1); // Default: Basic Component
    }
    
    private generateScriptName(entityName: string): string {
        return `${entityName.toLowerCase().replace(/\s+/g, '_')}_controller.rs`;
    }
    
    async onAccept(): Promise<void> {
        const scriptName = this.scriptNameInput.value;
        const path = this.pathInput.value;
        const template = this.templateSelect.value;
        
        // 1. Create script file
        const fullPath = `${path}${scriptName}`;
        const content = this.getTemplate(template, this.entityName);
        await this.fileService.writeFile(URI.file(fullPath), content);
        
        // 2. Attach to Entity in .vecn
        await this.attachScriptToEntity(this.entityName, fullPath);
        
        // 3. Open in editor
        await this.editorService.openEditor({
            resource: URI.file(fullPath)
        });
        
        this.close();
    }
    
    private getTemplate(type: string, entityName: string): string {
        switch (type) {
            case 'empty':
                return this.getEmptyTemplate(entityName);
            case 'component':
                return this.getComponentTemplate(entityName);
            case 'system':
                return this.getSystemTemplate(entityName);
            default:
                return '';
        }
    }
}
```

### Hover Action Button

**Файл:** `src/vs/workbench/contrib/files/browser/views/sceneHierarchyRenderer.ts`

```typescript
class EntityTreeRenderer implements ITreeRenderer {
    renderElement(element: Entity, container: HTMLElement) {
        const row = dom.$('.entity-row');
        
        // Icon + Name
        const icon = dom.$('.entity-icon', {}, '🎮');
        const name = dom.$('.entity-name', {}, element.name);
        
        // Attach Script Button (показывается при hover)
        const attachScriptBtn = dom.$('.attach-script-btn', {
            title: 'Attach Script'
        }, '📜');
        attachScriptBtn.style.opacity = '0';
        attachScriptBtn.style.transition = 'opacity 0.2s';
        
        // Hover effect
        row.addEventListener('mouseenter', () => {
            attachScriptBtn.style.opacity = '1';
        });
        row.addEventListener('mouseleave', () => {
            attachScriptBtn.style.opacity = '0';
        });
        
        // Click handler
        attachScriptBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openAttachScriptDialog(element);
        });
        
        dom.append(row, icon, name, attachScriptBtn);
        dom.append(container, row);
    }
    
    private openAttachScriptDialog(entity: Entity): void {
        const dialog = this.instantiationService.createInstance(
            AttachScriptDialog,
            entity.name
        );
        dialog.show();
    }
}
```

### CSS для кнопки

```css
.entity-row {
    display: flex;
    align-items: center;
    padding: 2px 8px;
    gap: 6px;
}

.attach-script-btn {
    margin-left: auto;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
    border-radius: 3px;
}

.attach-script-btn:hover {
    background: var(--vscode-list-hoverBackground);
}
```

### Обновление .vecn файла

При привязке скрипта обновляется .vecn:

```typescript
async attachScriptToEntity(entityName: string, scriptPath: string): Promise<void> {
    // 1. Загрузить .vecn
    const sceneUri = this.getActiveSceneUri();
    const content = await this.fileService.readFile(sceneUri);
    const scene = VecnParser.parse(content.value.toString());
    
    // 2. Найти Entity
    const entity = scene.entities.find(e => e.name === entityName);
    if (!entity) return;
    
    // 3. Добавить Script component
    entity.components.push({
        type: 'Script',
        path: scriptPath
    });
    
    // 4. Сохранить обратно
    const updatedContent = VecnSerializer.serialize(scene);
    await this.fileService.writeFile(sceneUri, updatedContent);
    
    // 5. Обновить дерево
    this.refresh();
}
```

## Итого: Attach Script Flow

1. Hover на Entity → появляется 📜
2. Клик на 📜 → диалог с именем, путем, шаблоном
3. Create & Attach → создается .rs файл, добавляется в .vecn, открывается редактор
4. Entity теперь показывает 📜 как индикатор привязанного скрипта
5. Клик на 📜 в дереве → открывает скрипт для редактирования

Точно как в Godot! 🎮

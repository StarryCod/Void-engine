# Welcome Screen - Real Project Actions

## Реализовано

### 1. Реальное открытие проектов

Теперь при клике на "Open" или двойном клике на карточку проекта:

1. Проект действительно открывается в VSCode
2. Welcome screen закрывается
3. Открывается папка проекта

**Код:**
```typescript
private async openProject(p: VoidProject): Promise<void> {
  console.log('[Void] Opening project:', p.name, p.path);
  p.lastOpened = Date.now();
  this.savePins();

  const card = this.findCard(p.id);
  if (card) this.stampCard(card, 'LAUNCHED', 'green');

  try {
    // Закрываем welcome screen
    const body = document.body;
    body.classList.add('void-welcome-closed');
    const overlay = document.getElementById('void-welcome-overlay');
    if (overlay) overlay.style.display = 'none';

    // Открываем папку проекта в VSCode
    const folderUri = URI.file(p.path);
    console.log('[Void] Opening folder:', folderUri.toString());
    
    // Используем команду для открытия папки
    await this.commandService.executeCommand('vscode.openFolder', folderUri, {
      forceNewWindow: false,
      forceReuseWindow: true
    });
    
    console.log('[Void] Project opened successfully');
  } catch (error) {
    console.error('[Void] Failed to open project:', error);
    this.stampScreen('FAILED', 'red');
  }
}
```

### 2. Реальное удаление проектов

Удаление уже было реализовано через `IFileService.del()`:

```typescript
private async deleteFromDisk(proj: VoidProject): Promise<void> {
  try { 
    await this.fileService.del(URI.file(proj.path), { recursive: true }); 
  }
  catch (e) { 
    console.error('[Void] Delete error:', e); 
  }
}
```

При клике на Delete:
1. Показывается модальное окно подтверждения
2. После подтверждения проект удаляется с диска
3. Список проектов обновляется
4. Показывается анимация удаления

## Добавленные импорты

```typescript
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
```

## Обновленный конструктор

```typescript
constructor(
  @IFileService private readonly fileService: IFileService,
  @IHostService private readonly hostService: IHostService,
  @ICommandService private readonly commandService: ICommandService
) {
  super();
  this.sep = isWindows ? '\\' : '/';
  this.projectsPath = isWindows
    ? 'C:\\Users\\Starred\\Documents\\VoidEngine\\Projects'
    : '/home/user/Documents/VoidEngine/Projects';
}
```

## Как работает

### Открытие проекта:
1. Пользователь кликает "Open" или делает двойной клик на карточку
2. Вызывается `openProject(p)`
3. Обновляется `lastOpened` и сохраняются pins
4. Показывается штамп "LAUNCHED"
5. Welcome screen скрывается
6. Выполняется команда `vscode.openFolder` с путем к проекту
7. VSCode открывает папку проекта

### Удаление проекта:
1. Пользователь кликает "Delete"
2. Показывается модальное окно с подтверждением
3. При подтверждении вызывается `deleteFromDisk(p)`
4. Файловый сервис удаляет папку рекурсивно
5. Список проектов пересканируется
6. UI обновляется

## Опции открытия папки

```typescript
{
  forceNewWindow: false,  // Не открывать в новом окне
  forceReuseWindow: true  // Использовать текущее окно
}
```

Можно изменить на:
- `forceNewWindow: true` - всегда открывать в новом окне
- Оба `false` - VSCode спросит пользователя

## Тестирование

1. Запустите VSCode
2. Welcome screen должен показаться автоматически
3. Кликните на проект → должен открыться
4. Кликните Delete → должно показаться подтверждение
5. Подтвердите → проект должен удалиться с диска

## Файлы изменены

- `vscode/src/vs/workbench/contrib/voidWelcome/browser/voidWelcome.ts`
  - Добавлены импорты IHostService, ICommandService
  - Обновлен конструктор
  - Реализован метод openProject()
  - deleteFromDisk() уже был реализован

## Примечания

- IFileService уже был в конструкторе и используется для всех файловых операций
- ICommandService используется для выполнения команд VSCode
- IHostService может понадобиться для дополнительных операций с окнами
- Dependency injection работает автоматически через IInstantiationService

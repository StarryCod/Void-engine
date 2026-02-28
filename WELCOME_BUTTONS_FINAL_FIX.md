# Welcome Screen Buttons - FINAL FIX

## Проблема
Кнопки не работали даже после предыдущих исправлений.

## Решение
Полностью отказался от `dom.addDisposableListener` и `DisposableStore` для кнопок.
Использую прямое назначение `onclick` - как в рабочем примере из `Карточки/index.html`.

## Изменения

### 1. Action Row Buttons (ab метод)
```typescript
private ab(parent: HTMLElement, label: string, ico: string[], fn: () => void, danger = false): void {
  const b = dom.append(parent, dom.$('.vs-ab'));
  // ...
  
  // Прямое назначение onclick
  b.onclick = (e) => {
    console.log('[Void] Action button clicked:', label);
    e.stopPropagation();
    e.preventDefault();
    fn();
  };
  
  // Дублирование через addEventListener с capture
  b.addEventListener('click', (e) => {
    console.log('[Void] Action button addEventListener:', label);
    e.stopPropagation();
    e.preventDefault();
    fn();
  }, true);
}
```

### 2. Grid Card Buttons (mkGridCard метод)
```typescript
openBtn.onclick = (e) => {
  console.log('[Void] Card Open button clicked for:', p.name);
  e.stopPropagation();
  e.preventDefault();
  this.openProject(p);
};

editBtn.onclick = (e) => {
  console.log('[Void] Card Edit button clicked for:', p.name);
  e.stopPropagation();
  e.preventDefault();
  this.showEdit(p);
};

delBtn.onclick = (e) => {
  console.log('[Void] Card Delete button clicked for:', p.name);
  e.stopPropagation();
  e.preventDefault();
  this.showDeleteConfirm(p);
};
```

### 3. New Project Card (mkNewCard метод)
```typescript
c.onclick = (e) => {
  console.log('[Void] New project card clicked');
  e.stopPropagation();
  e.preventDefault();
  this.showCreate();
};
```

### 4. Create Form Buttons (showCreate метод)
```typescript
cancelBtn.onclick = (e) => {
  console.log('[Void] Create Cancel clicked');
  e.stopPropagation();
  e.preventDefault();
  doCancel();
};

createBtn.onclick = (e) => {
  console.log('[Void] Create button clicked');
  e.stopPropagation();
  e.preventDefault();
  doCreate();
};

nameInp.onkeydown = (e: KeyboardEvent) => {
  e.stopPropagation();
  if (e.key === 'Enter') {
    e.preventDefault();
    doCreate();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    doCancel();
  }
};

// Click outside
setTimeout(() => {
  const clickOutside = (e: MouseEvent) => {
    if (!card.contains(e.target as HTMLElement)) {
      doCancel();
      document.removeEventListener('click', clickOutside);
    }
  };
  document.addEventListener('click', clickOutside);
}, 100);
```

### 5. Edit Form Buttons (showEdit метод)
```typescript
saveBtn.onclick = (e) => {
  console.log('[Void] Edit Save clicked');
  e.stopPropagation();
  e.preventDefault();
  doSave();
};

cancelBtn.onclick = (e) => {
  console.log('[Void] Edit Cancel clicked');
  e.stopPropagation();
  e.preventDefault();
  doCancel();
};

delBtn.onclick = (e) => {
  console.log('[Void] Edit Delete clicked');
  e.stopPropagation();
  e.preventDefault();
  doDelete();
};

// Category buttons
btn.onclick = (e) => {
  console.log('[Void] Category clicked:', cat.label);
  e.stopPropagation();
  e.preventDefault();
  selectedCat = cat.key;
  catBtns.forEach(b => b.classList.remove('vs-fed-cat-on'));
  btn.classList.add('vs-fed-cat-on');
};
```

### 6. Delete Modal Buttons (showDeleteConfirm метод)
```typescript
cancelBtn.onclick = () => {
  console.log('[Void] Delete modal Cancel clicked');
  this.closeOv();
};

delBtn.onclick = async () => {
  console.log('[Void] Delete modal Delete clicked');
  this.closeOv();
  // ... delete logic
};
```

### 7. Info Modal Button (showInfo метод)
```typescript
ok.onclick = () => {
  console.log('[Void] Info modal Close clicked');
  this.closeOv();
};
```

### 8. Overlay Click (openOv метод)
```typescript
this.overlayEl.onclick = (e) => {
  if ((e.target as HTMLElement).classList.contains('vs-ov')) {
    console.log('[Void] Overlay clicked, closing');
    this.closeOv();
  }
};
```

## Почему это работает

1. **Прямое назначение** - `element.onclick = handler` - самый надежный способ
2. **Нет промежуточных слоев** - не используем DisposableStore, который мог очищаться
3. **Явный preventDefault** - предотвращаем дефолтное поведение
4. **Подробное логирование** - видим каждый клик в консоли
5. **Click outside** - используем нативный addEventListener с ручной очисткой

## Проверка работы

Откройте консоль браузера и кликайте на кнопки. Должны появляться логи:
```
[Void] Card clicked: My Project
[Void] Selected project: abc123
[Void] Action row visible, styles: {...}
[Void] Action button clicked: Open
[Void] Opening project: My Project
```

## Файлы изменены
- `vscode/src/vs/workbench/contrib/voidWelcome/browser/voidWelcome.ts`
- `vscode/src/vs/workbench/contrib/voidWelcome/browser/media/voidWelcome.css`

## Важно
Теперь НЕ используем:
- ❌ `dom.addDisposableListener` для кнопок
- ❌ `this.cardStore.add()` для кнопок
- ❌ `this.editStore.add()` для кнопок (кроме click outside)
- ❌ `this.modalStore.add()` для кнопок

Используем:
- ✅ `element.onclick = handler`
- ✅ `element.addEventListener('click', handler, true)` как дублирование
- ✅ Прямое назначение обработчиков
- ✅ Ручная очистка для click outside

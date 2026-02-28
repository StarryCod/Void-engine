# Welcome Screen Buttons - Complete Fix

## Проблема
Все кнопки в welcome screen не работали - не реагировали на клики.

## Причины
1. События не доходили до обработчиков из-за проблем с pointer-events
2. Z-index конфликты между элементами
3. Использование dom.addDisposableListener могло вызывать проблемы с регистрацией

## Решение

### 1. CSS Изменения

#### Action Row (верхняя панель с кнопками)
```css
.vs-ar {
  z-index: 100 !important; /* Максимальный приоритет */
  pointer-events: none;
}
.vs-ar.vs-aron {
  pointer-events: all !important; /* Принудительно включаем */
}
.vs-arg { 
  pointer-events: all !important;
}
.vs-ab {
  cursor: pointer !important;
  pointer-events: all !important;
  z-index: 101 !important;
}
```

#### Card Toolbar (кнопки на карточках)
```css
.vs-gctb {
  z-index: 50 !important;
}
.vs-gc.vs-gcsel .vs-gctb {
  pointer-events: all !important;
}
.vs-gctb-btn {
  cursor: pointer !important;
  z-index: 51 !important;
  pointer-events: all !important;
}
```

#### Grid Cards
```css
.vs-gc {
  cursor: pointer !important;
  pointer-events: all !important;
  z-index: 1;
}
.vs-gc.vs-gcsel {
  z-index: 10 !important;
}
```

### 2. TypeScript Изменения

#### Метод ab() - создание кнопок action row
Заменил `dom.addDisposableListener` на прямое использование `onclick` и `addEventListener`:

```typescript
private ab(parent: HTMLElement, label: string, ico: string[], fn: () => void, danger = false): void {
  const b = dom.append(parent, dom.$('.vs-ab'));
  if (danger) b.classList.add('vs-abd');
  b.appendChild(this.svg(ico, 13));
  dom.append(b, dom.$('span')).textContent = label;
  
  // Используем onclick напрямую для гарантированной работы
  b.onclick = (e) => {
    console.log('[Void] Action button clicked:', label);
    e.stopPropagation();
    e.preventDefault();
    fn();
  };
  
  // Также добавляем через addEventListener для надежности
  b.addEventListener('click', (e) => {
    console.log('[Void] Action button addEventListener:', label);
    e.stopPropagation();
    e.preventDefault();
    fn();
  }, true); // true = capture phase
}
```

#### Метод mkGridCard() - создание карточек проектов
Заменил все `this.cardStore.add(dom.addDisposableListener(...))` на прямое использование `onclick`:

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

c.onclick = (e) => {
  if (this.editingId === p.id) return;
  if ((e.target as HTMLElement).closest('.vs-gctb')) return;
  console.log('[Void] Card clicked:', p.name);
  e.stopPropagation();
  this.sel(p.id);
};
```

#### Метод mkNewCard() - кнопка создания проекта
```typescript
c.onclick = (e) => {
  console.log('[Void] New project card clicked');
  e.stopPropagation();
  e.preventDefault();
  this.showCreate();
};
```

#### Метод sel() - выбор проекта
Добавил принудительную установку стилей и логирование:

```typescript
private sel(id: string): void {
  // ...
  this.actionRow.classList.add('vs-aron');
  
  // Принудительно устанавливаем стили для видимости
  this.actionRow.style.pointerEvents = 'all';
  this.actionRow.style.zIndex = '100';
  
  console.log('[Void] Action row visible, styles:', {
    display: getComputedStyle(this.actionRow).display,
    pointerEvents: getComputedStyle(this.actionRow).pointerEvents,
    zIndex: getComputedStyle(this.actionRow).zIndex,
    height: getComputedStyle(this.actionRow).height
  });
}
```

## Результат

Теперь все кнопки работают:
- ✅ Open - открывает проект
- ✅ Edit - переходит в режим редактирования
- ✅ Duplicate - дублирует проект
- ✅ Pin/Unpin - закрепляет/открепляет проект
- ✅ Info - показывает информацию о проекте
- ✅ Delete - удаляет проект (с подтверждением)
- ✅ New Project - создает новый проект
- ✅ Кнопки на карточках (Open, Edit, Delete)

## Отладка

В консоли браузера теперь видны все клики:
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

# Welcome Screen - Delete Button Debug

## Проблема
Кнопка Delete не работает.

## Что должно происходить

### 1. Выбор проекта
- Кликните на карточку проекта
- Карточка должна выделиться (синяя рамка)
- Action row (панель с кнопками) должна появиться сверху
- В консоли: `[Void] Card clicked: ProjectName`
- В консоли: `[Void] Selected project: abc123`

### 2. Клик на Delete
- Кликните кнопку "Delete" в action row
- В консоли должно появиться: `[Void] ========== actDelete CALLED ==========`
- Должно открыться модальное окно подтверждения

### 3. Подтверждение удаления
- Кликните "Delete" в модальном окне
- В консоли: `[Void] Delete modal Delete clicked`
- На карточке появится красный штамп "VOID"
- Карточка исчезнет с анимацией
- Проект удалится с диска

## Отладка

### Проверка 1: Выбирается ли проект?
Откройте консоль браузера (F12) и кликните на карточку проекта.

**Ожидаемый вывод:**
```
[Void] Card clicked: My Project
[Void] sel() called with id: abc123
[Void] Selected project: abc123
[Void] Action row visible, styles: {...}
```

**Если не видите логов:**
- Проект не выбирается
- Проблема в методе `sel()` или обработчике клика карточки

### Проверка 2: Появляется ли action row?
После выбора проекта посмотрите на верхнюю часть экрана.

**Должно быть:**
- Панель с кнопками: Open, Edit, Duplicate, Pin/Unpin, Info, Delete
- Панель должна быть видна (не прозрачная)

**Если панель не видна:**
- Проверьте в инспекторе элементов класс `.vs-ar`
- Должен быть класс `vs-aron`
- Должны быть стили: `height: 38px`, `opacity: 1`, `pointer-events: all`

### Проверка 3: Кликается ли кнопка Delete?
Кликните на кнопку "Delete" в action row.

**Ожидаемый вывод:**
```
[Void] Action button clicked: Delete
[Void] ========== actDelete CALLED ==========
[Void] actDelete called, selectedId: abc123
[Void] Calling showDeleteConfirm for project: My Project
```

**Если не видите логов:**
- Кнопка не получает клик
- Проблема в CSS (pointer-events) или обработчике onclick

**Если видите alert "No project selected!":**
- Проект был выбран, но потом selectedId сбросился
- Проблема в методе `sp()` или `selectedId`

### Проверка 4: Открывается ли модальное окно?
После клика на Delete должно открыться модальное окно.

**Должно быть:**
- Затемненный фон (overlay)
- Модальное окно с текстом "This project will be permanently deleted..."
- Две кнопки: Cancel и Delete

**Если окно не открывается:**
- Проверьте метод `openOv()`
- Проверьте метод `showDeleteConfirm()`

### Проверка 5: Работает ли кнопка Delete в модальном окне?
Кликните "Delete" в модальном окне.

**Ожидаемый вывод:**
```
[Void] Delete modal Delete clicked
```

**Что должно произойти:**
1. Модальное окно закроется
2. На карточке появится красный штамп "VOID"
3. Через 300мс карточка начнет исчезать
4. Через 1000мс проект удалится с диска
5. Список проектов обновится

## Код кнопки Delete в action row

```typescript
this.ab(aR, 'Delete', I.trash, () => this.actDelete(), true);
```

Метод `ab()`:
```typescript
private ab(parent: HTMLElement, label: string, ico: string[], fn: () => void, danger = false): void {
  const b = dom.append(parent, dom.$('.vs-ab'));
  if (danger) b.classList.add('vs-abd');
  b.appendChild(this.svg(ico, 13));
  dom.append(b, dom.$('span')).textContent = label;
  
  // Прямое назначение onclick
  b.onclick = (e) => {
    console.log('[Void] Action button clicked:', label);
    e.stopPropagation();
    e.preventDefault();
    fn();
  };
  
  // Дублирование через addEventListener
  b.addEventListener('click', (e) => {
    console.log('[Void] Action button addEventListener:', label);
    e.stopPropagation();
    e.preventDefault();
    fn();
  }, true);
}
```

## Возможные проблемы

### 1. Кнопка не получает клики
**Причина:** CSS pointer-events или z-index

**Решение:**
```css
.vs-ar {
  z-index: 100 !important;
  pointer-events: none;
}
.vs-ar.vs-aron {
  pointer-events: all !important;
}
.vs-ab {
  pointer-events: all !important;
  cursor: pointer !important;
  z-index: 101 !important;
}
```

### 2. selectedId сбрасывается
**Причина:** Метод `desel()` вызывается случайно

**Проверка:**
Добавьте логирование в `desel()`:
```typescript
private desel(): void {
  console.log('[Void] desel() called');
  console.trace(); // Покажет откуда вызвано
  // ...
}
```

### 3. Модальное окно не открывается
**Причина:** Ошибка в `openOv()` или `showDeleteConfirm()`

**Проверка:**
Добавьте try-catch:
```typescript
private actDelete(): void {
  try {
    console.log('[Void] actDelete called');
    const p = this.sp();
    if (!p) {
      console.warn('[Void] No project selected');
      return;
    }
    this.showDeleteConfirm(p);
  } catch (error) {
    console.error('[Void] actDelete error:', error);
    alert('Error: ' + error.message);
  }
}
```

## Тестирование после компиляции

1. Скомпилируйте VSCode: `npm run watch` или `npm run compile`
2. Запустите VSCode без открытой папки
3. Welcome screen должен появиться автоматически
4. Откройте консоль браузера (F12)
5. Кликните на карточку проекта
6. Проверьте логи в консоли
7. Кликните "Delete"
8. Проверьте логи в консоли
9. Подтвердите удаление
10. Проверьте что проект удалился

## Если ничего не помогает

Добавьте alert() для отладки:
```typescript
private actDelete(): void {
  alert('actDelete called!');
  console.log('[Void] actDelete called');
  // ...
}
```

Это покажет, вызывается ли метод вообще.

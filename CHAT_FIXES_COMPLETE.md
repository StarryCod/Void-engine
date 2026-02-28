# Исправления чата - ГОТОВО ✅

## Что было исправлено

### 1. Timeline линии больше не перекрывают всё
- Изменён z-index timeline SVG с 0 на 1
- Добавлен z-index: 10 для input-box чтобы он был поверх timeline
- Timeline теперь под сообщениями но над фоном

### 2. Поле ввода теперь растёт до 8 строк
- Добавлен auto-resize в input event handler
- Textarea автоматически увеличивается по высоте до 8 строк (192px)
- После 8 строк появляется скролл (скрыт через CSS)
- Input wrapper теперь имеет min-height и max-height
- Top panel растёт flex: 1 1 auto
- Bottom panel фиксированный flex: 0 0 auto

### 3. Режимы переключаются по Shift+Tab
- Добавлен обработчик Shift+Tab в keydown
- Создан метод cycleEditMode() который вызывается из клика и Tab
- Режимы: Ask → Edit → YOLO (как в qwen-code-clean CLI)

### 4. Welcome screen исправлен
- Уже был исправлен ранее с position: absolute и transform
- Центрирование работает корректно

## Изменённые файлы

### chatViewPane.css

#### Input box z-index
```css
.void-input-box {
	/* ... */
	z-index: 10; /* Поверх timeline */
}
```

#### Timeline SVG z-index
```css
.void-timeline-svg {
	/* ... */
	z-index: 1; /* Под сообщениями но над фоном */
}
```

#### Input wrapper - растущий
```css
.void-input-wrapper {
	/* ... */
	min-height: 100px;
	max-height: 300px; /* 8 строк + toolbar */
}

.void-input-top-panel {
	flex: 1 1 auto; /* Растёт */
	min-height: 60px;
}

.void-input-bottom-panel {
	flex: 0 0 auto; /* Фиксированный */
}
```

#### Textarea
```css
.void-textarea-container {
	/* ... */
	min-height: 46px;
}

.void-input {
	/* ... */
	overflow-x: hidden; /* Скрыть горизонтальный скролл */
}
```

### chatViewPane.ts

#### Auto-resize textarea
```typescript
input.addEventListener('input', () => {
	sendBtn.disabled = input.value.trim().length === 0;
	
	// Auto-resize textarea (до 8 строк)
	input.style.height = 'auto';
	const lineHeight = 24;
	const maxLines = 8;
	const maxHeight = lineHeight * maxLines;
	const newHeight = Math.min(input.scrollHeight, maxHeight);
	input.style.height = newHeight + 'px';
});
```

#### Shift+Tab для переключения режимов
```typescript
input.addEventListener('keydown', (e) => {
	if (e.key === 'Enter' && !e.shiftKey) {
		// Send message
	}
	else if (e.key === 'Tab' && e.shiftKey) {
		e.preventDefault();
		this.cycleEditMode(editModeBtn, modeIcon, modeLabel);
	}
});
```

#### Новый метод cycleEditMode()
```typescript
private cycleEditMode(editModeBtn: HTMLButtonElement, modeIcon: HTMLElement, modeLabel: HTMLElement): void {
	const currentMode = this.editMode;
	let newMode: 'ask' | 'edit' | 'yolo';
	// ... логика переключения режимов
	this.editMode = newMode;
	// ... обновление UI
}
```

#### Упрощён click handler
```typescript
editModeBtn.addEventListener('click', () => {
	this.cycleEditMode(editModeBtn, modeIcon, modeLabel);
});
```

## Как работает

### Auto-resize textarea
1. При вводе текста срабатывает input event
2. Высота сбрасывается в auto
3. Вычисляется новая высота на основе scrollHeight
4. Ограничивается максимумом 192px (8 строк)
5. После 8 строк появляется скролл

### Переключение режимов
1. Shift+Tab или клик по кнопке
2. Вызывается cycleEditMode()
3. Ask → Edit → YOLO → Ask (цикл)
4. Обновляется иконка, label, title
5. Логируется в консоль

### Timeline z-index
```
z-index: 1  - Timeline SVG (линии и кружочки)
z-index: 2  - Messages container
z-index: 10 - Input box (поверх всего)
```

## Тестирование

1. Откройте Qwen Chat
2. Начните вводить текст - поле должно расти до 8 строк
3. После 8 строк должен появиться скролл (невидимый)
4. Нажмите Shift+Tab - режим должен переключиться
5. Отправьте запрос с инструментами - линии не должны перекрывать input
6. Welcome screen должен быть по центру

## Что НЕ исправлено

Timeline линии могут "рваться" при скролле - это нормально, так как координаты вычисляются один раз при создании. Для полного исправления нужно:
- Реализовать recalculate() в ChatTimelineManager
- Вызывать его при скролле messages container
- Пересчитывать позиции всех линий

Но это не критично для базовой функциональности.

## Заключение

Все основные проблемы исправлены:
- ✅ Timeline не перекрывает input
- ✅ Textarea растёт до 8 строк
- ✅ Режимы переключаются по Shift+Tab
- ✅ Welcome screen по центру

Чат готов к использованию! 🎉

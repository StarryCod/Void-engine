# Интеграция Chat Timeline System в chatViewPane.ts

## Шаг 1: Импортировать ChatTimelineManager

В начале файла `chatViewPane.ts`:

```typescript
import { ChatTimelineManager } from './chatTimeline';
```

## Шаг 2: Добавить поле в класс

В классе `ChatViewPane`:

```typescript
private timelineManager: ChatTimelineManager | null = null;
```

## Шаг 3: Инициализировать в renderBody()

После создания `.void-chat-messages`:

```typescript
// В методе renderBody()
const messagesContainer = append(this.container, $('.void-chat-messages'));

// Инициализировать timeline manager
this.timelineManager = new ChatTimelineManager(messagesContainer);
```

## Шаг 4: Вызывать методы при добавлении сообщений

### Когда AI начинает отвечать:

```typescript
// Когда добавляется AI message
const aiMessage = append(messagesContainer, $('.void-message-assistant'));
// ... добавить контент ...

// Начать новую группу timeline
if (this.timelineManager) {
	this.timelineManager.startAIResponse(aiMessage);
}
```

### Когда добавляется tool card:

```typescript
// Когда добавляется tool card
const toolCard = append(messagesContainer, $('.void-message-tool'));
// ... добавить контент ...

// Добавить в timeline с уникальным ID
const toolId = `tool-${Date.now()}-${Math.random()}`;
toolCard.setAttribute('data-tool-id', toolId);

if (this.timelineManager) {
	this.timelineManager.addToolCard(toolCard, toolId);
}
```

### Когда tool завершается:

```typescript
// Когда tool card завершает выполнение
const toolId = toolCard.getAttribute('data-tool-id');
const status = success ? 'success' : 'error';

if (this.timelineManager && toolId) {
	this.timelineManager.updateToolStatus(toolId, status);
}
```

### Когда user пишет новое сообщение:

```typescript
// Когда добавляется user message
const userMessage = append(messagesContainer, $('.void-message-user'));
// ... добавить контент ...

// Завершить текущую группу timeline
if (this.timelineManager) {
	this.timelineManager.endAIResponse();
}
```

## Шаг 5: Добавить edit stats для edit cards

Для edit cards нужно добавить атрибут `data-edit-stats`:

```typescript
// Когда создается edit card
const editCard = append(messagesContainer, $('.void-tool-edit-card'));

// Добавить статистику (например, +5 строк, -2 строки)
const added = 5;
const removed = 2;
editCard.setAttribute('data-edit-stats', `${added},${removed}`);
```

## Шаг 6: Обработка скролла (опционально)

Если нужно пересчитывать позиции при скролле:

```typescript
messagesContainer.addEventListener('scroll', () => {
	if (this.timelineManager) {
		this.timelineManager.recalculate();
	}
});
```

## Шаг 7: Очистка при dispose

В методе `dispose()`:

```typescript
dispose() {
	if (this.timelineManager) {
		this.timelineManager.clear();
		this.timelineManager = null;
	}
	// ... остальная очистка ...
}
```

## Пример полного flow:

```typescript
// 1. User пишет: "Создай файл test.js"
const userMsg = this.addUserMessage("Создай файл test.js");
this.timelineManager?.endAIResponse(); // Завершить предыдущую группу

// 2. AI отвечает: "Создаю файл..."
const aiMsg = this.addAIMessage("Создаю файл...");
this.timelineManager?.startAIResponse(aiMsg); // Начать новую группу

// 3. AI использует tool: write_file
const toolCard = this.addToolCard("write_file", "test.js");
const toolId = `tool-${Date.now()}`;
toolCard.setAttribute('data-tool-id', toolId);
this.timelineManager?.addToolCard(toolCard, toolId);

// 4. Tool выполняется успешно
setTimeout(() => {
	this.timelineManager?.updateToolStatus(toolId, 'success');
}, 1000);

// 5. AI продолжает: "Файл создан!"
const aiMsg2 = this.addAIMessage("Файл создан!");
// НЕ вызываем startAIResponse - это та же группа!

// 6. User пишет новое сообщение
const userMsg2 = this.addUserMessage("Спасибо!");
this.timelineManager?.endAIResponse(); // Завершить группу
```

## Важные моменты:

1. **Один кружочек на tool card** - он меняет цвет от pending → success/error
2. **Линии только если есть tool cards** - если AI просто отвечает текстом, линий нет
3. **Группировка** - все между двумя user messages = одна группа
4. **Уникальные ID** - каждый tool card должен иметь уникальный ID
5. **Edit stats** - для edit cards добавлять атрибут `data-edit-stats`

## CSS уже готов!

Все стили уже добавлены в `chatViewPane.css`:
- `.void-timeline-svg` - контейнер SVG
- `.void-timeline-line-*` - линии
- `.void-timeline-dot-tool` - кружочки
- Анимации рисовки линий
- Пульсация pending кружочков

Теперь просто интегрируй вызовы методов в нужных местах! 🎯

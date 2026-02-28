# Система Timeline с индикаторами для чата

## Концепция

Визуальная система линий и индикаторов, которая показывает flow выполнения AI ответов и инструментов.

**ВАЖНО**: 
- Линии появляются ТОЛЬКО если AI использует инструменты (tool cards)
- Если AI просто отвечает текстом (например "Привет!") - НЕТ линий и кружочков
- Один кружочек на tool card, который МЕНЯЕТ ЦВЕТ в зависимости от статуса

## Структура

```
AI Message "Привет!" 
(НЕТ линий - просто текст)

---

User: "Создай файл"

AI Message (НЕТ кружочка у текста)
    |
    | (вертикальная линия вниз)
    |
    ● (оранжевый кружок - pending, начало выполнения)
    |─── Tool Card 1 (горизонтальная линия к середине иконки)
    
    (кружочек МЕНЯЕТСЯ на зеленый когда успех)
    ● (зеленый кружок - success)
         |
         └─── Edit Stats (+5 -2) (если edit card)
    |
    | (вертикальная линия до следующего tool card)
    |
    ● (оранжевый → зеленый/красный)
    |─── Tool Card 2
    |
    | (вертикальная линия до следующего ответа)
    |
AI Message (продолжение ответа, если есть)
```

## Логика группировки

**ВАЖНО**: Все сообщения и карточки между двумя user messages считаются ОДНИМ ответом AI.

**КРИТИЧНО**: Линии появляются ТОЛЬКО если есть tool cards!

```typescript
// Группировка сообщений
interface AIResponseGroup {
	startMessage: AIMessage;  // Первое AI сообщение
	toolCards: ToolCard[];    // Все tool cards
	endMessage?: AIMessage;   // Последнее AI сообщение (если есть)
	hasTools: boolean;        // ВАЖНО: если false - НЕ рисовать линии!
}

// Логика:
// 1. User пишет вопрос
// 2. AI отвечает (startMessage)
//    - Если НЕТ tool cards → НЕ рисовать линии
//    - Если ЕСТЬ tool cards → рисовать линии
// 3. AI использует инструменты (toolCards)
//    - Кружочек появляется ОРАНЖЕВЫЙ (pending)
//    - Когда выполнено → кружочек МЕНЯЕТСЯ на зеленый/красный
// 4. AI может написать еще текст (endMessage) - линия продолжается
// 5. User пишет новый вопрос - НОВАЯ группа, НОВАЯ линия
```

## Примеры

### Пример 1: Простой ответ (БЕЗ линий)
```
User: "Привет!"
AI: "Привет! Как дела?"
```
→ НЕТ линий, НЕТ кружочков

### Пример 2: С инструментами (С линиями)
```
User: "Создай файл test.js"
AI: "Создаю файл..."
    |
    ● (оранжевый → зеленый)
    |─── Tool Card: write_file (test.js)
         |
         └─── +10 -0
    |
AI: "Файл создан!"
```
→ ЕСТЬ линии и кружочки

## Цвета индикаторов

```css
/* Кружок перед tool card - ОДИН кружок, меняет цвет */
.void-timeline-dot-tool {
	fill: #f59e0b; /* Оранжевый - pending (начало) */
	r: 5;
	transition: fill 0.3s ease; /* Плавная смена цвета */
}

.void-timeline-dot-tool.success {
	fill: #10b981; /* Зеленый - успех */
}

.void-timeline-dot-tool.error {
	fill: #ef4444; /* Красный - ошибка */
}

/* Линии */
.void-timeline-line-vertical {
	stroke: #4a4a4a;
	stroke-width: 2;
}

.void-timeline-line-horizontal {
	stroke: #4a4a4a;
	stroke-width: 2;
}

/* Линия для edit stats */
.void-timeline-line-edit {
	stroke: #3a3a3a;
	stroke-width: 1.5;
	stroke-dasharray: 4 4;
}
```

## Позиционирование

### Вертикальная линия
- Начало: от AI message (если есть tool cards)
- Конец: до первой tool card

### Горизонтальная линия к tool card
- Начало: от оранжевого кружка
- Конец: до середины иконки tool card (не входит в карточку!)
- Высота: точно по центру иконки

### Смена цвета кружочка
```typescript
// Когда tool card начинает выполняться
dot.classList.add('pending'); // Оранжевый

// Когда tool card завершается
dot.classList.remove('pending');
dot.classList.add('success'); // Зеленый
// или
dot.classList.add('error'); // Красный
```

### Edit Stats
Если tool card - это edit card, добавляется:
```
Tool Card (edit)
    |
    | (вертикальная линия вниз, 12px)
    |
    └─── +5 -2 (горизонтальная линия вправо, 12px)
```

Текст stats:
- Если +0, не показывать
- Если -0, не показывать
- Цвет +: #10b981 (зеленый)
- Цвет -: #ef4444 (красный)
- Font: 11px, Monaco/Consolas

## Анимация рисовки (realtime)

```css
@keyframes void-draw-line {
	from {
		stroke-dashoffset: 100;
		opacity: 0;
	}
	to {
		stroke-dashoffset: 0;
		opacity: 1;
	}
}

.void-timeline-line-animated {
	stroke-dasharray: 100;
	animation: void-draw-line 0.3s ease-out forwards;
}
```

## SVG структура

```html
<svg class="void-timeline-svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0;">
	<g class="void-timeline-group" data-response-id="response-1">
		<!-- Вертикальная линия от AI message до tool card -->
		<line class="void-timeline-line-vertical void-timeline-line-animated" 
			  x1="20" y1="50" x2="20" y2="150" />
		
		<!-- Кружок перед tool card (ОДИН, меняет цвет) -->
		<circle class="void-timeline-dot-tool pending" cx="20" cy="150" r="5" 
				data-tool-id="tool-1" />
		
		<!-- Горизонтальная линия к tool card -->
		<line class="void-timeline-line-horizontal void-timeline-line-animated" 
			  x1="25" y1="150" x2="60" y2="150" />
		
		<!-- Edit stats (если edit card) -->
		<line class="void-timeline-line-vertical" 
			  x1="20" y1="200" x2="20" y2="212" />
		<line class="void-timeline-line-edit" 
			  x1="20" y1="212" x2="32" y2="212" />
		<text class="void-timeline-stats" x="36" y="216" fill="#10b981">+5</text>
		<text class="void-timeline-stats" x="52" y="216" fill="#ef4444">-2</text>
		
		<!-- Вертикальная линия до следующего tool card -->
		<line class="void-timeline-line-vertical void-timeline-line-animated" 
			  x1="20" y1="220" x2="20" y2="320" />
		
		<!-- Следующий кружок -->
		<circle class="void-timeline-dot-tool pending" cx="20" cy="320" r="5" 
				data-tool-id="tool-2" />
		
		<!-- И так далее... -->
	</g>
</svg>
```

## TypeScript логика

```typescript
class ChatTimelineManager {
	private svg: SVGElement;
	private currentGroup: AIResponseGroup | null = null;
	
	// Начать новую группу ответа AI
	startAIResponse(messageElement: HTMLElement) {
		this.currentGroup = {
			startElement: messageElement,
			toolCards: [],
			lines: [],
			hasTools: false  // Пока не знаем
		};
		
		// НЕ рисуем кружок у AI message!
		// Кружки только у tool cards
	}
	
	// Добавить tool card в текущую группу
	addToolCard(cardElement: HTMLElement, toolId: string) {
		if (!this.currentGroup) return;
		
		// Теперь мы знаем что есть tools
		this.currentGroup.hasTools = true;
		
		// Если это первая tool card - нарисовать линию от AI message
		if (this.currentGroup.toolCards.length === 0) {
			const verticalLine = this.createVerticalLine(
				this.getMessageY(this.currentGroup.startElement),
				this.getCardY(cardElement)
			);
			this.animateLine(verticalLine);
		} else {
			// Линия от предыдущей tool card
			const verticalLine = this.createVerticalLine(
				this.getLastY(),
				this.getCardY(cardElement)
			);
			this.animateLine(verticalLine);
		}
		
		// Нарисовать кружок (ОРАНЖЕВЫЙ - pending)
		const dot = this.createDot(cardElement, toolId, 'pending');
		
		// Нарисовать горизонтальную линию к иконке
		const horizontalLine = this.createHorizontalLine(
			dot.cx,
			this.getCardIconX(cardElement)
		);
		this.animateLine(horizontalLine);
		
		// Если edit card - добавить stats
		if (cardElement.classList.contains('void-tool-edit-card')) {
			this.addEditStats(cardElement);
		}
		
		this.currentGroup.toolCards.push({
			element: cardElement,
			toolId: toolId,
			dot: dot
		});
	}
	
	// Обновить статус tool card (МЕНЯЕТ ЦВЕТ кружочка)
	updateToolStatus(toolId: string, status: 'success' | 'error') {
		if (!this.currentGroup) return;
		
		const tool = this.currentGroup.toolCards.find(t => t.toolId === toolId);
		if (!tool) return;
		
		// МЕНЯЕМ ЦВЕТ кружочка
		tool.dot.classList.remove('pending');
		tool.dot.classList.add(status);
	}
	
	// Завершить группу (user написал новое сообщение)
	endAIResponse() {
		this.currentGroup = null;
	}
	
	// Создать кружок
	private createDot(cardElement: HTMLElement, toolId: string, status: string): SVGCircleElement {
		const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		dot.classList.add('void-timeline-dot-tool', status);
		dot.setAttribute('data-tool-id', toolId);
		dot.setAttribute('cx', '20');
		dot.setAttribute('cy', this.getCardY(cardElement).toString());
		dot.setAttribute('r', '5');
		this.svg.appendChild(dot);
		return dot;
	}
	
	// Анимация линии
	private animateLine(line: SVGLineElement) {
		line.classList.add('void-timeline-line-animated');
	}
	
	// Получить Y координату середины иконки tool card
	private getCardIconY(cardElement: HTMLElement): number {
		const icon = cardElement.querySelector('.void-message-tool-icon');
		if (!icon) return 0;
		
		const rect = icon.getBoundingClientRect();
		const containerRect = this.svg.getBoundingClientRect();
		
		return rect.top + rect.height / 2 - containerRect.top;
	}
}
```

## Проблемы которые нужно решить

1. **Координаты**: Нужно правильно вычислять позиции элементов относительно SVG
2. **Scroll**: При скролле линии должны оставаться на месте (SVG position: absolute)
3. **Resize**: При изменении размера окна пересчитывать координаты
4. **Группировка**: Правильно определять границы AI response group

## CSS уже добавлен в chatViewPane.css

Все стили для линий уже есть в конце файла:
- `.void-connection-lines-svg`
- `.void-connection-line`
- `.void-connection-dot`
- Анимации

## Следующие шаги

1. Создать `ChatTimelineManager` класс в TypeScript
2. Интегрировать в `chatViewPane.ts`
3. Вызывать методы при добавлении сообщений и tool cards
4. Тестировать и отлаживать позиционирование

## Примечания

- Линии рисуются в realtime с анимацией
- Если анимация не получается - можно убрать класс `.void-timeline-line-animated`
- Система должна быть легковесной и не тормозить UI
- При большом количестве сообщений можно рисовать только видимые линии

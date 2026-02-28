/*---------------------------------------------------------------------------------------------
 *  Chat Timeline System - Visual flow indicators for AI responses and tool execution
 *--------------------------------------------------------------------------------------------*/

interface ToolCardInfo {
	element: HTMLElement;
	toolId: string;
	dot: SVGCircleElement;
	horizontalLine: SVGLineElement;
}

interface AIResponseGroup {
	startElement: HTMLElement;
	toolCards: ToolCardInfo[];
	lines: SVGElement[];
	hasTools: boolean;
}

export class ChatTimelineManager {
	private svg: SVGSVGElement;
	private currentGroup: AIResponseGroup | null = null;
	private container: HTMLElement;

	constructor(container: HTMLElement) {
		this.container = container;
		this.svg = this.createSVG();
		this.container.appendChild(this.svg);
	}

	private createSVG(): SVGSVGElement {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.classList.add('void-timeline-svg');
		svg.style.position = 'absolute';
		svg.style.top = '0';
		svg.style.left = '0';
		svg.style.width = '100%';
		svg.style.height = '100%';
		svg.style.pointerEvents = 'none';
		svg.style.zIndex = '0';
		svg.style.overflow = 'visible';
		return svg;
	}

	// Начать новую группу ответа AI
	startAIResponse(messageElement: HTMLElement) {
		this.currentGroup = {
			startElement: messageElement,
			toolCards: [],
			lines: [],
			hasTools: false
		};
	}

	// Добавить tool card в текущую группу
	addToolCard(cardElement: HTMLElement, toolId: string) {
		if (!this.currentGroup) return;

		this.currentGroup.hasTools = true;

		// Если это первая tool card - нарисовать линию от AI message
		if (this.currentGroup.toolCards.length === 0) {
			const startY = this.getElementY(this.currentGroup.startElement) + 8; // От кружочка AI
			const endY = this.getElementY(cardElement) + 12; // До tool card

			const verticalLine = this.createLine(12, startY, 12, endY, 'vertical');
			this.animateLine(verticalLine);
			this.currentGroup.lines.push(verticalLine);
		} else {
			// Линия от предыдущей tool card
			const prevCard = this.currentGroup.toolCards[this.currentGroup.toolCards.length - 1];
			const startY = this.getElementY(prevCard.element) + 24; // После предыдущей карточки
			const endY = this.getElementY(cardElement) + 12;

			const verticalLine = this.createLine(12, startY, 12, endY, 'vertical');
			this.animateLine(verticalLine);
			this.currentGroup.lines.push(verticalLine);
		}

		// Нарисовать кружок (ОРАНЖЕВЫЙ - pending)
		const dotY = this.getElementY(cardElement) + 12;
		const dot = this.createDot(12, dotY, toolId, 'pending');
		this.currentGroup.lines.push(dot);

		// Нарисовать горизонтальную линию к иконке
		const iconX = this.getCardIconX(cardElement);
		const horizontalLine = this.createLine(17, dotY, iconX, dotY, 'horizontal');
		this.animateLine(horizontalLine);
		this.currentGroup.lines.push(horizontalLine);

		// Если edit card - добавить stats
		if (cardElement.classList.contains('void-tool-edit-card')) {
			this.addEditStats(cardElement, dotY);
		}

		this.currentGroup.toolCards.push({
			element: cardElement,
			toolId: toolId,
			dot: dot,
			horizontalLine: horizontalLine
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

	// Добавить edit stats (+5 -2)
	private addEditStats(cardElement: HTMLElement, dotY: number) {
		// Получить статистику из карточки (если есть)
		const statsText = cardElement.getAttribute('data-edit-stats');
		if (!statsText) return;

		const [added, removed] = statsText.split(',').map(s => parseInt(s));

		// Вертикальная линия вниз (12px)
		const cardBottom = this.getElementY(cardElement) + cardElement.offsetHeight;
		const vertLine = this.createLine(12, cardBottom, 12, cardBottom + 12, 'vertical');
		this.currentGroup!.lines.push(vertLine);

		// Горизонтальная линия вправо (12px)
		const horizLine = this.createLine(12, cardBottom + 12, 24, cardBottom + 12, 'edit');
		this.currentGroup!.lines.push(horizLine);

		// Текст статистики
		if (added > 0) {
			const addedText = this.createText(28, cardBottom + 16, `+${added}`, '#10b981');
			this.currentGroup!.lines.push(addedText);
		}

		if (removed > 0) {
			const removedText = this.createText(added > 0 ? 44 : 28, cardBottom + 16, `-${removed}`, '#ef4444');
			this.currentGroup!.lines.push(removedText);
		}
	}

	// Завершить группу (user написал новое сообщение)
	endAIResponse() {
		this.currentGroup = null;
	}

	// Очистить все линии
	clear() {
		while (this.svg.firstChild) {
			this.svg.removeChild(this.svg.firstChild);
		}
		this.currentGroup = null;
	}

	// Пересчитать позиции (при скролле или resize)
	recalculate() {
		// TODO: Пересчитать координаты всех линий
		// Это нужно вызывать при скролле контейнера
	}

	// Создать линию
	private createLine(x1: number, y1: number, x2: number, y2: number, type: 'vertical' | 'horizontal' | 'edit'): SVGLineElement {
		const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		line.classList.add('void-timeline-line');
		line.classList.add(`void-timeline-line-${type}`);
		line.setAttribute('x1', x1.toString());
		line.setAttribute('y1', y1.toString());
		line.setAttribute('x2', x2.toString());
		line.setAttribute('y2', y2.toString());
		this.svg.appendChild(line);
		return line;
	}

	// Создать кружок
	private createDot(cx: number, cy: number, toolId: string, status: string): SVGCircleElement {
		const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		dot.classList.add('void-timeline-dot-tool', status);
		dot.setAttribute('data-tool-id', toolId);
		dot.setAttribute('cx', cx.toString());
		dot.setAttribute('cy', cy.toString());
		dot.setAttribute('r', '5');
		this.svg.appendChild(dot);
		return dot;
	}

	// Создать текст
	private createText(x: number, y: number, text: string, color: string): SVGTextElement {
		const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		textEl.classList.add('void-timeline-stats');
		textEl.setAttribute('x', x.toString());
		textEl.setAttribute('y', y.toString());
		textEl.setAttribute('fill', color);
		textEl.textContent = text;
		this.svg.appendChild(textEl);
		return textEl;
	}

	// Анимация линии
	private animateLine(line: SVGLineElement) {
		line.classList.add('void-timeline-line-animated');
	}

	// Получить Y координату элемента относительно контейнера
	private getElementY(element: HTMLElement): number {
		const rect = element.getBoundingClientRect();
		const containerRect = this.container.getBoundingClientRect();
		return rect.top - containerRect.top + this.container.scrollTop;
	}

	// Получить X координату середины иконки tool card
	private getCardIconX(cardElement: HTMLElement): number {
		const icon = cardElement.querySelector('.void-message-tool-icon');
		if (!icon) return 60;

		const rect = icon.getBoundingClientRect();
		const containerRect = this.container.getBoundingClientRect();

		return rect.left + rect.width / 2 - containerRect.left;
	}
}

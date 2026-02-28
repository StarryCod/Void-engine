/*---------------------------------------------------------------------------------------------
 *  Void Engine - Game Window
 *  Separate window for running game with viewport/terminal/stop controls
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { $, addDisposableListener, EventType, append, clearNode } from '../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import './media/voidGameWindow.css';

export interface IGameWindowOptions {
	workspacePath: string;
	mode: 'release' | 'debug';
	buildRequired: boolean;
}

// Интерфейс для состояния бревна
interface ILogState {
	element: HTMLElement;
	fuel: number; // 100 = свежее, 0 = пепел
	maxFuel: number;
}

export class VoidGameWindow extends Disposable {
	private window: HTMLElement | null = null;
	private contentArea: HTMLElement | null = null;
	
	private terminalContent: HTMLElement | null = null;
	private _toyTimers: number[] = [];
	private _toyDisposables: Array<{ dispose(): void }> = [];
	private _logs: ILogState[] = []; // Храним состояние дров
	
	private _fireTimer: any = null;
	private _burnTimer: any = null;
	private _compilationProgress = 0; // 0-100%
	
	private readonly _onDidClose = this._register(new Emitter<void>());
	public readonly onDidClose: Event<void> = this._onDidClose.event;

	constructor(
		_options: IGameWindowOptions
	) {
		super();
		console.log('[Void Game Window] Created:', _options.workspacePath);
		this.create();
	}

	private create(): void {
		// Create compact overlay (centered, small)
		this.window = $('.void-game-window-overlay');
		this.window.style.display = 'flex';
		this.window.style.alignItems = 'center';
		this.window.style.justifyContent = 'center';
		
		// Create compact window container (smaller for fireplace)
		const windowContainer = $('.void-game-window.compact');
		windowContainer.style.width = '360px';
		windowContainer.style.height = 'auto';
		windowContainer.style.maxHeight = '500px';
		windowContainer.style.padding = '20px';
		windowContainer.style.borderRadius = '12px';
		
		// Create content area (no toolbar for compact mode)
		this.contentArea = $('.void-game-content');
		this.contentArea.style.padding = '0';
		this.contentArea.style.display = 'flex';
		this.contentArea.style.flexDirection = 'column';
		this.contentArea.style.alignItems = 'center';
		this.contentArea.style.gap = '15px';
		
		// Assemble window
		append(windowContainer, this.contentArea);
		append(this.window, windowContainer);
		
		// Add to body
		document.body.appendChild(this.window);
		
		// Show compilation animation immediately
		this.showCompilationAnimation();
	}
	
	private showCompilationAnimation(): void {
		if (!this.contentArea) return;
		this.cleanupToy();
		this._logs = [];
		if (this._fireTimer) clearInterval(this._fireTimer);
		if (this._burnTimer) clearInterval(this._burnTimer);
		
		clearNode(this.contentArea);

		// Простой контейнер как в Godot
		const loadingContainer = document.createElement('div');
		loadingContainer.style.display = 'flex';
		loadingContainer.style.flexDirection = 'column';
		loadingContainer.style.alignItems = 'center';
		loadingContainer.style.gap = '20px';
		loadingContainer.style.padding = '40px 20px';
		
		// Спиннер (круговой индикатор)
		const spinner = document.createElement('div');
		spinner.className = 'loading-spinner';
		spinner.style.width = '60px';
		spinner.style.height = '60px';
		spinner.style.border = '4px solid rgba(255, 140, 0, 0.2)';
		spinner.style.borderTop = '4px solid #ff8c00';
		spinner.style.borderRadius = '50%';
		spinner.style.animation = 'spin 1s linear infinite';
		
		// Текст статуса
		const statusText = document.createElement('div');
		statusText.className = 'compilation-status-text';
		statusText.textContent = 'Компиляция...';
		statusText.style.fontSize = '18px';
		statusText.style.fontWeight = '600';
		statusText.style.color = '#ffffff';
		statusText.style.textAlign = 'center';
		
		// Прогресс-бар контейнер
		const progressContainer = document.createElement('div');
		progressContainer.style.width = '300px';
		progressContainer.style.display = 'flex';
		progressContainer.style.flexDirection = 'column';
		progressContainer.style.gap = '8px';
		
		// Прогресс-бар фон
		const progressBarBg = document.createElement('div');
		progressBarBg.className = 'progress-bar-background';
		progressBarBg.style.width = '100%';
		progressBarBg.style.height = '6px';
		progressBarBg.style.background = 'rgba(255, 255, 255, 0.1)';
		progressBarBg.style.borderRadius = '3px';
		progressBarBg.style.overflow = 'hidden';
		
		// Прогресс-бар заполнение
		const progressBarFill = document.createElement('div');
		progressBarFill.className = 'progress-bar-fill';
		progressBarFill.style.width = '0%';
		progressBarFill.style.height = '100%';
		progressBarFill.style.background = '#ff8c00';
		progressBarFill.style.transition = 'width 0.3s ease';
		
		progressBarBg.appendChild(progressBarFill);
		
		// Процент
		const percentText = document.createElement('div');
		percentText.className = 'compilation-percent-text';
		percentText.textContent = '0%';
		percentText.style.fontSize = '14px';
		percentText.style.color = 'rgba(255, 255, 255, 0.7)';
		percentText.style.textAlign = 'center';
		
		progressContainer.appendChild(progressBarBg);
		progressContainer.appendChild(percentText);
		
		loadingContainer.appendChild(spinner);
		loadingContainer.appendChild(statusText);
		loadingContainer.appendChild(progressContainer);
		
		append(this.contentArea, loadingContainer);
	}

	// @ts-expect-error - Unused fireplace method, kept for future use
	// Создает ощущение глубины внутри топки
	private _createDeepInterior(container: HTMLElement): void {
		// 1. Задняя кирпичная кладка (мелкая и темная, создаёт перспективу)
		const backBrickRows = 12;
		for (let i = 0; i < backBrickRows; i++) {
			const line = document.createElement('div');
			line.style.position = 'absolute';
			line.style.left = '60px'; // Уже чем фасад
			line.style.right = '60px';
			line.style.height = '1px';
			line.style.top = `${100 + i * 14}px`; // Начинается ниже
			line.style.background = 'rgba(255,255,255,0.05)';
			container.appendChild(line);
		}
		
		// 2. Боковые внутренние стенки (толщина стены)
		// Левая внутренняя стенка
		const leftInner = $('.inner-wall');
		leftInner.style.left = '60px'; // Глубина слева
		leftInner.style.top = '100px';
		leftInner.style.width = '40px'; // Видимая толщина
		leftInner.style.height = '180px';
		// Градиент создает ощущение ухода в темноту
		leftInner.style.background = 'linear-gradient(90deg, #150a0a, #050202)';
		container.appendChild(leftInner);
		
		// Правая внутренняя стенка
		const rightInner = $('.inner-wall');
		rightInner.style.right = '60px';
		rightInner.style.top = '100px';
		rightInner.style.width = '40px';
		rightInner.style.height = '180px';
		rightInner.style.background = 'linear-gradient(-90deg, #150a0a, #050202)';
		container.appendChild(rightInner);
		
		// 3. Свечение позади дров
		const glow = $('.fire-glow');
		glow.style.top = '250px'; // Позиция свечения
		container.appendChild(glow);
		
		// 4. Дрова
		this.createWoodPile(container);
	}

	// --- НОВЫЙ МЕТОД ДРОВ (Strict DOM, 3D объемные) - теперь регистрируем их ---
	private createWoodPile(container: HTMLElement): void {
		const pileBaseX = 160;
		const pileBaseY = 270;
		
		// Функция создания бревна без innerHTML
		const addLog = (x: number, y: number, w: number, angle: number) => {
			const log = $('.wood-log');
			log.style.left = `${pileBaseX + x}px`;
			log.style.top = `${pileBaseY + y}px`;
			log.style.width = `${w}px`;
			log.style.height = '16px';
			log.style.transform = `rotate(${angle}deg)`;
			
			// Торец
			const cut = $('.wood-end');
			cut.style.width = '14px';
			cut.style.height = '14px';
			// Позиционируем торец справа
			cut.style.right = '-7px';
			cut.style.top = '1px'; // Центрируем по высоте бревна
			
			log.appendChild(cut);
			container.appendChild(log);
			
			// Стартовые дрова имеют много топлива
			this._logs.push({
				element: log,
				fuel: 150, // Полный заряд
				maxFuel: 150
			});
		};
		
		// Больше дров на старте для массивного огня
		addLog(-60, -20, 100, -10);
		addLog(-20, -25, 90, 5);
		addLog(-50, -10, 110, 0);
		addLog(10, -15, 60, -15);
		addLog(-10, -35, 80, 12); // Доп. бревно сверху
	}

	// @ts-expect-error - Unused fireplace method, kept for future use
	// Только фасадные кирпичи (рамка вокруг дырки)
	private _createBrickFacade(container: HTMLElement): void {
		// Палитра (та же)
		const bricksShadow = ['#5c2e2e', '#4a2525', '#3d1e1e'];
		
		const bricksLight = ['#8f4d4d', '#7a4242', '#6b3a3a'];
		const mortar = '#0f080a';

		const brickW = 40;
		const brickH = 20;
		const gap = 4;

		const rows = Math.ceil(280 / (brickH + gap));
		const cols = Math.ceil(320 / (brickW + gap));

		// Дырка (чуть шире, так как у нас теперь есть внутренние стенки)
		const holeStartCol = 2;
		const holeEndCol = 5;
		const holeStartRow = 4;

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				// Если это зона дырки - пропускаем
				if (row >= holeStartRow && col >= holeStartCol && col <= holeEndCol) {
					continue;
				}

				const brick = $('.pixel-brick');
				const offsetX = (row % 2) * (brickW / 2);
				const x = col * (brickW + gap) - 20 + offsetX;
				const y = row * (brickH + gap);
				
				brick.style.left = `${x}px`;
				brick.style.top = `${y}px`;
				brick.style.width = `${brickW}px`;
				brick.style.height = `${brickH}px`;
				
				const isShadowSide = x < 140;
				
				const palette = isShadowSide ? bricksShadow : bricksLight;
				const color = palette[Math.floor(Math.random() * palette.length)];
				
				brick.style.backgroundColor = color;
				
				// Эффект 3D для каждого кирпича (выпуклость)
				brick.style.boxShadow = `inset 2px 2px 0 rgba(255,255,255,0.05), inset -2px -2px 0 rgba(0,0,0,0.3), 0 4px 0 ${mortar}`;
				
				container.appendChild(brick);
			}
		}
	}

	// @ts-expect-error - Unused fireplace method, kept for future use
	private _createGrate(grate: HTMLElement): void {
		// Clear previous content
		clearNode(grate);
		
		// Создаем прутья (Bars)
		const barCount = 7;
		for (let i = 0; i < barCount; i++) {
			const bar = $('.iron-bar');
			// Разная высота для красоты
			const height = 80 + (i % 2) * 20;
			
			bar.style.height = `${height}px`;
			
			// Пика наверху
			const finial = $('.iron-finial');
			bar.appendChild(finial);
			
			// Добавляем эффект ржавчины/старости
			bar.style.background = '#1a1016';
			
			grate.appendChild(bar);
		}

		// Поперечина
		const crossbar = $('.iron-crossbar');
		grate.appendChild(crossbar);
	}

	// @ts-expect-error - Unused fireplace method, kept for future use
	// --- NEW METHOD: Builds the structured Pixel Art Column ---
	private _createPixelArtColumn(container: HTMLElement): void {
		// 1. Capital (Top)
		const capital = $('.pixel-capital');
		this._buildCapital(capital);

		// SEAM (Шов между капителью и стволом)
		const seamTop = $('.column-seam');

		// 2. Shaft (Middle)
		const shaft = $('.pixel-shaft');
		// Shaft is split into Shadow side (left) and Light side (right) via CSS
		const shadowSide = $('.shaft-shadow-side');
		const lightSide = $('.shaft-light-side');
		shaft.appendChild(shadowSide);
		shaft.appendChild(lightSide);

		// SEAM (Шов между стволом и базой)
		const seamBottom = $('.column-seam');

		// 3. Base (Bottom)
		const base = $('.pixel-base');
		this._buildBase(base);

		container.appendChild(capital);
		container.appendChild(seamTop); // Добавлен шов
		container.appendChild(shaft);
		container.appendChild(seamBottom); // Добавлен шов
		container.appendChild(base);
	}

	private _buildCapital(container: HTMLElement): void {
		const p = 4; // Pixel size multiplier
		
		// Colors
		const outline = '#1a1016';
		const shadow = '#5a3e50';
		const light = '#f5cc96';
		const highlight = '#ffe8c2';

		// Helper to draw a rect
		const rect = (x: number, y: number, w: number, h: number, color: string) => {
			const d = $('.px-block');
			d.style.left = `${x * p}px`;
			d.style.top = `${y * p}px`;
			d.style.width = `${w * p}px`;
			d.style.height = `${h * p}px`;
			d.style.backgroundColor = color;
			container.appendChild(d);
		};

		// --- Drawing the Volutes (Swirls) based on Reference ---
		
		// Top Slab (Abacus)
		rect(2, 0, 20, 3, outline); // Left top outline
		rect(2, 1, 20, 2, shadow);  // Left top fill
		rect(12, 1, 10, 2, light);  // Middle light
		rect(2, 1, 2, 2, highlight); // Left Highlight edge

		// Main Spiral Section - Backgrounds
		// Left Volute (Shadow side)
		rect(0, 3, 8, 8, outline); // Circle bounding box
		rect(1, 4, 6, 6, shadow);  // Fill
		rect(2, 5, 2, 2, outline); // Inner spiral dot
		rect(3, 6, 3, 1, outline); // Spiral line
		
		// Center connection
		rect(8, 4, 8, 6, shadow); // Darker center
		rect(12, 4, 4, 6, light); // Light transition

		// Right Volute (Light side)
		rect(16, 3, 8, 8, outline);
		rect(17, 4, 6, 6, light);
		rect(19, 5, 2, 2, outline);
		rect(18, 6, 3, 1, outline);

		// Decorative details (Highlight on right scroll)
		rect(18, 4, 4, 1, highlight);
	}

	private _buildBase(container: HTMLElement): void {
		const p = 4; // Pixel size multiplier
		
		const outline = '#1a1016';
		const shadowDark = '#3e2731';
		const shadowMid = '#5a3e50';
		const lightMid = '#f5cc96';
		const lightDark = '#d4a672';

		const rect = (x: number, y: number, w: number, h: number, color: string) => {
			const d = $('.px-block');
			d.style.left = `${x * p}px`;
			d.style.top = `${y * p}px`;
			d.style.width = `${w * p}px`;
			d.style.height = `${h * p}px`;
			d.style.backgroundColor = color;
			container.appendChild(d);
		};

		// Center X offset to align with shaft (shaft is 72px wide / 4 = 18 units)
		// Base container is 88px wide / 4 = 22 units.
		// Shaft center is at 11.
		
		// 1. Torus (The rounded ring part)
		// Top ring
		rect(2, 0, 18, 3, outline); // Outline
		rect(3, 1, 8, 1, shadowMid); // Shadow side
		rect(11, 1, 8, 1, lightMid); // Light side

		// Bottom ring (wider)
		rect(1, 3, 20, 3, outline);
		rect(2, 4, 9, 1, shadowDark);
		rect(11, 4, 9, 1, lightDark);

		// 2. Plinth (The square block at bottom)
		// Top face of block
		rect(1, 6, 20, 1, outline);
		
		// Main block body
		rect(2, 7, 18, 5, outline); // Borders
		
		// Split color for block
		rect(2, 7, 9, 5, shadowDark); // Left/Shadow
		rect(11, 7, 9, 5, lightMid);  // Right/Light
		
		// Shadow cast by torus onto plinth
		rect(2, 7, 9, 2, '#2a1a21'); // Deep shadow
	}

	// --- АВТОМАТИЧЕСКОЕ ПОПОЛНЕНИЕ ДРОВ ---

	// @ts-expect-error - Unused fireplace method, kept for future use
	private _createArchitrave(beam: HTMLElement): void {
		// Очищаем старую пиксельную сетку
		clearNode(beam);
		
		// Создаем две секции: Тень (слева) и Свет (справа)
		const shadowSection = $('.beam-section.beam-shadow');
		const lightSection = $('.beam-section.beam-light');
		
		// Добавляем декоративные элементы ("зубчики" или дентикулы)
		this._createDentils(shadowSection, 'shadow');
		this._createDentils(lightSection, 'light');
		
		beam.appendChild(shadowSection);
		beam.appendChild(lightSection);
	}

	private _createDentils(container: HTMLElement, type: 'shadow' | 'light'): void {
		const color = type === 'shadow' ? '#3e2731' : '#d4a672'; // Темный/Светлый shade
		
		// Создаем ряд маленьких квадратиков под верхним карнизом
		// Ширина секции 210px.
		const dentilCount = 10;
		const spacing = 20;
		
		for (let i = 0; i < dentilCount; i++) {
			const dentil = $('.px-block');
			dentil.style.top = '12px'; // Позиция под верхним карнизом
			dentil.style.left = `${10 + i * spacing}px`;
			dentil.style.width = '4px';
			dentil.style.height = '4px';
			dentil.style.backgroundColor = color;
			dentil.style.opacity = '0.5'; // Немного приглушаем
			container.appendChild(dentil);
		}
	}
	
	// @ts-expect-error - Unused fireplace method, kept for future use
	private _startFireSimulation(container: HTMLElement): void {
		// Начинаем с малого огня
		const baseFlame = $('.fire-base-layer');
		baseFlame.style.width = '20px'; // Маленький старт
		baseFlame.style.left = '150px';
		container.appendChild(baseFlame);

		// Таймер частиц
		this._fireTimer = setInterval(() => {
			if (!this.contentArea) return;
			this.updateFireVisuals(container, baseFlame);
		}, 30);

		// Таймер горения
		this._burnTimer = setInterval(() => {
			this.processBurning(container);
		}, 100);
		
		// Добавляем стартовые дрова
		this.addInitialLogs(container);
	}
	
	private addInitialLogs(container: HTMLElement): void {
		// Стартовые 3 бревна
		for (let i = 0; i < 3; i++) {
			setTimeout(() => {
				const x = 120 + Math.random() * 80;
				const y = 250 + Math.random() * 15;
				this.createLogInFire(container, x, y);
			}, i * 500);
		}
	}
	
	private processBurning(container: HTMLElement): void {
		this._logs.forEach(log => {
			if (log.fuel > 0) {
				log.fuel -= 0.3; // Медленнее горят
				this.updateLogAppearance(log);
			}
		});
		
		// Автоматическое пополнение по мере компиляции
		const targetLogs = Math.floor(3 + (this._compilationProgress / 100) * 7); // 3-10 дров
		
		if (this._logs.length < targetLogs && Math.random() > 0.95) {
			const x = 100 + Math.random() * 120;
			const y = 245 + Math.random() * 20;
			this.createLogInFire(container, x, y);
		}
		
		// Очистка пепла
		this.cleanupOldLogs();
	}
	
	private cleanupOldLogs(): void {
		const ashLogs = this._logs.filter(l => l.fuel <= 0);
		if (ashLogs.length > 3) {
			const oldLog = ashLogs[0];
			oldLog.element.style.transition = 'opacity 1s';
			oldLog.element.style.opacity = '0';
			setTimeout(() => oldLog.element.remove(), 1000);
			this._logs.splice(this._logs.indexOf(oldLog), 1);
		}
	}
	
	private updateLogAppearance(log: ILogState): void {
		const el = log.element;
		const pct = log.fuel / log.maxFuel;
		
		// Стадия 1: Горение (Charred)
		if (pct < 0.8 && pct > 0) {
			if (!el.classList.contains('burning')) {
				el.classList.add('burning');
			}
			// Мерцание тлеющих углей
			if (Math.random() > 0.8) {
				el.style.boxShadow = `inset 0 0 ${5 + Math.random() * 10}px #ff4500`;
			}
		}
		
		// Стадия 2: Пепел (Ash)
		if (log.fuel <= 0) {
			if (el.classList.contains('burning')) el.classList.remove('burning');
			if (!el.classList.contains('ash')) {
				el.classList.add('ash');
			}
		}
	}
	
	private createLogInFire(container: HTMLElement, x: number, y: number): void {
		const log = $('.wood-log');
		
		log.style.left = `${x}px`;
		log.style.top = `${y}px`;
		log.style.width = '50px';
		log.style.height = '14px';
		log.style.transform = `rotate(${Math.random() * 20 - 10}deg)`;
		
		const end = $('.wood-end');
		log.appendChild(end);
		
		container.appendChild(log);
		
		// Анимация появления
		log.animate(
			[
				{ transform: `translateY(-30px) rotate(0deg)`, opacity: '0' },
				{ transform: `translateY(0) rotate(${Math.random() * 20 - 10}deg)`, opacity: '1' }
			],
			{ duration: 300, easing: 'ease-out', fill: 'forwards' }
		);
		
		this._logs.push({
			element: log,
			fuel: 150,
			maxFuel: 150
		});
	}

	private updateFireVisuals(container: HTMLElement, baseFlame: HTMLElement): void {
		// Интенсивность зависит от прогресса компиляции
		const intensity = 0.3 + (this._compilationProgress / 100) * 0.7; // 0.3-1.0
		
		// 1. Обновляем базовое пламя
		baseFlame.style.opacity = Math.min(0.8, 0.2 + intensity * 0.6).toString();
		baseFlame.style.transform = `scale(${0.5 + intensity * 1.5})`; // Растет с прогрессом
		baseFlame.style.width = `${20 + intensity * 60}px`; // От 20px до 80px
		
		const glow = container.querySelector('.fire-glow') as HTMLElement;
		if (glow) {
			glow.style.opacity = Math.min(0.9, 0.3 + intensity * 0.6).toString();
			glow.style.transform = `translate(-50%, -50%) scale(${0.8 + intensity * 0.4})`;
		}

		// 2. Спавн частиц (больше при высоком прогрессе)
		const spawnCount = Math.ceil(intensity * 2);
		
		for (let i = 0; i < spawnCount; i++) {
			if (Math.random() > intensity) continue;
			this.spawnFireParticle(container, intensity);
		}
	}

	private spawnFireParticle(container: HTMLElement, intensity: number): void {
		const particle = $('.fire-particle');
		
		// Разброс зависит от интенсивности
		const spreadX = 80 * Math.min(1.5, intensity);
		const startX = 160 + (Math.random() - 0.5) * spreadX;
		const startY = 260 + (Math.random() * 20);
		
		particle.style.left = `${startX}px`;
		particle.style.top = `${startY}px`;
		
		// Размер частиц зависит от интенсивности
		const sizeBase = 4 + Math.random() * 5;
		const sizeMult = 0.4 + 0.6 * Math.min(1, intensity);
		const size = sizeBase * sizeMult;
		
		particle.style.width = `${size}px`;
		particle.style.height = `${size}px`;

		// Скорость полета
		const duration = 0.8 + Math.random() * 0.6;
		particle.style.animation = `fireRise ${duration}s ease-out forwards`;

		container.appendChild(particle);

		// Удаляем элемент после анимации
		setTimeout(() => {
			if (particle.parentElement) {
				particle.parentElement.removeChild(particle);
			}
		}, duration * 1000);
	}

	private onCompilationSuccess(): void {
		this.clearPxTimers();
		
		// Update text
		const text = this.contentArea?.querySelector('.void-compilation-text') as HTMLElement;
		if (text) {
			text.textContent = 'Compilation complete!';
			text.classList.add('success');
		}
		
		const status = this.contentArea?.querySelector('.void-compilation-status') as HTMLElement;
		if (status) {
			status.textContent = 'Game ready to launch';
		}
		
		// НЕ переключаемся автоматически - пусть пользователь смотрит на камин
		// Просто обновляем терминал в фоне
		this.updateTerminalInBackground('[Void Engine] ✓ Compilation successful!');
		this.updateTerminalInBackground('[Void Engine] Game ready to launch');
	}

	private updateTerminalInBackground(text: string): void {
		// Обновляем терминал, но не показываем его
		let terminal = this.terminalContent?.querySelector('.void-terminal-output');
		
		if (!terminal) {
			const terminalEl = $('.void-game-terminal');
			const output = $('.void-terminal-output');
			terminalEl.appendChild(output);
			this.terminalContent = terminalEl;
			terminal = output;
		}
		
		const line = $('.void-terminal-line.void-terminal-success');
		line.textContent = text;
		terminal.appendChild(line);
	}

	public addTerminalLine(text: string, type: 'normal' | 'success' | 'error' | 'warning' = 'normal'): void {
		// Find terminal output (even if not currently visible)
		let terminal = this.terminalContent?.querySelector('.void-terminal-output');
		
		// If terminal doesn't exist yet, create it
		if (!terminal) {
			const terminalEl = $('.void-game-terminal');
			const output = $('.void-terminal-output');
			terminalEl.appendChild(output);
			this.terminalContent = terminalEl;
			terminal = output;
		}
		
		const line = $('.void-terminal-line');
		if (type !== 'normal') {
			line.classList.add(`void-terminal-${type}`);
		}
		line.textContent = text;
		terminal.appendChild(line);
		
		// ВСЕГДА авто-скролл вниз при добавлении новой строки
		if (this.terminalContent) {
			// Используем requestAnimationFrame для плавного скролла
			requestAnimationFrame(() => {
				if (this.terminalContent) {
					this.terminalContent.scrollTop = this.terminalContent.scrollHeight;
				}
			});
		}
	}

	private onCompilationFailure(): void {
		this.clearPxTimers();
		
		// Update text
		const text = this.contentArea?.querySelector('.void-compilation-text') as HTMLElement;
		if (text) {
			text.textContent = 'Compilation failed!';
			text.classList.add('error');
		}
		
		const status = this.contentArea?.querySelector('.void-compilation-status') as HTMLElement;
		if (status) {
			status.textContent = 'Check terminal for errors';
		}
		
		// При ошибке тоже не переключаемся автоматически
		// Пользователь может сам переключиться на Terminal если нужно
	}

	public updateCompilationProgress(progress: number, message: string): void {
		this._compilationProgress = progress;
		
		// Update progress bar
		const progressBar = this.contentArea?.querySelector('.progress-bar-fill') as HTMLElement;
		if (progressBar) {
			progressBar.style.width = `${progress}%`;
		}
		
		// Update percent text
		const percentText = this.contentArea?.querySelector('.compilation-percent-text') as HTMLElement;
		if (percentText) {
			percentText.textContent = `${Math.round(progress)}%`;
		}
		
		// Update status text
		const statusText = this.contentArea?.querySelector('.compilation-status-text') as HTMLElement;
		if (statusText) {
			if (progress < 100) {
				statusText.textContent = 'Компиляция...';
			} else {
				statusText.textContent = 'Запуск игры...';
			}
		}
	}

	public showError(errorMessage: string): void {
		if (!this.contentArea || !this.window) return;
		
		// Expand window
		const windowContainer = this.window.querySelector('.void-game-window') as HTMLElement;
		if (windowContainer) {
			windowContainer.style.width = '700px';
			windowContainer.style.maxHeight = '600px';
		}
		
		// Clear content and show error
		clearNode(this.contentArea);
		
		const errorContainer = $('.error-container');
		errorContainer.style.padding = '20px';
		
		const errorTitle = $('.error-title');
		errorTitle.textContent = '❌ Compilation Failed';
		errorTitle.style.fontSize = '20px';
		errorTitle.style.fontWeight = 'bold';
		errorTitle.style.color = '#ff6b6b';
		errorTitle.style.marginBottom = '15px';
		
		const errorText = $('.error-message');
		errorText.textContent = errorMessage;
		errorText.style.color = '#fff';
		errorText.style.marginBottom = '20px';
		errorText.style.whiteSpace = 'pre-wrap';
		
		errorContainer.appendChild(errorTitle);
		errorContainer.appendChild(errorText);
		
		// Show terminal with logs if available
		if (this.terminalContent) {
			const logsTitle = $('.logs-title');
			logsTitle.textContent = 'Build Logs:';
			logsTitle.style.fontSize = '16px';
			logsTitle.style.fontWeight = 'bold';
			logsTitle.style.marginTop = '20px';
			logsTitle.style.marginBottom = '10px';
			
			errorContainer.appendChild(logsTitle);
			errorContainer.appendChild(this.terminalContent);
		}
		
		// Close button
		const closeButton = $('.close-error-button');
		closeButton.textContent = 'Close';
		closeButton.style.padding = '10px 20px';
		closeButton.style.background = '#ff6b6b';
		closeButton.style.border = 'none';
		closeButton.style.borderRadius = '4px';
		closeButton.style.color = '#fff';
		closeButton.style.cursor = 'pointer';
		closeButton.style.marginTop = '15px';
		
		this._register(addDisposableListener(closeButton, EventType.CLICK, () => {
			this.dispose();
		}));
		
		errorContainer.appendChild(closeButton);
		append(this.contentArea, errorContainer);
	}

	public onCompilationComplete(success: boolean): void {
		if (success) {
			this.onCompilationSuccess();
		} else {
			this.onCompilationFailure();
		}
	}

	private cleanupToy(): void {
		for (const t of this._toyTimers) clearTimeout(t);
		this._toyTimers = [];
		for (const d of this._toyDisposables) d.dispose();
		this._toyDisposables = [];
	}

	private clearPxTimers(): void {
		this.cleanupToy();
	}
	
	override dispose(): void {
		if (this._fireTimer) clearInterval(this._fireTimer);
		if (this._burnTimer) clearInterval(this._burnTimer);
		this.clearPxTimers();
		
		// Remove window from DOM
		if (this.window && this.window.parentElement) {
			this.window.parentElement.removeChild(this.window);
		}
		
		super.dispose();
	}
}

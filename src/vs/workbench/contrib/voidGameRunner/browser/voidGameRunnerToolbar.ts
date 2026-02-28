/*---------------------------------------------------------------------------------------------
 *  Void Engine - Game Runner Toolbar
 *  F5 and F6 buttons in titlebar for running games
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { $, addDisposableListener, EventType, append } from '../../../../base/browser/dom.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import './media/voidGameRunnerToolbar.css';

export class VoidGameRunnerToolbar extends Disposable {
	private container: HTMLElement | null = null;

	constructor(
		@ICommandService private readonly commandService: ICommandService
	) {
		super();
		this.create();
	}

	private create(): void {
		// Wait for titlebar to be ready
		const checkTitlebar = () => {
			const titlebar = document.querySelector('.titlebar-center');
			if (titlebar) {
				console.log('[Void Game Runner] Found titlebar element:', titlebar.className);
				this.createToolbar(titlebar as HTMLElement);
			} else {
				setTimeout(checkTitlebar, 100);
			}
		};
		checkTitlebar();
	}

	private createToolbar(titlebar: HTMLElement): void {
		// Create container
		this.container = $('.void-game-runner-toolbar');

		// F5 Button - Build & Run (Play triangle)
		const f5Button = $('.void-game-runner-button');
		f5Button.title = 'Build & Run (F5)';
		f5Button.setAttribute('role', 'button');
		f5Button.setAttribute('tabindex', '0');

		// Play triangle icon (rounded)
		const playSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		playSvg.classList.add('void-runner-icon');
		playSvg.setAttribute('viewBox', '0 0 24 24');
		playSvg.setAttribute('fill', 'none');

		const playPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		playPath.setAttribute('d', 'M8 5.5C8 4.67 8.9 4.13 9.6 4.55L17.4 9.05C18.1 9.47 18.1 10.53 17.4 10.95L9.6 15.45C8.9 15.87 8 15.33 8 14.5V5.5Z');
		playPath.setAttribute('fill', 'currentColor');

		playSvg.appendChild(playPath);
		f5Button.appendChild(playSvg);

		this._register(addDisposableListener(f5Button, EventType.CLICK, (e) => {
			e.preventDefault();
			e.stopPropagation();
			console.log('[Void Game Runner Toolbar] F5 button clicked!');
			this.commandService.executeCommand('voidGameRunner.buildAndRun').then(() => {
				console.log('[Void Game Runner Toolbar] Command executed successfully');
			}).catch(err => {
				console.error('[Void Game Runner Toolbar] Command failed:', err);
			});
		}));

		// F6 Button - Cargo Watch (Clock icon)
		const f6Button = $('.void-game-runner-button');
		f6Button.title = 'Start Cargo Watch (F6)';
		f6Button.setAttribute('role', 'button');
		f6Button.setAttribute('tabindex', '0');

		// Clock icon
		const clockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		clockSvg.classList.add('void-runner-icon');
		clockSvg.setAttribute('viewBox', '0 0 24 24');
		clockSvg.setAttribute('fill', 'none');

		const clockCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		clockCircle.setAttribute('cx', '12');
		clockCircle.setAttribute('cy', '12');
		clockCircle.setAttribute('r', '9');
		clockCircle.setAttribute('stroke', 'currentColor');
		clockCircle.setAttribute('stroke-width', '2');

		const clockHourHand = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		clockHourHand.setAttribute('d', 'M12 6v6l4 2');
		clockHourHand.setAttribute('stroke', 'currentColor');
		clockHourHand.setAttribute('stroke-width', '2');
		clockHourHand.setAttribute('stroke-linecap', 'round');

		clockSvg.appendChild(clockCircle);
		clockSvg.appendChild(clockHourHand);
		f6Button.appendChild(clockSvg);

		this._register(addDisposableListener(f6Button, EventType.CLICK, (e) => {
			e.preventDefault();
			e.stopPropagation();
			console.log('[Void Game Runner Toolbar] F6 button clicked!');
			this.commandService.executeCommand('voidGameRunner.startWatch').then(() => {
				console.log('[Void Game Runner Toolbar] Command executed successfully');
			}).catch(err => {
				console.error('[Void Game Runner Toolbar] Command failed:', err);
			});
		}));

		// Add buttons to container
		append(this.container, f5Button);
		append(this.container, f6Button);

		// Insert after titlebar-center
		if (titlebar.nextSibling) {
			titlebar.parentElement?.insertBefore(this.container, titlebar.nextSibling);
		} else {
			titlebar.parentElement?.appendChild(this.container);
		}

		console.log('[Void Game Runner] Toolbar created and inserted into titlebar');
	}

	override dispose(): void {
		if (this.container && this.container.parentElement) {
			this.container.parentElement.removeChild(this.container);
		}
		super.dispose();
	}
}

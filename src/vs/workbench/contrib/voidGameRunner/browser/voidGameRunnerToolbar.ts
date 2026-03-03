/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { $, addDisposableListener, EventType, append } from '../../../../base/browser/dom.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import './media/voidGameRunnerToolbar.css';

export class VoidGameRunnerToolbar extends Disposable {
	private container: HTMLElement | null = null;
	private readonly resetTimers = new Set<number>();

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
		f5Button.dataset.state = 'idle';

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
			this.setButtonState(f5Button, 'running');
			this.commandService.executeCommand('voidGameRunner.buildAndRun').then(() => {
				console.log('[Void Game Runner Toolbar] Command executed successfully');
				this.setButtonState(f5Button, 'success');
			}).catch(err => {
				console.error('[Void Game Runner Toolbar] Command failed:', err);
				this.setButtonState(f5Button, 'error');
			});
		}));

		// F6 Button - Build project (Tool icon)
		const f6Button = $('.void-game-runner-button');
		f6Button.title = 'Build Project (F6)';
		f6Button.setAttribute('role', 'button');
		f6Button.setAttribute('tabindex', '0');
		f6Button.dataset.state = 'idle';

		// Wrench icon
		const wrenchSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		wrenchSvg.classList.add('void-runner-icon');
		wrenchSvg.setAttribute('viewBox', '0 0 24 24');
		wrenchSvg.setAttribute('fill', 'none');

		const wrenchPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		wrenchPath.setAttribute('d', 'M14.6 4.4a4.2 4.2 0 0 0-5.4 5.3L4.9 14l5.1 5.1 4.3-4.3a4.2 4.2 0 0 0 5.3-5.4l-2.4 2.4-2.6-.7-.7-2.6 2.4-2.4Z');
		wrenchPath.setAttribute('fill', 'currentColor');

		wrenchSvg.appendChild(wrenchPath);
		f6Button.appendChild(wrenchSvg);

		this._register(addDisposableListener(f6Button, EventType.CLICK, (e) => {
			e.preventDefault();
			e.stopPropagation();
			console.log('[Void Game Runner Toolbar] F6 button clicked!');
			this.setButtonState(f6Button, 'running');
			this.commandService.executeCommand('voidGameRunner.buildProject').then(() => {
				console.log('[Void Game Runner Toolbar] Command executed successfully');
				this.setButtonState(f6Button, 'success');
			}).catch(err => {
				console.error('[Void Game Runner Toolbar] Command failed:', err);
				this.setButtonState(f6Button, 'error');
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

	private setButtonState(button: HTMLElement, state: 'idle' | 'running' | 'success' | 'error'): void {
		button.setAttribute('aria-busy', state === 'running' ? 'true' : 'false');
		button.dataset.state = state;
		if (state === 'success' || state === 'error') {
			const timer = window.setTimeout(() => {
				this.resetTimers.delete(timer);
				button.dataset.state = 'idle';
				button.setAttribute('aria-busy', 'false');
			}, 1200);
			this.resetTimers.add(timer);
		}
	}

	override dispose(): void {
		for (const timer of this.resetTimers) {
			window.clearTimeout(timer);
		}
		this.resetTimers.clear();
		if (this.container && this.container.parentElement) {
			this.container.parentElement.removeChild(this.container);
		}
		super.dispose();
	}
}

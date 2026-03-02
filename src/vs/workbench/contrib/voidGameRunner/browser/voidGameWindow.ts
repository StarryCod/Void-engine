/*---------------------------------------------------------------------------------------------
 *  Void Engine - Build/Run Window
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { $, addDisposableListener, EventType, append } from '../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import './media/voidGameWindow.css';

export interface IGameWindowOptions {
	workspacePath: string;
	mode: 'release' | 'debug';
	buildRequired: boolean;
}

type TerminalLineType = 'normal' | 'success' | 'error' | 'warning';

export class VoidGameWindow extends Disposable {
	private overlay: HTMLElement | undefined;
	private statusLine: HTMLElement | undefined;
	private progressFill: HTMLElement | undefined;
	private progressLabel: HTMLElement | undefined;
	private logList: HTMLElement | undefined;
	private closeButton: HTMLButtonElement | undefined;

	private readonly _onDidClose = this._register(new Emitter<void>());
	public readonly onDidClose: Event<void> = this._onDidClose.event;

	constructor(
		private readonly options: IGameWindowOptions
	) {
		super();
		this.create();
	}

	private create(): void {
		this.overlay = $('.void-game-window-overlay');
		const surface = append(this.overlay, $('.void-game-window'));

		const header = append(surface, $('.void-game-window-header'));
		const title = append(header, $('.void-game-window-title'));
		title.textContent = this.options.mode === 'release' ? 'Build & Run (Release)' : 'Build & Run (Debug)';
		const workspace = append(header, $('.void-game-window-workspace'));
		workspace.textContent = this.options.workspacePath;

		this.closeButton = append(header, $('button.void-game-window-close.codicon.codicon-close')) as HTMLButtonElement;
		this.closeButton.type = 'button';
		this.closeButton.setAttribute('aria-label', 'Close build window');
		this._register(addDisposableListener(this.closeButton, EventType.CLICK, () => this.dispose()));

		const body = append(surface, $('.void-game-window-body'));
		const stateCard = append(body, $('.void-build-state-card'));
		this.statusLine = append(stateCard, $('.void-build-status'));
		this.statusLine.textContent = 'Preparing build...';

		const progressTrack = append(stateCard, $('.void-build-progress-track'));
		this.progressFill = append(progressTrack, $('.void-build-progress-fill'));
		this.progressLabel = append(stateCard, $('.void-build-progress-label'));
		this.progressLabel.textContent = '0%';

		const logsCard = append(body, $('.void-build-logs-card'));
		const logsTitle = append(logsCard, $('.void-build-logs-title'));
		logsTitle.textContent = 'Output';
		this.logList = append(logsCard, $('.void-build-logs-list'));

		document.body.appendChild(this.overlay);
		this.addTerminalLine('[Void Build] window started', 'normal');
	}

	public addTerminalLine(text: string, type: TerminalLineType = 'normal'): void {
		if (!this.logList) {
			return;
		}
		const line = append(this.logList, $('.void-build-log-line'));
		if (type !== 'normal') {
			line.classList.add(type);
		}
		line.textContent = text;
		this.logList.scrollTop = this.logList.scrollHeight;
	}

	public updateCompilationProgress(progress: number, message: string): void {
		const clamped = Math.max(0, Math.min(100, progress));
		if (this.progressFill) {
			this.progressFill.style.width = `${clamped}%`;
		}
		if (this.progressLabel) {
			this.progressLabel.textContent = `${Math.round(clamped)}%`;
		}
		if (this.statusLine) {
			this.statusLine.textContent = message || 'Building...';
			this.statusLine.classList.toggle('success', clamped >= 100);
			this.statusLine.classList.remove('error');
		}
		this.addTerminalLine(`[${Math.round(clamped)}%] ${message}`, clamped >= 100 ? 'success' : 'normal');
	}

	public showError(errorMessage: string): void {
		if (this.statusLine) {
			this.statusLine.textContent = 'Build failed';
			this.statusLine.classList.remove('success');
			this.statusLine.classList.add('error');
		}
		this.addTerminalLine(errorMessage, 'error');
		if (this.progressFill) {
			this.progressFill.classList.add('error');
		}
	}

	public onCompilationComplete(success: boolean): void {
		if (success) {
			this.updateCompilationProgress(100, 'Build completed');
			this.addTerminalLine('[Void Build] finished successfully', 'success');
		} else {
			this.showError('Build failed. See output for details.');
		}
	}

	override dispose(): void {
		if (this.overlay?.parentElement) {
			this.overlay.parentElement.removeChild(this.overlay);
		}
		this._onDidClose.fire();
		super.dispose();
	}
}


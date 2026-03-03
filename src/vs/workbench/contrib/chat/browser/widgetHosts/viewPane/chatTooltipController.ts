/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../../../base/browser/dom.js';
import { IDisposable } from '../../../../../../base/common/lifecycle.js';

export class ChatTooltipOverlayController implements IDisposable {
	private readonly overlay: HTMLElement;
	private target: HTMLElement | undefined;
	private readonly onPointerOver: (event: PointerEvent) => void;
	private readonly onPointerOut: (event: PointerEvent) => void;
	private readonly onFocusIn: (event: FocusEvent) => void;
	private readonly onFocusOut: (event: FocusEvent) => void;
	private readonly onContainerScroll: () => void;
	private readonly onResize: () => void;

	constructor(private readonly container: HTMLElement) {
		this.overlay = append(container, $('.void-chat-tooltip-overlay'));

		this.onPointerOver = (event: PointerEvent): void => {
			const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
			if (!target || !container.contains(target)) {
				return;
			}
			this.show(target);
		};

		this.onPointerOut = (event: PointerEvent): void => {
			const relatedTarget = event.relatedTarget as HTMLElement | null;
			const nextTarget = relatedTarget?.closest<HTMLElement>('[data-tooltip]');
			if (nextTarget && container.contains(nextTarget)) {
				this.show(nextTarget);
				return;
			}
			this.hide();
		};

		this.onFocusIn = (event: FocusEvent): void => {
			const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
			if (!target || container.contains(target) === false) {
				return;
			}
			this.show(target);
		};

		this.onFocusOut = (event: FocusEvent): void => {
			const relatedTarget = event.relatedTarget as HTMLElement | null;
			const nextTarget = relatedTarget?.closest<HTMLElement>('[data-tooltip]');
			if (nextTarget && container.contains(nextTarget)) {
				this.show(nextTarget);
				return;
			}
			this.hide();
		};

		this.onContainerScroll = (): void => {
			if (this.target) {
				this.position(this.target);
			}
		};

		this.onResize = (): void => {
			if (this.target) {
				this.position(this.target);
			}
		};

		container.addEventListener('pointerover', this.onPointerOver);
		container.addEventListener('pointerout', this.onPointerOut);
		container.addEventListener('focusin', this.onFocusIn);
		container.addEventListener('focusout', this.onFocusOut);
		container.addEventListener('scroll', this.onContainerScroll, true);
		window.addEventListener('resize', this.onResize);
	}

	dispose(): void {
		this.container.removeEventListener('pointerover', this.onPointerOver);
		this.container.removeEventListener('pointerout', this.onPointerOut);
		this.container.removeEventListener('focusin', this.onFocusIn);
		this.container.removeEventListener('focusout', this.onFocusOut);
		this.container.removeEventListener('scroll', this.onContainerScroll, true);
		window.removeEventListener('resize', this.onResize);
		this.hide();
		this.overlay.remove();
	}

	private show(target: HTMLElement): void {
		const tooltipText = target.getAttribute('data-tooltip')?.trim();
		if (!tooltipText) {
			this.hide();
			return;
		}

		this.target = target;
		this.overlay.textContent = tooltipText;
		this.overlay.classList.add('visible');
		this.position(target);
	}

	private hide(): void {
		this.target = undefined;
		this.overlay.classList.remove('visible');
		this.overlay.style.visibility = 'hidden';
	}

	private position(target: HTMLElement): void {
		this.overlay.style.left = '0px';
		this.overlay.style.top = '0px';
		this.overlay.style.visibility = 'hidden';

		const margin = 8;
		const targetRect = target.getBoundingClientRect();
		const tooltipRect = this.overlay.getBoundingClientRect();

		let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
		let top = targetRect.top - tooltipRect.height - 8;

		if (top < margin) {
			top = targetRect.bottom + 8;
		}

		const maxLeft = Math.max(margin, window.innerWidth - tooltipRect.width - margin);
		left = Math.min(Math.max(left, margin), maxLeft);

		this.overlay.style.left = `${Math.round(left)}px`;
		this.overlay.style.top = `${Math.round(top)}px`;
		this.overlay.style.visibility = 'visible';
	}
}


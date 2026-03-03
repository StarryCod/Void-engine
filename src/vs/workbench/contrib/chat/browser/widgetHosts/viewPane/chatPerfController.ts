/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../../../../../../base/common/lifecycle.js';

export class ChatRafScheduler implements IDisposable {
	private handle: number | undefined;

	schedule(callback: () => void): void {
		if (typeof this.handle === 'number') {
			return;
		}
		this.handle = window.requestAnimationFrame(() => {
			this.handle = undefined;
			callback();
		});
	}

	dispose(): void {
		if (typeof this.handle === 'number') {
			window.cancelAnimationFrame(this.handle);
			this.handle = undefined;
		}
	}
}

export class ChatLongTaskObserverController implements IDisposable {
	private observer: PerformanceObserver | undefined;

	constructor(
		private readonly thresholdMs: number,
		private readonly onLongTask: (durationMs: number) => void
	) { }

	start(): void {
		if (!('PerformanceObserver' in window) || this.observer) {
			return;
		}
		try {
			this.observer = new PerformanceObserver((entries) => {
				for (const entry of entries.getEntries()) {
					if (entry.duration >= this.thresholdMs) {
						this.onLongTask(entry.duration);
					}
				}
			});
			this.observer.observe({ entryTypes: ['longtask'] });
		} catch {
			// Ignore unsupported observer environments.
		}
	}

	dispose(): void {
		this.observer?.disconnect();
		this.observer = undefined;
	}
}


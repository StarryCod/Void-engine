/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IVoidRuntimeService } from '../common/voidRuntimeService.js';
import { VoidRuntimeService } from './voidRuntimeService.js';
import { detectPotentialListenerLeak } from '../common/voidRuntimeQa.js';

registerSingleton(IVoidRuntimeService, VoidRuntimeService, InstantiationType.Delayed);

class VoidRuntimeContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.voidRuntime';
	private originalConsoleInfo: ((...data: unknown[]) => void) | undefined;
	private originalConsoleWarn: ((...data: unknown[]) => void) | undefined;
	private originalConsoleError: ((...data: unknown[]) => void) | undefined;
	private listenerLeakAlertHandle: number | undefined;
	private listenerLeakBanner: HTMLElement | null = null;

	constructor(
		@IVoidRuntimeService private readonly runtimeService: IVoidRuntimeService,
		@IWorkspaceContextService workspaceService: IWorkspaceContextService
	) {
		super();
		const workspacePath = workspaceService.getWorkspace().folders[0]?.uri.fsPath;
		this.runtimeService.transition('open', { workspacePath });
		this.runtimeService.publish('system', 'runtime.initialized', { workspacePath });
		this.installListenerLeakSentinel();
		this._register(this.runtimeService.onDidPublishEvent(event => {
			if (event.channel === 'system' && event.type === 'listenerLeak.detected') {
				this.showListenerLeakAlert(event.payload as { listenerCount?: number } | undefined);
			}
		}));
	}

	private installListenerLeakSentinel(): void {
		const inspect = (args: unknown[]): void => {
			const leak = detectPotentialListenerLeak(args);
			if (!leak) {
				return;
			}
			this.runtimeService.reportPotentialListenerLeak(leak);
		};

		this.originalConsoleInfo = console.info.bind(console);
		this.originalConsoleWarn = console.warn.bind(console);
		this.originalConsoleError = console.error.bind(console);

		console.info = (...args: unknown[]) => {
			inspect(args);
			this.originalConsoleInfo?.(...args);
		};
		console.warn = (...args: unknown[]) => {
			inspect(args);
			this.originalConsoleWarn?.(...args);
		};
		console.error = (...args: unknown[]) => {
			inspect(args);
			this.originalConsoleError?.(...args);
		};
	}

	private showListenerLeakAlert(payload: { listenerCount?: number } | undefined): void {
		const listenerCount = payload?.listenerCount ?? 0;
		if (!this.listenerLeakBanner) {
			this.listenerLeakBanner = document.createElement('div');
			this.listenerLeakBanner.className = 'void-runtime-listener-alert';
			this.listenerLeakBanner.style.position = 'fixed';
			this.listenerLeakBanner.style.right = '18px';
			this.listenerLeakBanner.style.bottom = '18px';
			this.listenerLeakBanner.style.zIndex = '2000';
			this.listenerLeakBanner.style.padding = '10px 12px';
			this.listenerLeakBanner.style.borderRadius = '10px';
			this.listenerLeakBanner.style.background = 'rgba(34, 20, 18, 0.92)';
			this.listenerLeakBanner.style.border = '1px solid rgba(212, 122, 74, 0.65)';
			this.listenerLeakBanner.style.color = '#f0d9c8';
			this.listenerLeakBanner.style.font = '12px Segoe UI, sans-serif';
			this.listenerLeakBanner.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.35)';
			document.body.appendChild(this.listenerLeakBanner);
		}

		this.listenerLeakBanner.textContent = `Listener leak detected: ${listenerCount} listeners`;
		this.listenerLeakBanner.style.display = 'block';

		if (typeof this.listenerLeakAlertHandle === 'number') {
			window.clearTimeout(this.listenerLeakAlertHandle);
		}
		this.listenerLeakAlertHandle = window.setTimeout(() => {
			if (this.listenerLeakBanner) {
				this.listenerLeakBanner.style.display = 'none';
			}
		}, 5000);
	}

	override dispose(): void {
		if (this.originalConsoleInfo) {
			console.info = this.originalConsoleInfo;
		}
		if (this.originalConsoleWarn) {
			console.warn = this.originalConsoleWarn;
		}
		if (this.originalConsoleError) {
			console.error = this.originalConsoleError;
		}
		if (typeof this.listenerLeakAlertHandle === 'number') {
			window.clearTimeout(this.listenerLeakAlertHandle);
			this.listenerLeakAlertHandle = undefined;
		}
		this.listenerLeakBanner?.remove();
		this.listenerLeakBanner = null;
		super.dispose();
	}
}

registerWorkbenchContribution2(
	VoidRuntimeContribution.ID,
	VoidRuntimeContribution,
	WorkbenchPhase.BlockRestore
);

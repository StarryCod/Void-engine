/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/voidShell.css';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { VOID_PRODUCT_UI_PROFILE } from '../common/voidProductProfileService.js';

class VoidShellContribution extends Disposable {
	private readonly profile = VOID_PRODUCT_UI_PROFILE;

	private mutationObserver: MutationObserver | undefined;
	private pruneScheduled = false;
	private pruneFrameHandle: number | undefined;
	private pruneInProgress = false;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();

		this.applyMode();
		this._register(this.configurationService.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('void.dev.enableWorkbenchFallback')) {
				this.applyMode();
			}
		}));
	}

	private applyMode(): void {
		const fallbackEnabled = this.configurationService.getValue<boolean>('void.dev.enableWorkbenchFallback') === true;
		document.body.classList.add('void-engine-shell');
		document.body.classList.toggle('void-shell-dev-fallback', fallbackEnabled);

		if (fallbackEnabled) {
			this.stopObserver();
			return;
		}

		this.schedulePrune();
		this.ensureObserver();
	}

	private ensureObserver(): void {
		if (this.mutationObserver) {
			return;
		}
		this.mutationObserver = new MutationObserver(() => this.schedulePrune());
		this.mutationObserver.observe(document.body, {
			childList: true,
			subtree: true
		});
	}

	private stopObserver(): void {
		this.mutationObserver?.disconnect();
		this.mutationObserver = undefined;
		if (typeof this.pruneFrameHandle === 'number') {
			window.cancelAnimationFrame(this.pruneFrameHandle);
			this.pruneFrameHandle = undefined;
		}
		this.pruneScheduled = false;
		this.pruneInProgress = false;
	}

	private schedulePrune(): void {
		if (this.pruneScheduled) {
			return;
		}
		this.pruneScheduled = true;
		this.pruneFrameHandle = window.requestAnimationFrame(() => {
			this.pruneFrameHandle = undefined;
			this.pruneScheduled = false;
			this.runPrune();
		});
	}

	private runPrune(): void {
		if (this.pruneInProgress) {
			return;
		}
		this.pruneInProgress = true;
		try {
			this.pruneWorkbenchSurface();
		} finally {
			this.pruneInProgress = false;
		}
	}

	private pruneWorkbenchSurface(): void {
		this.pruneActivityBar();
		this.pruneTitlebarActions();
		this.pruneStatusbarActions();
		this.pruneLegacyViews();
		this.pruneLegacyViewPanes();
	}

	private pruneActivityBar(): void {
		const actionItems = Array.from(document.querySelectorAll<HTMLElement>('.monaco-workbench .activitybar .action-item'));
		for (const item of actionItems) {
			const compositeId = this.resolveCompositeId(item);
			if (compositeId && this.profile.hiddenViewContainers.has(compositeId)) {
				this.hideNode(item);
				continue;
			}

			if (compositeId && compositeId.startsWith('workbench.view.') && this.profile.allowedViewContainers.size > 0) {
				if (!this.profile.allowedViewContainers.has(compositeId)) {
					this.hideNode(item);
					continue;
				}
			}

			const label = `${item.getAttribute('aria-label') ?? ''} ${item.getAttribute('title') ?? ''}`.trim();
			if (label && this.shouldHideByPatterns(label)) {
				this.hideNode(item);
			}
		}
	}

	private pruneTitlebarActions(): void {
		const titleActions = Array.from(document.querySelectorAll<HTMLElement>('.monaco-workbench .part.titlebar .action-item'));
		for (const item of titleActions) {
			const label = `${item.getAttribute('aria-label') ?? ''} ${item.getAttribute('title') ?? ''}`.trim();
			if (label && this.shouldHideByPatterns(label)) {
				this.hideNode(item);
			}
		}
	}

	private pruneStatusbarActions(): void {
		const statusItems = Array.from(document.querySelectorAll<HTMLElement>('.monaco-workbench .part.statusbar .statusbar-item'));
		for (const item of statusItems) {
			const label = `${item.getAttribute('aria-label') ?? ''} ${item.getAttribute('title') ?? ''}`.trim();
			if (label && this.shouldHideByPatterns(label)) {
				this.hideNode(item);
			}
		}
	}

	private pruneLegacyViews(): void {
		for (const selector of this.profile.hiddenCompositeSelectors) {
			for (const node of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
				this.hideNode(node);
			}
		}
	}

	private pruneLegacyViewPanes(): void {
		const paneHeaders = Array.from(document.querySelectorAll<HTMLElement>('.monaco-workbench .pane-header'));
		for (const header of paneHeaders) {
			const label = `${header.getAttribute('aria-label') ?? ''} ${header.getAttribute('title') ?? ''} ${header.textContent ?? ''}`.trim();
			if (!label || !this.shouldHideByPatterns(label)) {
				continue;
			}
			const pane = header.closest<HTMLElement>('.split-view-view, .pane, .pane-composite-part');
			this.hideNode(pane ?? header);
		}
	}

	private shouldHideByPatterns(label: string): boolean {
		return this.profile.hiddenActionPatterns.some(pattern => pattern.test(label));
	}

	private resolveCompositeId(item: HTMLElement): string | undefined {
		const directId = item.getAttribute('data-id') ?? item.id;
		if (directId) {
			return directId;
		}
		const nested = item.querySelector<HTMLElement>('[data-id]');
		return nested?.getAttribute('data-id') ?? undefined;
	}

	private hideNode(node: HTMLElement): void {
		if (!node.classList.contains('void-shell-hidden')) {
			node.classList.add('void-shell-hidden');
		}
		if (node.getAttribute('aria-hidden') !== 'true') {
			node.setAttribute('aria-hidden', 'true');
		}
	}

	override dispose(): void {
		this.stopObserver();
		super.dispose();
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(VoidShellContribution, LifecyclePhase.Eventually);

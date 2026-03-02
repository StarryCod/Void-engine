/*---------------------------------------------------------------------------------------------
 *  Void Engine - Product Shell Cleanup
 *--------------------------------------------------------------------------------------------*/

import './media/voidShell.css';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';

class VoidShellContribution extends Disposable {
	private readonly activityHidePatterns: ReadonlyArray<RegExp> = [
		/accounts/i,
		/extensions?/i,
		/marketplace/i,
		/debug/i,
		/search/i,
		/testing/i,
		/notebook/i,
		/remote/i,
		/ports?/i,
		/comments?/i,
		/timeline/i
	];

	private readonly titlebarHidePatterns: ReadonlyArray<RegExp> = [
		/accounts?/i,
		/extensions?/i,
		/marketplace/i,
		/settings sync/i
	];

	private mutationObserver: MutationObserver | undefined;

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

		this.pruneWorkbenchSurface();
		this.ensureObserver();
	}

	private ensureObserver(): void {
		if (this.mutationObserver) {
			return;
		}
		this.mutationObserver = new MutationObserver(() => this.pruneWorkbenchSurface());
		this.mutationObserver.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['aria-label', 'title', 'class']
		});
	}

	private stopObserver(): void {
		this.mutationObserver?.disconnect();
		this.mutationObserver = undefined;
	}

	private pruneWorkbenchSurface(): void {
		this.pruneActivityBar();
		this.pruneTitlebarActions();
		this.pruneLegacyViews();
	}

	private pruneActivityBar(): void {
		const actionItems = Array.from(document.querySelectorAll<HTMLElement>('.monaco-workbench .activitybar .action-item'));
		for (const item of actionItems) {
			const label = `${item.getAttribute('aria-label') ?? ''} ${item.getAttribute('title') ?? ''}`.trim();
			if (label && this.activityHidePatterns.some(pattern => pattern.test(label))) {
				item.classList.add('void-shell-hidden');
				item.setAttribute('aria-hidden', 'true');
			}
		}
	}

	private pruneTitlebarActions(): void {
		const titleActions = Array.from(document.querySelectorAll<HTMLElement>('.monaco-workbench .part.titlebar .action-item'));
		for (const item of titleActions) {
			const label = `${item.getAttribute('aria-label') ?? ''} ${item.getAttribute('title') ?? ''}`.trim();
			if (label && this.titlebarHidePatterns.some(pattern => pattern.test(label))) {
				item.classList.add('void-shell-hidden');
				item.setAttribute('aria-hidden', 'true');
			}
		}
	}

	private pruneLegacyViews(): void {
		const selectors: ReadonlyArray<string> = [
			'.composite[data-id="workbench.view.extensions"]',
			'.composite[data-id="workbench.view.search"]',
			'.composite[data-id="workbench.panel.repl"]',
			'.composite[data-id="workbench.panel.markers"]'
		];

		for (const selector of selectors) {
			for (const node of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
				node.classList.add('void-shell-hidden');
				node.setAttribute('aria-hidden', 'true');
			}
		}
	}

	override dispose(): void {
		this.stopObserver();
		super.dispose();
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(VoidShellContribution, LifecyclePhase.Eventually);


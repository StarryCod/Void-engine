/*---------------------------------------------------------------------------------------------
 *  Void Engine IDE - Startup Loader Contribution
 *--------------------------------------------------------------------------------------------*/

import './media/voidStartupLoader.css';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { VoidStartupLoader } from './voidStartupLoader.js';

class VoidStartupLoaderContribution extends Disposable {
	
	private loader: VoidStartupLoader | undefined;
	private isHidden = false;

	constructor(
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@ILifecycleService private readonly lifecycleService: ILifecycleService
	) {
		super();
		this.showLoader();
	}

	private showLoader(): void {
		console.log('[Void Startup] Initializing loader...');
		
		// Show loader immediately
		this.loader = new VoidStartupLoader();
		const container = this.layoutService.getContainer(window);
		this.loader.show(container);
		
		// Hide when workbench is restored
		this.lifecycleService.when(LifecyclePhase.Restored).then(() => {
			console.log('[Void Startup] Workbench restored, hiding loader...');
			this.hideLoader();
		});
		
		// Safety timeout - hide after 5 seconds max
		setTimeout(() => {
			if (!this.isHidden) {
				console.log('[Void Startup] Safety timeout, hiding loader...');
				this.hideLoader();
			}
		}, 5000);
	}

	private hideLoader(): void {
		if (this.isHidden || !this.loader) return;
		this.isHidden = true;
		this.loader.hide();
		this.loader = undefined;
	}

	override dispose(): void {
		this.hideLoader();
		super.dispose();
	}
}

// Register contribution
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(VoidStartupLoaderContribution, LifecyclePhase.Restored);

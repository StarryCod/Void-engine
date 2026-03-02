/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/voidWelcome.css';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { VoidWelcomeScreen } from './voidWelcome.js';
import { IWorkbenchThemeService } from '../../../services/themes/common/workbenchThemeService.js';
import { ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';

class VoidWelcomeContribution extends Disposable {
	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IWorkbenchThemeService private readonly themeService: IWorkbenchThemeService
	) {
		super();
		void this.themeService.setColorTheme('Void Cyber Minimal', ConfigurationTarget.USER);

		const ws = this.contextService.getWorkspace();
		const has = ws && ws.folders && ws.folders.length > 0;
		if (!has) {
			const el = document.createElement('div');
			el.id = 'void-welcome-overlay';
			document.body.appendChild(el);
			const screen = this.instantiationService.createInstance(VoidWelcomeScreen);
			this._register(screen);
			screen.render(el).then(() => console.log('[Void] Project Manager ready'));
		} else {
			document.body.classList.add('void-welcome-closed');
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(VoidWelcomeContribution, LifecyclePhase.Restored);

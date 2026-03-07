/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IProductUiProfile {
	readonly allowedViewContainers: ReadonlySet<string>;
	readonly hiddenViewContainers: ReadonlySet<string>;
	readonly hiddenCompositeSelectors: ReadonlyArray<string>;
	readonly hiddenActionPatterns: ReadonlyArray<RegExp>;
}

export const VOID_PRODUCT_UI_PROFILE: IProductUiProfile = {
	allowedViewContainers: new Set<string>([
		'workbench.view.explorer',
		'workbench.view.scm',
		'workbench.panel.output'
	]),
	hiddenViewContainers: new Set<string>([
		'workbench.view.debug',
		'workbench.view.search',
		'workbench.view.testing',
		'workbench.view.comments',
		'workbench.view.extensions',
		'workbench.panel.repl',
		'workbench.panel.markers'
	]),
	hiddenCompositeSelectors: [
		'.composite[data-id="workbench.view.debug"]',
		'.composite[data-id="workbench.view.extensions"]',
		'.composite[data-id="workbench.view.search"]',
		'.composite[data-id="workbench.view.testing"]',
		'.composite[data-id="workbench.view.comments"]',
		'.composite[data-id="workbench.panel.repl"]',
		'.composite[data-id="workbench.panel.markers"]'
	],
	hiddenActionPatterns: [
		/accounts?/i,
		/extensions?/i,
		/marketplace/i,
		/run and debug/i,
		/getting started/i,
		/walkthrough/i,
		/welcome/i,
		/testing/i,
		/notebook/i,
		/remote/i,
		/ports?/i,
		/comments?/i,
		/timeline/i,
		/settings sync/i,
		/update(?!d)/i
	]
};

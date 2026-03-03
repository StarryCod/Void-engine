/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type ChatPaneLayoutMode = 'home' | 'conversation' | 'history';

export class ChatLayoutController {
	private mode: ChatPaneLayoutMode = 'home';

	constructor(private readonly container: HTMLElement) { }

	setMode(mode: ChatPaneLayoutMode): void {
		if (this.mode === mode && this.container.classList.contains(`void-layout-${mode}`)) {
			return;
		}
		this.container.classList.remove('void-layout-home', 'void-layout-conversation', 'void-layout-history');
		this.container.classList.add(`void-layout-${mode}`);
		this.mode = mode;
	}

	getMode(): ChatPaneLayoutMode {
		return this.mode;
	}
}


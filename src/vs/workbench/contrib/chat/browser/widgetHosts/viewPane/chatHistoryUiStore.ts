/*---------------------------------------------------------------------------------------------
 *  Void Chat - History UI Store
 *--------------------------------------------------------------------------------------------*/

export interface IChatHistoryAttachmentUI {
	name: string;
	preview: string;
}

export interface IChatHistoryMessageUI {
	role: 'user' | 'assistant' | 'error';
	text: string;
	timestamp: number;
	attachments?: IChatHistoryAttachmentUI[];
}

export interface IChatHistoryItemUI {
	id: string;
	title: string;
	pinned: boolean;
	createdAt: number;
	updatedAt: number;
	lastViewedAt: number;
	order?: number;
	tags?: string[];
	messages: IChatHistoryMessageUI[];
}

export interface IChatHistoryPanelState {
	query: string;
	selectedSessionId?: string;
	mode: 'list' | 'search';
}

export interface IChatHistoryUiStore {
	loadItems(): IChatHistoryItemUI[];
	saveItems(items: ReadonlyArray<IChatHistoryItemUI>): void;
}

export class LocalChatHistoryUiStore implements IChatHistoryUiStore {
	constructor(
		private readonly storageKey: string,
		private readonly maxItems: number
	) { }

	loadItems(): IChatHistoryItemUI[] {
		try {
			const raw = localStorage.getItem(this.storageKey);
			if (!raw) {
				return [];
			}
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed as IChatHistoryItemUI[] : [];
		} catch {
			return [];
		}
	}

	saveItems(items: ReadonlyArray<IChatHistoryItemUI>): void {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(items.slice(0, this.maxItems)));
		} catch {
			// Ignore storage quota and privacy mode errors.
		}
	}
}

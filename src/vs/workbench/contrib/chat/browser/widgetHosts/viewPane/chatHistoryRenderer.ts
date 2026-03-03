/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../../../base/browser/dom.js';
import {
	filterHistorySessions,
	formatHistoryTime,
	getOrderedHistoryGroupKeys,
	groupHistorySessions,
	HistorySessionRecord
} from './chatHistoryModel.js';

export interface IHistoryListRenderParams {
	sessions: ReadonlyArray<HistorySessionRecord>;
	query: string;
	activeSessionId?: string;
}

export interface IHistoryListRenderResult {
	nodes: Node[];
	filteredCount: number;
}

export function buildHistoryListNodes(params: IHistoryListRenderParams): IHistoryListRenderResult {
	const root = document.createElement('div');
	const filtered = filterHistorySessions(params.sessions, params.query);

	if (!filtered.length) {
		const empty = append(root, $('.void-chat-history-empty'));
		empty.textContent = params.query ? 'No matching chats' : 'No saved chats yet';
		return {
			nodes: Array.from(root.childNodes),
			filteredCount: 0
		};
	}

	const groups = groupHistorySessions(filtered);
	const orderedKeys = getOrderedHistoryGroupKeys(groups);

	for (const key of orderedKeys) {
		const section = append(root, $('.void-chat-history-section'));
		const sectionTitle = append(section, $('.void-chat-history-section-title'));
		sectionTitle.textContent = key;
		const groupList = append(section, $('.void-chat-history-section-list'));
		for (const session of groups.get(key) ?? []) {
			const item = append(groupList, $('.void-chat-history-item'));
			if (session.id === params.activeSessionId) {
				item.classList.add('active');
			}

			const openButton = append(item, $('button.void-chat-history-open')) as HTMLButtonElement;
			openButton.setAttribute('type', 'button');
			openButton.setAttribute('data-history-action', 'open');
			openButton.setAttribute('data-session-id', session.id);

			const title = append(openButton, $('.void-chat-history-item-title'));
			title.textContent = session.title;
			const subtitle = append(openButton, $('.void-chat-history-item-subtitle'));
			subtitle.textContent = `${formatHistoryTime(session.updatedAt)}  |  ${session.messages.length} messages`;

			const actions = append(item, $('.void-chat-history-item-actions'));

			const pinButton = append(actions, $('button.void-chat-history-icon-btn.codicon')) as HTMLButtonElement;
			pinButton.classList.add('codicon-pin');
			if (session.pinned) {
				pinButton.classList.add('pinned');
			}
			pinButton.setAttribute('aria-label', session.pinned ? 'Unpin' : 'Pin');
			pinButton.setAttribute('data-tooltip', session.pinned ? 'Unpin' : 'Pin');
			pinButton.setAttribute('data-history-action', 'pin');
			pinButton.setAttribute('data-session-id', session.id);

			const renameButton = append(actions, $('button.void-chat-history-icon-btn.codicon.codicon-edit')) as HTMLButtonElement;
			renameButton.setAttribute('aria-label', 'Rename');
			renameButton.setAttribute('data-tooltip', 'Rename');
			renameButton.setAttribute('data-history-action', 'rename');
			renameButton.setAttribute('data-session-id', session.id);

			const deleteButton = append(actions, $('button.void-chat-history-icon-btn.codicon.codicon-trash')) as HTMLButtonElement;
			deleteButton.setAttribute('aria-label', 'Delete');
			deleteButton.setAttribute('data-tooltip', 'Delete');
			deleteButton.setAttribute('data-history-action', 'delete');
			deleteButton.setAttribute('data-session-id', session.id);
		}
	}

	return {
		nodes: Array.from(root.childNodes),
		filteredCount: filtered.length
	};
}


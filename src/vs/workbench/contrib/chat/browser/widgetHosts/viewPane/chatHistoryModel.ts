/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface HistoryAttachmentPreview {
	name: string;
	preview: string;
}

export interface HistoryMessageRecord {
	role: 'user' | 'assistant' | 'error';
	text: string;
	timestamp: number;
	attachments?: HistoryAttachmentPreview[];
}

export interface HistorySessionRecord {
	id: string;
	title: string;
	pinned: boolean;
	createdAt: number;
	updatedAt: number;
	lastViewedAt: number;
	messages: HistoryMessageRecord[];
}

export type HistoryGroupKey = 'Today' | 'Yesterday' | 'Older';

export function normalizeHistorySessionRecord(record: unknown): HistorySessionRecord | undefined {
	if (!record || typeof record !== 'object') {
		return undefined;
	}
	const candidate = record as Partial<HistorySessionRecord>;
	if (typeof candidate.id !== 'string' || !candidate.id.trim()) {
		return undefined;
	}
	if (typeof candidate.title !== 'string') {
		return undefined;
	}
	const messages = Array.isArray(candidate.messages) ? candidate.messages : [];
	const normalizedMessages: HistoryMessageRecord[] = [];
	for (const message of messages) {
		if (!message || typeof message !== 'object') {
			continue;
		}
		const entry = message as Partial<HistoryMessageRecord>;
		if (entry.role !== 'user' && entry.role !== 'assistant' && entry.role !== 'error') {
			continue;
		}
		if (typeof entry.text !== 'string') {
			continue;
		}
		const attachments = Array.isArray(entry.attachments)
			? entry.attachments
				.map(item => {
					if (!item || typeof item !== 'object') {
						return undefined;
					}
					const attachment = item as Partial<HistoryAttachmentPreview>;
					if (typeof attachment.name !== 'string' || typeof attachment.preview !== 'string') {
						return undefined;
					}
					return {
						name: attachment.name,
						preview: attachment.preview
					};
				})
				.filter((item): item is HistoryAttachmentPreview => !!item)
			: undefined;
		normalizedMessages.push({
			role: entry.role,
			text: entry.text,
			timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now(),
			attachments
		});
	}
	return {
		id: candidate.id.trim(),
		title: candidate.title.trim() || 'New chat',
		pinned: !!candidate.pinned,
		createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
		updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now(),
		lastViewedAt: typeof candidate.lastViewedAt === 'number' ? candidate.lastViewedAt : Date.now(),
		messages: normalizedMessages
	};
}

export function sortHistorySessions(sessions: ReadonlyArray<HistorySessionRecord>): HistorySessionRecord[] {
	return sessions
		.slice()
		.sort((a, b) => {
			if (a.pinned !== b.pinned) {
				return a.pinned ? -1 : 1;
			}
			return b.updatedAt - a.updatedAt;
		});
}

export function selectPreferredSession(sessions: ReadonlyArray<HistorySessionRecord>): HistorySessionRecord | undefined {
	if (!sessions.length) {
		return undefined;
	}
	return sessions
		.slice()
		.sort((a, b) => b.lastViewedAt - a.lastViewedAt)[0];
}

export function filterHistorySessions(
	sessions: ReadonlyArray<HistorySessionRecord>,
	query: string
): HistorySessionRecord[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return sessions.slice();
	}
	return sessions.filter(session =>
		session.title.toLowerCase().includes(normalizedQuery)
		|| session.messages.some(message => message.text.toLowerCase().includes(normalizedQuery))
	);
}

export function groupHistorySessions(sessions: ReadonlyArray<HistorySessionRecord>): Map<HistoryGroupKey, HistorySessionRecord[]> {
	const groups = new Map<HistoryGroupKey, HistorySessionRecord[]>();
	for (const session of sessions) {
		const key = getHistoryGroupKey(session.updatedAt);
		const list = groups.get(key);
		if (list) {
			list.push(session);
		} else {
			groups.set(key, [session]);
		}
	}
	return groups;
}

export function getOrderedHistoryGroupKeys(groups: Map<HistoryGroupKey, HistorySessionRecord[]>): HistoryGroupKey[] {
	const orderedKeys: HistoryGroupKey[] = [];
	if (groups.has('Today')) {
		orderedKeys.push('Today');
	}
	if (groups.has('Yesterday')) {
		orderedKeys.push('Yesterday');
	}
	if (groups.has('Older')) {
		orderedKeys.push('Older');
	}
	return orderedKeys;
}

export function getHistoryGroupKey(timestamp: number): HistoryGroupKey {
	const target = new Date(timestamp);
	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startOfYesterday = new Date(startOfToday);
	startOfYesterday.setDate(startOfYesterday.getDate() - 1);
	if (target >= startOfToday) {
		return 'Today';
	}
	if (target >= startOfYesterday) {
		return 'Yesterday';
	}
	return 'Older';
}

export function formatHistoryTime(timestamp: number): string {
	try {
		return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	} catch {
		return '--:--';
	}
}

export function buildSessionTitleFromText(text: string): string {
	const normalized = text.replace(/\s+/g, ' ').trim();
	if (!normalized) {
		return 'New chat';
	}
	return normalized.slice(0, 60);
}


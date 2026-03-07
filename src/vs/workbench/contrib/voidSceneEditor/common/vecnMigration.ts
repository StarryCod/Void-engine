/*---------------------------------------------------------------------------------------------
 *  Void Engine Scene Format (.vecn) - Migrations
 *--------------------------------------------------------------------------------------------*/

import { VECN_LATEST_VERSION, isSupportedVecnVersion } from './vecnSchema.js';

export interface VecnMigrationResult {
	readonly normalizedContent: string;
	readonly fromVersion: string;
	readonly toVersion: string;
	readonly migrated: boolean;
	readonly notes: readonly string[];
}

const VERSION_PATTERN = /version:\s*(?:"([^"]+)"|([0-9]+\.[0-9]+))/;

export function detectVecnVersion(content: string): string {
	const match = VERSION_PATTERN.exec(content);
	const raw = match?.[1] ?? match?.[2];
	return raw ?? '1.0';
}

function normalizeVersionField(content: string, targetVersion: string): string {
	if (VERSION_PATTERN.test(content)) {
		return content.replace(VERSION_PATTERN, `version: "${targetVersion}"`);
	}

	const sceneStart = content.match(/VoidScene\s*\(/);
	if (!sceneStart) {
		return content;
	}
	if (typeof sceneStart.index !== 'number') {
		return content;
	}

	const insertionPoint = sceneStart.index + sceneStart[0].length;
	return `${content.slice(0, insertionPoint)}\n    version: "${targetVersion}",${content.slice(insertionPoint)}`;
}

function ensureModeField(content: string, notes: string[]): string {
	if (/mode:\s*(Scene3D|Scene2D)/.test(content)) {
		return content;
	}

	const versionMatch = /version:\s*(?:"[^"]+"|[0-9]+\.[0-9]+),?/.exec(content);
	if (!versionMatch || typeof versionMatch.index !== 'number') {
		return content;
	}

	notes.push('Added missing top-level field: mode (default Scene3D).');
	const insertionPoint = versionMatch.index + versionMatch[0].length;
	return `${content.slice(0, insertionPoint)}\n    mode: Scene3D,${content.slice(insertionPoint)}`;
}

function migrateLegacyFieldAliases(content: string, notes: string[]): string {
	let migrated = content;

	// Legacy shorthand -> current WorldEnvironment field names.
	const aliasPairs: Array<{ from: RegExp; to: string; note: string }> = [
		{
			from: /\btonemap:\s*"?(Linear|Reinhard|Filmic|ACES)"?/g,
			to: 'tonemap_mode: "$1"',
			note: 'Field tonemap was migrated to tonemap_mode.',
		},
		{
			from: /\bbackground:\s*"?(Sky|Color|Gradient|Canvas|Keep)"?/g,
			to: 'background_mode: "$1"',
			note: 'Field background was migrated to background_mode.',
		},
	];

	for (const alias of aliasPairs) {
		if (alias.from.test(migrated)) {
			migrated = migrated.replace(alias.from, alias.to);
			notes.push(alias.note);
		}
	}

	return migrated;
}

export function migrateVecnToLatest(content: string): VecnMigrationResult {
	const notes: string[] = [];
	const fromVersion = detectVecnVersion(content);
	let normalizedContent = content;

	if (!isSupportedVecnVersion(fromVersion)) {
		notes.push(`Unsupported version "${fromVersion}" detected, normalized to ${VECN_LATEST_VERSION}.`);
	}

	normalizedContent = normalizeVersionField(normalizedContent, VECN_LATEST_VERSION);
	normalizedContent = ensureModeField(normalizedContent, notes);
	normalizedContent = migrateLegacyFieldAliases(normalizedContent, notes);

	const migrated = normalizedContent !== content;

	return {
		normalizedContent,
		fromVersion,
		toVersion: VECN_LATEST_VERSION,
		migrated,
		notes,
	};
}

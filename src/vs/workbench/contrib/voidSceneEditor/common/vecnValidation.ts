/*---------------------------------------------------------------------------------------------
 *  Void Engine Scene Format (.vecn) - Validation
 *--------------------------------------------------------------------------------------------*/

import { VecnParser } from './vecnParser.js';
import { Entity } from './vecnTypes.js';
import { detectVecnVersion, migrateVecnToLatest } from './vecnMigration.js';
import { isSupportedComponentType, isSupportedVecnMode, isSupportedVecnVersion } from './vecnSchema.js';

export type VecnValidationSeverity = 'error' | 'warning' | 'info';

export interface VecnValidationIssue {
	readonly severity: VecnValidationSeverity;
	readonly message: string;
	readonly path: string;
	readonly line: number;
	readonly column: number;
	readonly endLine: number;
	readonly endColumn: number;
	readonly expected?: string;
	readonly actual?: string;
}

export interface VecnValidationResult {
	readonly ok: boolean;
	readonly normalizedContent: string;
	readonly originalVersion: string;
	readonly effectiveVersion: string;
	readonly migrated: boolean;
	readonly migrationNotes: readonly string[];
	readonly issues: readonly VecnValidationIssue[];
}

const TOP_LEVEL_COMPONENT_WRAPPERS = new Set([
	'VoidScene',
	'Entity',
	'Cube',
	'Plane',
	'Sphere',
	'Cylinder',
	'Cone',
	'Torus',
	'Capsule',
	'Box',
	'Rectangle',
	'Circle',
	'AmbientLight',
	'ClearColor',
	'Fog',
	'ProceduralSky',
	'PanoramaSky',
	'PhysicalSky',
	'Color',
	'Gradient',
]);

function toPosition(content: string, index: number): { line: number; column: number } {
	const safeIndex = Math.max(0, Math.min(index, content.length));
	let line = 1;
	let column = 1;

	for (let i = 0; i < safeIndex; i++) {
		if (content.charCodeAt(i) === 10) {
			line++;
			column = 1;
		} else {
			column++;
		}
	}

	return { line, column };
}

function issueAt(
	content: string,
	index: number,
	message: string,
	path: string,
	severity: VecnValidationSeverity = 'error',
	expected?: string,
	actual?: string
): VecnValidationIssue {
	const start = toPosition(content, index);
	const end = toPosition(content, index + 1);
	return {
		severity,
		message,
		path,
		line: start.line,
		column: start.column,
		endLine: end.line,
		endColumn: end.column,
		expected,
		actual,
	};
}

function collectTopLevelFieldIssues(content: string): VecnValidationIssue[] {
	const issues: VecnValidationIssue[] = [];
	const requiredFields = ['version', 'mode', 'entities', 'resources'];

	for (const field of requiredFields) {
		if (!new RegExp(`\\b${field}\\s*:`).test(content)) {
			const pointer = content.search(/VoidScene\s*\(/);
			issues.push(issueAt(
				content,
				pointer >= 0 ? pointer : 0,
				`Missing required field "${field}".`,
				`/${field}`,
				'error',
				`${field}: <value>`,
				'missing',
			));
		}
	}

	return issues;
}

function extractComponentBlocks(content: string): Array<{ block: string; startIndex: number }> {
	const blocks: Array<{ block: string; startIndex: number }> = [];
	const fieldRe = /components\s*:\s*\[/g;
	let fieldMatch: RegExpExecArray | null;

	while ((fieldMatch = fieldRe.exec(content)) !== null) {
		let depth = 1;
		let i = fieldMatch.index + fieldMatch[0].length;
		const start = i;

		while (i < content.length && depth > 0) {
			const ch = content[i];
			if (ch === '[') depth++;
			else if (ch === ']') depth--;
			else if (ch === '"') {
				i++;
				while (i < content.length && content[i] !== '"') {
					if (content[i] === '\\') i++;
					i++;
				}
			}
			i++;
		}

		blocks.push({
			block: content.slice(start, i - 1),
			startIndex: start,
		});

		fieldRe.lastIndex = i;
	}

	return blocks;
}

function collectUnknownComponentIssues(content: string): VecnValidationIssue[] {
	const issues: VecnValidationIssue[] = [];
	const blocks = extractComponentBlocks(content);
	const componentRe = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

	for (const block of blocks) {
		let match: RegExpExecArray | null;
		while ((match = componentRe.exec(block.block)) !== null) {
			const componentName = match[1];
			if (TOP_LEVEL_COMPONENT_WRAPPERS.has(componentName)) {
				continue;
			}
			if (!isSupportedComponentType(componentName)) {
				const globalIndex = block.startIndex + match.index;
				issues.push(issueAt(
					content,
					globalIndex,
					`Unknown component "${componentName}".`,
					`/entities/components/${componentName}`,
					'warning',
					'One of supported component types',
					componentName,
				));
			}
		}
	}

	return issues;
}

function collectEntityIssues(content: string, entities: Entity[]): VecnValidationIssue[] {
	const issues: VecnValidationIssue[] = [];
	const seenIds = new Set<string>();

	const visit = (entity: Entity, indexPath: string): void => {
		if (!entity.id.trim()) {
			const pointer = content.indexOf('id:', 0);
			issues.push(issueAt(
				content,
				pointer >= 0 ? pointer : 0,
				'Entity id cannot be empty.',
				`${indexPath}/id`,
				'error',
				'non-empty string',
				'empty',
			));
		}

		if (seenIds.has(entity.id)) {
			const pointer = content.indexOf(`"${entity.id}"`);
			issues.push(issueAt(
				content,
				pointer >= 0 ? pointer : 0,
				`Duplicate entity id "${entity.id}".`,
				`${indexPath}/id`,
				'error',
				'unique entity id',
				entity.id,
			));
		} else {
			seenIds.add(entity.id);
		}

		if (!entity.name.trim()) {
			const pointer = content.indexOf('name:', 0);
			issues.push(issueAt(
				content,
				pointer >= 0 ? pointer : 0,
				'Entity name cannot be empty.',
				`${indexPath}/name`,
				'warning',
				'readable non-empty name',
				'empty',
			));
		}

		for (let i = 0; i < entity.children.length; i++) {
			visit(entity.children[i], `${indexPath}/children/${i}`);
		}
	};

	for (let i = 0; i < entities.length; i++) {
		visit(entities[i], `/entities/${i}`);
	}

	return issues;
}

function checkBracketBalance(content: string): VecnValidationIssue[] {
	const issues: VecnValidationIssue[] = [];
	const stack: Array<{ ch: '(' | '['; index: number }> = [];

	for (let i = 0; i < content.length; i++) {
		const ch = content[i];
		if (ch === '"') {
			const quote = ch;
			i++;
			while (i < content.length && content[i] !== quote) {
				if (content[i] === '\\') i++;
				i++;
			}
			continue;
		}

		if (ch === '(' || ch === '[') {
			stack.push({ ch, index: i });
			continue;
		}

		if (ch === ')' || ch === ']') {
			const last = stack.pop();
			const expectedOpen = ch === ')' ? '(' : '[';
			if (!last || last.ch !== expectedOpen) {
				issues.push(issueAt(
					content,
					i,
					`Bracket balance error near "${ch}".`,
					'/syntax',
					'error',
					expectedOpen,
					ch,
				));
			}
		}
	}

	for (const left of stack) {
		issues.push(issueAt(
			content,
			left.index,
			'Unclosed bracket.',
			'/syntax',
			'error',
			left.ch === '(' ? ')' : ']',
			left.ch,
		));
	}

	return issues;
}

export function validateVecnScene(content: string): VecnValidationResult {
	const migration = migrateVecnToLatest(content);
	const normalizedContent = migration.normalizedContent;
	const originalVersion = migration.fromVersion;
	const effectiveVersion = detectVecnVersion(normalizedContent);

	const issues: VecnValidationIssue[] = [];

	if (!/VoidScene\s*\(/.test(normalizedContent)) {
		issues.push(issueAt(
			normalizedContent,
			0,
			'File must start with VoidScene(...).',
			'/',
			'error',
			'VoidScene(',
			'not found',
		));
	}

	if (!isSupportedVecnVersion(effectiveVersion)) {
		const versionMatch = /version:\s*(?:"([^"]+)"|([0-9]+\.[0-9]+))/.exec(normalizedContent);
		const index = versionMatch && typeof versionMatch.index === 'number' ? versionMatch.index : 0;
		issues.push(issueAt(
			normalizedContent,
			index,
			`Unsupported .vecn version: "${effectiveVersion}".`,
			'/version',
			'error',
			'1.0 | 2.0',
			effectiveVersion,
		));
	}

	const modeMatch = /\bmode:\s*([A-Za-z0-9_]+)/.exec(normalizedContent);
	if (!modeMatch) {
		issues.push(issueAt(
			normalizedContent,
			0,
			'Missing field: mode.',
			'/mode',
			'error',
			'Scene3D | Scene2D',
			'missing',
		));
	} else if (!isSupportedVecnMode(modeMatch[1])) {
		const index = typeof modeMatch.index === 'number' ? modeMatch.index : 0;
		issues.push(issueAt(
			normalizedContent,
			index,
			`Invalid mode value: "${modeMatch[1]}".`,
			'/mode',
			'error',
			'Scene3D | Scene2D',
			modeMatch[1],
		));
	}

	issues.push(...checkBracketBalance(normalizedContent));
	issues.push(...collectTopLevelFieldIssues(normalizedContent));
	issues.push(...collectUnknownComponentIssues(normalizedContent));

	const parsed = VecnParser.parse(normalizedContent);
	if (!parsed) {
		issues.push(issueAt(
			normalizedContent,
			0,
			'Unable to parse .vecn scene.',
			'/syntax',
			'error',
			'valid RON/DSL',
			'parse failed',
		));
	} else {
		issues.push(...collectEntityIssues(normalizedContent, parsed.entities));
	}

	return {
		ok: issues.every(issue => issue.severity !== 'error'),
		normalizedContent,
		originalVersion,
		effectiveVersion,
		migrated: migration.migrated,
		migrationNotes: migration.notes,
		issues,
	};
}

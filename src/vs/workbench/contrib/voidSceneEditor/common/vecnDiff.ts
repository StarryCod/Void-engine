/*---------------------------------------------------------------------------------------------
 *  Void Engine Scene Format (.vecn) - Node/Component Diff + Merge
 *--------------------------------------------------------------------------------------------*/

import { Component, Entity, VoidScene } from './vecnTypes.js';

export type VecnChangeType = 'add' | 'remove' | 'update';
export type VecnMergeStrategy = 'ours' | 'theirs' | 'smart';

export interface VecnEntityDiffItem {
	readonly type: VecnChangeType;
	readonly entityId: string;
	readonly path: string;
	readonly before?: Entity;
	readonly after?: Entity;
}

export interface VecnComponentDiffItem {
	readonly type: VecnChangeType;
	readonly entityId: string;
	readonly componentType: string;
	readonly path: string;
	readonly before?: Component;
	readonly after?: Component;
}

export interface VecnSceneDiff {
	readonly versionChanged: boolean;
	readonly modeChanged: boolean;
	readonly entityChanges: readonly VecnEntityDiffItem[];
	readonly componentChanges: readonly VecnComponentDiffItem[];
}

interface FlatEntity {
	entity: Entity;
	path: string;
}

function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(',')}]`;
	}

	if (value && typeof value === 'object') {
		const keys = Object.keys(value as Record<string, unknown>).sort();
		return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(',')}}`;
	}

	return JSON.stringify(value);
}

function cloneEntity(entity: Entity): Entity {
	return JSON.parse(JSON.stringify(entity)) as Entity;
}

function flattenEntities(entities: readonly Entity[], path = '/entities'): Map<string, FlatEntity> {
	const result = new Map<string, FlatEntity>();

	const visit = (entity: Entity, parentPath: string, index: number): void => {
		const currentPath = `${parentPath}/${index}`;
		result.set(entity.id, { entity, path: currentPath });
		for (let i = 0; i < entity.children.length; i++) {
			visit(entity.children[i], `${currentPath}/children`, i);
		}
	};

	for (let i = 0; i < entities.length; i++) {
		visit(entities[i], path, i);
	}

	return result;
}

function componentsByType(components: readonly Component[]): Map<string, Component> {
	const map = new Map<string, Component>();
	for (const component of components) {
		map.set(component.type, component);
	}
	return map;
}

export function diffVecnScenes(base: VoidScene, next: VoidScene): VecnSceneDiff {
	const baseFlat = flattenEntities(base.entities);
	const nextFlat = flattenEntities(next.entities);

	const entityChanges: VecnEntityDiffItem[] = [];
	const componentChanges: VecnComponentDiffItem[] = [];

	for (const [id, nextNode] of nextFlat) {
		const baseNode = baseFlat.get(id);
		if (!baseNode) {
			entityChanges.push({
				type: 'add',
				entityId: id,
				path: nextNode.path,
				after: cloneEntity(nextNode.entity),
			});
			continue;
		}

		if (stableStringify(baseNode.entity) !== stableStringify(nextNode.entity)) {
			entityChanges.push({
				type: 'update',
				entityId: id,
				path: nextNode.path,
				before: cloneEntity(baseNode.entity),
				after: cloneEntity(nextNode.entity),
			});
		}

		const baseComponents = componentsByType(baseNode.entity.components);
		const nextComponents = componentsByType(nextNode.entity.components);

		for (const [componentType, nextComponent] of nextComponents) {
			const baseComponent = baseComponents.get(componentType);
			if (!baseComponent) {
				componentChanges.push({
					type: 'add',
					entityId: id,
					componentType,
					path: `${nextNode.path}/components/${componentType}`,
					after: JSON.parse(JSON.stringify(nextComponent)) as Component,
				});
				continue;
			}

			if (stableStringify(baseComponent) !== stableStringify(nextComponent)) {
				componentChanges.push({
					type: 'update',
					entityId: id,
					componentType,
					path: `${nextNode.path}/components/${componentType}`,
					before: JSON.parse(JSON.stringify(baseComponent)) as Component,
					after: JSON.parse(JSON.stringify(nextComponent)) as Component,
				});
			}
		}

		for (const [componentType, baseComponent] of baseComponents) {
			if (!nextComponents.has(componentType)) {
				componentChanges.push({
					type: 'remove',
					entityId: id,
					componentType,
					path: `${baseNode.path}/components/${componentType}`,
					before: JSON.parse(JSON.stringify(baseComponent)) as Component,
				});
			}
		}
	}

	for (const [id, baseNode] of baseFlat) {
		if (!nextFlat.has(id)) {
			entityChanges.push({
				type: 'remove',
				entityId: id,
				path: baseNode.path,
				before: cloneEntity(baseNode.entity),
			});
		}
	}

	return {
		versionChanged: base.version !== next.version,
		modeChanged: base.mode !== next.mode,
		entityChanges,
		componentChanges,
	};
}

export function mergeVecnScenes(base: VoidScene, incoming: VoidScene, strategy: VecnMergeStrategy = 'theirs'): VoidScene {
	if (strategy === 'theirs') {
		return JSON.parse(JSON.stringify(incoming)) as VoidScene;
	}

	if (strategy === 'ours') {
		return JSON.parse(JSON.stringify(base)) as VoidScene;
	}

	// "smart": keep base root order but inject incoming updates by id.
	const merged: VoidScene = JSON.parse(JSON.stringify(base)) as VoidScene;
	const incomingFlat = flattenEntities(incoming.entities);

	const replaceRecursive = (target: Entity[]): void => {
		for (let i = 0; i < target.length; i++) {
			const replacement = incomingFlat.get(target[i].id);
			if (replacement) {
				target[i] = cloneEntity(replacement.entity);
			}
			replaceRecursive(target[i].children);
		}
	};

	replaceRecursive(merged.entities);

	const mergedFlat = flattenEntities(merged.entities);
	for (const [incomingId, incomingNode] of incomingFlat) {
		if (!mergedFlat.has(incomingId)) {
			merged.entities.push(cloneEntity(incomingNode.entity));
		}
	}

	merged.version = incoming.version;
	merged.mode = incoming.mode;
	merged.resources = JSON.parse(JSON.stringify(incoming.resources));
	return merged;
}


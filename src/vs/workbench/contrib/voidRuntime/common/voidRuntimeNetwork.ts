/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VecnParser } from '../../voidSceneEditor/common/vecnParser.js';
import type { Entity } from '../../voidSceneEditor/common/vecnTypes.js';
import {
	IVoidNetworkSimulationProfile,
	IVoidNetworkStats,
	IVoidReplicatedTransformState,
	IVoidSceneSnapshot,
	VoidNetworkSnapshotSource
} from './voidRuntimeService.js';

export const DEFAULT_VOID_NETWORK_PROFILE: IVoidNetworkSimulationProfile = Object.freeze({
	enabled: true,
	mode: 'loopback',
	tickRate: 20,
	latencyMs: 18,
	jitterMs: 4,
	packetLoss: 0,
	outOfOrderChance: 0
});

export function normalizeNetworkProfile(
	current: IVoidNetworkSimulationProfile,
	update: Partial<IVoidNetworkSimulationProfile>
): IVoidNetworkSimulationProfile {
	const next: IVoidNetworkSimulationProfile = {
		enabled: update.enabled ?? current.enabled,
		mode: update.mode ?? current.mode,
		tickRate: clampInteger(update.tickRate ?? current.tickRate, 1, 240),
		latencyMs: clampNumber(update.latencyMs ?? current.latencyMs, 0, 5000),
		jitterMs: clampNumber(update.jitterMs ?? current.jitterMs, 0, 1000),
		packetLoss: clampNumber(update.packetLoss ?? current.packetLoss, 0, 1),
		outOfOrderChance: clampNumber(update.outOfOrderChance ?? current.outOfOrderChance, 0, 1)
	};

	if (next.mode === 'disabled') {
		return {
			...next,
			enabled: false,
			packetLoss: 0,
			latencyMs: 0,
			jitterMs: 0,
			outOfOrderChance: 0
		};
	}

	return next;
}

export function captureVecnNetworkSnapshot(
	scenePath: string,
	sourceText: string,
	tick: number,
	source: VoidNetworkSnapshotSource = 'editor',
	now: number = Date.now()
): IVoidSceneSnapshot {
	const parsed = VecnParser.parse(sourceText);
	const transforms = parsed ? collectTransforms(parsed.entities) : [];
	const entityCount = parsed?.entities.length ?? 0;
	const normalizedSource = parsed ? VecnParser.serialize(parsed) : sourceText;
	return {
		id: `void-snapshot-${now}-${tick}`,
		scenePath,
		hash: stableHash(normalizedSource),
		tick,
		source,
		capturedAt: now,
		entityCount,
		transformCount: transforms.length,
		transforms
	};
}

export function simulateNetworkReplication(
	snapshot: IVoidSceneSnapshot,
	current: IVoidNetworkStats,
	profile: IVoidNetworkSimulationProfile,
	randomValue: number = Math.random(),
	now: number = Date.now()
): IVoidNetworkStats {
	const payloadBytes = estimateSnapshotBytes(snapshot);
	const dropped = profile.enabled && profile.packetLoss > 0 && randomValue < profile.packetLoss;
	const jitterDelta = profile.jitterMs <= 0 ? 0 : Math.round((randomValue - 0.5) * profile.jitterMs * 2);
	const latencyMs = profile.enabled ? Math.max(0, profile.latencyMs + jitterDelta) : 0;

	const packetsSent = current.packetsSent + 1;
	const packetsDropped = current.packetsDropped + (dropped ? 1 : 0);
	const packetsDelivered = current.packetsDelivered + (dropped ? 0 : 1);
	const bytesSent = current.bytesSent + payloadBytes;
	const bytesDelivered = current.bytesDelivered + (dropped ? 0 : payloadBytes);

	return {
		tick: snapshot.tick,
		packetsSent,
		packetsDelivered,
		packetsDropped,
		bytesSent,
		bytesDelivered,
		averagePayloadBytes: packetsSent > 0 ? Math.round(bytesSent / packetsSent) : 0,
		lastLatencyMs: latencyMs,
		profile,
		lastSnapshot: {
			...snapshot,
			id: dropped ? `${snapshot.id}-dropped-${now}` : `${snapshot.id}-delivered-${now}`
		}
	};
}

export function estimateSnapshotBytes(snapshot: IVoidSceneSnapshot): number {
	return JSON.stringify({
		scenePath: snapshot.scenePath,
		hash: snapshot.hash,
		tick: snapshot.tick,
		transforms: snapshot.transforms
	}).length;
}

export function stableHash(input: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, '0');
}

function collectTransforms(entities: readonly Entity[]): IVoidReplicatedTransformState[] {
	const result: IVoidReplicatedTransformState[] = [];

	const visit = (entity: Entity): void => {
		for (const component of entity.components) {
			if (component.type === 'Transform') {
				result.push({
					entityId: entity.id,
					entityName: entity.name,
					dimension: '3d',
					translation: [component.translation[0], component.translation[1], component.translation[2]],
					rotationQuaternion: [component.rotation[0], component.rotation[1], component.rotation[2], component.rotation[3]],
					scale: [component.scale[0], component.scale[1], component.scale[2]]
				});
			}
			if (component.type === 'Transform2D') {
				result.push({
					entityId: entity.id,
					entityName: entity.name,
					dimension: '2d',
					position2D: [component.position[0], component.position[1]],
					rotation2D: component.rotation,
					scale2D: [component.scale[0], component.scale[1]]
				});
			}
		}

		for (const child of entity.children) {
			visit(child);
		}
	};

	for (const entity of entities) {
		visit(entity);
	}

	result.sort((a, b) => a.entityId.localeCompare(b.entityId));
	return result;
}

function clampNumber(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) {
		return min;
	}
	return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
	return Math.round(clampNumber(value, min, max));
}

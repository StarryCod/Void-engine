/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IVoidRuntimeService = createDecorator<IVoidRuntimeService>('voidRuntimeService');

export type EngineStateStatus = 'cold' | 'loading' | 'ready' | 'running' | 'failed';
export type EngineLifecycleAction = 'open' | 'load' | 'run' | 'stop' | 'reload' | 'fail';
export type VoidRuntimeEventChannel = 'editor' | 'runtime' | 'ai' | 'watchdog' | 'system' | 'network';
export type VoidRuntimeLogLevel = 'info' | 'warn' | 'error';
export type VoidNetworkSimulationMode = 'disabled' | 'loopback' | 'packetLoss' | 'custom';
export type VoidNetworkSnapshotSource = 'editor' | 'runtime' | 'loopback' | 'test';

export interface IEngineState {
	readonly status: EngineStateStatus;
	readonly lastAction: EngineLifecycleAction | 'boot';
	readonly sequence: number;
	readonly updatedAt: number;
	readonly workspacePath?: string;
	readonly activeScenePath?: string;
	readonly lastError?: string;
}

export interface IVoidRuntimeTransitionMetadata {
	readonly workspacePath?: string;
	readonly scenePath?: string;
	readonly error?: string;
}

export interface IVoidRuntimeEvent {
	readonly id: string;
	readonly timestamp: number;
	readonly channel: VoidRuntimeEventChannel;
	readonly type: string;
	readonly payload?: unknown;
}

export interface IVoidRuntimeLogEntry {
	readonly timestamp: number;
	readonly level: VoidRuntimeLogLevel;
	readonly channel: VoidRuntimeEventChannel;
	readonly type: string;
	readonly message: string;
	readonly payload?: unknown;
}

export interface IVoidEngineCrashReport {
	readonly id: string;
	readonly timestamp: number;
	readonly reason: string;
	readonly state: IEngineState;
	readonly workspacePath?: string;
	readonly activeScenePath?: string;
	readonly recentLogs: readonly IVoidRuntimeLogEntry[];
	readonly configSnapshot: Readonly<Record<string, unknown>>;
	readonly watchdog: {
		readonly lastRafAt: number;
		readonly stalledMs: number;
		readonly thresholdMs: number;
	};
}

export interface IVoidNetworkSimulationProfile {
	readonly enabled: boolean;
	readonly mode: VoidNetworkSimulationMode;
	readonly tickRate: number;
	readonly latencyMs: number;
	readonly jitterMs: number;
	readonly packetLoss: number;
	readonly outOfOrderChance: number;
}

export interface IVoidReplicatedTransformState {
	readonly entityId: string;
	readonly entityName: string;
	readonly dimension: '3d' | '2d';
	readonly translation?: readonly [number, number, number];
	readonly rotationQuaternion?: readonly [number, number, number, number];
	readonly position2D?: readonly [number, number];
	readonly rotation2D?: number;
	readonly scale?: readonly [number, number, number];
	readonly scale2D?: readonly [number, number];
}

export interface IVoidSceneSnapshot {
	readonly id: string;
	readonly scenePath: string;
	readonly hash: string;
	readonly tick: number;
	readonly source: VoidNetworkSnapshotSource;
	readonly capturedAt: number;
	readonly entityCount: number;
	readonly transformCount: number;
	readonly transforms: readonly IVoidReplicatedTransformState[];
}

export interface IVoidNetworkStats {
	readonly tick: number;
	readonly packetsSent: number;
	readonly packetsDelivered: number;
	readonly packetsDropped: number;
	readonly bytesSent: number;
	readonly bytesDelivered: number;
	readonly averagePayloadBytes: number;
	readonly lastLatencyMs: number;
	readonly profile: IVoidNetworkSimulationProfile;
	readonly lastSnapshot?: IVoidSceneSnapshot;
}

export interface IVoidPotentialListenerLeak {
	readonly listenerCount: number;
	readonly message: string;
	readonly stack?: string;
}

export interface IVoidRuntimeService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeState: Event<IEngineState>;
	readonly onDidPublishEvent: Event<IVoidRuntimeEvent>;
	readonly onDidCreateCrashReport: Event<IVoidEngineCrashReport>;

	getState(): IEngineState;
	transition(action: EngineLifecycleAction, metadata?: IVoidRuntimeTransitionMetadata): IEngineState;

	publish(channel: VoidRuntimeEventChannel, type: string, payload?: unknown): void;
	log(level: VoidRuntimeLogLevel, message: string, options?: { channel?: VoidRuntimeEventChannel; type?: string; payload?: unknown }): void;

	getRecentLogs(limit?: number): readonly IVoidRuntimeLogEntry[];
	createCrashReport(reason: string, metadata?: IVoidRuntimeTransitionMetadata): IVoidEngineCrashReport;
	getLastCrashReport(): IVoidEngineCrashReport | undefined;

	setNetworkSimulationProfile(update: Partial<IVoidNetworkSimulationProfile>): IVoidNetworkSimulationProfile;
	getNetworkSimulationProfile(): IVoidNetworkSimulationProfile;
	captureSceneSnapshot(scenePath: string, sourceText: string, source?: VoidNetworkSnapshotSource): IVoidSceneSnapshot;
	replicateSceneSnapshot(scenePath: string, sourceText: string, source?: VoidNetworkSnapshotSource): IVoidNetworkStats;
	getNetworkStats(): IVoidNetworkStats;
	reportPotentialListenerLeak(leak: IVoidPotentialListenerLeak): void;
}

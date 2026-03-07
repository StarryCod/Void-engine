/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import {
	EngineLifecycleAction,
	EngineStateStatus,
	IEngineState,
	IVoidNetworkSimulationProfile,
	IVoidNetworkStats,
	IVoidPotentialListenerLeak,
	IVoidSceneSnapshot,
	IVoidEngineCrashReport,
	IVoidRuntimeEvent,
	IVoidRuntimeLogEntry,
	IVoidRuntimeService,
	IVoidRuntimeTransitionMetadata,
	VoidNetworkSnapshotSource,
	VoidRuntimeEventChannel,
	VoidRuntimeLogLevel
} from '../common/voidRuntimeService.js';
import {
	captureVecnNetworkSnapshot,
	DEFAULT_VOID_NETWORK_PROFILE,
	normalizeNetworkProfile,
	simulateNetworkReplication
} from '../common/voidRuntimeNetwork.js';

const MAX_LOG_ENTRIES = 400;
const WATCHDOG_THRESHOLD_MS = 2500;
const WATCHDOG_POLL_MS = 1000;
const WATCHDOG_COOLDOWN_MS = 5000;

export class VoidRuntimeService extends Disposable implements IVoidRuntimeService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeState = this._register(new Emitter<IEngineState>());
	readonly onDidChangeState: Event<IEngineState> = this._onDidChangeState.event;

	private readonly _onDidPublishEvent = this._register(new Emitter<IVoidRuntimeEvent>());
	readonly onDidPublishEvent: Event<IVoidRuntimeEvent> = this._onDidPublishEvent.event;

	private readonly _onDidCreateCrashReport = this._register(new Emitter<IVoidEngineCrashReport>());
	readonly onDidCreateCrashReport: Event<IVoidEngineCrashReport> = this._onDidCreateCrashReport.event;

	private state: IEngineState;
	private logs: IVoidRuntimeLogEntry[] = [];
	private eventCounter = 0;
	private lastCrashReport: IVoidEngineCrashReport | undefined;
	private readonly watchdogThresholdMs = WATCHDOG_THRESHOLD_MS;
	private readonly bootStartedAt = Date.now();
	private lastLoadStartedAt = this.bootStartedAt;
	private firstFrameMetricPublished = false;
	private coldStartMetricPublished = false;
	private lastRafAt = Date.now();
	private lastWatchdogAlertAt = 0;
	private networkTick = 0;
	private networkProfile: IVoidNetworkSimulationProfile = DEFAULT_VOID_NETWORK_PROFILE;
	private networkStats: IVoidNetworkStats = {
		tick: 0,
		packetsSent: 0,
		packetsDelivered: 0,
		packetsDropped: 0,
		bytesSent: 0,
		bytesDelivered: 0,
		averagePayloadBytes: 0,
		lastLatencyMs: 0,
		profile: DEFAULT_VOID_NETWORK_PROFILE
	};
	private rafHandle: number | undefined;
	private watchdogHandle: ReturnType<typeof globalThis.setInterval> | undefined;

	constructor(
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IEditorService private readonly editorService: IEditorService
	) {
		super();

		this.state = {
			status: 'cold',
			lastAction: 'boot',
			sequence: 0,
			updatedAt: Date.now(),
			workspacePath: this.getPrimaryWorkspacePath()
		};

		this.log('info', 'Void runtime core booted', { channel: 'system', type: 'runtime.boot' });
		this.startWatchdog();
	}

	getState(): IEngineState {
		return this.cloneState(this.state);
	}

	transition(action: EngineLifecycleAction, metadata: IVoidRuntimeTransitionMetadata = {}): IEngineState {
		if (action === 'open' || action === 'reload') {
			this.lastLoadStartedAt = Date.now();
		}

		const nextStatus = this.resolveStatus(action);
		const nextState: IEngineState = {
			...this.state,
			status: nextStatus,
			lastAction: action,
			sequence: this.state.sequence + 1,
			updatedAt: Date.now(),
			workspacePath: metadata.workspacePath ?? this.state.workspacePath ?? this.getPrimaryWorkspacePath(),
			activeScenePath: metadata.scenePath ?? this.state.activeScenePath,
			lastError: metadata.error ?? (action === 'fail' ? this.state.lastError : undefined)
		};

		this.state = nextState;
		this._onDidChangeState.fire(this.cloneState(nextState));

		this.publish('runtime', `lifecycle.${action}`, {
			status: nextState.status,
			workspacePath: nextState.workspacePath,
			scenePath: nextState.activeScenePath,
			error: nextState.lastError
		});

		if (action === 'fail') {
			this.log('error', `Lifecycle transition failed: ${nextState.lastError ?? 'unknown error'}`, {
				channel: 'runtime',
				type: 'lifecycle.fail'
			});
			this.createCrashReport('lifecycle-failure', metadata);
		} else {
			this.log('info', `Lifecycle transition: ${action} -> ${nextState.status}`, {
				channel: 'runtime',
				type: `lifecycle.${action}`
			});
		}

		if (action === 'open' && !this.coldStartMetricPublished) {
			this.coldStartMetricPublished = true;
			this.publishMetric('coldStart', Date.now() - this.bootStartedAt, {
				workspacePath: nextState.workspacePath
			});
		}

		if (action === 'load') {
			this.publishMetric('sceneLoad', Date.now() - this.lastLoadStartedAt, {
				workspacePath: nextState.workspacePath,
				scenePath: nextState.activeScenePath
			});
		}

		return this.cloneState(nextState);
	}

	publish(channel: VoidRuntimeEventChannel, type: string, payload?: unknown): void {
		const event: IVoidRuntimeEvent = {
			id: `${Date.now()}-${++this.eventCounter}`,
			timestamp: Date.now(),
			channel,
			type,
			payload
		};
		this._onDidPublishEvent.fire(event);
	}

	log(level: VoidRuntimeLogLevel, message: string, options?: { channel?: VoidRuntimeEventChannel; type?: string; payload?: unknown }): void {
		const entry: IVoidRuntimeLogEntry = {
			timestamp: Date.now(),
			level,
			channel: options?.channel ?? 'system',
			type: options?.type ?? 'log',
			message,
			payload: options?.payload
		};
		this.logs.push(entry);
		if (this.logs.length > MAX_LOG_ENTRIES) {
			this.logs = this.logs.slice(this.logs.length - MAX_LOG_ENTRIES);
		}
	}

	getRecentLogs(limit: number = 100): readonly IVoidRuntimeLogEntry[] {
		if (limit <= 0) {
			return [];
		}
		return this.logs.slice(-limit);
	}

	createCrashReport(reason: string, metadata: IVoidRuntimeTransitionMetadata = {}): IVoidEngineCrashReport {
		const stalledMs = Math.max(0, Date.now() - this.lastRafAt);
		const report: IVoidEngineCrashReport = {
			id: `void-crash-${Date.now()}-${Math.round(Math.random() * 10000)}`,
			timestamp: Date.now(),
			reason,
			state: this.getState(),
			workspacePath: metadata.workspacePath ?? this.state.workspacePath ?? this.getPrimaryWorkspacePath(),
			activeScenePath: metadata.scenePath ?? this.state.activeScenePath ?? this.getActiveScenePath(),
			recentLogs: this.getRecentLogs(120),
			configSnapshot: this.captureConfigSnapshot(),
			watchdog: {
				lastRafAt: this.lastRafAt,
				stalledMs,
				thresholdMs: this.watchdogThresholdMs
			}
		};

		this.lastCrashReport = report;
		this._onDidCreateCrashReport.fire(report);
		this.log('error', `Crash report captured: ${reason}`, { channel: 'system', type: 'crash.report', payload: report.id });
		return report;
	}

	getLastCrashReport(): IVoidEngineCrashReport | undefined {
		return this.lastCrashReport;
	}

	setNetworkSimulationProfile(update: Partial<IVoidNetworkSimulationProfile>): IVoidNetworkSimulationProfile {
		this.networkProfile = normalizeNetworkProfile(this.networkProfile, update);
		this.networkStats = {
			...this.networkStats,
			profile: this.networkProfile
		};
		this.publish('network', 'profile.updated', this.networkProfile);
		this.log('info', `Network profile updated: ${this.networkProfile.mode}`, {
			channel: 'network',
			type: 'profile.updated',
			payload: this.networkProfile
		});
		return this.networkProfile;
	}

	getNetworkSimulationProfile(): IVoidNetworkSimulationProfile {
		return { ...this.networkProfile };
	}

	captureSceneSnapshot(scenePath: string, sourceText: string, source: VoidNetworkSnapshotSource = 'editor'): IVoidSceneSnapshot {
		const snapshot = captureVecnNetworkSnapshot(scenePath, sourceText, this.networkTick, source);
		this.publish('network', 'snapshot.captured', snapshot);
		this.log('info', `Captured scene snapshot: ${snapshot.transformCount} transforms`, {
			channel: 'network',
			type: 'snapshot.captured',
			payload: {
				scenePath: snapshot.scenePath,
				hash: snapshot.hash,
				tick: snapshot.tick
			}
		});
		return snapshot;
	}

	replicateSceneSnapshot(scenePath: string, sourceText: string, source: VoidNetworkSnapshotSource = 'editor'): IVoidNetworkStats {
		this.networkTick += 1;
		const snapshot = captureVecnNetworkSnapshot(scenePath, sourceText, this.networkTick, source);
		this.networkStats = simulateNetworkReplication(snapshot, this.networkStats, this.networkProfile);
		this.publish('network', 'replication.tick', {
			profile: this.networkProfile,
			stats: this.networkStats
		});
		this.log(
			this.networkStats.packetsDropped > 0 && this.networkStats.packetsDropped === this.networkStats.packetsSent ? 'warn' : 'info',
			`Replication tick ${this.networkStats.tick}: sent=${this.networkStats.packetsSent} delivered=${this.networkStats.packetsDelivered} dropped=${this.networkStats.packetsDropped}`,
			{
				channel: 'network',
				type: 'replication.tick',
				payload: this.networkStats
			}
		);
		return this.getNetworkStats();
	}

	getNetworkStats(): IVoidNetworkStats {
		return {
			...this.networkStats,
			profile: { ...this.networkStats.profile },
			lastSnapshot: this.networkStats.lastSnapshot ? { ...this.networkStats.lastSnapshot } : undefined
		};
	}

	reportPotentialListenerLeak(leak: IVoidPotentialListenerLeak): void {
		this.publish('system', 'listenerLeak.detected', leak);
		this.log('warn', `Potential listener leak detected (${leak.listenerCount})`, {
			channel: 'system',
			type: 'listenerLeak.detected',
			payload: leak
		});
	}

	private resolveStatus(action: EngineLifecycleAction): EngineStateStatus {
		switch (action) {
			case 'open':
			case 'reload':
				return 'loading';
			case 'load':
			case 'stop':
				return 'ready';
			case 'run':
				return 'running';
			case 'fail':
				return 'failed';
		}
	}

	private captureConfigSnapshot(): Readonly<Record<string, unknown>> {
		const keys = [
			'void.dev.enableWorkbenchFallback',
			'workbench.colorTheme',
			'window.titleBarStyle',
			'files.autoSave',
			'editor.fontSize'
		];

		const result: Record<string, unknown> = {};
		for (const key of keys) {
			result[key] = this.configurationService.getValue(key);
		}
		return result;
	}

	private getPrimaryWorkspacePath(): string | undefined {
		return this.workspaceService.getWorkspace().folders[0]?.uri.fsPath;
	}

	private getActiveScenePath(): string | undefined {
		const resource = this.editorService.activeEditor?.resource;
		if (!resource) {
			return undefined;
		}
		if (!resource.path.toLowerCase().endsWith('.vecn')) {
			return undefined;
		}
		return resource.fsPath || resource.path;
	}

	private cloneState(source: IEngineState): IEngineState {
		return {
			status: source.status,
			lastAction: source.lastAction,
			sequence: source.sequence,
			updatedAt: source.updatedAt,
			workspacePath: source.workspacePath,
			activeScenePath: source.activeScenePath,
			lastError: source.lastError
		};
	}

	private publishMetric(name: string, durationMs: number, payload: Record<string, unknown> = {}): void {
		const metricPayload = {
			durationMs: Math.max(0, durationMs),
			...payload
		};
		this.publish('system', `metric.${name}`, metricPayload);
		this.log('info', `Metric ${name}: ${metricPayload.durationMs}ms`, {
			channel: 'system',
			type: `metric.${name}`,
			payload: metricPayload
		});
	}

	private startWatchdog(): void {
		const rafLoop = () => {
			if (!this.firstFrameMetricPublished) {
				this.firstFrameMetricPublished = true;
				this.publishMetric('firstFrame', Date.now() - this.bootStartedAt, {
					workspacePath: this.getPrimaryWorkspacePath(),
					scenePath: this.getActiveScenePath()
				});
			}
			this.lastRafAt = Date.now();
			this.rafHandle = globalThis.requestAnimationFrame(rafLoop);
		};

		this.rafHandle = globalThis.requestAnimationFrame(rafLoop);
		this.watchdogHandle = globalThis.setInterval(() => this.checkWatchdog(), WATCHDOG_POLL_MS);
	}

	private checkWatchdog(): void {
		const now = Date.now();
		const stalledMs = now - this.lastRafAt;
		if (stalledMs < this.watchdogThresholdMs) {
			return;
		}
		if (now - this.lastWatchdogAlertAt < WATCHDOG_COOLDOWN_MS) {
			return;
		}

		this.lastWatchdogAlertAt = now;
		const payload = {
			stalledMs,
			thresholdMs: this.watchdogThresholdMs,
			lastRafAt: this.lastRafAt
		};

		this.publish('watchdog', 'ui.stall', payload);
		this.log('error', `Watchdog detected UI stall: ${stalledMs}ms`, { channel: 'watchdog', type: 'ui.stall', payload });
		this.createCrashReport('watchdog-ui-stall');
	}

	override dispose(): void {
		if (typeof this.rafHandle === 'number') {
			globalThis.cancelAnimationFrame(this.rafHandle);
			this.rafHandle = undefined;
		}
		if (this.watchdogHandle !== undefined) {
			globalThis.clearInterval(this.watchdogHandle);
			this.watchdogHandle = undefined;
		}
		super.dispose();
	}
}

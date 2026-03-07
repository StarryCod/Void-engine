/*---------------------------------------------------------------------------------------------
 *  Void Engine runtime output formatting
 *--------------------------------------------------------------------------------------------*/

import { IVoidEngineCrashReport, IVoidRuntimeEvent } from './voidRuntimeService.js';

export const VOID_ENGINE_OUTPUT_CHANNEL_ID = 'void.engine.output';
export const VOID_ENGINE_OUTPUT_CHANNEL_LABEL = 'Void Engine';

function formatTimestamp(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString('en-GB', {
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

function safeJson(value: unknown): string {
	try {
		const json = JSON.stringify(value);
		if (!json) {
			return '';
		}
		return json.length > 220 ? `${json.slice(0, 217)}...` : json;
	} catch {
		return String(value);
	}
}

export function formatVoidRuntimeEvent(event: IVoidRuntimeEvent): string {
	const prefix = `[${formatTimestamp(event.timestamp)}] [${event.channel}] ${event.type}`;
	if (typeof event.payload === 'undefined') {
		return `${prefix}\n`;
	}
	if (typeof event.payload === 'string') {
		return `${prefix}: ${event.payload}\n`;
	}
	return `${prefix}: ${safeJson(event.payload)}\n`;
}

export function formatVoidCrashReport(report: IVoidEngineCrashReport): string {
	const lines = [
		`[${formatTimestamp(report.timestamp)}] [crash] ${report.reason}`,
		`state=${report.state.status} seq=${report.state.sequence} workspace=${report.workspacePath ?? 'unknown'}`,
		`scene=${report.activeScenePath ?? 'unknown'} stalledMs=${report.watchdog.stalledMs} thresholdMs=${report.watchdog.thresholdMs}`,
	];

	if (report.recentLogs.length) {
		lines.push(`recentLogs=${report.recentLogs.length}`);
	}

	return `${lines.join('\n')}\n`;
}

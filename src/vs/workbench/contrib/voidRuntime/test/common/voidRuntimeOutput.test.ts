/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { formatVoidCrashReport, formatVoidRuntimeEvent } from '../../common/voidRuntimeOutput.js';
import type { IVoidEngineCrashReport, IVoidRuntimeEvent } from '../../common/voidRuntimeService.js';

suite('VoidRuntimeOutput', () => {

	test('formats runtime events compactly', () => {
		const event: IVoidRuntimeEvent = {
			id: 'evt-1',
			timestamp: 1000,
			channel: 'runtime',
			type: 'build.preflight',
			payload: { cargoAvailable: true, cargoTomlExists: true }
		};

		const line = formatVoidRuntimeEvent(event);
		assert.ok(line.includes('[runtime] build.preflight'));
		assert.ok(line.includes('cargoAvailable'));
	});

	test('formats crash reports with state summary', () => {
		const report: IVoidEngineCrashReport = {
			id: 'crash-1',
			timestamp: 1000,
			reason: 'watchdog-ui-stall',
			state: {
				status: 'failed',
				lastAction: 'fail',
				sequence: 7,
				updatedAt: 1000,
				workspacePath: 'C:/workspace',
				activeScenePath: 'assets/scenes/main.vecn',
				lastError: 'boom'
			},
			workspacePath: 'C:/workspace',
			activeScenePath: 'assets/scenes/main.vecn',
			recentLogs: [],
			configSnapshot: {},
			watchdog: {
				lastRafAt: 900,
				stalledMs: 3200,
				thresholdMs: 2500
			}
		};

		const text = formatVoidCrashReport(report);
		assert.ok(text.includes('watchdog-ui-stall'));
		assert.ok(text.includes('state=failed'));
		assert.ok(text.includes('assets/scenes/main.vecn'));
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});

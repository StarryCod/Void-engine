/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { detectPotentialListenerLeak } from '../../common/voidRuntimeQa.js';

suite('VoidRuntimeQa', () => {

	test('parses listener leak diagnostics from console payload', () => {
		const leak = detectPotentialListenerLeak([
			'[3e8] potential listener LEAK detected, having 188 listeners already. MOST frequent listener (29):',
			'Error',
			'    at Stacktrace.create (event.js:726:21)'
		]);

		assert.ok(leak);
		assert.strictEqual(leak?.listenerCount, 188);
		assert.ok(leak?.message.includes('potential listener LEAK detected'));
		assert.ok(leak?.stack?.includes('Stacktrace.create'));
	});

	test('ignores unrelated console messages', () => {
		const leak = detectPotentialListenerLeak([
			'[Scene Diagnostics] entities=16, ray_targets=3'
		]);

		assert.strictEqual(leak, undefined);
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});

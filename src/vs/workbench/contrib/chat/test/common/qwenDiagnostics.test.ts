/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { diagnoseQwenFailure, formatQwenFailureForUser } from '../../common/qwenDiagnostics.js';

suite('QwenDiagnostics', () => {

	test('extracts script path and cwd from raw failure', () => {
		const diagnosis = diagnoseQwenFailure('Process exited with code 1: no stderr/stdout diagnostics (script: C:/bridge/void-ai-chat.js, cwd: C:/workspace)');

		assert.strictEqual(diagnosis.code, 1);
		assert.strictEqual(diagnosis.scriptPath, 'C:/bridge/void-ai-chat.js');
		assert.strictEqual(diagnosis.cwd, 'C:/workspace');
		assert.ok(diagnosis.hints.length >= 2);
	});

	test('formats user-facing diagnostics for missing script', () => {
		const message = formatQwenFailureForUser('Process exited with code 1: script file does not exist: C:/bridge/void-ai-chat.js');

		assert.ok(message.includes('Qwen IPC failed with exit code 1'));
		assert.ok(message.includes('What to check:'));
		assert.ok(message.includes('void-ai-chat.js'));
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	createVoidAssetLibraryScaffold,
	getVoidAssetLibraryTemplate,
	VOID_ASSET_LIBRARY_TEMPLATES
} from '../../common/voidWelcomeAssetLibrary.js';

suite('VoidWelcomeAssetLibrary', () => {

	test('exposes built-in templates', () => {
		assert.ok(VOID_ASSET_LIBRARY_TEMPLATES.length >= 4);
		assert.ok(getVoidAssetLibraryTemplate('starter-3d'));
		assert.ok(getVoidAssetLibraryTemplate('ai-sandbox'));
	});

	test('creates scaffold with scene content', () => {
		const template = getVoidAssetLibraryTemplate('fps-prototype');
		assert.ok(template);
		if (!template) {
			return;
		}

		const scaffold = createVoidAssetLibraryScaffold(template);
		assert.ok(scaffold.sceneContent.includes('VoidScene('));
		assert.ok(Object.keys(scaffold.extraFiles).some(path => path.endsWith('fps_controller.rs')));
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});

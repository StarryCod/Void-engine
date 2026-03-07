/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	captureVecnNetworkSnapshot,
	DEFAULT_VOID_NETWORK_PROFILE,
	normalizeNetworkProfile,
	simulateNetworkReplication,
	stableHash
} from '../../common/voidRuntimeNetwork.js';
import type { IVoidNetworkStats } from '../../common/voidRuntimeService.js';

suite('VoidRuntimeNetwork', () => {

	const sampleScene = [
		'VoidScene(',
		'    version: "2.0",',
		'    mode: Scene3D,',
		'    entities: [',
		'        (',
		'            id: "z_entity",',
		'            name: "Zed",',
		'            visible: true,',
		'            components: [',
		'                Transform(',
		'                    translation: (1, 2, 3),',
		'                    rotation: (0, 0, 0, 1),',
		'                    scale: (1, 1, 1),',
		'                ),',
		'            ],',
		'            children: [],',
		'        ),',
		'        (',
		'            id: "a_entity",',
		'            name: "Alpha",',
		'            visible: true,',
		'            components: [',
		'                Transform2D(',
		'                    position: (4, 5),',
		'                    rotation: 0.5,',
		'                    scale: (2, 3),',
		'                ),',
		'            ],',
		'            children: [],',
		'        ),',
		'    ],',
		'    resources: [],',
		')',
	].join('\n');

	function createEmptyStats(): IVoidNetworkStats {
		return {
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
	}

	test('captures deterministic snapshot data from vecn', () => {
		const snapshotA = captureVecnNetworkSnapshot('assets/scenes/main.vecn', sampleScene, 3, 'editor', 123);
		const snapshotB = captureVecnNetworkSnapshot('assets/scenes/main.vecn', sampleScene, 3, 'editor', 123);

		assert.strictEqual(snapshotA.hash, snapshotB.hash);
		assert.strictEqual(snapshotA.transformCount, 2);
		assert.strictEqual(snapshotA.transforms[0].entityId, 'a_entity');
		assert.strictEqual(snapshotA.transforms[1].entityId, 'z_entity');
		assert.deepStrictEqual(snapshotA.transforms[0].position2D, [4, 5]);
		assert.deepStrictEqual(snapshotA.transforms[1].translation, [1, 2, 3]);
	});

	test('normalizes disabled profile and simulates dropped packets', () => {
		const disabled = normalizeNetworkProfile(DEFAULT_VOID_NETWORK_PROFILE, {
			mode: 'disabled',
			enabled: true,
			packetLoss: 0.7,
			latencyMs: 80
		});
		assert.strictEqual(disabled.enabled, false);
		assert.strictEqual(disabled.packetLoss, 0);
		assert.strictEqual(disabled.latencyMs, 0);

		const lossyProfile = normalizeNetworkProfile(DEFAULT_VOID_NETWORK_PROFILE, {
			mode: 'packetLoss',
			enabled: true,
			packetLoss: 1,
			latencyMs: 48,
			jitterMs: 12
		});
		const snapshot = captureVecnNetworkSnapshot('assets/scenes/main.vecn', sampleScene, 9, 'loopback', 456);
		const stats = simulateNetworkReplication(snapshot, createEmptyStats(), lossyProfile, 0, 789);

		assert.strictEqual(stats.packetsSent, 1);
		assert.strictEqual(stats.packetsDropped, 1);
		assert.strictEqual(stats.packetsDelivered, 0);
		assert.strictEqual(stats.lastSnapshot?.scenePath, 'assets/scenes/main.vecn');
		assert.ok(stats.bytesSent > 0);
	});

	test('stableHash stays stable for identical input', () => {
		assert.strictEqual(stableHash(sampleScene), stableHash(sampleScene));
		assert.notStrictEqual(stableHash(sampleScene), stableHash(`${sampleScene}\n// change`));
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});

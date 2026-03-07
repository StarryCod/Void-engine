/*---------------------------------------------------------------------------------------------
 *  Void Engine Scene Format (.vecn) - Preset Scenes
 *--------------------------------------------------------------------------------------------*/

import { VecnParser } from './vecnParser.js';
import { VoidScene } from './vecnTypes.js';
import { VECN_LATEST_VERSION } from './vecnSchema.js';

export type VecnPresetId = 'empty' | '2d' | '3d' | 'test-polygon';

export interface VecnScenePreset {
	readonly id: VecnPresetId;
	readonly label: string;
	readonly description: string;
}

export const VECN_SCENE_PRESETS: readonly VecnScenePreset[] = [
	{ id: 'empty', label: 'Empty Scene', description: 'Minimal empty 3D scene.' },
	{ id: '2d', label: '2D Starter', description: '2D scene with camera + sprite root.' },
	{ id: '3d', label: '3D Starter', description: '3D scene with camera, light and primitives.' },
	{ id: 'test-polygon', label: 'Test Polygon', description: 'Validation/test scene with mixed node set.' },
];

function createBaseScene(mode: 'Scene3D' | 'Scene2D'): VoidScene {
	return {
		version: VECN_LATEST_VERSION,
		mode,
		entities: [],
		resources: [
			{ type: 'ClearColor', color: [0.11, 0.13, 0.17, 1.0] },
			{ type: 'AmbientLight', color: [0.44, 0.47, 0.52], brightness: 0.42 },
		],
	};
}

export function createVecnPresetScene(presetId: VecnPresetId): VoidScene {
	if (presetId === 'empty') {
		return createBaseScene('Scene3D');
	}

	if (presetId === '2d') {
		return {
			...createBaseScene('Scene2D'),
			entities: [
				{
					id: 'camera_2d',
					name: 'Camera2D',
					visible: true,
					components: [
						{ type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
					],
					children: [],
				},
				{
					id: 'sprite_root',
					name: 'SpriteRoot',
					visible: true,
					components: [
						{ type: 'Transform2D', position: [0, 0], rotation: 0, scale: [1, 1] },
						{ type: 'Sprite2D', texture: '', region_enabled: false, region_rect: [0, 0, 0, 0], offset: [0, 0] },
					],
					children: [],
				},
			],
		};
	}

	if (presetId === '3d') {
		return {
			...createBaseScene('Scene3D'),
			entities: [
				{
					id: 'camera',
					name: 'Camera',
					visible: true,
					components: [
						{ type: 'Transform', translation: [0, 3.5, 8], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
						{ type: 'Camera', fov: 60, near: 0.1, far: 1000 },
					],
					children: [],
				},
				{
					id: 'sun',
					name: 'DirectionalLight',
					visible: true,
					components: [
						{ type: 'Transform', translation: [5, 9, 3], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
						{ type: 'DirectionalLight', color: [1, 0.95, 0.86], illuminance: 24000 },
					],
					children: [],
				},
				{
					id: 'floor',
					name: 'Floor',
					visible: true,
					components: [
						{ type: 'Transform', translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
						{ type: 'Mesh', shape: { type: 'Plane', size: 25 } },
						{ type: 'Material', color: [0.28, 0.31, 0.35, 1.0], metallic: 0.05, roughness: 0.9 },
					],
					children: [],
				},
				{
					id: 'cube',
					name: 'Cube',
					visible: true,
					components: [
						{ type: 'Transform', translation: [0, 1, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
						{ type: 'Mesh', shape: { type: 'Cube', size: 1 } },
						{ type: 'Material', color: [0.76, 0.32, 0.24, 1.0], metallic: 0.35, roughness: 0.52 },
					],
					children: [],
				},
			],
		};
	}

	// test-polygon
	return {
		...createBaseScene('Scene3D'),
		entities: [
			{
				id: 'camera',
				name: 'Camera',
				visible: true,
				components: [
					{ type: 'Transform', translation: [0, 6, 12], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
					{ type: 'Camera', fov: 70, near: 0.1, far: 1000 },
				],
				children: [],
			},
			{
				id: 'light',
				name: 'Sun',
				visible: true,
				components: [
					{ type: 'Transform', translation: [8, 12, 6], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
					{ type: 'DirectionalLight', color: [1, 0.97, 0.92], illuminance: 30000 },
				],
				children: [],
			},
			{
				id: 'world_environment',
				name: 'WorldEnvironment',
				visible: true,
				components: [
					{ type: 'Transform', translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
					{
						type: 'WorldEnvironment',
						environment: '',
						camera_attributes: '',
						background_mode: 'Sky',
						background_color: [0.1, 0.14, 0.19, 1],
						gradient_top: [0.28, 0.45, 0.75, 1],
						gradient_bottom: [0.11, 0.14, 0.19, 1],
						ambient_light_energy: 0.55,
						ambient_light_color: [0.46, 0.47, 0.5, 1],
						ambient_light_sky_contribution: 0.65,
						reflected_light_energy: 0.65,
						tonemap_mode: 'Filmic',
						tonemap_exposure: 1.2,
						tonemap_white: 1.0,
						ssao_enabled: true,
						ssao_intensity: 1.0,
						ssao_radius: 1.5,
						glow_enabled: false,
						glow_intensity: 0.8,
						glow_threshold: 0.9,
					},
				],
				children: [],
			},
		],
	};
}

export function createVecnPresetContent(presetId: VecnPresetId): string {
	return VecnParser.serialize(createVecnPresetScene(presetId));
}


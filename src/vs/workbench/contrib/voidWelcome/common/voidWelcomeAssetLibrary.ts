/*---------------------------------------------------------------------------------------------
 *  Void Engine - Internal Asset Library
 *--------------------------------------------------------------------------------------------*/

import { createVecnPresetContent, VecnPresetId } from '../../voidSceneEditor/common/vecnPresets.js';

export interface IVoidAssetLibraryTemplate {
	readonly id: string;
	readonly label: string;
	readonly category: 'starter' | 'gameplay' | 'prototype';
	readonly description: string;
	readonly version: string;
	readonly defaultProjectName: string;
	readonly scenePresetId: VecnPresetId;
	readonly mainTitle: string;
	readonly features: readonly string[];
	readonly readme: string;
	readonly extraFiles?: Readonly<Record<string, string>>;
}

export interface IVoidAssetLibraryScaffold {
	readonly sceneContent: string;
	readonly extraFiles: Readonly<Record<string, string>>;
}

const FPS_CONTROLLER_RS = `use bevy::prelude::*;

#[derive(Component, Default)]
pub struct FpsController {
    pub walk_speed: f32,
    pub sprint_speed: f32,
    pub jump_force: f32,
}

pub fn spawn_fps_controller(mut commands: Commands) {
    commands.spawn(FpsController {
        walk_speed: 4.5,
        sprint_speed: 7.5,
        jump_force: 5.0,
    });
}
`;

const SANDBOX_NOTES = `# Void Sandbox Notes

- Use AI Chat to modify assets/scenes/main.vecn
- Use Build to verify Cargo + scene loader preflight
- Use Run to launch runtime without editor fallback
`;

export const VOID_ASSET_LIBRARY_TEMPLATES: readonly IVoidAssetLibraryTemplate[] = [
	{
		id: 'starter-3d',
		label: '3D Starter',
		category: 'starter',
		description: 'Минимальный стартовый проект: камера, свет, пол, базовый mesh.',
		version: '1.0.0',
		defaultProjectName: 'VoidStarter3D',
		scenePresetId: '3d',
		mainTitle: 'Fast 3D bootstrap',
		features: [
			'3D preset scene',
			'Cargo scaffold with local void-scene-loader path',
			'Ready for immediate Build/Run'
		],
		readme: 'Быстрый старт для новых 3D сцен и проверки runtime/toolchain.',
	},
	{
		id: 'starter-2d',
		label: '2D Starter',
		category: 'starter',
		description: 'Минимальный 2D проект для проверки режима Scene2D и editor layout.',
		version: '1.0.0',
		defaultProjectName: 'VoidStarter2D',
		scenePresetId: '2d',
		mainTitle: '2D scene bootstrap',
		features: [
			'2D preset scene',
			'Good for viewport + inspector smoke checks',
			'No extra gameplay code'
		],
		readme: 'Используется для проверки 2D mode, inspector и future scripting pipeline.',
	},
	{
		id: 'fps-prototype',
		label: 'FPS Prototype',
		category: 'gameplay',
		description: 'Стартовый прототип FPS с базовым controller script и 3D сценой.',
		version: '1.1.0',
		defaultProjectName: 'VoidFpsPrototype',
		scenePresetId: '3d',
		mainTitle: 'Gameplay prototype',
		features: [
			'3D starter scene',
			'Rust gameplay script scaffold',
			'Good baseline for player-controller iteration'
		],
		readme: 'Подходит как база для player controller, collision и AI-assisted gameplay iteration.',
		extraFiles: {
			'src/scripts/mod.rs': 'pub mod fps_controller;\n',
			'src/scripts/fps_controller.rs': FPS_CONTROLLER_RS
		}
	},
	{
		id: 'ai-sandbox',
		label: 'AI Sandbox',
		category: 'prototype',
		description: 'Проект для тестирования AI-агента, vecn diff и scene iteration.',
		version: '1.0.0',
		defaultProjectName: 'VoidAiSandbox',
		scenePresetId: 'test-polygon',
		mainTitle: 'AI-driven sandbox',
		features: [
			'Richer .vecn baseline',
			'Preloaded notes for AI experiments',
			'Useful for tool cards + scene diffs'
		],
		readme: 'Этот шаблон нужен для проверки AI workflow: read/edit/search/tool cards и runtime overlays.',
		extraFiles: {
			'docs/ai_sandbox_notes.md': SANDBOX_NOTES
		}
	}
];

export function getVoidAssetLibraryTemplate(templateId: string): IVoidAssetLibraryTemplate | undefined {
	return VOID_ASSET_LIBRARY_TEMPLATES.find(template => template.id === templateId);
}

export function createVoidAssetLibraryScaffold(template: IVoidAssetLibraryTemplate): IVoidAssetLibraryScaffold {
	return {
		sceneContent: createVecnPresetContent(template.scenePresetId),
		extraFiles: template.extraFiles ?? {}
	};
}

/*---------------------------------------------------------------------------------------------
 *  Void Scene Editor - Common Types and Interfaces
 *--------------------------------------------------------------------------------------------*/

export const VOID_SCENE_EDITOR_ID = 'workbench.contrib.voidSceneEditor';

export enum SceneEditorMode {
	Scene3D = '3d',
	Scene2D = '2d',
	Script = 'script'
}

export interface IVoidSceneEditorService {
	readonly _serviceBrand: undefined;
	
	/**
	 * Current editor mode
	 */
	readonly currentMode: SceneEditorMode;
	
	/**
	 * Switch editor mode
	 */
	switchMode(mode: SceneEditorMode): void;
	
	/**
	 * Open .vecn file in scene editor
	 */
	openScene(uri: string): Promise<void>;
}

export const IVoidSceneEditorService = Symbol('IVoidSceneEditorService');

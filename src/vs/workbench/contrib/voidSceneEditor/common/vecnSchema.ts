/*---------------------------------------------------------------------------------------------
 *  Void Engine Scene Format (.vecn) - Schema Contract
 *--------------------------------------------------------------------------------------------*/

export const VECN_LATEST_VERSION = '2.0';
export const VECN_SUPPORTED_VERSIONS = ['1.0', '2.0'] as const;
export type VecnMode = 'Scene3D' | 'Scene2D';

export const VECN_SUPPORTED_MODES: readonly VecnMode[] = ['Scene3D', 'Scene2D'];

export const VECN_COMPONENT_TYPES = [
	'Transform',
	'Mesh',
	'Material',
	'PointLight',
	'DirectionalLight',
	'SpotLight',
	'Camera',
	'CollisionShape',
	'CharacterBody',
	'RigidBody',
	'StaticBody',
	'Area',
	'RayCast',
	'ShapeCast',
	'Transform2D',
	'Sprite2D',
	'AnimatedSprite2D',
	'CharacterBody2D',
	'RigidBody2D',
	'StaticBody2D',
	'Area2D',
	'CollisionShape2D',
	'RayCast2D',
	'Sprite3D',
	'AnimatedSprite3D',
	'Label3D',
	'GPUParticles3D',
	'CPUParticles3D',
	'MultiMeshInstance3D',
	'AudioStreamPlayer',
	'AudioStreamPlayer2D',
	'AudioStreamPlayer3D',
	'AnimationPlayer',
	'AnimationTree',
	'Tween',
	'NavigationRegion3D',
	'NavigationRegion2D',
	'NavigationAgent3D',
	'NavigationAgent2D',
	'NavigationObstacle3D',
	'NavigationObstacle2D',
	'WorldEnvironment',
	'Sky',
	'FogVolume',
	'ReflectionProbe',
	'Timer',
	'Path3D',
	'Path2D',
	'PathFollow3D',
	'PathFollow2D',
	'RemoteTransform3D',
	'RemoteTransform2D',
	'Marker3D',
	'Marker2D',
	'VisibleOnScreenNotifier3D',
	'VisibleOnScreenNotifier2D',
	'Viewport',
	'SubViewport',
	'CanvasLayer',
	'Skeleton3D',
	'BoneAttachment3D',
] as const;

export type VecnComponentType = typeof VECN_COMPONENT_TYPES[number];

export interface VecnDslSpec {
	readonly format: '.vecn';
	readonly latestVersion: string;
	readonly supportedVersions: readonly string[];
	readonly modes: readonly VecnMode[];
	readonly requiredTopLevelFields: readonly string[];
	readonly entityShape: readonly string[];
	readonly componentTypes: readonly VecnComponentType[];
}

export const VECN_DSL_SPEC: VecnDslSpec = {
	format: '.vecn',
	latestVersion: VECN_LATEST_VERSION,
	supportedVersions: VECN_SUPPORTED_VERSIONS,
	modes: VECN_SUPPORTED_MODES,
	requiredTopLevelFields: ['version', 'mode', 'entities', 'resources'],
	entityShape: ['id', 'name', 'visible', 'components', 'children'],
	componentTypes: VECN_COMPONENT_TYPES,
};

export function isSupportedVecnVersion(version: string): boolean {
	return VECN_SUPPORTED_VERSIONS.includes(version as typeof VECN_SUPPORTED_VERSIONS[number]);
}

export function isSupportedVecnMode(mode: string): mode is VecnMode {
	return VECN_SUPPORTED_MODES.includes(mode as VecnMode);
}

export function isSupportedComponentType(componentType: string): componentType is VecnComponentType {
	return VECN_COMPONENT_TYPES.includes(componentType as VecnComponentType);
}


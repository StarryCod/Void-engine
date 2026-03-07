/*---------------------------------------------------------------------------------------------
 *  Void Scene Actions - Context menu actions for .vecn files
 *--------------------------------------------------------------------------------------------*/

import { Action2, registerAction2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import type { ICommandActionTitle } from '../../../../platform/action/common/action.js';
import { localize, localize2 } from '../../../../nls.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { createVecnPresetContent, VecnPresetId } from '../common/vecnPresets.js';

// ============================================================================
// Set as Main Scene Action
// ============================================================================

class SetAsMainSceneAction extends Action2 {
	constructor() {
		super({
			id: 'voidEngine.setAsMainScene',
			title: localize('setAsMainScene', 'Set as Main Scene'),
			f1: false,
			menu: {
				id: MenuId.ExplorerContext,
				when: ContextKeyExpr.regex('resourceExtname', /\.vecn$/),
				group: 'void@1'
			}
		});
	}

	async run(accessor: ServicesAccessor, resource?: URI): Promise<void> {
		if (!resource) {
			return;
		}

		const fileService = accessor.get(IFileService);
		const notificationService = accessor.get(INotificationService);

		try {
			// Find project root (look for void.config.json)
			const projectRoot = await this.findProjectRoot(fileService, resource);
			if (!projectRoot) {
				notificationService.error('Could not find project root (void.config.json)');
				return;
			}

			// Get relative path from project root
			const relativePath = resource.path.substring(projectRoot.path.length + 1);

			// Read void.config.json
			const configUri = URI.joinPath(projectRoot, 'void.config.json');
			const configContent = await fileService.readFile(configUri);
			const config = JSON.parse(configContent.value.toString());

			// Update main scene
			config.mainScene = relativePath;

			// Write back
			await fileService.writeFile(configUri, VSBuffer.fromString(JSON.stringify(config, null, 2)));

			notificationService.info(`Main scene set to: ${relativePath}`);
		} catch (error) {
			notificationService.error(`Failed to set main scene: ${error}`);
		}
	}

	private async findProjectRoot(fileService: IFileService, startUri: URI): Promise<URI | null> {
		let current = URI.file(startUri.path.substring(0, startUri.path.lastIndexOf('/')));

		// Go up until we find void.config.json or reach root
		for (let i = 0; i < 10; i++) {
			const configUri = URI.joinPath(current, 'void.config.json');
			try {
				await fileService.resolve(configUri);
				return current;
			} catch {
				// Not found, go up
				const parent = URI.file(current.path.substring(0, current.path.lastIndexOf('/')));
				if (parent.path === current.path) {
					break; // Reached root
				}
				current = parent;
			}
		}

		return null;
	}
}

// ============================================================================
// Create Script for Scene Action
// ============================================================================

class CreateScriptForSceneAction extends Action2 {
	constructor() {
		super({
			id: 'voidEngine.createScriptForScene',
			title: localize('createScriptForScene', 'Create Script for Scene'),
			f1: false,
			menu: {
				id: MenuId.ExplorerContext,
				when: ContextKeyExpr.regex('resourceExtname', /\.vecn$/),
				group: 'void@2'
			}
		});
	}

	async run(accessor: ServicesAccessor, resource?: URI): Promise<void> {
		if (!resource) {
			return;
		}

		const fileService = accessor.get(IFileService);
		const notificationService = accessor.get(INotificationService);

		try {
			// Get scene name (without .vecn extension)
			const sceneName = resource.path.substring(resource.path.lastIndexOf('/') + 1, resource.path.lastIndexOf('.'));

			// Find project root
			const projectRoot = await this.findProjectRoot(fileService, resource);
			if (!projectRoot) {
				notificationService.error('Could not find project root');
				return;
			}

			// Create scripts folder if it doesn't exist
			const scriptsFolder = URI.joinPath(projectRoot, 'src', 'scripts');
			try {
				await fileService.createFolder(scriptsFolder);
			} catch {
				// Folder already exists
			}

			// Create script file
			const scriptPath = URI.joinPath(scriptsFolder, `${sceneName}.rs`);

			// Check if script already exists
			try {
				await fileService.resolve(scriptPath);
				notificationService.warn(`Script already exists: src/scripts/${sceneName}.rs`);
				return;
			} catch {
				// Script doesn't exist, create it
			}

			const scriptContent = `// Script for scene: ${sceneName}.vecn
use bevy::prelude::*;

#[derive(Component)]
pub struct ${this.toPascalCase(sceneName)}Behavior {
    // Add your custom fields here
}

pub fn setup_${sceneName}(
    mut commands: Commands,
) {
    println!("Setting up scene: ${sceneName}");
    
    // Add your setup logic here
}

pub fn update_${sceneName}(
    time: Res<Time>,
    mut query: Query<&mut Transform, With<${this.toPascalCase(sceneName)}Behavior>>,
) {
    // Add your update logic here
    for mut transform in query.iter_mut() {
        // Example: rotate objects
        // transform.rotate_y(time.delta_seconds());
    }
}

// Register this script in your main.rs:
// .add_systems(Startup, scripts::${sceneName}::setup_${sceneName})
// .add_systems(Update, scripts::${sceneName}::update_${sceneName})
`;

			await fileService.writeFile(scriptPath, VSBuffer.fromString(scriptContent));

			// Create mod.rs if it doesn't exist
			const modPath = URI.joinPath(scriptsFolder, 'mod.rs');
			try {
				const modContent = await fileService.readFile(modPath);
				const modText = modContent.value.toString();
				
				// Add module declaration if not present
				if (!modText.includes(`pub mod ${sceneName};`)) {
					await fileService.writeFile(
						modPath,
						VSBuffer.fromString(modText + `\npub mod ${sceneName};\n`)
					);
				}
			} catch {
				// mod.rs doesn't exist, create it
				await fileService.writeFile(
					modPath,
					VSBuffer.fromString(`pub mod ${sceneName};\n`)
				);
			}

			notificationService.info(`Script created: src/scripts/${sceneName}.rs`);
		} catch (error) {
			notificationService.error(`Failed to create script: ${error}`);
		}
	}

	private async findProjectRoot(fileService: IFileService, startUri: URI): Promise<URI | null> {
		let current = URI.file(startUri.path.substring(0, startUri.path.lastIndexOf('/')));

		for (let i = 0; i < 10; i++) {
			const configUri = URI.joinPath(current, 'void.config.json');
			try {
				await fileService.resolve(configUri);
				return current;
			} catch {
				const parent = URI.file(current.path.substring(0, current.path.lastIndexOf('/')));
				if (parent.path === current.path) {
					break;
				}
				current = parent;
			}
		}

		return null;
	}

	private toPascalCase(str: string): string {
		return str
			.split(/[-_]/)
			.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join('');
	}
}

// ============================================================================
// Create Scene Presets
// ============================================================================

interface PresetActionConfig {
	id: string;
	title: ICommandActionTitle;
	presetId: VecnPresetId;
	defaultName: string;
	group: string;
}

class CreatePresetVecnSceneAction extends Action2 {
	constructor(private readonly cfg: PresetActionConfig) {
		super({
			id: cfg.id,
			title: cfg.title,
			f1: true,
			menu: {
				id: MenuId.ExplorerContext,
				when: ContextKeyExpr.has('explorerResourceIsFolder'),
				group: cfg.group,
			}
		});
	}

	async run(accessor: ServicesAccessor, resource?: URI): Promise<void> {
		if (!resource) {
			return;
		}

		const fileService = accessor.get(IFileService);
		const notificationService = accessor.get(INotificationService);

		try {
			const targetFolder = await this.resolveTargetFolder(fileService, resource);
			const targetUri = await this.nextFreeSceneUri(fileService, targetFolder, this.cfg.defaultName);
			const content = createVecnPresetContent(this.cfg.presetId);
			await fileService.writeFile(targetUri, VSBuffer.fromString(content));
			notificationService.info(`Scene preset created: ${targetUri.path.split('/').pop()}`);
		} catch (error) {
			notificationService.error(`Failed to create scene preset: ${error}`);
		}
	}

	private async resolveTargetFolder(fileService: IFileService, resource: URI): Promise<URI> {
		const stat = await fileService.resolve(resource);
		if (stat.isDirectory) {
			return resource;
		}

		const lastSlash = resource.path.lastIndexOf('/');
		if (lastSlash <= 0) {
			return resource;
		}
		return URI.file(resource.path.slice(0, lastSlash));
	}

	private async nextFreeSceneUri(fileService: IFileService, folder: URI, baseName: string): Promise<URI> {
		const dotIndex = baseName.lastIndexOf('.');
		const plainName = dotIndex >= 0 ? baseName.slice(0, dotIndex) : baseName;
		const extension = dotIndex >= 0 ? baseName.slice(dotIndex) : '.vecn';

		for (let i = 0; i < 1000; i++) {
			const suffix = i === 0 ? '' : `_${i}`;
			const candidate = URI.joinPath(folder, `${plainName}${suffix}${extension}`);
			try {
				await fileService.resolve(candidate);
			} catch {
				return candidate;
			}
		}

		return URI.joinPath(folder, `${plainName}_${Date.now()}${extension}`);
	}
}

interface AssetCacheEntry {
	readonly path: string;
	readonly kind: string;
	readonly size: number;
	readonly mtime: number;
}

interface ScriptStoreTemplate {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly version: string;
	readonly defaultFileName: string;
	readonly content: string;
}

interface ScriptStorePick extends IQuickPickItem {
	template: ScriptStoreTemplate;
}

const SCRIPT_STORE_TEMPLATES: readonly ScriptStoreTemplate[] = [
	{
		id: 'player-controller-fps',
		label: 'FPS Player Controller',
		description: 'WASD movement + jump + sprint skeleton for Bevy gameplay logic',
		version: '1.0.0',
		defaultFileName: 'player_controller_fps.rs',
		content: `use bevy::prelude::*;

#[derive(Component, Default)]
pub struct PlayerControllerFps {
    pub walk_speed: f32,
    pub sprint_speed: f32,
    pub jump_force: f32,
}

pub fn spawn_player_controller(mut commands: Commands) {
    commands.spawn(PlayerControllerFps {
        walk_speed: 4.5,
        sprint_speed: 7.5,
        jump_force: 5.0,
    });
}

pub fn update_player_controller(
    keyboard: Res<ButtonInput<KeyCode>>,
    time: Res<Time>,
    mut query: Query<&mut Transform, With<PlayerControllerFps>>,
) {
    for mut transform in &mut query {
        let mut direction = Vec3::ZERO;
        if keyboard.pressed(KeyCode::KeyW) { direction.z -= 1.0; }
        if keyboard.pressed(KeyCode::KeyS) { direction.z += 1.0; }
        if keyboard.pressed(KeyCode::KeyA) { direction.x -= 1.0; }
        if keyboard.pressed(KeyCode::KeyD) { direction.x += 1.0; }

        if direction.length_squared() > 0.0 {
            transform.translation += direction.normalize() * 4.5 * time.delta_secs();
        }
    }
}
`
	},
	{
		id: 'trigger-volume',
		label: 'Trigger Volume System',
		description: 'Simple trigger volume callbacks for gameplay interactions',
		version: '1.0.0',
		defaultFileName: 'trigger_volume.rs',
		content: `use bevy::prelude::*;

#[derive(Component)]
pub struct TriggerVolume {
    pub id: String,
    pub radius: f32,
}

#[derive(Event)]
pub struct TriggerEntered {
    pub trigger_id: String,
}

pub fn register_trigger_events(app: &mut App) {
    app.add_event::<TriggerEntered>();
}

pub fn process_triggers(
    mut writer: EventWriter<TriggerEntered>,
    trigger_query: Query<(&Transform, &TriggerVolume)>,
    actor_query: Query<&Transform, Without<TriggerVolume>>,
) {
    for (trigger_transform, trigger) in &trigger_query {
        for actor_transform in &actor_query {
            let distance = trigger_transform.translation.distance(actor_transform.translation);
            if distance <= trigger.radius {
                writer.send(TriggerEntered { trigger_id: trigger.id.clone() });
                break;
            }
        }
    }
}
`
	},
	{
		id: 'fsm-lite',
		label: 'Gameplay FSM (Lite)',
		description: 'Finite state machine scaffold for enemy/NPC logic',
		version: '1.0.0',
		defaultFileName: 'fsm_lite.rs',
		content: `use bevy::prelude::*;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ActorState {
    Idle,
    Patrol,
    Chase,
}

#[derive(Component)]
pub struct ActorFsm {
    pub state: ActorState,
    pub timer: Timer,
}

pub fn spawn_fsm_actor(mut commands: Commands) {
    commands.spawn(ActorFsm {
        state: ActorState::Idle,
        timer: Timer::from_seconds(2.0, TimerMode::Repeating),
    });
}

pub fn update_fsm(time: Res<Time>, mut query: Query<&mut ActorFsm>) {
    for mut fsm in &mut query {
        fsm.timer.tick(time.delta());
        if fsm.timer.just_finished() {
            fsm.state = match fsm.state {
                ActorState::Idle => ActorState::Patrol,
                ActorState::Patrol => ActorState::Chase,
                ActorState::Chase => ActorState::Idle,
            };
        }
    }
}
`
	},
	{
		id: 'task-runner',
		label: 'AI Task Runner',
		description: 'Queue-based task executor scaffold for scripted AI behaviors',
		version: '1.0.0',
		defaultFileName: 'ai_task_runner.rs',
		content: `use bevy::prelude::*;
use std::collections::VecDeque;

#[derive(Clone, Debug)]
pub struct AiTask {
    pub name: String,
}

#[derive(Component, Default)]
pub struct AiTaskQueue {
    pub tasks: VecDeque<AiTask>,
}

pub fn enqueue_default_tasks(mut query: Query<&mut AiTaskQueue>) {
    for mut queue in &mut query {
        if queue.tasks.is_empty() {
            queue.tasks.push_back(AiTask { name: "FindTarget".into() });
            queue.tasks.push_back(AiTask { name: "MoveToTarget".into() });
            queue.tasks.push_back(AiTask { name: "ExecuteAction".into() });
        }
    }
}

pub fn run_ai_tasks(mut query: Query<&mut AiTaskQueue>) {
    for mut queue in &mut query {
        if let Some(task) = queue.tasks.pop_front() {
            info!("[AI Task Runner] task executed: {}", task.name);
        }
    }
}
`
	}
];

const ASSET_FILE_EXTENSIONS = new Set([
	'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tga', '.dds', '.ktx2', '.hdr', '.exr',
	'.gltf', '.glb', '.obj', '.fbx', '.mesh', '.mat', '.material', '.shader', '.wgsl',
	'.wav', '.ogg', '.mp3', '.flac', '.ttf', '.otf', '.json', '.ron', '.toml', '.vecn'
]);

function normalizeAssetPath(path: string): string {
	return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function fileNameFromPath(path: string): string {
	const normalized = path.replace(/\\/g, '/');
	const index = normalized.lastIndexOf('/');
	return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function getFileExtension(path: string): string {
	const base = fileNameFromPath(path);
	const index = base.lastIndexOf('.');
	return index >= 0 ? base.slice(index).toLowerCase() : '';
}

function parentDir(uri: URI): URI {
	const normalized = uri.path.replace(/\\/g, '/');
	const index = normalized.lastIndexOf('/');
	if (index <= 0) {
		return uri;
	}
	return URI.file(normalized.slice(0, index));
}

function toRelativeProjectPath(projectRoot: URI, target: URI): string {
	const rootPath = projectRoot.path.replace(/\\/g, '/').replace(/\/+$/, '');
	const targetPath = target.path.replace(/\\/g, '/');
	const rootWithSlash = `${rootPath}/`;
	if (targetPath.toLowerCase().startsWith(rootWithSlash.toLowerCase())) {
		return targetPath.slice(rootWithSlash.length);
	}
	return targetPath.replace(/^\/+/, '');
}

async function uriExists(fileService: IFileService, uri: URI): Promise<boolean> {
	try {
		await fileService.resolve(uri);
		return true;
	} catch {
		return false;
	}
}

async function findProjectRootForAction(
	fileService: IFileService,
	workspaceService: IWorkspaceContextService,
	resource?: URI
): Promise<URI | null> {
	const starts: URI[] = [];
	if (resource) {
		starts.push(resource);
	}
	for (const folder of workspaceService.getWorkspace().folders) {
		starts.push(folder.uri);
	}

	for (const start of starts) {
		let current = start;
		try {
			const stat = await fileService.resolve(start);
			if (!stat.isDirectory) {
				current = parentDir(start);
			}
		} catch {
			current = parentDir(start);
		}

		for (let i = 0; i < 14; i++) {
			const configUri = URI.joinPath(current, 'void.config.json');
			if (await uriExists(fileService, configUri)) {
				return current;
			}
			const parent = parentDir(current);
			if (parent.path === current.path) {
				break;
			}
			current = parent;
		}
	}

	return null;
}

async function collectFilesRecursive(
	fileService: IFileService,
	root: URI,
	accept: (uri: URI) => boolean,
	maxDepth: number = 10,
	depth: number = 0
): Promise<URI[]> {
	if (depth > maxDepth) {
		return [];
	}

	const out: URI[] = [];
	let stat;
	try {
		stat = await fileService.resolve(root);
	} catch {
		return out;
	}
	if (!stat.children || !stat.isDirectory) {
		return out;
	}

	const skipDirs = new Set(['.git', '.vscode', '.void', 'target', 'node_modules', 'out', 'dist', 'build']);
	for (const child of stat.children) {
		if (child.isDirectory) {
			if (!skipDirs.has(child.name)) {
				const nested = await collectFilesRecursive(fileService, child.resource, accept, maxDepth, depth + 1);
				out.push(...nested);
			}
			continue;
		}
		if (accept(child.resource)) {
			out.push(child.resource);
		}
	}
	return out;
}

function extractSceneAssetRefs(sceneText: string): string[] {
	const refs = new Set<string>();
	const pathPattern = /["'`]([^"'`\r\n\t]+?\.[a-zA-Z0-9]{2,8})["'`]/g;
	let match: RegExpExecArray | null = null;
	while ((match = pathPattern.exec(sceneText)) !== null) {
		const raw = match[1].trim();
		const ext = getFileExtension(raw);
		if (!ext || !ASSET_FILE_EXTENSIONS.has(ext)) {
			continue;
		}
		refs.add(raw);
	}
	return [...refs];
}

function resolveSceneRef(projectRoot: URI, sceneUri: URI, ref: string): URI | null {
	const cleaned = ref.trim();
	if (!cleaned) {
		return null;
	}
	if (/^[a-zA-Z]:[\\/]/.test(cleaned)) {
		return URI.file(cleaned);
	}
	if (cleaned.startsWith('res://')) {
		const tail = cleaned.slice('res://'.length).replace(/^\/+/, '');
		return URI.joinPath(projectRoot, 'assets', tail);
	}
	if (cleaned.startsWith('./') || cleaned.startsWith('../')) {
		return URI.joinPath(parentDir(sceneUri), cleaned);
	}
	if (cleaned.startsWith('assets/')) {
		return URI.joinPath(projectRoot, cleaned);
	}
	return URI.joinPath(projectRoot, 'assets', cleaned);
}

class AssetPipelineReportAction extends Action2 {
	constructor() {
		super({
			id: 'voidEngine.assetPipeline.report',
			title: localize2('voidAssetPipelineReport', 'Void Engine: Build Asset Pipeline Report'),
			f1: true,
			menu: {
				id: MenuId.ExplorerContext,
				when: ContextKeyExpr.or(
					ContextKeyExpr.has('explorerResourceIsFolder'),
					ContextKeyExpr.regex('resourceExtname', /\.vecn$/)
				),
				group: 'void@7'
			}
		});
	}

	async run(accessor: ServicesAccessor, resource?: URI): Promise<void> {
		const fileService = accessor.get(IFileService);
		const workspaceService = accessor.get(IWorkspaceContextService);
		const notificationService = accessor.get(INotificationService);

		const projectRoot = await findProjectRootForAction(fileService, workspaceService, resource);
		if (!projectRoot) {
			notificationService.error('Void Engine asset pipeline: project root not found (void.config.json).');
			return;
		}

		const assetsRoot = URI.joinPath(projectRoot, 'assets');
		if (!(await uriExists(fileService, assetsRoot))) {
			notificationService.warn('Void Engine asset pipeline: assets folder not found.');
			return;
		}

		const allAssetFiles = await collectFilesRecursive(fileService, assetsRoot, uri => {
			const ext = getFileExtension(uri.path);
			return ext.length > 0 && ASSET_FILE_EXTENSIONS.has(ext);
		});

		const sceneFiles = allAssetFiles.filter(uri => uri.path.toLowerCase().endsWith('.vecn'));
		const assetSet = new Set(allAssetFiles.map(uri => normalizeAssetPath(toRelativeProjectPath(projectRoot, uri))));
		const referencedSet = new Set<string>();
		const missingRefs: Array<{ scene: string; ref: string; resolved: string }> = [];

		for (const sceneUri of sceneFiles) {
			let sceneText = '';
			try {
				sceneText = (await fileService.readFile(sceneUri)).value.toString();
			} catch {
				continue;
			}
			const refs = extractSceneAssetRefs(sceneText);
			for (const ref of refs) {
				const resolved = resolveSceneRef(projectRoot, sceneUri, ref);
				if (!resolved) {
					continue;
				}
				const resolvedRelative = normalizeAssetPath(toRelativeProjectPath(projectRoot, resolved));
				referencedSet.add(resolvedRelative);
				if (!(await uriExists(fileService, resolved))) {
					missingRefs.push({
						scene: toRelativeProjectPath(projectRoot, sceneUri),
						ref,
						resolved: resolvedRelative
					});
				}
			}
		}

		const duplicateMap = new Map<string, string[]>();
		for (const assetPath of assetSet) {
			const base = fileNameFromPath(assetPath);
			const list = duplicateMap.get(base) ?? [];
			list.push(assetPath);
			duplicateMap.set(base, list);
		}

		const duplicates = [...duplicateMap.entries()]
			.filter(([, list]) => list.length > 1)
			.map(([name, list]) => ({ name, files: list }));

		const unusedAssets = [...assetSet]
			.filter(path => !path.endsWith('.vecn'))
			.filter(path => !referencedSet.has(path));

		const cacheEntries: AssetCacheEntry[] = [];
		for (const fileUri of allAssetFiles) {
			try {
				const stat = await fileService.resolve(fileUri);
				cacheEntries.push({
					path: toRelativeProjectPath(projectRoot, fileUri),
					kind: getFileExtension(fileUri.path).replace('.', ''),
					size: stat.size ?? 0,
					mtime: stat.mtime ?? 0
				});
			} catch {
				// ignore ephemeral files
			}
		}

		const voidFolder = URI.joinPath(projectRoot, '.void');
		try {
			await fileService.createFolder(voidFolder);
		} catch {
			// already exists
		}

		const report = {
			generatedAt: new Date().toISOString(),
			projectRoot: projectRoot.fsPath || projectRoot.path,
			assetsTotal: assetSet.size,
			referencedTotal: referencedSet.size,
			missingTotal: missingRefs.length,
			unusedTotal: unusedAssets.length,
			duplicateTotal: duplicates.length,
			missingRefs,
			unusedAssets,
			duplicates
		};

		await fileService.writeFile(
			URI.joinPath(voidFolder, 'asset-report.json'),
			VSBuffer.fromString(JSON.stringify(report, null, 2))
		);
		await fileService.writeFile(
			URI.joinPath(voidFolder, 'asset-metadata-cache.json'),
			VSBuffer.fromString(JSON.stringify({
				generatedAt: report.generatedAt,
				entries: cacheEntries
			}, null, 2))
		);

		notificationService.info(
			`Asset report ready: missing ${missingRefs.length}, unused ${unusedAssets.length}, duplicates ${duplicates.length} (.void/asset-report.json)`
		);
	}
}

class OpenScriptStoreAction extends Action2 {
	constructor() {
		super({
			id: 'voidEngine.scriptStore.open',
			title: localize2('voidScriptStoreOpen', 'Void Engine: Open Script Store'),
			f1: true,
			menu: {
				id: MenuId.ExplorerContext,
				when: ContextKeyExpr.has('explorerResourceIsFolder'),
				group: 'void@8'
			}
		});
	}

	async run(accessor: ServicesAccessor, resource?: URI): Promise<void> {
		const fileService = accessor.get(IFileService);
		const workspaceService = accessor.get(IWorkspaceContextService);
		const notificationService = accessor.get(INotificationService);
		const quickInputService = accessor.get(IQuickInputService);
		const editorService = accessor.get(IEditorService);

		const projectRoot = await findProjectRootForAction(fileService, workspaceService, resource);
		if (!projectRoot) {
			notificationService.error('Script Store: project root not found (void.config.json).');
			return;
		}

		const picks: ScriptStorePick[] = SCRIPT_STORE_TEMPLATES.map(template => ({
			label: template.label,
			description: template.description,
			detail: `v${template.version} - ${template.defaultFileName}`,
			template
		}));
		const selected = await quickInputService.pick(picks, {
			placeHolder: 'Select script from Void Script Store',
			matchOnDescription: true,
			matchOnDetail: true
		});
		if (!selected) {
			return;
		}

		const storeFolder = URI.joinPath(projectRoot, 'src', 'scripts', 'store');
		try {
			await fileService.createFolder(storeFolder);
		} catch {
			// already exists
		}

		const targetUri = await this.nextFreeFileUri(fileService, storeFolder, selected.template.defaultFileName);
		await fileService.writeFile(targetUri, VSBuffer.fromString(selected.template.content));

		const indexUri = URI.joinPath(storeFolder, 'script_store.index.json');
		const installedEntry = {
			id: selected.template.id,
			label: selected.template.label,
			version: selected.template.version,
			file: toRelativeProjectPath(projectRoot, targetUri),
			installedAt: new Date().toISOString()
		};
		let currentIndex: { installed: Array<typeof installedEntry> } = { installed: [] };
		try {
			const existing = await fileService.readFile(indexUri);
			const parsed = JSON.parse(existing.value.toString());
			if (parsed && Array.isArray(parsed.installed)) {
				currentIndex = { installed: parsed.installed as Array<typeof installedEntry> };
			}
		} catch {
			// create new index
		}
		currentIndex.installed = [
			installedEntry,
			...currentIndex.installed.filter(entry => entry.file !== installedEntry.file)
		];
		await fileService.writeFile(indexUri, VSBuffer.fromString(JSON.stringify(currentIndex, null, 2)));

		await editorService.openEditor({ resource: targetUri, options: { pinned: true } });
		notificationService.info(`Script installed from store: ${installedEntry.file}`);
	}

	private async nextFreeFileUri(fileService: IFileService, folder: URI, baseName: string): Promise<URI> {
		const dot = baseName.lastIndexOf('.');
		const plain = dot >= 0 ? baseName.slice(0, dot) : baseName;
		const ext = dot >= 0 ? baseName.slice(dot) : '.rs';
		for (let i = 0; i < 200; i++) {
			const suffix = i === 0 ? '' : `_${i}`;
			const candidate = URI.joinPath(folder, `${plain}${suffix}${ext}`);
			if (!(await uriExists(fileService, candidate))) {
				return candidate;
			}
		}
		return URI.joinPath(folder, `${plain}_${Date.now()}${ext}`);
	}
}

// ============================================================================
// Register Actions
// ============================================================================

registerAction2(SetAsMainSceneAction);
registerAction2(CreateScriptForSceneAction);
registerAction2(class extends CreatePresetVecnSceneAction {
	constructor() {
		super({
			id: 'voidEngine.createPresetScene.empty',
			title: localize2('createPresetSceneEmpty', 'Create Empty Scene (.vecn)'),
			presetId: 'empty',
			defaultName: 'empty_scene.vecn',
			group: 'void@3',
		});
	}
});
registerAction2(class extends CreatePresetVecnSceneAction {
	constructor() {
		super({
			id: 'voidEngine.createPresetScene.2d',
			title: localize2('createPresetScene2D', 'Create 2D Starter Scene (.vecn)'),
			presetId: '2d',
			defaultName: 'scene_2d.vecn',
			group: 'void@4',
		});
	}
});
registerAction2(class extends CreatePresetVecnSceneAction {
	constructor() {
		super({
			id: 'voidEngine.createPresetScene.3d',
			title: localize2('createPresetScene3D', 'Create 3D Starter Scene (.vecn)'),
			presetId: '3d',
			defaultName: 'scene_3d.vecn',
			group: 'void@5',
		});
	}
});
registerAction2(class extends CreatePresetVecnSceneAction {
	constructor() {
		super({
			id: 'voidEngine.createPresetScene.testPolygon',
			title: localize2('createPresetSceneTestPolygon', 'Create Test Polygon Scene (.vecn)'),
			presetId: 'test-polygon',
			defaultName: 'scene_test_polygon.vecn',
			group: 'void@6',
		});
	}
});
registerAction2(AssetPipelineReportAction);
registerAction2(OpenScriptStoreAction);

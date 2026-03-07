/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { localize2 } from '../../../../nls.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IMarkerData, IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { basename, dirname, joinPath } from '../../../../base/common/resources.js';
import { $, append } from '../../../../base/browser/dom.js';
import { ThreeViewport } from './threeViewport.js';
import { Viewport2D } from './viewport2D.js';
import { InspectorView } from './inspectorView.js';
import { sceneBridge } from '../common/voidSceneBridge.js';
import type { VecnValidationResult, VecnValidationSeverity } from '../common/vecnValidation.js';
import { IVoidRuntimeService } from '../../voidRuntime/common/voidRuntimeService.js';
import './media/voidSceneEditorToolbar.css';

type EditorMode = '3D' | '2D' | 'Script';
type LayoutPreset = 'Code' | 'Scene' | 'Debug' | 'Minimal';

interface EngineCommandPick extends IQuickPickItem {
	action: () => Promise<void> | void;
}

interface ScenePickerEntry {
	key: string;
	uri: URI;
	label: string;
}

interface ScriptPickerEntry {
	key: string;
	uri: URI;
	label: string;
}

type ScriptTemplateKind = 'rust' | 'toml';

class VoidSceneEditorContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.voidSceneEditor';
	private static readonly SCENE_PICKER_STORAGE_KEY = 'void.sceneEditor.mainVecnPicker.v1';
	private static readonly SCENE_PICKER_MAX_ITEMS = 14;

	private currentMode: EditorMode = 'Script';
	private currentLayoutPreset: LayoutPreset = 'Scene';
	private toolbar: HTMLElement | null = null;
	private scenePickerToolbar: HTMLElement | null = null;
	private scriptDockContainer: HTMLElement | null = null;
	private readonly modeButtons = new Map<EditorMode, HTMLButtonElement>();
	private readonly layoutButtons = new Map<LayoutPreset, HTMLButtonElement>();
	private scenePickerContainer: HTMLElement | null = null;
	private scenePickerEntries: ScenePickerEntry[] = [];
	private selectedSceneKey: string | null = null;
	private scriptPickerContainer: HTMLElement | null = null;
	private scriptMethodsContainer: HTMLElement | null = null;
	private networkOverlay: HTMLElement | null = null;
	private scriptFilterInput: HTMLInputElement | null = null;
	private scriptFilterQuery = '';
	private scriptPickerEntries: ScriptPickerEntry[] = [];
	private selectedScriptKey: string | null = null;
	private undoButton: HTMLButtonElement | null = null;
	private redoButton: HTMLButtonElement | null = null;
	private networkReplicationHandle: ReturnType<typeof globalThis.setTimeout> | undefined;

	// Container for viewport (3D or 2D)
	private viewportContainer: HTMLElement | null = null;
	private inspectorContainer: HTMLElement | null = null;
	
	// Viewports
	private viewport3D: ThreeViewport | null = null;
	private viewport2D: Viewport2D | null = null;
	private inspector: InspectorView | null = null;
	
	private modelListener: IDisposable | null = null;
	private fileWatcher: IDisposable | null = null;
	private suppressModelUntil: number = 0;
	private readonly modeDisposables = this._register(new DisposableStore());
	private readonly vecnMarkerOwner = 'void.vecn.schema';
	private markerResource: URI | null = null;
	private static activeInstance: VoidSceneEditorContribution | null = null;
	private static readonly SCRIPT_LINKS_FILE = '.void/scene-script-links.json';
	private readonly scriptDockEnabled = false;

	private clearElement(element: HTMLElement): void {
		while (element.firstChild) {
			element.removeChild(element.firstChild);
		}
	}

	private isMainVecnUri(uri: URI | undefined): uri is URI {
		if (!uri?.path) {
			return false;
		}
		return uri.path.toLowerCase().endsWith('/main.vecn');
	}

	private scenePickerKey(uri: URI): string {
		return uri.toString().toLowerCase();
	}

	private formatScenePickerLabel(uri: URI): string {
		const normalizedPath = uri.path.replace(/\\/g, '/');
		const segments = normalizedPath.split('/').filter(Boolean);
		if (segments.length < 2) {
			return 'main.vecn';
		}
		const parent = segments[segments.length - 2];
		return `${parent}/main.vecn`;
	}

	private loadScenePickerEntries(): ScenePickerEntry[] {
		if (typeof window === 'undefined' || !window.localStorage) {
			return [];
		}
		try {
			const raw = window.localStorage.getItem(VoidSceneEditorContribution.SCENE_PICKER_STORAGE_KEY);
			if (!raw) {
				return [];
			}
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) {
				return [];
			}
			const entries: ScenePickerEntry[] = [];
			for (const item of parsed) {
				if (typeof item !== 'string' || !item.trim()) {
					continue;
				}
				try {
					const uri = URI.parse(item);
					if (!this.isMainVecnUri(uri)) {
						continue;
					}
					entries.push({
						key: this.scenePickerKey(uri),
						uri,
						label: this.formatScenePickerLabel(uri),
					});
				} catch {
					// ignore malformed uri record
				}
			}
			return entries.slice(0, VoidSceneEditorContribution.SCENE_PICKER_MAX_ITEMS);
		} catch {
			return [];
		}
	}

	private saveScenePickerEntries(): void {
		if (typeof window === 'undefined' || !window.localStorage) {
			return;
		}
		try {
			const serialized = JSON.stringify(this.scenePickerEntries.map(entry => entry.uri.toString()));
			window.localStorage.setItem(VoidSceneEditorContribution.SCENE_PICKER_STORAGE_KEY, serialized);
		} catch {
			// ignore storage failures
		}
	}

	private rememberSceneInPicker(uri: URI): void {
		if (!this.isMainVecnUri(uri)) {
			return;
		}
		const key = this.scenePickerKey(uri);
		const filtered = this.scenePickerEntries.filter(entry => entry.key !== key);
		this.scenePickerEntries = [{
			key,
			uri,
			label: this.formatScenePickerLabel(uri),
		}, ...filtered].slice(0, VoidSceneEditorContribution.SCENE_PICKER_MAX_ITEMS);
		this.selectedSceneKey = key;
		this.saveScenePickerEntries();
		this.renderScenePicker();
	}

	private removeSceneFromPicker(key: string): void {
		const previousLength = this.scenePickerEntries.length;
		this.scenePickerEntries = this.scenePickerEntries.filter(entry => entry.key !== key);
		if (this.scenePickerEntries.length === previousLength) {
			return;
		}
		if (this.selectedSceneKey === key) {
			this.selectedSceneKey = this.scenePickerEntries[0]?.key ?? null;
		}
		this.saveScenePickerEntries();
		this.renderScenePicker();
	}

	private async openSceneFromPicker(uri: URI): Promise<void> {
		this.selectedSceneKey = this.scenePickerKey(uri);
		this.renderScenePicker();
		await this.editorService.openEditor({
			resource: uri,
			options: { pinned: true }
		});
	}

	private getSelectedScenePickerEntry(): ScenePickerEntry | null {
		if (this.selectedSceneKey) {
			const selected = this.scenePickerEntries.find(entry => entry.key === this.selectedSceneKey);
			if (selected) {
				return selected;
			}
		}
		const fallback = this.scenePickerEntries[0] ?? null;
		if (fallback) {
			this.selectedSceneKey = fallback.key;
		}
		return fallback;
	}

	private async closeResourceIfOpened(uri: URI): Promise<void> {
		const editors = this.editorService.findEditors(uri);
		if (editors.length === 0) {
			return;
		}
		await this.editorService.closeEditors(editors);
	}

	private renderScenePicker(): void {
		if (!this.scenePickerContainer) {
			return;
		}
		this.clearElement(this.scenePickerContainer);
		if (this.scenePickerEntries.length === 0) {
			this.selectedSceneKey = null;
			return;
		}
		const activeResource = this.editorService.activeEditor?.resource;
		const activeSceneKey = this.isMainVecnUri(activeResource) ? this.scenePickerKey(activeResource) : null;
		if (activeSceneKey && this.scenePickerEntries.some(entry => entry.key === activeSceneKey)) {
			this.selectedSceneKey = activeSceneKey;
		} else if (!this.selectedSceneKey || !this.scenePickerEntries.some(entry => entry.key === this.selectedSceneKey)) {
			this.selectedSceneKey = this.scenePickerEntries[0]?.key ?? null;
		}

		for (const entry of this.scenePickerEntries) {
			const item = append(this.scenePickerContainer, $('button.void-scene-picker-item')) as HTMLButtonElement;
			item.type = 'button';
			item.title = entry.uri.fsPath || entry.uri.path;
			item.classList.toggle('active', entry.key === this.selectedSceneKey);
			item.onclick = (event) => {
				event.preventDefault();
				event.stopPropagation();
				void this.openSceneFromPicker(entry.uri);
			};

			const label = append(item, $('span.void-scene-picker-label'));
			label.textContent = entry.label;

			const close = append(item, $('span.void-scene-picker-close.codicon.codicon-close'));
			close.setAttribute('role', 'button');
			close.setAttribute('aria-label', `Remove ${entry.label} from scene picker`);
			close.onclick = (event) => {
				event.preventDefault();
				event.stopPropagation();
				void (async () => {
					await this.closeResourceIfOpened(entry.uri);
					this.removeSceneFromPicker(entry.key);
				})();
			};
		}
	}

	private isScriptPickerUri(uri: URI | undefined): uri is URI {
		if (!uri?.path) {
			return false;
		}
		const lower = uri.path.toLowerCase();
		return lower.endsWith('.rs') || lower.endsWith('.toml');
	}

	private scriptPickerKey(uri: URI): string {
		return uri.toString().toLowerCase();
	}

	private formatScriptPickerLabel(uri: URI): string {
		const fileName = basename(uri);
		const normalizedPath = uri.path.replace(/\\/g, '/');
		const segments = normalizedPath.split('/').filter(Boolean);
		const parent = segments.length > 1 ? segments[segments.length - 2] : '';
		return parent ? `${parent}/${fileName}` : fileName;
	}

	private async scanWorkspaceForScripts(): Promise<ScriptPickerEntry[]> {
		const folders = this.workspaceService.getWorkspace().folders;
		const result: ScriptPickerEntry[] = [];
		const seen = new Set<string>();
		const skip = new Set(['.git', '.vscode', 'node_modules', 'target', 'out', 'dist', 'build', '.void']);

		const walk = async (uri: URI, depth: number): Promise<void> => {
			if (depth > 7) {
				return;
			}
			let stat: any;
			try {
				stat = await this.fileService.resolve(uri);
			} catch {
				return;
			}
			if (!stat.children) {
				return;
			}
			for (const child of stat.children) {
				if (child.isDirectory) {
					if (!skip.has(child.name)) {
						await walk(child.resource, depth + 1);
					}
					continue;
				}
				if (!this.isScriptPickerUri(child.resource)) {
					continue;
				}
				const key = this.scriptPickerKey(child.resource);
				if (seen.has(key)) {
					continue;
				}
				seen.add(key);
				result.push({
					key,
					uri: child.resource,
					label: this.formatScriptPickerLabel(child.resource),
				});
			}
		};

		for (const folder of folders) {
			await walk(folder.uri, 0);
		}

		result.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
		return result;
	}

	private async refreshScriptPickerEntries(): Promise<void> {
		this.scriptPickerEntries = await this.scanWorkspaceForScripts();
		if (this.selectedScriptKey && !this.scriptPickerEntries.some(entry => entry.key === this.selectedScriptKey)) {
			this.selectedScriptKey = null;
		}
		this.renderScriptPicker();
	}

	private renderScriptPicker(): void {
		if (!this.scriptPickerContainer) {
			return;
		}
		this.clearElement(this.scriptPickerContainer);

		const normalizedFilter = this.scriptFilterQuery.trim().toLowerCase();
		const visibleEntries = normalizedFilter
			? this.scriptPickerEntries.filter(entry => entry.label.toLowerCase().includes(normalizedFilter))
			: this.scriptPickerEntries;

		if (visibleEntries.length === 0) {
			const empty = append(this.scriptPickerContainer, $('div.void-script-picker-empty'));
			empty.textContent = normalizedFilter ? 'No scripts found' : 'No scripts found in workspace';
			void this.renderScriptMethodsForSelected();
			return;
		}

		for (const entry of visibleEntries) {
			const item = append(this.scriptPickerContainer, $('button.void-script-picker-item')) as HTMLButtonElement;
			item.type = 'button';
			item.title = entry.uri.fsPath || entry.uri.path;
			item.classList.toggle('active', entry.key === this.selectedScriptKey);
			item.onclick = (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.selectedScriptKey = entry.key;
				this.renderScriptPicker();
				void this.openScriptFromPicker(entry.uri);
			};

			const label = append(item, $('span.void-script-picker-label'));
			label.textContent = entry.label;

			const close = append(item, $('span.void-script-picker-close.codicon.codicon-close'));
			close.onclick = (event) => {
				event.preventDefault();
				event.stopPropagation();
				void (async () => {
					await this.closeResourceIfOpened(entry.uri);
					this.scriptPickerEntries = this.scriptPickerEntries.filter(candidate => candidate.key !== entry.key);
					if (this.selectedScriptKey === entry.key) {
						this.selectedScriptKey = this.scriptPickerEntries[0]?.key ?? null;
					}
					this.renderScriptPicker();
				})();
			};
		}
		void this.renderScriptMethodsForSelected();
	}

	private async openScriptFromPicker(uri: URI): Promise<void> {
		await this.editorService.openEditor({ resource: uri, options: { pinned: true } });
	}

	private async readTextFileSafely(uri: URI): Promise<string> {
		try {
			const file = await this.fileService.readFile(uri);
			return file.value.toString();
		} catch {
			return '';
		}
	}

	private async extractMethodNamesFromScript(uri: URI): Promise<string[]> {
		const content = await this.readTextFileSafely(uri);
		if (!content) {
			return [];
		}
		const lower = uri.path.toLowerCase();
		if (lower.endsWith('.rs')) {
			const regex = /^\s*(?:pub\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm;
			const methods: string[] = [];
			let match: RegExpExecArray | null;
			while ((match = regex.exec(content)) !== null) {
				methods.push(match[1]);
			}
			return methods.slice(0, 40);
		}
		if (lower.endsWith('.toml')) {
			const regex = /^\s*\[([^\]]+)\]\s*$/gm;
			const sections: string[] = [];
			let match: RegExpExecArray | null;
			while ((match = regex.exec(content)) !== null) {
				sections.push(`[${match[1]}]`);
			}
			return sections.slice(0, 40);
		}
		return [];
	}

	private async renderScriptMethodsForSelected(): Promise<void> {
		if (!this.scriptMethodsContainer) {
			return;
		}
		this.clearElement(this.scriptMethodsContainer);
		const selected = this.scriptPickerEntries.find(entry => entry.key === this.selectedScriptKey) ?? this.scriptPickerEntries[0];
		if (!selected) {
			const empty = append(this.scriptMethodsContainer, $('div.void-script-method-empty'));
			empty.textContent = 'Methods unavailable';
			return;
		}

		const methods = await this.extractMethodNamesFromScript(selected.uri);
		if (methods.length === 0) {
			const empty = append(this.scriptMethodsContainer, $('div.void-script-method-empty'));
			empty.textContent = 'No methods found';
			return;
		}

		for (const method of methods) {
			const chip = append(this.scriptMethodsContainer, $('button.void-script-method-chip')) as HTMLButtonElement;
			chip.type = 'button';
			chip.textContent = method;
			chip.onclick = (event) => {
				event.preventDefault();
				event.stopPropagation();
				void this.openScriptFromPicker(selected.uri);
			};
		}
	}

	private updateScriptPickerVisibility(): void {
		const editorContainer = document.querySelector('.part.editor .editor-container') as HTMLElement | null;
		if (!this.scriptDockEnabled) {
			this.scriptDockContainer?.classList.remove('visible');
			editorContainer?.classList.remove('void-script-dock-visible');
			editorContainer?.classList.remove('void-mode-script');
			return;
		}
		const isScriptMode = this.currentMode === 'Script';
		this.scriptDockContainer?.classList.toggle('visible', isScriptMode);
		editorContainer?.classList.toggle('void-script-dock-visible', isScriptMode);
		editorContainer?.classList.toggle('void-mode-script', isScriptMode);
	}

	private getWorkspaceRoot(): URI | null {
		return this.workspaceService.getWorkspace().folders[0]?.uri ?? null;
	}

	private scriptTemplateContent(kind: ScriptTemplateKind): string {
		if (kind === 'toml') {
			return `[package]\nname = \"my_script_package\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[dependencies]\n`;
		}
		return `pub fn _ready() {\n    // init\n}\n\npub fn _process(_delta: f32) {\n    // frame update\n}\n`;
	}

	private normalizeScriptPathInput(value: string, kind: ScriptTemplateKind): string {
		let normalized = value.trim().replace(/^res:\/\//i, '');
		normalized = normalized.replace(/^\/+/, '');
		if (!normalized) {
			normalized = kind === 'toml' ? 'scripts/new_config.toml' : 'src/scripts/new_script.rs';
		}
		const lower = normalized.toLowerCase();
		if (kind === 'rust' && !lower.endsWith('.rs')) {
			normalized += '.rs';
		}
		if (kind === 'toml' && !lower.endsWith('.toml')) {
			normalized += '.toml';
		}
		return normalized;
	}

	private async createScriptViaDialog(): Promise<void> {
		const kindPick = await this.quickInputService.pick([
			{ label: 'Rust Script (.rs)', id: 'rust' },
			{ label: 'TOML Config (.toml)', id: 'toml' },
		], {
			placeHolder: 'Choose script type',
		});
		if (!kindPick) {
			return;
		}
		const kind: ScriptTemplateKind = kindPick.id === 'toml' ? 'toml' : 'rust';
		const defaultPath = kind === 'toml' ? 'scripts/new_config.toml' : 'src/scripts/new_script.rs';
		const enteredPath = await this.quickInputService.input({
			prompt: 'Enter script path (relative to workspace)',
			value: defaultPath,
		});
		if (!enteredPath) {
			return;
		}
		const root = this.getWorkspaceRoot();
		if (!root) {
			return;
		}

		const relativePath = this.normalizeScriptPathInput(enteredPath, kind);
		const targetUri = joinPath(root, ...relativePath.split('/').filter(Boolean));
		const parent = dirname(targetUri);
		try {
			if (!(await this.fileService.exists(parent))) {
				await this.fileService.createFolder(parent);
			}
			if (!(await this.fileService.exists(targetUri))) {
				await this.fileService.writeFile(targetUri, VSBuffer.fromString(this.scriptTemplateContent(kind)));
			}
			await this.openScriptFromPicker(targetUri);
			await this.attachScriptToSelection(targetUri);
			await this.refreshScriptPickerEntries();
			this.selectedScriptKey = this.scriptPickerKey(targetUri);
			this.renderScriptPicker();
		} catch (error) {
			console.error('[Void Scene Editor] Failed to create script', error);
		}
	}

	private getScriptLinksUri(): URI | null {
		const root = this.getWorkspaceRoot();
		if (!root) {
			return null;
		}
		return joinPath(root, ...VoidSceneEditorContribution.SCRIPT_LINKS_FILE.split('/'));
	}

	private async loadScriptLinks(): Promise<Record<string, Record<string, string[]>>> {
		const linksUri = this.getScriptLinksUri();
		if (!linksUri) {
			return {};
		}
		try {
			if (!(await this.fileService.exists(linksUri))) {
				return {};
			}
			const raw = await this.fileService.readFile(linksUri);
			const parsed = JSON.parse(raw.value.toString());
			if (!parsed || typeof parsed !== 'object') {
				return {};
			}
			return parsed as Record<string, Record<string, string[]>>;
		} catch {
			return {};
		}
	}

	private async saveScriptLinks(data: Record<string, Record<string, string[]>>): Promise<void> {
		const linksUri = this.getScriptLinksUri();
		if (!linksUri) {
			return;
		}
		const linksDir = dirname(linksUri);
		if (!(await this.fileService.exists(linksDir))) {
			await this.fileService.createFolder(linksDir);
		}
		await this.fileService.writeFile(linksUri, VSBuffer.fromString(JSON.stringify(data, null, 2)));
	}

	private async attachScriptToSelection(scriptUri: URI): Promise<void> {
		const sceneUri = sceneBridge.uri;
		const selectedEntityId = sceneBridge.getSelectedEntityId();
		if (!sceneUri || !selectedEntityId) {
			return;
		}
		const links = await this.loadScriptLinks();
		const sceneKey = sceneUri.toString();
		if (!links[sceneKey]) {
			links[sceneKey] = {};
		}
		if (!links[sceneKey][selectedEntityId]) {
			links[sceneKey][selectedEntityId] = [];
		}
		const scriptKey = scriptUri.toString();
		if (!links[sceneKey][selectedEntityId].includes(scriptKey)) {
			links[sceneKey][selectedEntityId].push(scriptKey);
			await this.saveScriptLinks(links);
		}
	}

	private async attachSelectedScriptToSelection(): Promise<void> {
		const selected = this.scriptPickerEntries.find(entry => entry.key === this.selectedScriptKey) ?? this.scriptPickerEntries[0];
		if (!selected) {
			return;
		}
		await this.attachScriptToSelection(selected.uri);
	}

	public async createScriptFromSceneHierarchy(): Promise<void> {
		await this.createScriptViaDialog();
	}

	public async attachScriptFromSceneHierarchy(): Promise<void> {
		await this.attachSelectedScriptToSelection();
	}

	public static getActiveInstance(): VoidSceneEditorContribution | null {
		return this.activeInstance;
	}

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IMarkerService private readonly markerService: IMarkerService,
		@ICommandService private readonly commandService: ICommandService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IVoidRuntimeService private readonly runtimeService: IVoidRuntimeService,
	) {
		super();
		VoidSceneEditorContribution.activeInstance = this;
		this.scenePickerEntries = this.loadScenePickerEntries();
		this.selectedSceneKey = this.scenePickerEntries[0]?.key ?? null;
		this.runtimeService.publish('editor', 'sceneEditor.initialized');
		
		// Wait for DOM ready, then create toolbar
		this.initWhenReady();
		
		// Bridge save handler
		this._register(sceneBridge.onNeedsSave(e => this.saveToDisk(e.uri, e.content)));

		// Realtime scene sync: keep both viewports hot-updated on any bridge change
		this._register(sceneBridge.onSceneUpdated(() => {
			this.applySceneUpdate();
			this.scheduleNetworkReplication();
		}));
		this._register(sceneBridge.onValidationChanged(result => this.applyValidationMarkers(result)));
		this._register(sceneBridge.onHistoryChanged(() => this.refreshHistoryButtons()));
		this._register(this.runtimeService.onDidPublishEvent(event => {
			if (event.channel === 'network' || (event.channel === 'system' && event.type === 'listenerLeak.detected')) {
				this.updateNetworkOverlay();
			}
		}));

		// Keep selection synchronized across scene hierarchy, inspector and both viewports
		this._register(sceneBridge.onEntitySelected(id => {
			this.viewport3D?.selectEntityById(id);
			this.viewport2D?.selectEntity(id);
		}));
		
		// Editor changes
		this._register(this.editorService.onDidActiveEditorChange(() => this.handleActiveEditorChange()));
		
		// Load scene
		this.loadScene();
	}

	private handleActiveEditorChange(): void {
		const activeResource = this.editorService.activeEditor?.resource;
		if (activeResource?.path?.toLowerCase().endsWith('.vecn')) {
			const scenePath = activeResource.fsPath || activeResource.path;
			this.runtimeService.publish('editor', 'activeScene.changed', { scenePath });
			if (this.isMainVecnUri(activeResource)) {
				this.selectedSceneKey = this.scenePickerKey(activeResource);
			}
			this.rememberSceneInPicker(activeResource);
			this.applyValidationMarkers(sceneBridge.getValidation());
		} else if (this.isScriptPickerUri(activeResource)) {
			this.clearValidationMarkers();
			this.selectedScriptKey = this.scriptPickerKey(activeResource);
			if (!this.scriptPickerEntries.some(entry => entry.key === this.selectedScriptKey)) {
				this.scriptPickerEntries = [{
					key: this.selectedScriptKey,
					uri: activeResource,
					label: this.formatScriptPickerLabel(activeResource),
				}, ...this.scriptPickerEntries].slice(0, 40);
			}
			this.renderScriptPicker();
		} else {
			this.clearValidationMarkers();
		}
		this.attachModelListener();
		if (!this.isVecnEditorActive() && this.currentMode !== 'Script') {
			this.switchMode('Script');
		}
		this.updateNetworkOverlay();
	}

	private scheduleNetworkReplication(): void {
		if (this.networkReplicationHandle !== undefined) {
			globalThis.clearTimeout(this.networkReplicationHandle);
		}

		this.networkReplicationHandle = globalThis.setTimeout(async () => {
			this.networkReplicationHandle = undefined;
			const activeScene = await this.readActiveSceneTextForNetworking();
			if (!activeScene) {
				this.updateNetworkOverlay();
				return;
			}
			this.runtimeService.replicateSceneSnapshot(activeScene.scenePath, activeScene.text, 'editor');
			this.updateNetworkOverlay();
		}, 120);
	}

	private async captureActiveSceneSnapshotForNetwork(): Promise<void> {
		const activeScene = await this.readActiveSceneTextForNetworking();
		if (!activeScene) {
			return;
		}
		this.runtimeService.captureSceneSnapshot(activeScene.scenePath, activeScene.text, 'editor');
		this.updateNetworkOverlay();
	}

	private async readActiveSceneTextForNetworking(): Promise<{ scenePath: string; text: string } | null> {
		const resource = sceneBridge.uri ?? this.editorService.activeEditor?.resource;
		if (!resource?.path?.toLowerCase().endsWith('.vecn')) {
			return null;
		}

		if (sceneBridge.uri && sceneBridge.uri.toString() === resource.toString() && sceneBridge.getRaw().trim()) {
			return {
				scenePath: resource.fsPath || resource.path,
				text: sceneBridge.getRaw()
			};
		}

		try {
			const file = await this.fileService.readFile(resource);
			return {
				scenePath: resource.fsPath || resource.path,
				text: file.value.toString()
			};
		} catch {
			return null;
		}
	}

	private setNetworkProfilePreset(preset: 'disabled' | 'loopback' | 'packetLoss'): void {
		switch (preset) {
			case 'disabled':
				this.runtimeService.setNetworkSimulationProfile({
					enabled: false,
					mode: 'disabled',
					packetLoss: 0,
					latencyMs: 0,
					jitterMs: 0,
					outOfOrderChance: 0
				});
				break;
			case 'packetLoss':
				this.runtimeService.setNetworkSimulationProfile({
					enabled: true,
					mode: 'packetLoss',
					tickRate: 20,
					latencyMs: 90,
					jitterMs: 24,
					packetLoss: 0.12,
					outOfOrderChance: 0.04
				});
				break;
			default:
				this.runtimeService.setNetworkSimulationProfile({
					enabled: true,
					mode: 'loopback',
					tickRate: 30,
					latencyMs: 16,
					jitterMs: 3,
					packetLoss: 0,
					outOfOrderChance: 0
				});
				break;
		}
		this.updateNetworkOverlay();
	}

	private updateNetworkOverlay(): void {
		this.ensureNetworkOverlayAttached();
		if (!this.networkOverlay) {
			return;
		}

		const visible = this.currentMode !== 'Script';
		this.networkOverlay.style.display = visible ? 'flex' : 'none';
		if (!visible) {
			return;
		}

		const stats = this.runtimeService.getNetworkStats();
		const lossPercent = Math.round(stats.profile.packetLoss * 100);
		const kbSent = (stats.bytesSent / 1024).toFixed(1);
		const lines = [
			`NET ${stats.profile.mode} ${stats.profile.enabled ? 'on' : 'off'}`,
			`tick ${stats.tick} | sent ${stats.packetsSent} | drop ${stats.packetsDropped}`,
			`loss ${lossPercent}% | ${kbSent}kb | ${stats.lastLatencyMs}ms`
		];

		while (this.networkOverlay.firstChild) {
			this.networkOverlay.removeChild(this.networkOverlay.firstChild);
		}

		for (const line of lines) {
			const lineNode = append(this.networkOverlay, $('div.void-network-overlay-line'));
			lineNode.textContent = line;
		}
	}

	private isVecnEditorActive(): boolean {
		const resource = this.editorService.activeEditor?.resource;
		return !!resource?.path && resource.path.toLowerCase().endsWith('.vecn');
	}

	private getActiveMonacoEditor(): HTMLElement | null {
		const activeEditor = document.querySelector('.part.editor .editor-instance.active .monaco-editor') as HTMLElement | null;
		if (activeEditor) {
			return activeEditor;
		}
		return document.querySelector('.part.editor .monaco-editor') as HTMLElement | null;
	}

	private unhideMonacoEditors(): void {
		for (const editor of Array.from(document.querySelectorAll<HTMLElement>('.part.editor .monaco-editor.void-scene-editor-hidden'))) {
			editor.classList.remove('void-scene-editor-hidden');
		}
	}

	private applyValidationMarkers(validation: VecnValidationResult): void {
		const model = this.findVecnModel();
		const resource = model?.uri ?? sceneBridge.uri ?? this.editorService.activeEditor?.resource;
		if (!resource || !resource.path.toLowerCase().endsWith('.vecn')) {
			return;
		}

		if (this.markerResource && this.markerResource.toString() !== resource.toString()) {
			this.markerService.changeOne(this.vecnMarkerOwner, this.markerResource, []);
		}

		this.markerResource = resource;
		const markers: IMarkerData[] = validation.issues.map(issue => ({
			severity: this.toMarkerSeverity(issue.severity),
			message: this.formatIssueMessage(issue),
			startLineNumber: Math.max(1, issue.line),
			startColumn: Math.max(1, issue.column),
			endLineNumber: Math.max(1, issue.endLine),
			endColumn: Math.max(1, issue.endColumn),
		}));

		this.markerService.changeOne(this.vecnMarkerOwner, resource, markers);
	}

	private clearValidationMarkers(): void {
		if (!this.markerResource) {
			return;
		}
		this.markerService.changeOne(this.vecnMarkerOwner, this.markerResource, []);
		this.markerResource = null;
	}

	private toMarkerSeverity(severity: VecnValidationSeverity): MarkerSeverity {
		switch (severity) {
			case 'warning':
				return MarkerSeverity.Warning;
			case 'info':
				return MarkerSeverity.Info;
			default:
				return MarkerSeverity.Error;
		}
	}

	private formatIssueMessage(issue: VecnValidationResult['issues'][number]): string {
		const details = [
			issue.path ? `path: ${issue.path}` : '',
			issue.expected ? `expected: ${issue.expected}` : '',
			issue.actual ? `actual: ${issue.actual}` : '',
		].filter(Boolean);

		return details.length ? `${issue.message}\n${details.join('\n')}` : issue.message;
	}

	private initWhenReady(): void {
		const check = () => {
			const editorPart = document.querySelector('.part.editor');
			if (editorPart) {
				this.createToolbar(editorPart as HTMLElement);
				this.createViewportContainer(editorPart as HTMLElement);
				this.createScriptDock(editorPart as HTMLElement);
			} else {
				setTimeout(check, 50);
			}
		};
		setTimeout(check, 100);
	}

	// ════════════════════════════════════════════════════════════════
	// TOOLBAR
	// ════════════════════════════════════════════════════════════════

	private createToolbar(editorPart: HTMLElement): void {
		// Remove old toolbar if exists
		const oldToolbar = editorPart.querySelector('.void-scene-editor-toolbar');
		if (oldToolbar) oldToolbar.remove();
		const oldScenePickerToolbar = editorPart.querySelector('.void-scene-picker-toolbar');
		if (oldScenePickerToolbar) oldScenePickerToolbar.remove();
		const oldScriptPickerToolbar = editorPart.querySelector('.void-script-picker-toolbar');
		if (oldScriptPickerToolbar) oldScriptPickerToolbar.remove();

		this.toolbar = document.createElement('div');
		this.toolbar.className = 'void-scene-editor-toolbar';
		this.scenePickerToolbar = document.createElement('div');
		this.scenePickerToolbar.className = 'void-scene-picker-toolbar';
		const leftGroup = document.createElement('div');
		leftGroup.className = 'toolbar-group toolbar-group-left';
		const centerGroup = document.createElement('div');
		centerGroup.className = 'toolbar-group toolbar-group-center';
		const rightGroup = document.createElement('div');
		rightGroup.className = 'toolbar-group toolbar-group-right';
		const scenePickerContainer = document.createElement('div');
		scenePickerContainer.className = 'void-scene-picker';
		this.scenePickerContainer = scenePickerContainer;
		this.scenePickerToolbar.appendChild(scenePickerContainer);

		this.modeButtons.clear();
		this.layoutButtons.clear();
		this.undoButton = null;
		this.redoButton = null;

		// Mode buttons
		const modes: EditorMode[] = ['3D', '2D', 'Script'];
		modes.forEach(mode => {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'mode-button';
			btn.textContent = mode;
			btn.dataset.mode = mode;
			this.updateButtonStyle(btn, mode === this.currentMode);
			btn.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.switchMode(mode);
			};
			centerGroup.appendChild(btn);
			this.modeButtons.set(mode, btn);
		});
		this.renderScenePicker();

		// Layout presets
		const layoutPresets: LayoutPreset[] = ['Code', 'Scene', 'Debug', 'Minimal'];
		layoutPresets.forEach(preset => {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'layout-button';
			btn.textContent = preset;
			btn.dataset.layout = preset;
			btn.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.applyLayoutPreset(preset);
			};
			rightGroup.appendChild(btn);
			this.layoutButtons.set(preset, btn);
		});

		this.undoButton = this.createToolbarIconButton('codicon-discard', 'Undo Scene Change', () => {
			sceneBridge.undo();
			this.refreshHistoryButtons();
		});
		this.redoButton = this.createToolbarIconButton('codicon-redo', 'Redo Scene Change', () => {
			sceneBridge.redo();
			this.refreshHistoryButtons();
		});
		const commandPaletteButton = this.createToolbarIconButton('codicon-terminal-cmd', 'Void Engine Commands', () => {
			void this.openEngineCommandPalette();
		});

		leftGroup.appendChild(this.undoButton);
		leftGroup.appendChild(this.redoButton);
		leftGroup.appendChild(commandPaletteButton);

		this.toolbar.appendChild(leftGroup);
		this.toolbar.appendChild(centerGroup);
		this.toolbar.appendChild(rightGroup);

		editorPart.insertBefore(this.toolbar, editorPart.firstChild);
		editorPart.insertBefore(this.scenePickerToolbar, this.toolbar.nextSibling);

		// Adjust editor container
		const editorContainer = editorPart.querySelector('.editor-container');
		if (editorContainer) {
			(editorContainer as HTMLElement).classList.add('void-scene-editor-host');
			(editorContainer as HTMLElement).classList.toggle('void-mode-script', this.currentMode === 'Script');
		}
		this.refreshHistoryButtons();
		this.updateLayoutButtons();
		this.updateScriptPickerVisibility();
		if (this.scriptDockEnabled && this.currentMode === 'Script') {
			void this.refreshScriptPickerEntries();
		}
	}

	private updateButtonStyle(btn: HTMLButtonElement, isActive: boolean): void {
		btn.classList.toggle('active', isActive);
	}

	private createToolbarIconButton(iconClass: string, title: string, onClick: () => void): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'toolbar-icon-button';
		button.title = title;

		const icon = document.createElement('span');
		icon.className = `codicon ${iconClass} ve-center-host`;
		button.appendChild(icon);

		button.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			onClick();
		};
		return button;
	}

	public async openEngineCommandPalette(): Promise<void> {
		const items: EngineCommandPick[] = [
			{
				label: 'Scene: Undo',
				description: 'Undo last scene operation',
				action: () => { sceneBridge.undo(); this.refreshHistoryButtons(); },
			},
			{
				label: 'Scene: Redo',
				description: 'Redo scene operation',
				action: () => { sceneBridge.redo(); this.refreshHistoryButtons(); },
			},
			{
				label: 'Layout: Code',
				description: 'Switch to script-focused layout',
				action: () => this.applyLayoutPreset('Code'),
			},
			{
				label: 'Layout: Scene',
				description: 'Switch to scene editing layout',
				action: () => this.applyLayoutPreset('Scene'),
			},
			{
				label: 'Layout: Debug',
				description: 'Scene + larger inspector + output panel',
				action: () => this.applyLayoutPreset('Debug'),
			},
			{
				label: 'Layout: Minimal',
				description: 'Scene without inspector pane',
				action: () => this.applyLayoutPreset('Minimal'),
			},
			{
				label: 'Mode: 3D',
				description: 'Switch scene editor to 3D mode',
				action: () => this.switchMode('3D'),
			},
			{
				label: 'Mode: 2D',
				description: 'Switch scene editor to 2D mode',
				action: () => this.switchMode('2D'),
			},
			{
				label: 'Mode: Script',
				description: 'Switch scene editor to script mode',
				action: () => this.switchMode('Script'),
			},
			{
				label: 'Assets: Build Pipeline Report',
				description: 'Scan assets, detect missing/unused/duplicate links',
				action: () => this.commandService.executeCommand('voidEngine.assetPipeline.report'),
			},
			{
				label: 'Scripting: Open Script Store',
				description: 'Install gameplay script templates into project',
				action: () => this.commandService.executeCommand('voidEngine.scriptStore.open'),
			},
			{
				label: 'Network: Capture Scene Snapshot',
				description: 'Create deterministic state snapshot from active .vecn scene',
				action: () => this.captureActiveSceneSnapshotForNetwork(),
			},
			{
				label: 'Network: Local Loopback',
				description: 'Enable local loopback replication profile',
				action: () => this.setNetworkProfilePreset('loopback'),
			},
			{
				label: 'Network: Packet Loss Simulation',
				description: 'Enable lag + packet loss profile for multiplayer debugging',
				action: () => this.setNetworkProfilePreset('packetLoss'),
			},
			{
				label: 'Network: Disable Simulation',
				description: 'Disable replication simulator and keep overlay passive',
				action: () => this.setNetworkProfilePreset('disabled'),
			},
		];

		const selected = await this.quickInputService.pick(items, {
			placeHolder: 'Void Engine Command Palette',
			matchOnDescription: true,
		});
		if (!selected) {
			return;
		}
		await selected.action();
	}

	public applyLayoutPreset(preset: LayoutPreset): void {
		this.currentLayoutPreset = preset;
		this.updateLayoutButtons();
		this.ensureEditorContainers();

		if (this.viewportContainer) {
			this.viewportContainer.classList.remove(
				'layout-code',
				'layout-scene',
				'layout-debug',
				'layout-minimal'
			);
			this.viewportContainer.classList.add(`layout-${preset.toLowerCase()}`);
		}

		switch (preset) {
			case 'Code':
				this.switchMode('Script');
				break;
			case 'Minimal':
			case 'Scene':
			case 'Debug': {
				const targetMode: EditorMode = this.currentMode === 'Script' ? '3D' : this.currentMode;
				this.switchMode(targetMode);
				if (preset === 'Debug') {
					try {
						void this.commandService.executeCommand('workbench.action.output.focus');
					} catch {
						// ignore
					}
				}
				break;
			}
			default:
				this.switchMode(this.currentMode === 'Script' ? '3D' : this.currentMode);
				break;
		}
	}

	private updateLayoutButtons(): void {
		for (const [preset, button] of this.layoutButtons) {
			this.updateButtonStyle(button, preset === this.currentLayoutPreset);
		}
	}

	private refreshHistoryButtons(): void {
		const history = sceneBridge.getHistoryState();
		if (this.undoButton) {
			this.undoButton.disabled = !history.canUndo;
			this.undoButton.classList.toggle('disabled', !history.canUndo);
		}
		if (this.redoButton) {
			this.redoButton.disabled = !history.canRedo;
			this.redoButton.classList.toggle('disabled', !history.canRedo);
		}
	}

	// ════════════════════════════════════════════════════════════════
	// VIEWPORT CONTAINER
	// ════════════════════════════════════════════════════════════════

	private createViewportContainer(editorPart: HTMLElement): void {
		const editorContainer = editorPart.querySelector('.editor-container');
		if (!editorContainer) return;

		// Create main container (hidden by default)
		this.viewportContainer = document.createElement('div');
		this.viewportContainer.className = 'void-viewport-wrapper';

		// Create viewport pane (left)
		const viewportPane = document.createElement('div');
		viewportPane.className = 'void-viewport-pane';
		viewportPane.id = 'void-viewport-pane';
		this.viewportContainer.appendChild(viewportPane);
		this.ensureNetworkOverlayAttached(viewportPane);

		// Create inspector pane (right)
		this.inspectorContainer = document.createElement('div');
		this.inspectorContainer.className = 'void-inspector-pane';
		this.viewportContainer.appendChild(this.inspectorContainer);
		this.viewportContainer.classList.add(`layout-${this.currentLayoutPreset.toLowerCase()}`);

		editorContainer.appendChild(this.viewportContainer);
		this.updateNetworkOverlay();
	}

	private createScriptDock(editorPart: HTMLElement): void {
		const editorContainer = editorPart.querySelector('.editor-container');
		if (!editorContainer) {
			return;
		}

		const oldDock = editorContainer.querySelector('.void-script-dock');
		if (oldDock) {
			oldDock.remove();
		}
		if (!this.scriptDockEnabled) {
			this.scriptDockContainer = null;
			this.scriptPickerContainer = null;
			this.scriptMethodsContainer = null;
			this.scriptFilterInput = null;
			editorContainer.classList.remove('void-script-dock-visible');
			return;
		}

		this.scriptDockContainer = document.createElement('div');
		this.scriptDockContainer.className = 'void-script-dock';

		const filesPanel = document.createElement('section');
		filesPanel.className = 'void-script-dock-panel void-script-dock-files';
		const filesHeader = document.createElement('div');
		filesHeader.className = 'void-script-dock-header';
		filesHeader.textContent = 'Scripts';
		filesPanel.appendChild(filesHeader);
		this.scriptFilterInput = document.createElement('input');
		this.scriptFilterInput.type = 'text';
		this.scriptFilterInput.className = 'void-script-dock-filter';
		this.scriptFilterInput.placeholder = 'Filter scripts';
		this.scriptFilterInput.value = this.scriptFilterQuery;
		this.scriptFilterInput.oninput = () => {
			this.scriptFilterQuery = this.scriptFilterInput?.value ?? '';
			this.renderScriptPicker();
		};
		filesPanel.appendChild(this.scriptFilterInput);
		this.scriptPickerContainer = document.createElement('div');
		this.scriptPickerContainer.className = 'void-script-picker';
		filesPanel.appendChild(this.scriptPickerContainer);

		const methodsPanel = document.createElement('section');
		methodsPanel.className = 'void-script-dock-panel void-script-dock-methods';
		const methodsHeader = document.createElement('div');
		methodsHeader.className = 'void-script-dock-header';
		methodsHeader.textContent = 'Methods';
		methodsPanel.appendChild(methodsHeader);
		this.scriptMethodsContainer = document.createElement('div');
		this.scriptMethodsContainer.className = 'void-script-methods';
		methodsPanel.appendChild(this.scriptMethodsContainer);

		this.scriptDockContainer.appendChild(filesPanel);
		this.scriptDockContainer.appendChild(methodsPanel);
		editorContainer.appendChild(this.scriptDockContainer);
		this.updateScriptPickerVisibility();
		this.renderScriptPicker();
		if (this.currentMode === 'Script') {
			void this.refreshScriptPickerEntries();
		}
	}

	private ensureEditorContainers(): void {
		const editorPart = document.querySelector('.part.editor') as HTMLElement | null;
		if (!editorPart) {
			return;
		}
		if (!this.toolbar || !editorPart.contains(this.toolbar)) {
			this.createToolbar(editorPart);
		}
		if (!this.viewportContainer || !editorPart.contains(this.viewportContainer)) {
			this.createViewportContainer(editorPart);
		}
		if (!this.scriptDockContainer || !editorPart.contains(this.scriptDockContainer)) {
			this.createScriptDock(editorPart);
		}
	}

	private getViewportPane(): HTMLElement | null {
		const localPane = this.viewportContainer?.querySelector('#void-viewport-pane') as HTMLElement | null;
		if (localPane) {
			return localPane;
		}
		return document.getElementById('void-viewport-pane');
	}

	private ensureNetworkOverlayAttached(pane?: HTMLElement | null): void {
		const targetPane = pane ?? this.getViewportPane();
		if (!targetPane) {
			return;
		}
		if (!this.networkOverlay) {
			this.networkOverlay = document.createElement('div');
			this.networkOverlay.className = 'void-network-overlay';
		}
		if (this.networkOverlay.parentElement !== targetPane) {
			targetPane.appendChild(this.networkOverlay);
		}
	}

	// ════════════════════════════════════════════════════════════════
	// MODE SWITCHING - SIMPLE IF LOGIC
	// ════════════════════════════════════════════════════════════════

	private switchMode(mode: EditorMode): void {
		try {
			this.ensureEditorContainers();
			this.currentMode = mode;
			this.runtimeService.publish('editor', 'mode.changed', { mode });
			this.modeDisposables.clear();
			this.updateScriptPickerVisibility();
			this.updateNetworkOverlay();

			// Update toolbar buttons
			if (this.modeButtons.size > 0) {
				for (const [btnMode, btn] of this.modeButtons) {
					this.updateButtonStyle(btn, btnMode === mode);
				}
			}

			// Get editor elements
			const monacoEditor = this.getActiveMonacoEditor();

			// Stop all viewports
			if (this.viewport3D) this.viewport3D.stopRendering();
			if (this.viewport2D) this.viewport2D.stopRendering();

			// === SCRIPT MODE ===
			if (mode === 'Script') {
				// Show Monaco editor
				this.unhideMonacoEditors();
				// Hide viewport container
				if (this.viewportContainer) this.viewportContainer.classList.remove('visible');
				if (this.scriptDockEnabled) {
					void this.refreshScriptPickerEntries();
				}
				this.updateNetworkOverlay();
				return;
			}

			if (!this.isVecnEditorActive()) {
				const selectedScene = this.getSelectedScenePickerEntry()?.uri ?? null;
				if (selectedScene && this.isMainVecnUri(selectedScene)) {
					void this.openSceneFromPicker(selectedScene).then(() => {
						if (this.isVecnEditorActive()) {
							this.switchMode(mode);
						}
					});
					return;
				}
				this.currentMode = 'Script';
				this.unhideMonacoEditors();
				if (this.viewportContainer) this.viewportContainer.classList.remove('visible');
				this.updateScriptPickerVisibility();
				if (this.scriptDockEnabled) {
					void this.refreshScriptPickerEntries();
				}
				this.updateNetworkOverlay();
				return;
			}

			// === 3D MODE ===
			if (mode === '3D') {
				// Hide Monaco editor
				if (monacoEditor) monacoEditor.classList.add('void-scene-editor-hidden');
				// Show viewport container
				if (this.viewportContainer) this.viewportContainer.classList.add('visible');

				// Dispose 2D viewport before creating/restoring 3D.
				// Both modes share the same DOM pane, so keeping both instances breaks switching.
				if (this.viewport2D) {
					this.viewport2D.dispose();
					this.viewport2D = null;
				}
				
				// Create 3D viewport if not exists
				const pane = this.getViewportPane();
				if (pane && !this.viewport3D) {
					// Clear pane
					this.clearElement(pane);
					this.viewport3D = new ThreeViewport(pane, sceneBridge.getRaw() || '');
					this._register(this.viewport3D);
					this.ensureNetworkOverlayAttached(pane);
				}
				if (this.viewport3D) {
					this.modeDisposables.add(this.viewport3D.onTransformEditedTRS(e => {
						sceneBridge.updateTransform({
							entityId: e.entityId,
							translation: e.translation,
							rotation: e.rotation,
							scale: e.scale,
						});
					}));
					this.modeDisposables.add(this.viewport3D.onEntityPicked(id => {
						sceneBridge.selectEntity(id);
					}));
				}
				
				// Create inspector if not exists
				if (this.inspectorContainer && !this.inspector) {
					this.clearElement(this.inspectorContainer);
					this.inspector = new InspectorView(this.inspectorContainer);
					this._register(this.inspector);
				}
				
				// Update scene
				if (this.viewport3D) {
					this.viewport3D.updateScene(sceneBridge.getRaw() || '');
					this.viewport3D.startRendering();
				}
				return;
			}

			// === 2D MODE ===
			if (mode === '2D') {
				// Hide Monaco editor
				if (monacoEditor) monacoEditor.classList.add('void-scene-editor-hidden');
				// Show viewport container
				if (this.viewportContainer) this.viewportContainer.classList.add('visible');

				// Dispose 3D viewport before creating/restoring 2D.
				// Both modes share the same DOM pane, so keeping both instances breaks switching.
				if (this.viewport3D) {
					this.viewport3D.dispose();
					this.viewport3D = null;
				}
				
				// Create 2D viewport if not exists
				const pane = this.getViewportPane();
				if (pane && !this.viewport2D) {
					// Clear pane
					this.clearElement(pane);
					this.viewport2D = new Viewport2D(pane);
					this._register(this.viewport2D);
					this.ensureNetworkOverlayAttached(pane);
				}
				if (this.viewport2D) {
					this.modeDisposables.add(this.viewport2D.onEntitySelected(id => {
						sceneBridge.selectEntity(id);
					}));

					this.modeDisposables.add(this.viewport2D.onTransformChanged(e => {
						sceneBridge.updateTransform2D({
							entityId: e.id,
							position: [e.transform.position[0], e.transform.position[1]],
							rotation: e.transform.rotation,
							scale: [e.transform.scale[0], e.transform.scale[1]]
						});
					}));
				}
				
				// Create inspector if not exists
				if (this.inspectorContainer && !this.inspector) {
					this.clearElement(this.inspectorContainer);
					this.inspector = new InspectorView(this.inspectorContainer);
					this._register(this.inspector);
				}
				
				// Update entities
				if (this.viewport2D) {
					this.viewport2D.loadScene(this.convertEntities());
					this.viewport2D.resize();
					this.viewport2D.startRendering();
				}
				return;
			}
		} catch (error) {
			console.error('[Void Scene Editor] Failed to switch editor mode:', error);
		}
	}

	private convertEntities(): any[] {
		const entities = sceneBridge.getEntities();
		return entities.map(e => {
			const result: any = {
				id: e.id,
				name: e.name,
				transform: { position: [0, 0] as [number, number], rotation: 0, scale: [1, 1] as [number, number] },
				visible: e.visible ?? true,
			};
			
			for (const comp of e.components || []) {
				if (comp.type === 'Transform') {
					result.transform.position = [comp.translation?.[0] || 0, comp.translation?.[1] || 0];
					result.transform.scale = [comp.scale?.[0] || 1, comp.scale?.[1] || 1];
				} else if (comp.type === 'Transform2D') {
					result.transform = {
						position: comp.position || [0, 0],
						rotation: comp.rotation || 0,
						scale: comp.scale || [1, 1],
					};
				} else if (comp.type === 'Sprite2D') {
					result.sprite = { size: [100, 100] };
				} else if (comp.type === 'CollisionShape2D') {
					const shape = comp.shape;
					const size: [number, number] =
						shape && 'size' in shape
							? shape.size
							: shape && 'radius' in shape
								? [shape.radius * 2, shape.radius * 2]
								: [50, 50];
					result.collider = { type: shape?.type || 'box', size };
				}
			}
			return result;
		});
	}

	private applySceneUpdate(): void {
		if (this.viewport3D) {
			this.viewport3D.updateScene(sceneBridge.getRaw() || '');
		}
		if (this.viewport2D) {
			this.viewport2D.loadScene(this.convertEntities());
		}
	}

	// ════════════════════════════════════════════════════════════════
	// SCENE LOADING
	// ════════════════════════════════════════════════════════════════

	private async loadScene(): Promise<void> {
		const delays = [100, 300, 600, 1000, 2000];
		
		for (const delay of delays) {
			await new Promise(r => setTimeout(r, delay));
			if (sceneBridge.hasScene()) return;

			const uri = await this.findVecnUri();
			if (!uri) continue;

			try {
				const file = await this.fileService.readFile(uri);
				const content = file.value.toString();
				if (!content.trim()) continue;

				sceneBridge.setUri(uri);
				if (sceneBridge.loadFromText(content, 'init')) {
					this.rememberSceneInPicker(uri);
					const workspacePath = this.workspaceService.getWorkspace().folders[0]?.uri.fsPath;
					const scenePath = uri.fsPath || uri.path;
					this.runtimeService.transition('load', { workspacePath, scenePath });
					this.runtimeService.publish('editor', 'scene.loaded', { source: 'init', scenePath });
					this.setupFileWatcher(uri);
					return;
				}
			} catch { /* ignore */ }
		}
	}

	private async findVecnUri(): Promise<URI | null> {
		const active = this.editorService.activeEditor;
		if (active?.resource?.path?.endsWith('.vecn')) return active.resource;

		for (const ctrl of this.editorService.visibleTextEditorControls) {
			const m = (ctrl as any)?.getModel?.();
			if (m?.uri?.path?.endsWith('.vecn')) return m.uri;
		}

		const folders = this.workspaceService.getWorkspace().folders;
		for (const folder of folders) {
			const found = await this.searchFolder(folder.uri, 0);
			if (found) return found;
		}
		return null;
	}

	private async searchFolder(uri: URI, depth: number): Promise<URI | null> {
		if (depth > 4) return null;
		try {
			const stat = await this.fileService.resolve(uri);
			if (!stat.children) return null;
			const skip = new Set(['node_modules', '.git', '.vscode', 'out', 'dist', 'build', '.void']);
			for (const c of stat.children) {
				if (!c.isDirectory && c.name.endsWith('.vecn')) return c.resource;
			}
			for (const c of stat.children) {
				if (c.isDirectory && !skip.has(c.name)) {
					const f = await this.searchFolder(c.resource, depth + 1);
					if (f) return f;
				}
			}
		} catch { /* ignore */ }
		return null;
	}

	private attachModelListener(): void {
		const model = this.findVecnModel();
		if (!model) return;

		if (this.modelListener && (this.modelListener as any).__uri === model.uri.toString()) return;

		this.disposeModelListener();

		if (!sceneBridge.hasScene()) {
			sceneBridge.setUri(model.uri);
			if (sceneBridge.loadFromText(model.getValue(), 'init')) {
				this.rememberSceneInPicker(model.uri);
				const workspacePath = this.workspaceService.getWorkspace().folders[0]?.uri.fsPath;
				const scenePath = model.uri.fsPath || model.uri.path;
				this.runtimeService.transition('load', { workspacePath, scenePath });
				this.runtimeService.publish('editor', 'scene.loaded', { source: 'editor-init', scenePath });
			}
			this.setupFileWatcher(model.uri);
		}

		const disp = model.onDidChangeContent(() => {
			if (Date.now() < this.suppressModelUntil) return;
			sceneBridge.loadFromText(model.getValue(), 'editor');
		});

		this.modelListener = disp;
		(this.modelListener as any).__uri = model.uri.toString();
	}

	private findVecnModel(): any {
		for (const ctrl of this.editorService.visibleTextEditorControls) {
			const m = (ctrl as any)?.getModel?.();
			if (m?.uri?.path?.endsWith('.vecn')) return m;
		}
		return null;
	}

	private disposeModelListener(): void {
		if (this.modelListener) {
			this.modelListener.dispose();
			this.modelListener = null;
		}
	}

	private setupFileWatcher(uri: URI): void {
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
			this.fileWatcher = null;
		}

		const w = this.fileService.watch(uri);
		const l = this.fileService.onDidFilesChange(async e => {
			if (Date.now() < this.suppressModelUntil) return;
			if (!e.contains(uri)) return;
			try {
				const f = await this.fileService.readFile(uri);
				sceneBridge.loadFromText(f.value.toString(), 'disk');
			} catch { /* ignore */ }
		});
		this.fileWatcher = { dispose: () => { w.dispose(); l.dispose(); } };
	}

	private async saveToDisk(uri: URI, content: string): Promise<void> {
		this.suppressModelUntil = Date.now() + 300;

		const model = this.findVecnModel();
		if (model && model.uri.toString() === uri.toString()) {
			if (model.getValue() !== content) {
				model.setValue(content);
			}
		}

		try {
			await this.fileService.writeFile(uri, VSBuffer.fromString(content));
		} catch { /* ignore */ }
	}

	override dispose(): void {
		if (VoidSceneEditorContribution.activeInstance === this) {
			VoidSceneEditorContribution.activeInstance = null;
		}
		this.disposeModelListener();
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
			this.fileWatcher = null;
		}
		this.clearValidationMarkers();
		const editorContainer = document.querySelector('.part.editor .editor-container') as HTMLElement | null;
		editorContainer?.classList.remove('void-scene-editor-host');
		editorContainer?.classList.remove('void-script-dock-visible');
		editorContainer?.classList.remove('void-mode-script');
		if (this.networkReplicationHandle !== undefined) {
			globalThis.clearTimeout(this.networkReplicationHandle);
			this.networkReplicationHandle = undefined;
		}
		this.unhideMonacoEditors();
		if (this.toolbar) this.toolbar.remove();
		if (this.scenePickerToolbar) this.scenePickerToolbar.remove();
		if (this.scriptDockContainer) this.scriptDockContainer.remove();
		if (this.viewportContainer) this.viewportContainer.remove();
		this.scenePickerToolbar = null;
		this.scenePickerContainer = null;
		this.scriptDockContainer = null;
		this.scriptPickerContainer = null;
		this.scriptMethodsContainer = null;
		this.scriptFilterInput = null;
		this.networkOverlay = null;
		super.dispose();
	}
}

class VoidSceneCommandPaletteAction extends Action2 {
	constructor() {
		super({
			id: 'voidSceneEditor.commandPalette',
			title: localize2('voidSceneEditorCommandPalette', 'Void Engine: Command Palette'),
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		const instance = VoidSceneEditorContribution.getActiveInstance();
		if (instance) {
			await instance.openEngineCommandPalette();
		}
	}
}

class VoidSceneUndoAction extends Action2 {
	constructor() {
		super({
			id: 'voidSceneEditor.undo',
			title: localize2('voidSceneEditorUndo', 'Void Engine: Undo Scene Change'),
			f1: true,
		});
	}

	override run(_accessor: ServicesAccessor): void {
		sceneBridge.undo();
	}
}

class VoidSceneRedoAction extends Action2 {
	constructor() {
		super({
			id: 'voidSceneEditor.redo',
			title: localize2('voidSceneEditorRedo', 'Void Engine: Redo Scene Change'),
			f1: true,
		});
	}

	override run(_accessor: ServicesAccessor): void {
		sceneBridge.redo();
	}
}

class VoidSceneCreateScriptAction extends Action2 {
	constructor() {
		super({
			id: 'voidSceneEditor.createScriptForSelection',
			title: localize2('voidSceneEditorCreateScript', 'Void Engine: Create Script For Selected Node'),
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		const instance = VoidSceneEditorContribution.getActiveInstance();
		if (instance) {
			await instance.createScriptFromSceneHierarchy();
		}
	}
}

class VoidSceneAttachScriptAction extends Action2 {
	constructor() {
		super({
			id: 'voidSceneEditor.attachScriptToSelection',
			title: localize2('voidSceneEditorAttachScript', 'Void Engine: Attach Selected Script To Node'),
			f1: true,
		});
	}

	override async run(_accessor: ServicesAccessor): Promise<void> {
		const instance = VoidSceneEditorContribution.getActiveInstance();
		if (instance) {
			await instance.attachScriptFromSceneHierarchy();
		}
	}
}

registerAction2(VoidSceneCommandPaletteAction);
registerAction2(VoidSceneUndoAction);
registerAction2(VoidSceneRedoAction);
registerAction2(VoidSceneCreateScriptAction);
registerAction2(VoidSceneAttachScriptAction);

registerWorkbenchContribution2(
	VoidSceneEditorContribution.ID,
	VoidSceneEditorContribution,
	WorkbenchPhase.BlockRestore
);

import './sceneActions.js';

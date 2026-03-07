/*---------------------------------------------------------------------------------------------
 *  Void Engine - Project Picker (Godot-like structure, Void minimal style)
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import * as dom from '../../../../base/browser/dom.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { URI } from '../../../../base/common/uri.js';
import { dirname, joinPath, relativePath } from '../../../../base/common/resources.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IWorkspacesService, isRecentFolder, isRecentWorkspace } from '../../../../platform/workspaces/common/workspaces.js';
import { IHostService } from '../../../services/host/browser/host.js';
import {
	createVoidAssetLibraryScaffold,
	getVoidAssetLibraryTemplate,
	IVoidAssetLibraryTemplate,
	VOID_ASSET_LIBRARY_TEMPLATES
} from '../common/voidWelcomeAssetLibrary.js';

interface ProjectPickerEntry {
	id: string;
	name: string;
	path: string;
	kind: 'folder' | 'workspace';
	uri: URI;
	remoteAuthority?: string;
	workspaceId?: string;
	exists: boolean;
	order: number;
	version: string;
}

type WelcomeTab = 'projects' | 'library';
const WELCOME_LAST_LOCATION_STORAGE_KEY = 'void.welcome.lastLocationPath';

const DEFAULT_PROJECT_SCENE = `// Void Engine Scene Format (.vecn)
// Version 1.0

VoidScene(
    version: "1.0",
    mode: Scene3D,

    entities: [
        (
            id: "world_env",
            name: "WorldEnvironment",
            visible: true,
            components: [
                Transform(
                    translation: (0.0, 0.0, 0.0),
                    rotation: (0.0, 0.0, 0.0, 1.0),
                    scale: (1.0, 1.0, 1.0),
                ),
                WorldEnvironment((
                    environment: "",
                    camera_attributes: "",
                )),
            ],
            children: [],
        ),
        (
            id: "camera_main",
            name: "Camera",
            visible: true,
            components: [
                Transform(
                    translation: (0.0, 5.5, 9.0),
                    rotation: (-0.30, 0.0, 0.0, 0.954),
                    scale: (1.0, 1.0, 1.0),
                ),
                Camera(
                    fov: 60.0,
                    near: 0.1,
                    far: 500.0,
                ),
            ],
            children: [],
        ),
        (
            id: "dir_light",
            name: "DirectionalLight",
            visible: true,
            components: [
                Transform(
                    translation: (8.0, 14.0, 6.0),
                    rotation: (-0.45, 0.15, 0.08, 0.87),
                    scale: (1.0, 1.0, 1.0),
                ),
                DirectionalLight(
                    color: (1.0, 0.95, 0.88),
                    illuminance: 35000.0,
                ),
            ],
            children: [],
        ),
        (
            id: "ground_plane",
            name: "Ground",
            visible: true,
            components: [
                Transform(
                    translation: (0.0, -0.5, 0.0),
                    rotation: (0.0, 0.0, 0.0, 1.0),
                    scale: (1.0, 1.0, 1.0),
                ),
                Mesh(shape: Plane(size: 40.0)),
                Material(color: (0.20, 0.22, 0.24, 1.0), metallic: 0.0, roughness: 0.95),
            ],
            children: [],
        ),
        (
            id: "cube",
            name: "Cube",
            visible: true,
            components: [
                Transform(
                    translation: (0.0, 1.0, 0.0),
                    rotation: (0.0, 0.0, 0.0, 1.0),
                    scale: (1.0, 1.0, 1.0),
                ),
                Mesh(shape: Cube(size: 1.2)),
                Material(color: (0.88, 0.42, 0.32, 1.0), metallic: 0.08, roughness: 0.62),
            ],
            children: [],
        ),
    ],
)`;

const DEFAULT_PROJECT_MAIN_RS = `use bevy::prelude::*;
use void_scene_loader::VoidSceneLoaderPlugin;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Void Project".to_string(),
                resolution: (1600.0, 900.0).into(),
                ..default()
            }),
            ..default()
        }))
        .add_plugins(VoidSceneLoaderPlugin)
        .run();
}`;

export class VoidWelcomeScreen extends Disposable {
	private root: HTMLElement | undefined;
	private projectList: HTMLElement | undefined;
	private listHeader: HTMLElement | undefined;
	private sidePanel: HTMLElement | undefined;
	private statusText: HTMLElement | undefined;
	private emptyState: HTMLElement | undefined;
	private searchInput: HTMLInputElement | undefined;
	private sortSelect: HTMLSelectElement | undefined;
	private sortWrap: HTMLElement | undefined;
	private createButton: HTMLButtonElement | undefined;
	private importButton: HTMLButtonElement | undefined;
	private projectsTab: HTMLButtonElement | undefined;
	private libraryTab: HTMLButtonElement | undefined;
	private openButton: HTMLButtonElement | undefined;
	private runButton: HTMLButtonElement | undefined;
	private renameButton: HTMLButtonElement | undefined;
	private removeButton: HTMLButtonElement | undefined;
	private removeMissingButton: HTMLButtonElement | undefined;
	private refreshButton: HTMLButtonElement | undefined;
	private libraryCreateButton: HTMLButtonElement | undefined;
	private libraryCreateOpenButton: HTMLButtonElement | undefined;
	private libraryDetails: HTMLElement | undefined;
	private modalOverlay: HTMLElement | undefined;
	private selectedProjectId: string | undefined;
	private selectedTemplateId: string | undefined;
	private entries: ProjectPickerEntry[] = [];
	private activeTab: WelcomeTab = 'projects';

	constructor(
		@IFileService private readonly fileService: IFileService,
		@ICommandService private readonly commandService: ICommandService,
		@IDialogService private readonly dialogService: IDialogService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IWorkspacesService private readonly workspacesService: IWorkspacesService,
		@IHostService private readonly hostService: IHostService
	) {
		super();
	}

	async render(container: HTMLElement): Promise<void> {
		container.replaceChildren();
		document.body.classList.remove('void-welcome-closed');

		this.root = dom.append(container, dom.$('.ve-picker-root'));

		const header = dom.append(this.root, dom.$('.ve-picker-header'));
		const brand = dom.append(header, dom.$('.ve-picker-brand'));
		brand.textContent = 'VOID ENGINE';

		const headerActions = dom.append(header, dom.$('.ve-picker-header-actions'));
		const settingsButton = dom.append(headerActions, dom.$('button.ve-picker-header-btn.codicon.codicon-settings-gear')) as HTMLButtonElement;
		settingsButton.type = 'button';
		settingsButton.title = 'Settings';
		settingsButton.setAttribute('aria-label', 'Settings');
		settingsButton.addEventListener('click', () => {
			this.closeWelcome();
			void this.commandService.executeCommand('workbench.action.openSettings');
		});

		const tabs = dom.append(this.root, dom.$('.ve-picker-tabs'));
		this.projectsTab = dom.append(tabs, dom.$('button.ve-picker-tab.active')) as HTMLButtonElement;
		this.projectsTab.type = 'button';
		this.projectsTab.textContent = 'Projects';
		this.projectsTab.addEventListener('click', () => this.setActiveTab('projects'));
		this.libraryTab = dom.append(tabs, dom.$('button.ve-picker-tab')) as HTMLButtonElement;
		this.libraryTab.type = 'button';
		this.libraryTab.textContent = 'Asset Library';
		this.libraryTab.addEventListener('click', () => this.setActiveTab('library'));

		const toolbar = dom.append(this.root, dom.$('.ve-picker-toolbar'));
		const toolbarLeft = dom.append(toolbar, dom.$('.ve-picker-toolbar-left'));
		this.createButton = this.createActionButton(toolbarLeft, 'Create', 'codicon-add');
		this.importButton = this.createActionButton(toolbarLeft, 'Import', 'codicon-folder-opened');
		this.refreshButton = this.createActionButton(toolbarLeft, 'Scan', 'codicon-refresh');

		this.createButton.addEventListener('click', () => void this.handlePrimaryCreateAction());
		this.importButton.addEventListener('click', () => void this.importProject());
		this.refreshButton.addEventListener('click', () => void this.reloadEntries(true));

		const searchWrap = dom.append(toolbar, dom.$('.ve-picker-search-wrap'));
		const searchIcon = dom.append(searchWrap, dom.$('span.ve-picker-search-icon.codicon.codicon-search'));
		void searchIcon;
		this.searchInput = dom.append(searchWrap, dom.$('input.ve-picker-search')) as HTMLInputElement;
		this.searchInput.type = 'text';
		this.searchInput.placeholder = 'Filter projects';
		this.searchInput.addEventListener('input', () => this.refreshActiveView());

		this.sortWrap = dom.append(toolbar, dom.$('.ve-picker-sort-wrap'));
		const sortLabel = dom.append(this.sortWrap, dom.$('label.ve-picker-sort-label'));
		sortLabel.textContent = 'Sort:';
		this.sortSelect = dom.append(this.sortWrap, dom.$('select.ve-picker-sort-select')) as HTMLSelectElement;
		this.sortSelect.replaceChildren();
		this.appendSortOption(this.sortSelect, 'recent', 'Last opened');
		this.appendSortOption(this.sortSelect, 'name', 'Name');
		this.appendSortOption(this.sortSelect, 'path', 'Path');
		this.sortSelect.addEventListener('change', () => this.refreshActiveView());

		const content = dom.append(this.root, dom.$('.ve-picker-content'));
		const listPanel = dom.append(content, dom.$('.ve-picker-list-panel'));
		this.listHeader = dom.append(listPanel, dom.$('.ve-picker-list-header'));
		this.renderListHeader();

		this.projectList = dom.append(listPanel, dom.$('.ve-picker-list'));
		this.emptyState = dom.append(listPanel, dom.$('.ve-picker-empty'));
		this.emptyState.textContent = 'No projects found. Create or import a project.';

		this.sidePanel = dom.append(content, dom.$('.ve-picker-side-panel'));
		this.openButton = this.createSideButton(this.sidePanel, 'Edit', 'codicon-edit');
		this.runButton = this.createSideButton(this.sidePanel, 'Run', 'codicon-play');
		this.renameButton = this.createSideButton(this.sidePanel, 'Rename', 'codicon-tag');
		this.removeButton = this.createSideButton(this.sidePanel, 'Delete', 'codicon-trash');
		this.removeMissingButton = this.createSideButton(this.sidePanel, 'Remove Missing', 'codicon-clear-all');
		this.libraryCreateButton = this.createSideButton(this.sidePanel, 'Create Project', 'codicon-add');
		this.libraryCreateOpenButton = this.createSideButton(this.sidePanel, 'Create & Open', 'codicon-play-circle');
		this.libraryDetails = dom.append(this.sidePanel, dom.$('.ve-library-details'));

		this.openButton.addEventListener('click', () => void this.openSelectedProject(false));
		this.runButton.addEventListener('click', () => void this.openSelectedProject(true));
		this.renameButton.addEventListener('click', () => void this.renameSelectedProject());
		this.removeButton.addEventListener('click', () => void this.removeSelectedProject());
		this.removeMissingButton.addEventListener('click', () => void this.removeMissingProjects());
		this.libraryCreateButton.addEventListener('click', () => void this.createProjectFromSelectedTemplate(false));
		this.libraryCreateOpenButton.addEventListener('click', () => void this.createProjectFromSelectedTemplate(true));

		const footer = dom.append(this.root, dom.$('.ve-picker-footer'));
		this.statusText = dom.append(footer, dom.$('.ve-picker-status'));
		this.statusText.textContent = 'Ready';
		const version = dom.append(footer, dom.$('.ve-picker-version'));
		version.textContent = 'v0.1 Void UI';

		await this.reloadEntries(false);
		this.selectedTemplateId = VOID_ASSET_LIBRARY_TEMPLATES[0]?.id;
		this.refreshActiveView();
		this._register(this.workspacesService.onDidChangeRecentlyOpened(() => void this.reloadEntries(false)));
	}

	private createActionButton(parent: HTMLElement, label: string, codicon: string): HTMLButtonElement {
		const button = dom.append(parent, dom.$('button.ve-picker-toolbar-btn')) as HTMLButtonElement;
		button.type = 'button';
		const icon = dom.append(button, dom.$(`span.ve-center-host.ve-center-codicon.codicon.${codicon}`));
		void icon;
		const text = dom.append(button, dom.$('span.ve-picker-toolbar-btn-text'));
		text.textContent = label;
		return button;
	}

	private createSideButton(parent: HTMLElement, label: string, codicon: string): HTMLButtonElement {
		const button = dom.append(parent, dom.$('button.ve-picker-side-btn')) as HTMLButtonElement;
		button.type = 'button';
		const icon = dom.append(button, dom.$(`span.ve-center-host.ve-center-codicon.codicon.${codicon}`));
		void icon;
		const text = dom.append(button, dom.$('span.ve-picker-side-btn-text'));
		text.textContent = label;
		return button;
	}

	private setActiveTab(tab: WelcomeTab): void {
		if (this.activeTab === tab) {
			return;
		}
		this.activeTab = tab;
		this.refreshActiveView();
		this.setStatus(tab === 'library'
			? 'Asset Library is now local and creates real project scaffolds.'
			: 'Ready');
	}

	private refreshActiveView(): void {
		this.renderListHeader();
		this.syncTabButtons();
		this.syncToolbarForTab();
		if (this.activeTab === 'library') {
			this.renderLibraryList();
		} else {
			this.renderProjectList();
		}
		this.updateActionButtons();
	}

	private syncTabButtons(): void {
		this.projectsTab?.classList.toggle('active', this.activeTab === 'projects');
		this.libraryTab?.classList.toggle('active', this.activeTab === 'library');
	}

	private syncToolbarForTab(): void {
		if (this.createButton) {
			const text = this.createButton.querySelector('.ve-picker-toolbar-btn-text');
			if (text) {
				text.textContent = this.activeTab === 'library' ? 'Use Template' : 'Create';
			}
		}
		if (this.importButton) {
			this.importButton.style.display = this.activeTab === 'projects' ? '' : 'none';
		}
		if (this.refreshButton) {
			this.refreshButton.style.display = this.activeTab === 'projects' ? '' : 'none';
		}
		if (this.sortWrap) {
			this.sortWrap.style.display = this.activeTab === 'projects' ? '' : 'none';
		}
		if (this.searchInput) {
			this.searchInput.placeholder = this.activeTab === 'projects' ? 'Filter projects' : 'Filter templates';
		}
	}

	private renderListHeader(): void {
		if (!this.listHeader) {
			return;
		}
		this.listHeader.replaceChildren();
		if (this.activeTab === 'library') {
			appendText(this.listHeader, 'Template');
			appendText(this.listHeader, 'Description');
			appendText(this.listHeader, 'Version');
			appendText(this.listHeader, 'Category');
			return;
		}
		appendText(this.listHeader, 'Project');
		appendText(this.listHeader, 'Path');
		appendText(this.listHeader, 'Version');
		appendText(this.listHeader, 'Type');
	}

	private handlePrimaryCreateAction(): Promise<void> {
		if (this.activeTab === 'library') {
			return this.createProjectFromSelectedTemplate(false);
		}
		return this.createProject();
	}

	private appendSortOption(select: HTMLSelectElement, value: string, label: string): void {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = label;
		select.appendChild(option);
	}

	private async reloadEntries(showStatus: boolean): Promise<void> {
		const recent = await this.workspacesService.getRecentlyOpened();
		const entries: ProjectPickerEntry[] = [];
		let order = 0;

		for (const item of recent.workspaces) {
			if (isRecentFolder(item)) {
				entries.push(await this.toEntryFromFolder(item.folderUri, item.label, item.remoteAuthority, order++));
				continue;
			}
			if (isRecentWorkspace(item)) {
				entries.push(await this.toEntryFromWorkspace(item.workspace.configPath, item.workspace.id, item.label, item.remoteAuthority, order++));
			}
		}

		this.entries = entries;
		if (!this.selectedProjectId || !this.entries.some(entry => entry.id === this.selectedProjectId)) {
			this.selectedProjectId = this.entries[0]?.id;
		}
		this.refreshActiveView();
		if (showStatus) {
			this.setStatus(`Scanned ${this.entries.length} project(s)`);
		}
	}

	private async toEntryFromFolder(uri: URI, label: string | undefined, remoteAuthority: string | undefined, order: number): Promise<ProjectPickerEntry> {
		const path = uri.fsPath || uri.path;
		const exists = await this.safeExists(uri);
		const leaf = this.basename(path);
		return {
			id: `folder:${uri.toString()}`,
			name: (label && label.trim()) || leaf || 'Unnamed Folder',
			path,
			kind: 'folder',
			uri,
			remoteAuthority,
			exists,
			order,
			version: '4.5'
		};
	}

	private async toEntryFromWorkspace(uri: URI, workspaceId: string, label: string | undefined, remoteAuthority: string | undefined, order: number): Promise<ProjectPickerEntry> {
		const path = uri.fsPath || uri.path;
		const exists = await this.safeExists(uri);
		const leaf = this.basename(path).replace(/\.code-workspace$/i, '');
		return {
			id: `workspace:${uri.toString()}`,
			name: (label && label.trim()) || leaf || 'Unnamed Workspace',
			path,
			kind: 'workspace',
			uri,
			remoteAuthority,
			workspaceId,
			exists,
			order,
			version: '4.5'
		};
	}

	private async safeExists(uri: URI): Promise<boolean> {
		try {
			return await this.fileService.exists(uri);
		} catch {
			return false;
		}
	}

	private basename(path: string): string {
		const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
		const parts = normalized.split('/').filter(Boolean);
		return parts[parts.length - 1] ?? '';
	}

	private getVisibleEntries(): ProjectPickerEntry[] {
		const query = this.searchInput?.value.trim().toLowerCase() ?? '';
		const sortMode = this.sortSelect?.value ?? 'recent';
		let result = this.entries.slice();
		if (query) {
			result = result.filter(entry =>
				entry.name.toLowerCase().includes(query)
				|| entry.path.toLowerCase().includes(query)
			);
		}
		switch (sortMode) {
			case 'name':
				result.sort((a, b) => a.name.localeCompare(b.name));
				break;
			case 'path':
				result.sort((a, b) => a.path.localeCompare(b.path));
				break;
			default:
				result.sort((a, b) => a.order - b.order);
				break;
		}
		return result;
	}

	private getVisibleTemplates(): readonly IVoidAssetLibraryTemplate[] {
		const query = this.searchInput?.value.trim().toLowerCase() ?? '';
		if (!query) {
			return VOID_ASSET_LIBRARY_TEMPLATES;
		}
		return VOID_ASSET_LIBRARY_TEMPLATES.filter(template =>
			template.label.toLowerCase().includes(query)
			|| template.description.toLowerCase().includes(query)
			|| template.category.toLowerCase().includes(query)
			|| template.features.some(feature => feature.toLowerCase().includes(query))
		);
	}

	private getSelectedTemplate(): IVoidAssetLibraryTemplate | undefined {
		return getVoidAssetLibraryTemplate(this.selectedTemplateId ?? '');
	}

	private renderProjectList(): void {
		if (!this.projectList || !this.emptyState) {
			return;
		}
		const visible = this.getVisibleEntries();
		this.projectList.replaceChildren();

		for (const entry of visible) {
			const row = dom.append(this.projectList, dom.$('button.ve-picker-row')) as HTMLButtonElement;
			row.type = 'button';
			row.classList.toggle('selected', entry.id === this.selectedProjectId);
			if (!entry.exists) {
				row.classList.add('missing');
			}
			row.addEventListener('click', () => {
				this.selectedProjectId = entry.id;
				this.renderProjectList();
			});
			row.addEventListener('dblclick', () => void this.openSelectedProject(false));

			const projectCell = dom.append(row, dom.$('.ve-picker-cell.ve-picker-project-cell'));
			const icon = dom.append(projectCell, dom.$('span.ve-picker-project-icon.codicon.codicon-symbol-class'));
			void icon;
			const titleWrap = dom.append(projectCell, dom.$('.ve-picker-project-meta'));
			appendText(titleWrap, entry.name, 've-picker-project-name');
			if (!entry.exists) {
				appendText(titleWrap, 'Missing', 've-picker-project-missing');
			}

			appendText(row, entry.path, 've-picker-cell ve-picker-path-cell');
			appendText(row, entry.version, 've-picker-cell ve-picker-version-cell');
			appendText(row, entry.kind === 'workspace' ? 'Workspace' : 'Folder', 've-picker-cell ve-picker-kind-cell');
		}

		this.emptyState.style.display = visible.length > 0 ? 'none' : 'block';
		this.emptyState.textContent = 'No projects found. Create or import a project.';
		this.renderLibraryDetails(undefined);
	}

	private renderLibraryList(): void {
		if (!this.projectList || !this.emptyState) {
			return;
		}

		const templates = this.getVisibleTemplates();
		this.projectList.replaceChildren();

		if (!this.selectedTemplateId || !templates.some(template => template.id === this.selectedTemplateId)) {
			this.selectedTemplateId = templates[0]?.id;
		}

		for (const template of templates) {
			const row = dom.append(this.projectList, dom.$('button.ve-picker-row.ve-library-row')) as HTMLButtonElement;
			row.type = 'button';
			row.classList.toggle('selected', template.id === this.selectedTemplateId);
			row.addEventListener('click', () => {
				this.selectedTemplateId = template.id;
				this.renderLibraryList();
				this.updateActionButtons();
			});
			row.addEventListener('dblclick', () => void this.createProjectFromSelectedTemplate(false));

			const templateCell = dom.append(row, dom.$('.ve-picker-cell.ve-picker-project-cell'));
			const icon = dom.append(templateCell, dom.$('span.ve-picker-project-icon.codicon.codicon-package'));
			void icon;
			const titleWrap = dom.append(templateCell, dom.$('.ve-picker-project-meta'));
			appendText(titleWrap, template.label, 've-picker-project-name');
			appendText(titleWrap, template.mainTitle, 've-library-subtitle');

			appendText(row, template.description, 've-picker-cell ve-picker-path-cell');
			appendText(row, template.version, 've-picker-cell ve-picker-version-cell');
			appendText(row, template.category, 've-picker-cell ve-picker-kind-cell');
		}

		this.emptyState.style.display = templates.length > 0 ? 'none' : 'block';
		this.emptyState.textContent = 'No asset templates match the current filter.';
		this.renderLibraryDetails(this.getSelectedTemplate());
	}

	private updateActionButtons(): void {
		const projectMode = this.activeTab === 'projects';
		const hasProjectSelection = Boolean(this.getSelectedEntry());
		const hasTemplateSelection = Boolean(this.getSelectedTemplate());

		if (this.openButton) {
			this.openButton.disabled = !hasProjectSelection;
			this.openButton.style.display = projectMode ? '' : 'none';
		}
		if (this.runButton) {
			this.runButton.disabled = !hasProjectSelection;
			this.runButton.style.display = projectMode ? '' : 'none';
		}
		if (this.renameButton) {
			this.renameButton.disabled = !hasProjectSelection;
			this.renameButton.style.display = projectMode ? '' : 'none';
		}
		if (this.removeButton) {
			this.removeButton.disabled = !hasProjectSelection;
			this.removeButton.style.display = projectMode ? '' : 'none';
		}
		if (this.removeMissingButton) {
			const hasMissing = this.entries.some(entry => !entry.exists);
			this.removeMissingButton.disabled = !hasMissing;
			this.removeMissingButton.style.display = projectMode ? '' : 'none';
		}
		if (this.libraryCreateButton) {
			this.libraryCreateButton.disabled = !hasTemplateSelection;
			this.libraryCreateButton.style.display = projectMode ? 'none' : '';
		}
		if (this.libraryCreateOpenButton) {
			this.libraryCreateOpenButton.disabled = !hasTemplateSelection;
			this.libraryCreateOpenButton.style.display = projectMode ? 'none' : '';
		}
		if (this.libraryDetails) {
			this.libraryDetails.style.display = projectMode ? 'none' : 'block';
		}
	}

	private getSelectedEntry(): ProjectPickerEntry | undefined {
		if (!this.selectedProjectId) {
			return undefined;
		}
		return this.entries.find(entry => entry.id === this.selectedProjectId);
	}

	private renderLibraryDetails(template: IVoidAssetLibraryTemplate | undefined): void {
		if (!this.libraryDetails) {
			return;
		}
		this.libraryDetails.replaceChildren();
		if (!template) {
			appendText(this.libraryDetails, 'Select a template to preview its scaffold.', 've-library-empty');
			return;
		}

		appendText(this.libraryDetails, template.label, 've-library-title');
		appendText(this.libraryDetails, template.description, 've-library-description');
		appendText(this.libraryDetails, `Version ${template.version} - ${template.category}`, 've-library-meta');

		const features = dom.append(this.libraryDetails, dom.$('.ve-library-features'));
		for (const feature of template.features) {
			appendText(features, feature, 've-library-feature');
		}

		appendText(this.libraryDetails, template.readme, 've-library-readme');
	}

	private async createProject(): Promise<void> {
		try {
			const projectName = await this.requestProjectName('Create project', 'MyVoidProject', 'Create');
			if (!projectName) {
				return;
			}
			const parentUri = await this.requestLocationPath(
				'Project location',
				'Enter the parent folder where the new project should be created.',
				'Create'
			);
			if (!parentUri) {
				return;
			}
			if (await this.safeExists(parentUri) && !(await this.isDirectory(parentUri))) {
				this.setStatus('Project location must be a folder path.');
				return;
			}

			const projectUri = joinPath(parentUri, projectName);
			if (await this.safeExists(projectUri)) {
				this.setStatus(`Project already exists: ${projectName}`);
				return;
			}
			await this.createProjectScaffold(projectUri, projectName, DEFAULT_PROJECT_SCENE);
			await this.finishCreatedProject(projectUri, projectName, false);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.setStatus(`Create failed: ${message}`);
		}
	}

	private async createProjectFromSelectedTemplate(openAfterCreate: boolean): Promise<void> {
		try {
			const template = this.getSelectedTemplate();
			if (!template) {
				this.setStatus('Select an asset template first.');
				return;
			}
			const projectName = await this.requestProjectName('Create project from asset template', template.defaultProjectName, openAfterCreate ? 'Create & Open' : 'Create');
			if (!projectName) {
				return;
			}
			const parentUri = await this.requestLocationPath(
				'Project location',
				`Enter the parent folder where "${template.label}" should be created.`,
				openAfterCreate ? 'Create & Open' : 'Create'
			);
			if (!parentUri) {
				return;
			}
			if (await this.safeExists(parentUri) && !(await this.isDirectory(parentUri))) {
				this.setStatus('Project location must be a folder path.');
				return;
			}

			const projectUri = joinPath(parentUri, projectName);
			if (await this.safeExists(projectUri)) {
				this.setStatus(`Project already exists: ${projectName}`);
				return;
			}

			const scaffold = createVoidAssetLibraryScaffold(template);
			await this.createProjectScaffold(projectUri, projectName, scaffold.sceneContent, {
				...scaffold.extraFiles,
				'README.md': `# ${projectName}\n\n${template.readme}\n`,
			}, template.id);
			await this.finishCreatedProject(projectUri, projectName, openAfterCreate);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.setStatus(`Template create failed: ${message}`);
		}
	}

	private async createProjectScaffold(
		projectUri: URI,
		projectName: string,
		sceneContent: string,
		extraFiles: Readonly<Record<string, string>> = {},
		templateId?: string
	): Promise<void> {
		const assetsUri = joinPath(projectUri, 'assets');
		const scenesUri = joinPath(assetsUri, 'scenes');
		const srcUri = joinPath(projectUri, 'src');
		const loaderPath = this.getSceneLoaderDependencyPath(projectUri);
		const crateName = this.toCargoPackageName(projectName);

		await this.fileService.createFolder(projectUri);
		await this.fileService.createFolder(assetsUri);
		await this.fileService.createFolder(scenesUri);
		await this.fileService.createFolder(srcUri);

		await this.writeTextFile(joinPath(projectUri, '.void-meta.json'), JSON.stringify({
			name: projectName,
			version: '1.0.0',
			engine: 'void',
			entryScene: 'assets/scenes/main.vecn',
			templateId,
			createdAt: new Date().toISOString()
		}, null, 2));
		await this.writeTextFile(joinPath(projectUri, '.gitignore'), '/target\nCargo.lock\n');
		await this.writeTextFile(joinPath(projectUri, 'Cargo.toml'), this.createCargoToml(crateName, loaderPath));
		await this.writeTextFile(joinPath(srcUri, 'main.rs'), DEFAULT_PROJECT_MAIN_RS);
		await this.writeTextFile(joinPath(scenesUri, 'main.vecn'), sceneContent);

		for (const [relativeFilePath, contents] of Object.entries(extraFiles)) {
			const normalizedPath = relativeFilePath.replace(/\\/g, '/');
			const segments = normalizedPath.split('/').filter(Boolean);
			let parent = projectUri;
			for (let index = 0; index < segments.length - 1; index++) {
				parent = joinPath(parent, segments[index]);
				await this.fileService.createFolder(parent);
			}
			let fileUri = projectUri;
			for (const segment of segments) {
				fileUri = joinPath(fileUri, segment);
			}
			await this.writeTextFile(fileUri, contents);
		}
	}

	private async finishCreatedProject(projectUri: URI, projectName: string, openAfterCreate: boolean): Promise<void> {
		await this.workspacesService.addRecentlyOpened([{ folderUri: projectUri }]);
		this.selectedProjectId = `folder:${projectUri.toString()}`;
		await this.reloadEntries(false);
		this.setStatus(`Created project: ${projectName}`);
		if (openAfterCreate) {
			await this.hostService.openWindow([{ folderUri: projectUri }], { forceReuseWindow: true, remoteAuthority: null });
			this.closeWelcome();
		}
	}

	private async importProject(): Promise<void> {
		try {
			const resource = await this.requestImportPath();
			if (!resource) {
				return;
			}

			if (this.isWorkspaceFile(resource)) {
				const workspace = await this.workspacesService.getWorkspaceIdentifier(resource);
				await this.workspacesService.addRecentlyOpened([{ workspace }]);
				this.selectedProjectId = `workspace:${resource.toString()}`;
			} else if (await this.isDirectory(resource)) {
				await this.workspacesService.addRecentlyOpened([{ folderUri: resource }]);
				this.selectedProjectId = `folder:${resource.toString()}`;
			} else {
				this.setStatus('Import supports folders or .code-workspace files only.');
				return;
			}

			await this.reloadEntries(false);
			this.setStatus(`Imported: ${this.basename(resource.fsPath || resource.path)}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.setStatus(`Import failed: ${message}`);
		}
	}

	private async openSelectedProject(runAfterOpen: boolean): Promise<void> {
		try {
			const entry = this.getSelectedEntry();
			if (!entry) {
				this.setStatus('Select a project first.');
				return;
			}
			if (!entry.exists) {
				this.setStatus('Selected project path is missing.');
				return;
			}

			localStorage.removeItem('void.welcome.autorun');

			await this.hostService.openWindow([
				entry.kind === 'folder'
					? { folderUri: entry.uri }
					: { workspaceUri: entry.uri }
			], {
				forceReuseWindow: true,
				remoteAuthority: entry.remoteAuthority || null
			});

			if (runAfterOpen) {
				this.setStatus(`Opened project: ${entry.name}. Launch runtime from the project toolbar.`);
			}
			this.closeWelcome();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.setStatus(`Open failed: ${message}`);
		}
	}

	private async removeSelectedProject(): Promise<void> {
		try {
			const entry = this.getSelectedEntry();
			if (!entry) {
				return;
			}

			if (!entry.exists) {
				await this.workspacesService.removeRecentlyOpened([entry.uri]);
				this.setStatus(`Removed missing entry: ${entry.name}`);
				await this.reloadEntries(false);
				return;
			}

			const confirmed = await this.confirmWelcomeAction(
				`Delete "${entry.name}"?`,
				entry.kind === 'folder'
					? `The project folder will be moved to the recycle bin.\n\n${entry.path}`
					: `The workspace file will be moved to the recycle bin.\n\n${entry.path}`,
				'Delete'
			);
			if (!confirmed) {
				return;
			}

			await this.fileService.del(entry.uri, {
				recursive: entry.kind === 'folder',
				useTrash: true
			});
			await this.workspacesService.removeRecentlyOpened([entry.uri]);
			this.selectedProjectId = undefined;
			this.setStatus(`Deleted: ${entry.name}`);
			await this.reloadEntries(false);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.setStatus(`Delete failed: ${message}`);
		}
	}

	private async renameSelectedProject(): Promise<void> {
		const entry = this.getSelectedEntry();
		if (!entry) {
			this.setStatus('Select a project first.');
			return;
		}

		const trimmed = await this.requestProjectName('Rename project', entry.name, 'Rename');
		if (!trimmed) {
			return;
		}
		if (!trimmed || trimmed === entry.name) {
			return;
		}

		try {
			if (entry.kind === 'folder') {
				const targetUri = joinPath(dirname(entry.uri), trimmed);
				if (await this.safeExists(targetUri)) {
					this.setStatus(`Target already exists: ${trimmed}`);
					return;
				}
				await this.fileService.move(entry.uri, targetUri);
				await this.workspacesService.removeRecentlyOpened([entry.uri]);
				await this.workspacesService.addRecentlyOpened([{
					folderUri: targetUri,
					label: trimmed,
					remoteAuthority: entry.remoteAuthority
				}]);
				this.selectedProjectId = `folder:${targetUri.toString()}`;
			} else {
				const workspaceFileName = trimmed.toLowerCase().endsWith('.code-workspace') ? trimmed : `${trimmed}.code-workspace`;
				const targetUri = joinPath(dirname(entry.uri), workspaceFileName);
				if (await this.safeExists(targetUri)) {
					this.setStatus(`Target already exists: ${workspaceFileName}`);
					return;
				}
				await this.fileService.move(entry.uri, targetUri);
				await this.workspacesService.removeRecentlyOpened([entry.uri]);
				const workspace = entry.workspaceId
					? { id: entry.workspaceId, configPath: targetUri }
					: await this.workspacesService.getWorkspaceIdentifier(targetUri);

				await this.workspacesService.addRecentlyOpened([{
					workspace,
					label: workspaceFileName.replace(/\.code-workspace$/i, ''),
					remoteAuthority: entry.remoteAuthority
				}]);
				this.selectedProjectId = `workspace:${targetUri.toString()}`;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.setStatus(`Rename failed: ${message}`);
			return;
		}

		this.setStatus(`Renamed: ${trimmed}`);
		await this.reloadEntries(false);
	}

	private async requestProjectName(title: string, initialValue: string, primaryButton: string): Promise<string | undefined> {
		const value = await this.showWelcomePrompt({
			title,
			detail: 'Use letters, numbers, spaces, dashes or underscores.',
			initialValue,
			placeholder: 'Project name',
			primaryButton
		});
		if (typeof value !== 'string') {
			return undefined;
		}
		const trimmed = value.trim();
		const validationError = this.validateProjectName(trimmed);
		if (validationError) {
			this.setStatus(validationError);
			return undefined;
		}
		return trimmed;
	}

	private validateProjectName(value: string): string | undefined {
		const trimmed = value.trim();
		if (!trimmed) {
			return 'Project name cannot be empty';
		}
		if (/^\.+$/.test(trimmed)) {
			return 'Project name is invalid';
		}
		if (/[<>:"/\\|?*\x00-\x1f]/.test(trimmed)) {
			return 'Project name contains invalid characters';
		}
		return undefined;
	}

	private async requestLocationPath(title: string, detail: string, primaryButton: string): Promise<URI | undefined> {
		const initialValue = await this.getDefaultLocationValue();
		const value = await this.showWelcomePrompt({
			title,
			detail,
			initialValue,
			placeholder: 'C:\\Projects\\VoidProject',
			primaryButton
		});
		if (typeof value !== 'string') {
			return undefined;
		}
		const normalized = this.normalizeUserPath(value);
		if (!normalized) {
			this.setStatus('Path cannot be empty.');
			return undefined;
		}
		const resource = URI.file(normalized);
		this.rememberLocation(resource);
		return resource;
	}

	private async requestImportPath(): Promise<URI | undefined> {
		const initialValue = await this.getDefaultLocationValue();
		const value = await this.showWelcomePrompt({
			title: 'Import project',
			detail: 'Enter a folder path or a .code-workspace file path.',
			initialValue,
			placeholder: 'C:\\Projects\\MyProject',
			primaryButton: 'Import'
		});
		if (typeof value !== 'string') {
			return undefined;
		}
		const normalized = this.normalizeUserPath(value);
		if (!normalized) {
			this.setStatus('Path cannot be empty.');
			return undefined;
		}
		const resource = URI.file(normalized);
		if (!(await this.safeExists(resource))) {
			this.setStatus(`Path not found: ${normalized}`);
			return undefined;
		}
		this.rememberLocation(resource);
		return resource;
	}

	private async getDefaultLocationValue(): Promise<string> {
		const stored = localStorage.getItem(WELCOME_LAST_LOCATION_STORAGE_KEY);
		if (stored?.trim()) {
			return stored;
		}

		const selected = this.getSelectedEntry();
		if (selected) {
			const parent = dirname(selected.uri);
			return parent.fsPath || parent.path;
		}

		const firstEntry = this.entries[0];
		if (firstEntry) {
			const parent = dirname(firstEntry.uri);
			return parent.fsPath || parent.path;
		}

		try {
			const defaultUri = await this.fileDialogService.defaultFolderPath();
			return defaultUri.fsPath || defaultUri.path;
		} catch {
			return '';
		}
	}

	private normalizeUserPath(value: string): string {
		let normalized = value.trim();
		if (normalized.startsWith('"') && normalized.endsWith('"') && normalized.length > 1) {
			normalized = normalized.slice(1, -1);
		}
		return normalized.trim();
	}

	private rememberLocation(resource: URI): void {
		const path = resource.fsPath || resource.path;
		if (path) {
			localStorage.setItem(WELCOME_LAST_LOCATION_STORAGE_KEY, path);
		}
	}

	private isWorkspaceFile(resource: URI): boolean {
		return resource.path.toLowerCase().endsWith('.code-workspace');
	}

	private async isDirectory(resource: URI): Promise<boolean> {
		try {
			const stat = await this.fileService.resolve(resource);
			return stat.isDirectory;
		} catch {
			return false;
		}
	}

	private toCargoPackageName(projectName: string): string {
		const normalized = projectName
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
		return normalized || 'void_project';
	}

	private createCargoToml(crateName: string, loaderPath: string): string {
		return `[package]
name = "${crateName}"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "${crateName}"
path = "src/main.rs"

[dependencies]
bevy = "0.15"
void_scene_loader = { package = "void-scene-loader", path = "${loaderPath}" }

[profile.dev]
opt-level = 1

[profile.dev.package."*"]
opt-level = 3
`;
	}

	private getSceneLoaderDependencyPath(projectUri: URI): string {
		const loaderUri = this.resolveSceneLoaderUri();
		const relativeLoaderPath = relativePath(projectUri, loaderUri);
		const path = (relativeLoaderPath || loaderUri.fsPath || loaderUri.path).replace(/\\/g, '/');
		return path;
	}

	private resolveSceneLoaderUri(): URI {
		const currentModule = this.normalizeModuleFsPath(URI.parse(import.meta.url).path).replace(/\\/g, '/');
		const vscodeRoot = currentModule.replace(/\/(?:out|src)\/vs\/workbench\/contrib\/voidWelcome\/browser\/voidWelcome\.(?:js|ts)$/i, '');
		return URI.file(`${vscodeRoot.replace(/\//g, '\\')}\\engine\\void-scene-loader`);
	}

	private normalizeModuleFsPath(path: string): string {
		return path.replace(/^\/([a-zA-Z]:)/, '$1');
	}

	private async writeTextFile(resource: URI, contents: string): Promise<void> {
		await this.fileService.writeFile(resource, VSBuffer.fromString(contents));
	}

	private async removeMissingProjects(): Promise<void> {
		try {
			const missingUris = this.entries.filter(entry => !entry.exists).map(entry => entry.uri);
			if (!missingUris.length) {
				this.setStatus('No missing projects to remove.');
				return;
			}
			await this.workspacesService.removeRecentlyOpened(missingUris);
			this.setStatus(`Removed ${missingUris.length} missing project(s)`);
			await this.reloadEntries(false);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.setStatus(`Remove missing failed: ${message}`);
		}
	}

	private setStatus(text: string): void {
		if (this.statusText) {
			this.statusText.textContent = text;
		}
	}

	private async showWelcomePrompt(options: {
		readonly title: string;
		readonly detail?: string;
		readonly initialValue: string;
		readonly placeholder: string;
		readonly primaryButton: string;
	}): Promise<string | undefined> {
		if (!this.root) {
			const result = await this.dialogService.input({
				type: 'info',
				message: options.title,
				detail: options.detail,
				primaryButton: options.primaryButton,
				cancelButton: 'Cancel',
				custom: true,
				inputs: [{
					placeholder: options.placeholder,
					value: options.initialValue
				}]
			});
			return result.confirmed ? result.values?.[0] : undefined;
		}

		return new Promise<string | undefined>(resolve => {
			this.disposeModal();

			const overlay = dom.append(this.root!, dom.$('.ve-picker-modal-overlay'));
			const dialog = dom.append(overlay, dom.$('.ve-picker-modal'));
			const title = dom.append(dialog, dom.$('.ve-picker-modal-title'));
			title.textContent = options.title;
			if (options.detail) {
				const detail = dom.append(dialog, dom.$('.ve-picker-modal-detail'));
				detail.textContent = options.detail;
			}
			const input = dom.append(dialog, dom.$('input.ve-picker-modal-input')) as HTMLInputElement;
			input.type = 'text';
			input.placeholder = options.placeholder;
			input.value = options.initialValue;

			const actions = dom.append(dialog, dom.$('.ve-picker-modal-actions'));
			const cancelButton = dom.append(actions, dom.$('button.ve-picker-modal-button.ve-picker-modal-button-secondary')) as HTMLButtonElement;
			cancelButton.type = 'button';
			cancelButton.textContent = 'Cancel';
			const primaryButton = dom.append(actions, dom.$('button.ve-picker-modal-button.ve-picker-modal-button-primary')) as HTMLButtonElement;
			primaryButton.type = 'button';
			primaryButton.textContent = options.primaryButton;

			this.modalOverlay = overlay;

			const finish = (value: string | undefined) => {
				this.disposeModal();
				resolve(value);
			};

			cancelButton.addEventListener('click', () => finish(undefined));
			primaryButton.addEventListener('click', () => finish(input.value));
			overlay.addEventListener('click', event => {
				if (event.target === overlay) {
					finish(undefined);
				}
			});
			dialog.addEventListener('click', event => event.stopPropagation());
			input.addEventListener('keydown', event => {
				if (event.key === 'Enter') {
					event.preventDefault();
					finish(input.value);
				} else if (event.key === 'Escape') {
					event.preventDefault();
					finish(undefined);
				}
			});

			queueMicrotask(() => {
				input.focus();
				input.select();
			});
		});
	}

	private async confirmWelcomeAction(title: string, detail: string, primaryButtonLabel: string): Promise<boolean> {
		if (!this.root) {
			const result = await this.dialogService.confirm({
				type: 'warning',
				message: title,
				detail,
				primaryButton: primaryButtonLabel,
				cancelButton: 'Cancel'
			});
			return result.confirmed;
		}

		return new Promise<boolean>(resolve => {
			this.disposeModal();

			const overlay = dom.append(this.root!, dom.$('.ve-picker-modal-overlay'));
			const dialog = dom.append(overlay, dom.$('.ve-picker-modal.ve-picker-modal-warning'));
			const titleNode = dom.append(dialog, dom.$('.ve-picker-modal-title'));
			titleNode.textContent = title;
			const detailNode = dom.append(dialog, dom.$('.ve-picker-modal-detail'));
			detailNode.textContent = detail;

			const actions = dom.append(dialog, dom.$('.ve-picker-modal-actions'));
			const cancelButton = dom.append(actions, dom.$('button.ve-picker-modal-button.ve-picker-modal-button-secondary')) as HTMLButtonElement;
			cancelButton.type = 'button';
			cancelButton.textContent = 'Cancel';
			const primaryButton = dom.append(actions, dom.$('button.ve-picker-modal-button.ve-picker-modal-button-danger')) as HTMLButtonElement;
			primaryButton.type = 'button';
			primaryButton.textContent = primaryButtonLabel;

			this.modalOverlay = overlay;

			const finish = (confirmed: boolean) => {
				this.disposeModal();
				resolve(confirmed);
			};

			cancelButton.addEventListener('click', () => finish(false));
			primaryButton.addEventListener('click', () => finish(true));
			overlay.addEventListener('click', event => {
				if (event.target === overlay) {
					finish(false);
				}
			});
			dialog.addEventListener('click', event => event.stopPropagation());
			dialog.addEventListener('keydown', event => {
				if (event.key === 'Escape') {
					event.preventDefault();
					finish(false);
				} else if (event.key === 'Enter') {
					event.preventDefault();
					finish(true);
				}
			});

			queueMicrotask(() => primaryButton.focus());
		});
	}

	private disposeModal(): void {
		this.modalOverlay?.remove();
		this.modalOverlay = undefined;
	}

	private closeWelcome(): void {
		this.disposeModal();
		document.body.classList.add('void-welcome-closed');
		this.root?.remove();
	}

	override dispose(): void {
		this.root?.remove();
		this.root = undefined;
		super.dispose();
	}
}

function appendText(parent: HTMLElement, text: string, className?: string): HTMLElement {
	const element = dom.append(parent, dom.$(className ? `span.${className.replace(/\s+/g, '.')}` : 'span'));
	element.textContent = text;
	return element;
}

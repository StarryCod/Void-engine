/*---------------------------------------------------------------------------------------------
 *  Void Engine - Project Picker (Godot-like structure, Void minimal style)
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import * as dom from '../../../../base/browser/dom.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IWorkspacesService, isRecentFolder, isRecentWorkspace } from '../../../../platform/workspaces/common/workspaces.js';
import { IHostService } from '../../../services/host/browser/host.js';

interface ProjectPickerEntry {
	id: string;
	name: string;
	path: string;
	kind: 'folder' | 'workspace';
	uri: URI;
	remoteAuthority?: string;
	exists: boolean;
	order: number;
	version: string;
}

export class VoidWelcomeScreen extends Disposable {
	private root: HTMLElement | undefined;
	private projectList: HTMLElement | undefined;
	private statusText: HTMLElement | undefined;
	private emptyState: HTMLElement | undefined;
	private searchInput: HTMLInputElement | undefined;
	private sortSelect: HTMLSelectElement | undefined;
	private openButton: HTMLButtonElement | undefined;
	private runButton: HTMLButtonElement | undefined;
	private removeButton: HTMLButtonElement | undefined;
	private removeMissingButton: HTMLButtonElement | undefined;
	private refreshButton: HTMLButtonElement | undefined;
	private selectedProjectId: string | undefined;
	private entries: ProjectPickerEntry[] = [];

	constructor(
		@IFileService private readonly fileService: IFileService,
		@ICommandService private readonly commandService: ICommandService,
		@IOpenerService private readonly openerService: IOpenerService,
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
		settingsButton.addEventListener('click', () => void this.commandService.executeCommand('workbench.action.openSettings'));

		const tabs = dom.append(this.root, dom.$('.ve-picker-tabs'));
		const projectsTab = dom.append(tabs, dom.$('button.ve-picker-tab.active')) as HTMLButtonElement;
		projectsTab.type = 'button';
		projectsTab.textContent = 'Projects';
		const libraryTab = dom.append(tabs, dom.$('button.ve-picker-tab')) as HTMLButtonElement;
		libraryTab.type = 'button';
		libraryTab.textContent = 'Asset Library';
		libraryTab.addEventListener('click', () => {
			void this.openerService.open(URI.parse('https://godotengine.org/asset-library/asset'));
			this.setStatus('Asset Library opened in browser');
		});

		const toolbar = dom.append(this.root, dom.$('.ve-picker-toolbar'));
		const toolbarLeft = dom.append(toolbar, dom.$('.ve-picker-toolbar-left'));
		const createButton = this.createActionButton(toolbarLeft, 'Create', 'codicon-add');
		const importButton = this.createActionButton(toolbarLeft, 'Import', 'codicon-folder-opened');
		this.refreshButton = this.createActionButton(toolbarLeft, 'Scan', 'codicon-refresh');

		createButton.addEventListener('click', () => void this.createProject());
		importButton.addEventListener('click', () => void this.importProject());
		this.refreshButton.addEventListener('click', () => void this.reloadEntries(true));

		const searchWrap = dom.append(toolbar, dom.$('.ve-picker-search-wrap'));
		const searchIcon = dom.append(searchWrap, dom.$('span.ve-picker-search-icon.codicon.codicon-search'));
		void searchIcon;
		this.searchInput = dom.append(searchWrap, dom.$('input.ve-picker-search')) as HTMLInputElement;
		this.searchInput.type = 'text';
		this.searchInput.placeholder = 'Filter projects';
		this.searchInput.addEventListener('input', () => this.renderProjectList());

		const sortWrap = dom.append(toolbar, dom.$('.ve-picker-sort-wrap'));
		const sortLabel = dom.append(sortWrap, dom.$('label.ve-picker-sort-label'));
		sortLabel.textContent = 'Sort:';
		this.sortSelect = dom.append(sortWrap, dom.$('select.ve-picker-sort-select')) as HTMLSelectElement;
		this.sortSelect.replaceChildren();
		this.appendSortOption(this.sortSelect, 'recent', 'Last opened');
		this.appendSortOption(this.sortSelect, 'name', 'Name');
		this.appendSortOption(this.sortSelect, 'path', 'Path');
		this.sortSelect.addEventListener('change', () => this.renderProjectList());

		const content = dom.append(this.root, dom.$('.ve-picker-content'));
		const listPanel = dom.append(content, dom.$('.ve-picker-list-panel'));
		const listHeader = dom.append(listPanel, dom.$('.ve-picker-list-header'));
		appendText(listHeader, 'Project');
		appendText(listHeader, 'Path');
		appendText(listHeader, 'Version');
		appendText(listHeader, 'Type');

		this.projectList = dom.append(listPanel, dom.$('.ve-picker-list'));
		this.emptyState = dom.append(listPanel, dom.$('.ve-picker-empty'));
		this.emptyState.textContent = 'No projects found. Create or import a project.';

		const sidePanel = dom.append(content, dom.$('.ve-picker-side-panel'));
		this.openButton = this.createSideButton(sidePanel, 'Edit', 'codicon-edit');
		this.runButton = this.createSideButton(sidePanel, 'Run', 'codicon-play');
		this.removeButton = this.createSideButton(sidePanel, 'Remove', 'codicon-trash');
		this.removeMissingButton = this.createSideButton(sidePanel, 'Remove Missing', 'codicon-clear-all');

		this.openButton.addEventListener('click', () => void this.openSelectedProject(false));
		this.runButton.addEventListener('click', () => void this.openSelectedProject(true));
		this.removeButton.addEventListener('click', () => void this.removeSelectedProject());
		this.removeMissingButton.addEventListener('click', () => void this.removeMissingProjects());

		const footer = dom.append(this.root, dom.$('.ve-picker-footer'));
		this.statusText = dom.append(footer, dom.$('.ve-picker-status'));
		this.statusText.textContent = 'Ready';
		const version = dom.append(footer, dom.$('.ve-picker-version'));
		version.textContent = 'v0.1 Void UI';

		await this.reloadEntries(false);
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
				entries.push(await this.toEntryFromWorkspace(item.workspace.configPath, item.label, item.remoteAuthority, order++));
			}
		}

		this.entries = entries;
		if (!this.selectedProjectId || !this.entries.some(entry => entry.id === this.selectedProjectId)) {
			this.selectedProjectId = this.entries[0]?.id;
		}
		this.renderProjectList();
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

	private async toEntryFromWorkspace(uri: URI, label: string | undefined, remoteAuthority: string | undefined, order: number): Promise<ProjectPickerEntry> {
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
		this.updateActionButtons();
	}

	private updateActionButtons(): void {
		const hasSelection = Boolean(this.getSelectedEntry());
		if (this.openButton) {
			this.openButton.disabled = !hasSelection;
		}
		if (this.runButton) {
			this.runButton.disabled = !hasSelection;
		}
		if (this.removeButton) {
			this.removeButton.disabled = !hasSelection;
		}
		if (this.removeMissingButton) {
			const hasMissing = this.entries.some(entry => !entry.exists);
			this.removeMissingButton.disabled = !hasMissing;
		}
	}

	private getSelectedEntry(): ProjectPickerEntry | undefined {
		if (!this.selectedProjectId) {
			return undefined;
		}
		return this.entries.find(entry => entry.id === this.selectedProjectId);
	}

	private async createProject(): Promise<void> {
		await this.commandService.executeCommand('workbench.action.files.openFolder');
		this.closeWelcome();
	}

	private async importProject(): Promise<void> {
		await this.commandService.executeCommand('workbench.action.files.openFolder');
		this.closeWelcome();
	}

	private async openSelectedProject(runAfterOpen: boolean): Promise<void> {
		const entry = this.getSelectedEntry();
		if (!entry) {
			this.setStatus('Select a project first.');
			return;
		}
		if (!entry.exists) {
			this.setStatus('Selected project path is missing.');
			return;
		}

		if (runAfterOpen) {
			localStorage.setItem('void.welcome.autorun', String(Date.now()));
		}

		await this.hostService.openWindow([
			entry.kind === 'folder'
				? { folderUri: entry.uri }
				: { workspaceUri: entry.uri }
		], {
			forceReuseWindow: true,
			remoteAuthority: entry.remoteAuthority || null
		});

		this.closeWelcome();
	}

	private async removeSelectedProject(): Promise<void> {
		const entry = this.getSelectedEntry();
		if (!entry) {
			return;
		}
		await this.workspacesService.removeRecentlyOpened([entry.uri]);
		this.setStatus(`Removed: ${entry.name}`);
		await this.reloadEntries(false);
	}

	private async removeMissingProjects(): Promise<void> {
		const missingUris = this.entries.filter(entry => !entry.exists).map(entry => entry.uri);
		if (!missingUris.length) {
			this.setStatus('No missing projects to remove.');
			return;
		}
		await this.workspacesService.removeRecentlyOpened(missingUris);
		this.setStatus(`Removed ${missingUris.length} missing project(s)`);
		await this.reloadEntries(false);
	}

	private setStatus(text: string): void {
		if (this.statusText) {
			this.statusText.textContent = text;
		}
	}

	private closeWelcome(): void {
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

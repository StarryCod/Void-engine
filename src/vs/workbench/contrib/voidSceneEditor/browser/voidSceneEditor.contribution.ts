/*---------------------------------------------------------------------------------------------
 *  Void Scene Editor - Contribution
 *  Simple 3D viewport integration
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import * as DOM from '../../../../base/browser/dom.js';
import { ThreeViewport } from './threeViewport.js';
import { sceneBridge } from '../common/voidSceneBridge.js';

class VoidSceneEditorContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.voidSceneEditor';

	private viewport: ThreeViewport | null = null;
	private layoutContainer: HTMLElement | null = null;

	private modelListener: IDisposable | null = null;
	private fileWatcher: IDisposable | null = null;
	private suppressModelUntil: number = 0;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEditorService private readonly editorService: IEditorService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
	) {
		super();

		// Bridge -> Disk (save handler)
		this._register(sceneBridge.onNeedsSave(e => this.saveToDisk(e.uri, e.content)));

		// Editor changes
		this._register(this.editorService.onDidActiveEditorChange(() => this.onEditorChanged()));

		// Early discovery
		this.earlyDiscovery();
	}

	// ════════════════════════════════════════════════════════════════
	// EARLY DISCOVERY — find .vecn, load into bridge, setup watcher
	// ════════════════════════════════════════════════════════════════

	private async earlyDiscovery(): Promise<void> {
		const delays = [100, 300, 600, 1000, 2000, 3000];
		
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
				const success = sceneBridge.loadFromText(content, 'init');
				if (success) {
					this.setupFileWatcher(uri);
					return;
				}
			} catch {
				// ignore
			}
		}
	}

	// ════════════════════════════════════════════════════════════════
	// FIND .vecn FILE
	// ════════════════════════════════════════════════════════════════

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
			for (const c of stat.children)
				if (!c.isDirectory && c.name.endsWith('.vecn')) return c.resource;
			for (const c of stat.children)
				if (c.isDirectory && !skip.has(c.name)) {
					const f = await this.searchFolder(c.resource, depth + 1);
					if (f) return f;
				}
		} catch { /* ignore */ }
		return null;
	}

	// ════════════════════════════════════════════════════════════════
	// EDITOR MODEL LISTENER
	// ════════════════════════════════════════════════════════════════

	private onEditorChanged(): void {
		this.attachModelListener();
	}

	private attachModelListener(): void {
		const model = this.findVecnModel();
		if (!model) return;

		if (this.modelListener && (this.modelListener as any).__uri === model.uri.toString()) return;

		this.disposeModelListener();

		if (!sceneBridge.hasScene()) {
			sceneBridge.setUri(model.uri);
			sceneBridge.loadFromText(model.getValue(), 'init');
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
		if (this.modelListener) { this.modelListener.dispose(); this.modelListener = null; }
	}

	// ════════════════════════════════════════════════════════════════
	// FILE WATCHER
	// ════════════════════════════════════════════════════════════════

	private setupFileWatcher(uri: URI): void {
		if (this.fileWatcher) { this.fileWatcher.dispose(); this.fileWatcher = null; }

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

	// ════════════════════════════════════════════════════════════════
	// SAVE TO DISK
	// ════════════════════════════════════════════════════════════════

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
		} catch {
			// ignore
		}
	}

	// ════════════════════════════════════════════════════════════════

	override dispose(): void {
		this.disposeModelListener();
		if (this.fileWatcher) { this.fileWatcher.dispose(); this.fileWatcher = null; }
		super.dispose();
	}
}

registerWorkbenchContribution2(
	VoidSceneEditorContribution.ID,
	VoidSceneEditorContribution,
	WorkbenchPhase.BlockRestore
);

// Register scene context menu actions
import './sceneActions.js';

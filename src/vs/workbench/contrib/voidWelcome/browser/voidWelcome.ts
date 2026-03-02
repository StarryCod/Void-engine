/*---------------------------------------------------------------------------------------------
 *  Void Engine — Welcome Screen "Project Manager"
 *  Complete rewrite — proper event handling, inline editing, stamps
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import * as dom from '../../../../base/browser/dom.js';
import { isWindows } from '../../../../base/common/platform.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

// ═══ Types ═══

interface VoidProject {
	id: string;
	name: string;
	slug: string;
	path: string;
	lastOpened: number;
	createdAt: number;
	version: string;
	fileCount: number;
	sizeLabel: string;
	iconType: PIcon;
	pinned: boolean;
	real: boolean;
	description: string;
	author: string;
}

type PIcon = 'game' | 'web' | 'lib' | 'tool' | '3d' | '2d';
type ScreenState = 'intro' | 'desktop' | 'search';
type StampColor = 'green' | 'red' | 'blue' | 'gold';

interface OrbitRef {
	project: VoidProject;
	el: HTMLElement;
	matched: boolean;
	tx: number; ty: number;
	cx: number; cy: number;
	cs: number; ts: number;
}

// ═══ SVG Icon Paths ═══

const I: Record<string, string[]> = {
	search: ['M21 21l-4.35-4.35', 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z'],
	plus: ['M12 5v14', 'M5 12h14'],
	copy: ['M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
	trash: ['M3 6h18', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'],
	edit: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'],
	folder: ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'],
	xport: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
	info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01'],
	pin: ['M12 2v8', 'M5 10h14', 'M7 10l1 8h8l1-8', 'M12 18v4'],
	x: ['M18 6L6 18', 'M6 6l12 12'],
	game: ['M6 11h4', 'M8 9v4', 'M15.5 10.5h.01', 'M18.5 12.5h.01', 'M6 5a2 2 0 0 0-2 2v6a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V7a2 2 0 0 0-2-2H6z'],
	web: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M2 12h20'],
	lib: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
	tool: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
	_3d: ['M12 2L2 7l10 5 10-5-10-5', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
	_2d: ['M4 4h16v16H4z', 'M4 12h16', 'M12 4v16'],
	chevR: ['M9 18l6-6-6-6'],
	check: ['M20 6L9 17l-5-5'],
	user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
	save: ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', 'M17 21v-8H7v8', 'M7 3v5h8'],
	play: ['M5 3l14 9-14 9V3z'],
};

// ═══ File Templates ═══

function bevyCargo(n: string): string {
	return `[package]\nname = "${n}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nbevy = "0.15"\nvoid-scene-loader = { path = "../../vscode/engine/void-scene-loader" }\n`;
}

const BEVY_MAIN_3D = `use bevy::prelude::*;\nuse void_scene_loader::VoidSceneLoaderPlugin;\n\nfn main() {\n    App::new()\n        .add_plugins(DefaultPlugins.set(WindowPlugin {\n            primary_window: Some(Window {\n                title: "Void Engine".to_string(),\n                resolution: (1280.0, 720.0).into(),\n                ..default()\n            }),\n            ..default()\n        }))\n        .add_plugins(VoidSceneLoaderPlugin)\n        .run();\n}\n`;
const BEVY_MAIN_2D = BEVY_MAIN_3D;
const BEVY_MAIN_BLANK = `use bevy::prelude::*;\n\nfn main() {\n    App::new()\n        .add_plugins(DefaultPlugins)\n        .add_systems(Startup, setup)\n        .run();\n}\n\nfn setup(mut commands: Commands) {\n    commands.spawn(Camera2dBundle::default());\n}\n`;
const GITIGNORE = `/target\nCargo.lock\n.vscode\n*.vecn~\n`;
function voidConfig(mainScene: string | null): string {
	return JSON.stringify({
		mainScene,
		version: '0.1.0',
	}, null, 2);
}
const SCENE_3D = `// Void Engine Scene Format (.vecn)
VoidScene(
    version: "1.0",
    mode: Scene3D,

    entities: [
        (
            id: "camera_main",
            name: "Camera",
            visible: true,
            components: [
                Transform(
                    translation: (0, 5, 10),
                    rotation: (0, 0, 0, 1),
                    scale: (1, 1, 1),
                ),
                Camera(
                    fov: 60,
                    near: 0.1,
                    far: 1000,
                ),
            ],
            children: [],
        ),
        (
            id: "light_sun",
            name: "Directional Light",
            visible: true,
            components: [
                Transform(
                    translation: (0, 10, 5),
                    rotation: (0, 0, 0, 1),
                    scale: (1, 1, 1),
                ),
                DirectionalLight(
                    color: (1, 1, 1),
                    illuminance: 10000,
                ),
            ],
            children: [],
        ),
        (
            id: "cube_main",
            name: "Cube",
            visible: true,
            components: [
                Transform(
                    translation: (0, 1, 0),
                    rotation: (0, 0, 0, 1),
                    scale: (1, 1, 1),
                ),
                Mesh( shape: Cube(size: 1) ),
                Material(
                    color: (0.6, 0.6, 0.7, 1.0),
                    metallic: 0,
                    roughness: 0.8,
                ),
            ],
            children: [],
        ),
    ],

    resources: [
        AmbientLight(
            color: (1, 1, 1),
            brightness: 0.35,
        ),
        ClearColor(
            color: (0.06, 0.07, 0.10, 1.0),
        ),
    ],
)
`;
const SCENE_2D = `// Void Engine Scene Format (.vecn)
VoidScene(
    version: "1.0",
    mode: Scene2D,

    entities: [
        (
            id: "camera_2d",
            name: "Camera2D",
            visible: true,
            components: [
                Transform2D(
                    position: (0, 0),
                    rotation: 0,
                    scale: (1, 1),
                ),
            ],
            children: [],
        ),
        (
            id: "sprite_main",
            name: "Sprite2D",
            visible: true,
            components: [
                Transform2D(
                    position: (0, 0),
                    rotation: 0,
                    scale: (1, 1),
                ),
                Sprite2D(
                    texture: "",
                    region_enabled: false,
                    region_rect: (0, 0, 64, 64),
                    offset: (0, 0),
                ),
            ],
            children: [],
        ),
    ],

    resources: [
        ClearColor(
            color: (0.08, 0.08, 0.10, 1.0),
        ),
    ],
)
`;

// ═══════════════════════════════════════════════════════════════
// MAIN CLASS
// ═══════════════════════════════════════════════════════════════

export class VoidWelcomeScreen extends Disposable {

	// DOM refs
	private shell!: HTMLElement;
	private topZone!: HTMLElement;
	private searchInput!: HTMLInputElement;
	private actionRow!: HTMLElement;
	private gridWrap!: HTMLElement;
	private orbitStage!: HTMLElement;
	private centerInfo!: HTMLElement;
	private centerName!: HTMLElement;
	private centerMeta!: HTMLElement;
	private noResults!: HTMLElement;

	// State
	private state: ScreenState = 'intro';
	private projects: VoidProject[] = [];
	private selectedId: string | null = null;
	private editingId: string | null = null;
	private orbits: OrbitRef[] = [];
	private cardStore = new DisposableStore();
	private editStore = new DisposableStore();
	private modalStore = new DisposableStore();
	private rafId = 0;
	private gAngle = 0;
	private matchedId: string | null = null;
	private radius = 210;
	private sW = 0;
	private sH = 0;
	private overlayEl: HTMLElement | null = null;

	private readonly sep: string;
	private readonly projectsPath: string;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@ICommandService private readonly commandService: ICommandService
	) {
		super();
		this.sep = isWindows ? '\\' : '/';
		this.projectsPath = isWindows
			? 'C:\\Users\\Starred\\Documents\\VoidEngine\\Projects'
			: '/home/user/Documents/VoidEngine/Projects';
	}

	// ═══ Utilities ═══

	private uid(): string { return Math.random().toString(36).slice(2, 10); }
	private toSlug(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
	private prettify(s: string): string { return s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); }

	private svg(paths: string[], sz = 18): SVGSVGElement {
		const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		s.setAttribute('viewBox', '0 0 24 24');
		s.setAttribute('width', String(sz));
		s.setAttribute('height', String(sz));
		s.setAttribute('fill', 'none');
		s.setAttribute('stroke', 'currentColor');
		s.setAttribute('stroke-width', '1.5');
		s.setAttribute('stroke-linecap', 'round');
		s.setAttribute('stroke-linejoin', 'round');
		for (const d of paths) {
			const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			p.setAttribute('d', d);
			s.appendChild(p);
		}
		return s;
	}

	private icoFor(t: PIcon): string[] {
		if (t === '3d') return I._3d;
		if (t === '2d') return I._2d;
		return I[t] || I.folder;
	}

	private relTime(ms: number): string {
		const d = Date.now() - ms;
		const m = Math.floor(d / 60000);
		if (m < 1) return 'Just now';
		if (m < 60) return m + 'm ago';
		const h = Math.floor(m / 60);
		if (h < 24) return h + 'h ago';
		const dd = Math.floor(h / 24);
		if (dd < 7) return dd + 'd ago';
		return Math.floor(dd / 7) + 'w ago';
	}

	private fmtDate(ms: number): string {
		const d = new Date(ms);
		const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return `${mo[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
	}

	// ═══ Disk Operations ═══

	private async ensureRoot(): Promise<void> {
		try { await this.fileService.createFolder(URI.file(this.projectsPath)); } catch { /* ok */ }
	}

	private async w(path: string, content: string): Promise<void> {
		await this.fileService.writeFile(URI.file(path), VSBuffer.fromString(content));
	}

	private async read(path: string): Promise<string> {
		const r = await this.fileService.readFile(URI.file(path));
		return r.value.toString();
	}

	private async exists(path: string): Promise<boolean> {
		try { await this.fileService.stat(URI.file(path)); return true; } catch { return false; }
	}

	private async countFiles(dir: string): Promise<number> {
		try {
			const d = await this.fileService.resolve(URI.file(dir));
			if (!d.children) return 0;
			let c = 0;
			for (const ch of d.children) {
				if (ch.isDirectory) c += await this.countFiles(dir + this.sep + ch.name);
				else c++;
			}
			return c;
		} catch { return 0; }
	}

	private async calcSizeBytes(dir: string): Promise<number> {
		try {
			const d = await this.fileService.resolve(URI.file(dir));
			if (!d.children) return 0;
			let total = 0;
			for (const ch of d.children) {
				if (ch.isDirectory) total += await this.calcSizeBytes(dir + this.sep + ch.name);
				else if (ch.size) total += ch.size;
			}
			return total;
		} catch { return 0; }
	}

	private async calcSize(dir: string): Promise<string> {
		const total = await this.calcSizeBytes(dir);
		if (total < 1024) return total + ' B';
		if (total < 1048576) return Math.round(total / 1024) + ' KB';
		return (total / 1048576).toFixed(1) + ' MB';
	}

	// ═══ Scan Projects from Disk ═══

	private async scanDisk(): Promise<void> {
		this.projects = [];
		try {
			const dir = await this.fileService.resolve(URI.file(this.projectsPath));
			if (!dir.children) return;

			for (const ch of dir.children) {
				if (!ch.isDirectory) continue;
				const nm = ch.name;
				const cargoPath = this.projectsPath + this.sep + nm + this.sep + 'Cargo.toml';
				if (!(await this.exists(cargoPath))) continue;

				try {
					const cargoStr = await this.read(cargoPath);
					const verMatch = cargoStr.match(/version\s*=\s*"([^"]+)"/);
					const nameMatch = cargoStr.match(/name\s*=\s*"([^"]+)"/);
					const projPath = this.projectsPath + this.sep + nm;
					const fileCount = await this.countFiles(projPath);
					const sizeLabel = await this.calcSize(projPath);

					let iconType: PIcon = 'game';
					let description = '';
					let author = '';

					const metaPath = projPath + this.sep + '.void-meta.json';
					if (await this.exists(metaPath)) {
						try {
							const meta = JSON.parse(await this.read(metaPath));
							description = meta.description || '';
							author = meta.author || '';
							if (meta.iconType) iconType = meta.iconType;
						} catch { /* ignore */ }
					} else {
						const mainPath = projPath + this.sep + 'src' + this.sep + 'main.rs';
						if (await this.exists(mainPath)) {
							const mainStr = await this.read(mainPath);
							if (mainStr.includes('Camera2d')) iconType = '2d';
							else if (mainStr.includes('VoidSceneLoaderPlugin')) iconType = '3d';
						}
					}

					this.projects.push({
						id: this.uid(),
						name: this.prettify(nameMatch ? nameMatch[1] : nm),
						slug: this.toSlug(nm),
						path: projPath,
						lastOpened: ch.mtime || Date.now(),
						createdAt: ch.ctime || Date.now(),
						version: verMatch ? verMatch[1] : '0.1.0',
						fileCount, sizeLabel, iconType,
						pinned: false, real: true,
						description, author,
					});
				} catch (e) { console.error('[Void] Project read error:', nm, e); }
			}
		} catch (e) { console.error('[Void] Scan error:', e); }
	}

	// ═══ Create Project on Disk ═══

	private async createOnDisk(name: string, template: '3d' | '2d' | 'blank'): Promise<VoidProject> {
		const sl = this.toSlug(name);
		const root = this.projectsPath + this.sep + sl;
		const src = root + this.sep + 'src';
		const assets = root + this.sep + 'assets';
		const scenes = assets + this.sep + 'scenes';

		await this.fileService.createFolder(URI.file(root));
		await this.fileService.createFolder(URI.file(src));
		await this.fileService.createFolder(URI.file(assets));
		await this.fileService.createFolder(URI.file(scenes));

		await this.w(root + this.sep + 'Cargo.toml', bevyCargo(sl));
		await this.w(root + this.sep + '.gitignore', GITIGNORE);
		await this.w(root + this.sep + 'void.config.json', voidConfig(template !== 'blank' ? 'assets/scenes/main.vecn' : null));

		const mainContent = template === '3d' ? BEVY_MAIN_3D : template === '2d' ? BEVY_MAIN_2D : BEVY_MAIN_BLANK;
		await this.w(src + this.sep + 'main.rs', mainContent);

		if (template !== 'blank') {
			await this.w(scenes + this.sep + 'main.vecn', template === '3d' ? SCENE_3D : SCENE_2D);
		}

		const iconType: PIcon = template === '2d' ? '2d' : template === '3d' ? '3d' : 'game';
		await this.w(root + this.sep + '.void-meta.json', JSON.stringify({
			name, slug: sl, description: '', author: '',
			template, iconType, createdAt: Date.now(),
		}, null, 2));

		const fileCount = await this.countFiles(root);
		const sizeLabel = await this.calcSize(root);

		return {
			id: this.uid(), name, slug: sl, path: root,
			lastOpened: Date.now(), createdAt: Date.now(),
			version: '0.1.0', fileCount, sizeLabel, iconType,
			pinned: false, real: true, description: '', author: '',
		};
	}

	// ═══ Duplicate ═══

	private async dupOnDisk(srcProj: VoidProject, newSlug: string): Promise<void> {
		const dst = this.projectsPath + this.sep + newSlug;
		await this.fileService.createFolder(URI.file(dst));
		await this.fileService.createFolder(URI.file(dst + this.sep + 'src'));

		for (const f of ['Cargo.toml', '.gitignore', '.void-meta.json', 'void.config.json']) {
			try { await this.w(dst + this.sep + f, await this.read(srcProj.path + this.sep + f)); } catch { /* */ }
		}
		try {
			await this.w(dst + this.sep + 'src' + this.sep + 'main.rs',
				await this.read(srcProj.path + this.sep + 'src' + this.sep + 'main.rs'));
		} catch {
			await this.w(dst + this.sep + 'src' + this.sep + 'main.rs', BEVY_MAIN_BLANK);
		}
		try { await this.copyDir(srcProj.path + this.sep + 'assets', dst + this.sep + 'assets'); } catch { /* */ }
		try {
			let cargo = await this.read(dst + this.sep + 'Cargo.toml');
			cargo = cargo.replace(/name\s*=\s*"[^"]*"/, `name = "${newSlug}"`);
			await this.w(dst + this.sep + 'Cargo.toml', cargo);
		} catch { /* */ }
	}

	private async copyDir(src: string, dst: string): Promise<void> {
		try {
			await this.fileService.createFolder(URI.file(dst));
			const d = await this.fileService.resolve(URI.file(src));
			if (!d.children) return;
			for (const ch of d.children) {
				if (ch.isDirectory) await this.copyDir(src + this.sep + ch.name, dst + this.sep + ch.name);
				else await this.w(dst + this.sep + ch.name, await this.read(src + this.sep + ch.name));
			}
		} catch { /* */ }
	}

	// ═══ Update ═══

	private async updateCargoName(proj: VoidProject): Promise<void> {
		if (!proj.real) return;
		try {
			const p = proj.path + this.sep + 'Cargo.toml';
			let text = await this.read(p);
			text = text.replace(/name\s*=\s*"[^"]*"/, `name = "${proj.slug}"`);
			await this.w(p, text);
		} catch { /* ok */ }
	}

	private async updateMeta(proj: VoidProject): Promise<void> {
		try {
			await this.w(proj.path + this.sep + '.void-meta.json', JSON.stringify({
				name: proj.name, slug: proj.slug,
				description: proj.description, author: proj.author,
				iconType: proj.iconType, updatedAt: Date.now(),
			}, null, 2));
		} catch { /* ok */ }
	}

	// ═══ Delete ═══

	private async deleteFromDisk(proj: VoidProject): Promise<void> {
		try { await this.fileService.del(URI.file(proj.path), { recursive: true }); }
		catch (e) { console.error('[Void] Delete error:', e); }
	}

	// ═══ Persistence (pins only) ═══

	private loadPins(): void {
		try {
			const r = localStorage.getItem('void:pins');
			if (r) {
				const pins: string[] = JSON.parse(r);
				this.projects.forEach(p => { p.pinned = pins.includes(p.slug); });
			}
		} catch { /* noop */ }
	}

	private savePins(): void {
		const pins = this.projects.filter(p => p.pinned).map(p => p.slug);
		localStorage.setItem('void:pins', JSON.stringify(pins));
	}

	// ═══════════════════════════════════════════════════════════════
	// RENDER ENTRY POINT
	// ═══════════════════════════════════════════════════════════════

	async render(parent: HTMLElement): Promise<void> {
		await this.ensureRoot();
		await this.scanDisk();
		this.loadPins();

		this.shell = dom.append(parent, dom.$('.vs'));
		this.shell.setAttribute('data-s', 'intro');

		this.buildTop();
		this.buildOrbit();
		this.buildGrid();
		this.bindKeys();

		this.measure();
		window.addEventListener('resize', () => this.measure());

		this.setState('intro');
		setTimeout(() => this.setState('desktop'), 1500);
	}

	private measure(): void {
		if (!this.orbitStage) return;
		const r = this.orbitStage.getBoundingClientRect();
		this.sW = r.width; this.sH = r.height;
	}

	// ═══ Top Bar ═══

	private buildTop(): void {
		this.topZone = dom.append(this.shell, dom.$('.vs-top'));
		const row = dom.append(this.topZone, dom.$('.vs-row1'));

		const left = dom.append(row, dom.$('.vs-tl'));
		dom.append(left, dom.$('.vs-logo')).appendChild(this.mkLogo());
		dom.append(left, dom.$('.vs-tlbl')).textContent = 'VOID ENGINE';

		const center = dom.append(row, dom.$('.vs-tc'));
		const sb = dom.append(center, dom.$('.vs-sb'));
		dom.append(sb, dom.$('.vs-si')).appendChild(this.svg(I.search, 14));
		this.searchInput = document.createElement('input');
		this.searchInput.type = 'text';
		this.searchInput.className = 'vs-sin';
		this.searchInput.placeholder = 'Search projects…';
		this.searchInput.setAttribute('autocomplete', 'off');
		this.searchInput.setAttribute('spellcheck', 'false');
		sb.appendChild(this.searchInput);
		const kh = dom.append(sb, dom.$('.vs-sk'));
		dom.append(kh, dom.$('kbd')).textContent = isWindows ? 'Ctrl' : '⌘';
		dom.append(kh, dom.$('kbd')).textContent = 'K';

		const right = dom.append(row, dom.$('.vs-tr'));
		const ver = dom.$('.vs-ver');
		ver.textContent = 'v0.5.0';
		right.appendChild(ver);

		this.actionRow = dom.append(this.topZone, dom.$('.vs-ar'));
		const aL = dom.append(this.actionRow, dom.$('.vs-arg'));
		const aR = dom.append(this.actionRow, dom.$('.vs-arg'));

		this.ab(aL, 'Open', I.folder, () => this.actOpen());
		this.ab(aL, 'Edit', I.edit, () => this.actEdit());
		this.ab(aR, 'Duplicate', I.copy, () => this.actDuplicate());
		this.ab(aR, 'Pin/Unpin', I.pin, () => this.actPin());
		this.ab(aR, 'Info', I.info, () => this.actInfo());
		this.ab(aR, 'Delete', I.trash, () => this.actDelete(), true);

		this._register(dom.addDisposableListener(this.searchInput, dom.EventType.FOCUS, () => {
			if (this.state !== 'search') this.setState('search');
		}));
		this._register(dom.addDisposableListener(this.searchInput, dom.EventType.INPUT, () => {
			if (this.state !== 'search') this.setState('search');
			this.filter();
		}));
		this._register(dom.addDisposableListener(this.searchInput, dom.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			if (e.key === 'Escape') { e.preventDefault(); this.leaveSearch(); }
			if (e.key === 'Enter' && this.matchedId) {
				e.preventDefault();
				const p = this.fp(this.matchedId);
				if (p) this.openProject(p);
			}
		}));
	}

	private mkLogo(): SVGSVGElement {
		const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		s.setAttribute('viewBox', '0 0 32 32');
		s.setAttribute('width', '20');
		s.setAttribute('height', '20');
		s.setAttribute('fill', 'none');
		s.setAttribute('stroke', 'currentColor');
		s.setAttribute('stroke-width', '2');
		s.setAttribute('stroke-linecap', 'round');
		for (const d of ['M14 4A12 12 0 0 0 14 28', 'M18 4A12 12 0 0 1 18 28']) {
			const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			p.setAttribute('d', d);
			s.appendChild(p);
		}
		const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		c.setAttribute('cx', '16');
		c.setAttribute('cy', '16');
		c.setAttribute('r', '2');
		c.setAttribute('fill', 'currentColor');
		c.setAttribute('stroke', 'none');
		s.appendChild(c);
		return s;
	}

	private ab(parent: HTMLElement, label: string, ico: string[], fn: () => void, danger = false): void {
		const b = dom.append(parent, dom.$('.vs-ab'));
		if (danger) b.classList.add('vs-abd');
		b.appendChild(this.svg(ico, 13));
		dom.append(b, dom.$('span')).textContent = label;
		
		b.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			fn();
			return false;
		};
	}

	// ═══ Orbit ═══

	private buildOrbit(): void {
		this.orbitStage = dom.append(this.shell, dom.$('.vs-os'));
		dom.append(this.orbitStage, dom.$('.vs-ring'));

		this.centerInfo = dom.append(this.orbitStage, dom.$('.vs-ci'));
		this.centerName = dom.append(this.centerInfo, dom.$('.vs-cin'));
		this.centerMeta = dom.append(this.centerInfo, dom.$('.vs-cim'));

		this.noResults = dom.append(this.orbitStage, dom.$('.vs-nope'));
		this.noResults.textContent = 'No projects found';

		dom.append(this.orbitStage, dom.$('.vs-ologo')).appendChild(this.mkOrbitLogo());
		this.rebuildOrbits();
	}

	private rebuildOrbits(): void {
		for (const o of this.orbits) o.el.remove();
		this.orbits = [];
		const n = Math.max(this.projects.length, 1);
		this.projects.forEach((p, i) => {
			this.orbits.push(this.mkOrbitItem(p, (360 / n) * i));
		});
	}

	private mkOrbitLogo(): HTMLElement {
		const w = dom.$('.vs-olog-w');
		const mk = (d: string, cls: string) => {
			const h = dom.append(w, dom.$('.vs-olh.' + cls));
			const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			s.setAttribute('viewBox', '0 0 30 60');
			s.setAttribute('width', '30');
			s.setAttribute('height', '60');
			s.setAttribute('fill', 'none');
			s.setAttribute('stroke', 'currentColor');
			s.setAttribute('stroke-width', '2');
			const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			p.setAttribute('d', d);
			s.appendChild(p);
			h.appendChild(s);
		};
		mk('M25 5Q5 15 5 30Q5 45 25 55', 'vs-olh-l');
		mk('M5 5Q25 15 25 30Q25 45 5 55', 'vs-olh-r');
		dom.append(w, dom.$('.vs-odot'));
		return w;
	}

	private mkOrbitItem(p: VoidProject, angle: number): OrbitRef {
		const el = dom.append(this.orbitStage, dom.$('.vs-oi'));
		el.setAttribute('data-id', p.id);
		el.appendChild(this.mkFolder(p, true));
		this._register(dom.addDisposableListener(el, dom.EventType.CLICK, (e) => {
			e.stopPropagation();
			this.openProject(p);
		}));
		const cx = this.sW / 2;
		const cy = this.sH / 2;
		const rad = (angle * Math.PI) / 180;
		const x = cx + Math.cos(rad) * this.radius;
		const y = cy + Math.sin(rad) * this.radius;
		return { project: p, el, matched: false, tx: x, ty: y, cx: x, cy: y, cs: 1, ts: 1 };
	}

	// ═══════════════════════════════════════════════════════════════
	// FOLDER CARD
	// ═══════════════════════════════════════════════════════════════

	private mkFolder(p: VoidProject, compact: boolean): HTMLElement {
		const f = dom.$('.vs-f');
		if (compact) f.classList.add('vs-fs');

		const sheet = dom.append(f, dom.$('.vs-fsh'));
		const lineCount = compact ? 2 : 3;
		for (let i = 0; i < lineCount; i++) dom.append(sheet, dom.$('.vs-fln'));

		dom.append(f, dom.$('.vs-ftab'));

		const body = dom.append(f, dom.$('.vs-fbd'));

		const ic = dom.append(body, dom.$('.vs-fic'));
		ic.appendChild(this.svg(this.icoFor(p.iconType), compact ? 14 : 16));

		dom.append(body, dom.$('.vs-fnm')).textContent = p.name;

		if (!compact) {
			if (p.description) {
				dom.append(body, dom.$('.vs-fdesc')).textContent = p.description;
			}
			dom.append(body, dom.$('.vs-fdt')).textContent = this.fmtDate(p.createdAt);
			dom.append(body, dom.$('.vs-fmt')).textContent = `${p.fileCount} files · ${p.sizeLabel}`;

			const bottomRow = dom.append(body, dom.$('.vs-fbr'));
			dom.append(bottomRow, dom.$('.vs-fvr')).textContent = 'v' + p.version;
			if (p.real) dom.append(bottomRow, dom.$('.vs-frl')).textContent = '● disk';
			if (p.author) {
				const auth = dom.append(bottomRow, dom.$('.vs-fau'));
				auth.appendChild(this.svg(I.user, 9));
				dom.append(auth, dom.$('span')).textContent = p.author;
			}

			if (p.pinned) {
				const pinIcon = dom.append(f, dom.$('.vs-fpin'));
				pinIcon.appendChild(this.svg(I.pin, 10));
			}
		}

		return f;
	}

	// ═══════════════════════════════════════════════════════════════
	// GRID
	// ═══════════════════════════════════════════════════════════════

	private buildGrid(): void {
		this.gridWrap = dom.append(this.shell, dom.$('.vs-gw'));
		this.rebuildGrid();
	}

	private rebuildGrid(): void {
		// Don't clear editStore here - it's managed by edit handlers!
		this.cardStore.clear();
		// Don't clear editingId - it's managed by edit handlers!
		this.gridWrap.textContent = '';

		this.gridWrap.appendChild(this.mkNewCard());

		const sorted = [...this.projects].sort((a, b) => {
			if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
			return b.lastOpened - a.lastOpened;
		});
		for (const p of sorted) {
			// Skip the project being edited - it will be rendered by edit form
			if (this.editingId === p.id) continue;
			this.gridWrap.appendChild(this.mkGridCard(p));
		}
	}

	private mkNewCard(): HTMLElement {
		const c = dom.$('.vs-gc.vs-gcnew');
		const f = dom.$('.vs-f.vs-fnew');
		dom.append(f, dom.$('.vs-ftab'));
		const body = dom.append(f, dom.$('.vs-fbd.vs-fbdnew'));
		dom.append(body, dom.$('.vs-fplus')).appendChild(this.svg(I.plus, 26));
		dom.append(body, dom.$('.vs-fnewlbl')).textContent = 'New Project';
		c.appendChild(f);

		c.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			this.showCreate();
		};

		return c;
	}

	// ═══════════════════════════════════════════════════════════════
	// GRID CARD — with toolbar
	// ═══════════════════════════════════════════════════════════════

	private mkGridCard(p: VoidProject): HTMLElement {
		const c = dom.$('.vs-gc');
		c.setAttribute('data-id', p.id);
		if (p.pinned) c.classList.add('vs-gcp');

		c.appendChild(this.mkFolder(p, false));

		const tb = dom.append(c, dom.$('.vs-gctb'));

		const openBtn = dom.append(tb, dom.$('.vs-gctb-btn'));
		openBtn.appendChild(this.svg(I.folder, 14));
		openBtn.title = 'Open';
		openBtn.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			this.openProject(p);
			return false;
		};

		const editBtn = dom.append(tb, dom.$('.vs-gctb-btn'));
		editBtn.appendChild(this.svg(I.edit, 14));
		editBtn.title = 'Edit';
		editBtn.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			this.showEdit(p);
			return false;
		};

		const delBtn = dom.append(tb, dom.$('.vs-gctb-btn.vs-gctb-del'));
		delBtn.appendChild(this.svg(I.trash, 14));
		delBtn.title = 'Delete';
		delBtn.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			this.showDeleteConfirm(p);
			return false;
		};

		c.onclick = (e: MouseEvent) => {
			// Don't select if we're editing this card
			if (this.editingId === p.id) return;
			
			// Don't select if clicking on toolbar buttons or action buttons
			const target = e.target as HTMLElement;
			if (target.closest('.vs-gctb') || target.closest('.vs-ab') || target.closest('.vs-ar')) {
				return;
			}
			
			e.stopPropagation();
			this.sel(p.id);
		};

		c.ondblclick = (e: MouseEvent) => {
			if (this.editingId === p.id) return;
			e.stopPropagation();
			e.preventDefault();
			this.openProject(p);
		};

		return c;
	}

	// ═══ Selection ═══

	private sel(id: string): void {
		if (this.editingId) this.cancelEdit();

		if (this.selectedId === id) {
			this.desel();
			return;
		}
		this.selectedId = id;
		this.updateSel();
		
		this.actionRow.classList.add('vs-aron');
		this.actionRow.style.pointerEvents = 'all';
		this.actionRow.style.zIndex = '100';
		
		setTimeout(() => {
			const closeActionRow = (e: MouseEvent) => {
				if (!this.actionRow.contains(e.target as HTMLElement)) {
					const clickedCard = (e.target as HTMLElement).closest('.vs-gc');
					if (!clickedCard || clickedCard.getAttribute('data-id') !== this.selectedId) {
						this.desel();
						document.removeEventListener('click', closeActionRow);
					}
				}
			};
			document.addEventListener('click', closeActionRow);
		}, 100);
	}

	private desel(): void {
		if (this.editingId) this.cancelEdit();
		this.selectedId = null;
		this.updateSel();
		this.actionRow.classList.remove('vs-aron');
	}

	private updateSel(): void {
		this.gridWrap.querySelectorAll('.vs-gc[data-id]').forEach(el => {
			const isSelected = el.getAttribute('data-id') === this.selectedId;
			(el as HTMLElement).classList.toggle('vs-gcsel', isSelected);
		});
	}

	private fp(id: string): VoidProject | null {
		return this.projects.find(p => p.id === id) || null;
	}

	private sp(): VoidProject | null {
		return this.selectedId ? this.fp(this.selectedId) : null;
	}

	private findCard(id: string): HTMLElement | null {
		return this.gridWrap.querySelector(`.vs-gc[data-id="${id}"]`) as HTMLElement;
	}

	// ═══ State Machine ═══

	private setState(s: ScreenState): void {
		this.state = s;
		this.shell.setAttribute('data-s', s);
		if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }

		if (s === 'intro') {
			this.startLoop();
		} else if (s === 'desktop') {
			this.matchedId = null;
			this.searchInput.value = '';
			this.orbits.forEach(o => {
				o.matched = false;
				o.el.classList.remove('vs-oi-m', 'vs-oi-d');
			});
			this.centerInfo.classList.remove('vs-vis');
			this.noResults.classList.remove('vs-vis');
			if (document.activeElement === this.searchInput) this.searchInput.blur();
		} else if (s === 'search') {
			this.desel();
			this.matchedId = null;
			this.orbits.forEach(o => {
				o.matched = false;
				o.el.classList.remove('vs-oi-m', 'vs-oi-d');
			});
			this.centerInfo.classList.remove('vs-vis');
			this.startLoop();
			this.filter();
		}
	}

	// ═══ Orbit Animation Loop ═══

	private startLoop(): void {
		if (this.rafId) return;
		const tick = () => {
			this.gAngle = (this.gAngle + 0.07) % 360;
			this.calcTargets();
			this.lerpAll();
			this.applyPos();
			this.rafId = requestAnimationFrame(tick);
		};
		this.rafId = requestAnimationFrame(tick);
	}

	private calcTargets(): void {
		this.measure();
		const cx = this.sW / 2;
		const cy = this.sH / 2;
		const free = this.orbits.filter(o => !o.matched);
		const n = Math.max(free.length, 1);
		let idx = 0;
		for (const o of this.orbits) {
			if (o.matched) {
				o.tx = cx;
				o.ty = cy - 10;
				o.ts = 1.3;
			} else {
				const a = ((360 / n) * idx + this.gAngle) * Math.PI / 180;
				o.tx = cx + Math.cos(a) * this.radius;
				o.ty = cy + Math.sin(a) * this.radius;
				o.ts = 1;
				idx++;
			}
		}
	}

	private lerpAll(): void {
		const s = 0.06;
		for (const o of this.orbits) {
			o.cx += (o.tx - o.cx) * s;
			o.cy += (o.ty - o.cy) * s;
			o.cs += (o.ts - o.cs) * s;
		}
	}

	private applyPos(): void {
		for (const o of this.orbits) {
			o.el.style.left = (o.cx - 57) + 'px';
			o.el.style.top = (o.cy - 45) + 'px';
			o.el.style.transform = `scale(${o.cs.toFixed(3)})`;
		}
	}

	// ═══ Search Filter ═══

	private filter(): void {
		const q = (this.searchInput.value || '').trim().toLowerCase();
		if (!q) {
			this.matchedId = null;
			this.orbits.forEach(o => {
				o.matched = false;
				o.el.classList.remove('vs-oi-m', 'vs-oi-d');
			});
			this.centerInfo.classList.remove('vs-vis');
			this.noResults.classList.remove('vs-vis');
			return;
		}

		const hits = this.projects.filter(p =>
			p.name.toLowerCase().includes(q) || p.slug.includes(q)
		);

		if (!hits.length) {
			this.matchedId = null;
			this.orbits.forEach(o => {
				o.matched = false;
				o.el.classList.remove('vs-oi-m');
				o.el.classList.add('vs-oi-d');
			});
			this.centerInfo.classList.remove('vs-vis');
			this.noResults.classList.add('vs-vis');
			return;
		}

		this.noResults.classList.remove('vs-vis');
		const best = hits[0];
		this.matchedId = best.id;

		for (const o of this.orbits) {
			if (o.project.id === best.id) {
				o.matched = true;
				o.el.classList.add('vs-oi-m');
				o.el.classList.remove('vs-oi-d');
			} else if (hits.some(h => h.id === o.project.id)) {
				o.matched = false;
				o.el.classList.remove('vs-oi-m', 'vs-oi-d');
			} else {
				o.matched = false;
				o.el.classList.remove('vs-oi-m');
				o.el.classList.add('vs-oi-d');
			}
		}

		this.centerName.textContent = best.name;
		this.centerMeta.textContent = `${best.fileCount} files · ${best.sizeLabel} · ${this.relTime(best.lastOpened)}`;
		this.centerInfo.classList.add('vs-vis');
	}

	private leaveSearch(): void {
		if (this.state === 'search') this.setState('desktop');
	}

	// ═══ Keyboard ═══

	private bindKeys(): void {
		this._register(dom.addDisposableListener(this.shell, dom.EventType.CLICK, (e: MouseEvent) => {
			const t = e.target as HTMLElement;

			if (this.state === 'search' && !this.topZone.contains(t) && !t.closest('.vs-oi')) {
				this.leaveSearch();
				return;
			}

			if (this.state === 'desktop' && !t.closest('.vs-gc') && !t.closest('.vs-ar') && !this.topZone.contains(t)) {
				this.desel();
			}
		}));

		this._register(dom.addDisposableListener(document, dom.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			if (this.overlayEl) {
				if (e.key === 'Escape') { e.preventDefault(); this.closeOv(); }
				return;
			}

			// Editing mode - only Escape works to cancel
			if (this.editingId) {
				if (e.key === 'Escape') {
					e.preventDefault();
					this.cancelEdit();
				}
				return;
			}

			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				this.searchInput.focus();
			}
			if (e.key === 'Escape') {
				if (this.state === 'search') this.leaveSearch();
				else this.desel();
			}
			if (e.key === 'Delete' && this.selectedId) this.actDelete();
			if (e.key === 'Enter' && this.selectedId && this.state === 'desktop') this.actOpen();
			if (e.key === 'F2' && this.selectedId) this.actEdit();
		}));
	}

	// ═══════════════════════════════════════════════════════════════
	// STAMPS
	// ═══════════════════════════════════════════════════════════════

	private stampCard(card: HTMLElement, text: string, color: StampColor, durationMs = 1500): void {
		const old = card.querySelector('.vs-cs');
		if (old) old.remove();

		const s = dom.append(card, dom.$('.vs-cs'));
		s.classList.add('vs-cs-' + color);
		dom.append(s, dom.$('.vs-cst')).textContent = text;

		requestAnimationFrame(() => {
			s.classList.add('vs-cs-in');
		});

		setTimeout(() => {
			s.classList.remove('vs-cs-in');
			s.classList.add('vs-cs-out');
			setTimeout(() => s.remove(), 200);
		}, durationMs);
	}

	private stampScreen(text: string, color: StampColor): void {
		const s = dom.append(this.shell, dom.$('.vs-ss'));
		s.classList.add('vs-ss-' + color);
		dom.append(s, dom.$('.vs-sst')).textContent = text;

		requestAnimationFrame(() => {
			s.classList.add('vs-ss-in');
		});

		setTimeout(() => {
			s.classList.remove('vs-ss-in');
			s.classList.add('vs-ss-out');
			setTimeout(() => s.remove(), 400);
		}, 800);
	}

	// ═══════════════════════════════════════════════════════════════
	// ACTIONS (from top bar)
	// ═══════════════════════════════════════════════════════════════

	private actOpen(): void {
		const p = this.sp();
		if (!p) return;
		this.openProject(p);
	}

	private async openProject(p: VoidProject): Promise<void> {
		p.lastOpened = Date.now();
		this.savePins();

		const card = this.findCard(p.id);
		if (card) this.stampCard(card, 'LAUNCHED', 'green');

		try {
			const body = document.body;
			body.classList.add('void-welcome-closed');
			const overlay = document.getElementById('void-welcome-overlay');
			if (overlay) overlay.style.display = 'none';

			const folderUri = URI.file(p.path);
			await this.commandService.executeCommand('vscode.openFolder', folderUri, {
				forceNewWindow: false,
				forceReuseWindow: true
			});
		} catch (error) {
			console.error('[Void] Failed to open project:', error);
			this.stampScreen('FAILED', 'red');
		}
	}

	private actEdit(): void {
		const p = this.sp();
		if (!p) return;
		this.showEdit(p);
	}

	private async actDuplicate(): Promise<void> {
		const p = this.sp();
		if (!p) return;

		let nm = p.name + ' Copy';
		let sl = this.toSlug(nm);
		let c = 1;
		while (this.projects.some(x => x.slug === sl)) {
			c++;
			nm = `${p.name} Copy ${c}`;
			sl = this.toSlug(nm);
		}

		const card = this.findCard(p.id);
		if (card) this.stampCard(card, 'COPIED', 'blue');

		try {
			if (p.real) await this.dupOnDisk(p, sl);
			await this.scanDisk();
			this.loadPins();
			this.stampScreen('DUPLICATED', 'blue');
			setTimeout(() => {
				this.rebuildGrid();
				this.rebuildOrbits();
				this.desel();
			}, 600);
		} catch (e) {
			console.error(e);
			this.stampScreen('FAILED', 'red');
		}
	}

	private actPin(): void {
		const p = this.sp();
		if (!p) return;

		p.pinned = !p.pinned;
		this.savePins();

		const card = this.findCard(p.id);
		if (card) this.stampCard(card, p.pinned ? 'PINNED' : 'UNPINNED', 'gold');

		setTimeout(() => {
			this.rebuildGrid();
			this.desel();
		}, 600);
	}

	private actInfo(): void {
		const p = this.sp();
		if (!p) return;
		this.showInfo(p);
	}

	private actDelete(): void {
		const p = this.sp();
		if (!p) return;
		this.showDeleteConfirm(p);
	}

	// ═══════════════════════════════════════════════════════════════
	// INLINE EDITING — CREATE
	// ═══════════════════════════════════════════════════════════════

	private showCreate(): void {
		if (this.editingId) this.cancelEdit();
		this.desel();

		const card = dom.$('.vs-gc.vs-gc-inline.vs-gc-editing');
		const f = dom.$('.vs-f.vs-f-edit');

		const sheet = dom.append(f, dom.$('.vs-fsh'));
		for (let i = 0; i < 3; i++) dom.append(sheet, dom.$('.vs-fln'));

		dom.append(f, dom.$('.vs-ftab'));

		const body = dom.append(f, dom.$('.vs-fbd.vs-fbd-edit'));

		const nameRow = dom.append(body, dom.$('.vs-fed-row'));
		dom.append(nameRow, dom.$('.vs-fed-lbl')).textContent = 'Name';
		const nameInp = document.createElement('input');
		nameInp.type = 'text';
		nameInp.className = 'vs-fed-inp';
		nameInp.placeholder = 'my-project';
		nameInp.setAttribute('autocomplete', 'off');
		nameInp.setAttribute('spellcheck', 'false');
		nameRow.appendChild(nameInp);

		const tmplRow = dom.append(body, dom.$('.vs-fed-row'));
		dom.append(tmplRow, dom.$('.vs-fed-lbl')).textContent = 'Type';
		const tmplSel = document.createElement('select');
		tmplSel.className = 'vs-fed-sel';
		for (const [val, label] of [['3d', '3D Scene'], ['2d', '2D Scene'], ['blank', 'Blank']]) {
			const opt = document.createElement('option');
			opt.value = val;
			opt.textContent = label;
			tmplSel.appendChild(opt);
		}
		tmplRow.appendChild(tmplSel);

		const btnRow = dom.append(body, dom.$('.vs-fed-btns'));

		const cancelBtn = dom.append(btnRow, dom.$('.vs-fed-btn.vs-fed-btn-g'));
		cancelBtn.appendChild(this.svg(I.x, 11));
		dom.append(cancelBtn, dom.$('span')).textContent = 'Cancel';

		const createBtn = dom.append(btnRow, dom.$('.vs-fed-btn.vs-fed-btn-p'));
		createBtn.appendChild(this.svg(I.plus, 11));
		dom.append(createBtn, dom.$('span')).textContent = 'Create';

		card.appendChild(f);

		const newCard = this.gridWrap.querySelector('.vs-gcnew');
		if (newCard && newCard.nextSibling) {
			this.gridWrap.insertBefore(card, newCard.nextSibling);
		} else {
			this.gridWrap.appendChild(card);
		}

		this.editingId = '__new__';

		setTimeout(() => nameInp.focus(), 50);

		const doCreate = async () => {
			const name = nameInp.value.trim() || 'my-project';
			const template = tmplSel.value as '3d' | '2d' | 'blank';
			const slug = this.toSlug(name);

			if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
				card.remove();
				this.editingId = null;
				this.editStore.clear();
				this.stampScreen('INVALID', 'red');
				return;
			}

			if (this.projects.some(p => p.slug === slug)) {
				card.remove();
				this.editingId = null;
				this.editStore.clear();
				this.stampScreen('EXISTS', 'red');
				return;
			}

			try {
				card.remove();
				this.editingId = null;
				this.editStore.clear();

				await this.createOnDisk(name, template);
				await this.scanDisk();
				this.loadPins();
				this.rebuildGrid();
				this.rebuildOrbits();

				this.stampScreen('CREATED', 'green');

				setTimeout(() => {
					for (const c of Array.from(this.gridWrap.querySelectorAll('.vs-gc[data-id]'))) {
						const id = c.getAttribute('data-id');
						const proj = id ? this.fp(id) : null;
						if (proj && proj.slug === slug) {
							this.stampCard(c as HTMLElement, 'CREATED', 'green');
							break;
						}
					}
				}, 100);
			} catch (e) {
				console.error('[Void] Create failed:', e);
				this.stampScreen('FAILED', 'red');
			}
		};

		const doCancel = () => {
			card.remove();
			this.editingId = null;
			this.editStore.clear();
		};

		cancelBtn.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			doCancel();
		};
		
		createBtn.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			doCreate();
		};
		
		nameInp.onkeydown = (e: KeyboardEvent) => {
			e.stopPropagation();
			if (e.key === 'Enter') {
				e.preventDefault();
				doCreate();
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				doCancel();
			}
		};

		setTimeout(() => {
			const clickOutside = (e: MouseEvent) => {
				if (!card.contains(e.target as HTMLElement)) {
					doCancel();
					document.removeEventListener('click', clickOutside);
				}
			};
			document.addEventListener('click', clickOutside);
		}, 100);
	}

	// ═══════════════════════════════════════════════════════════════
	// INLINE EDITING — EDIT EXISTING
	// ═══════════════════════════════════════════════════════════════

	private showEdit(p: VoidProject): void {
		const card = this.findCard(p.id);
		if (!card) return;

		if (this.editingId && this.editingId !== p.id) this.cancelEdit();
		if (this.editingId === p.id) return;

		this.editingId = p.id;

		const original = {
			name: p.name, description: p.description,
			author: p.author, version: p.version,
			iconType: p.iconType,
		};

		card.classList.add('vs-gc-editing');
		const oldContent = card.querySelector('.vs-f');
		const oldToolbar = card.querySelector('.vs-gctb');
		if (oldContent) oldContent.remove();
		if (oldToolbar) oldToolbar.remove();

		const f = dom.$('.vs-f.vs-f-edit');

		const sheet = dom.append(f, dom.$('.vs-fsh'));
		for (let i = 0; i < 3; i++) dom.append(sheet, dom.$('.vs-fln'));

		dom.append(f, dom.$('.vs-ftab'));

		const body = dom.append(f, dom.$('.vs-fbd.vs-fbd-edit'));

		const nameRow = dom.append(body, dom.$('.vs-fed-row'));
		dom.append(nameRow, dom.$('.vs-fed-lbl')).textContent = 'Name';
		const nameInp = document.createElement('input');
		nameInp.type = 'text';
		nameInp.className = 'vs-fed-inp';
		nameInp.value = p.name;
		nameRow.appendChild(nameInp);

		const descRow = dom.append(body, dom.$('.vs-fed-row'));
		dom.append(descRow, dom.$('.vs-fed-lbl')).textContent = 'Desc';
		const descInp = document.createElement('input');
		descInp.type = 'text';
		descInp.className = 'vs-fed-inp';
		descInp.value = p.description;
		descInp.placeholder = 'Description…';
		descRow.appendChild(descInp);

		const authRow = dom.append(body, dom.$('.vs-fed-row'));
		dom.append(authRow, dom.$('.vs-fed-lbl')).textContent = 'Author';
		const authInp = document.createElement('input');
		authInp.type = 'text';
		authInp.className = 'vs-fed-inp';
		authInp.value = p.author;
		authInp.placeholder = 'Author';
		authRow.appendChild(authInp);

		const verRow = dom.append(body, dom.$('.vs-fed-row'));
		dom.append(verRow, dom.$('.vs-fed-lbl')).textContent = 'Ver';
		const verInp = document.createElement('input');
		verInp.type = 'text';
		verInp.className = 'vs-fed-inp';
		verInp.value = p.version;
		verRow.appendChild(verInp);

		const catRow = dom.append(body, dom.$('.vs-fed-row'));
		dom.append(catRow, dom.$('.vs-fed-lbl')).textContent = 'Type';
		const catWrap = dom.append(catRow, dom.$('.vs-fed-cats'));

		let selectedCat = p.iconType;
		const catDefs: { key: PIcon; label: string; ico: string[] }[] = [
			{ key: 'game', label: 'Game', ico: I.game },
			{ key: '3d', label: '3D', ico: I._3d },
			{ key: '2d', label: '2D', ico: I._2d },
			{ key: 'web', label: 'Web', ico: I.web },
			{ key: 'lib', label: 'Lib', ico: I.lib },
			{ key: 'tool', label: 'Tool', ico: I.tool },
		];
		const catBtns: HTMLElement[] = [];
		for (const cat of catDefs) {
			const btn = dom.append(catWrap, dom.$('.vs-fed-cat'));
			btn.appendChild(this.svg(cat.ico, 11));
			dom.append(btn, dom.$('span')).textContent = cat.label;
			if (cat.key === selectedCat) btn.classList.add('vs-fed-cat-on');
			catBtns.push(btn);

			btn.onclick = (e: MouseEvent) => {
				e.stopPropagation();
				e.preventDefault();
				selectedCat = cat.key;
				catBtns.forEach(b => b.classList.remove('vs-fed-cat-on'));
				btn.classList.add('vs-fed-cat-on');
			};
		}

		const btnRow = dom.append(body, dom.$('.vs-fed-btns'));

		const cancelBtn = dom.append(btnRow, dom.$('.vs-fed-btn.vs-fed-btn-g'));
		cancelBtn.appendChild(this.svg(I.x, 11));
		dom.append(cancelBtn, dom.$('span')).textContent = 'Cancel';

		const delBtn = dom.append(btnRow, dom.$('.vs-fed-btn.vs-fed-btn-r'));
		delBtn.appendChild(this.svg(I.trash, 11));
		dom.append(delBtn, dom.$('span')).textContent = 'Delete';

		const saveBtn = dom.append(btnRow, dom.$('.vs-fed-btn.vs-fed-btn-p'));
		saveBtn.appendChild(this.svg(I.save, 11));
		dom.append(saveBtn, dom.$('span')).textContent = 'Save';

		card.appendChild(f);

		setTimeout(() => { nameInp.focus(); nameInp.select(); }, 50);

		// ── Define actions BEFORE adding listeners ──
		const doSave = async () => {
			const newName = nameInp.value.trim() || p.name;
			const oldSlug = p.slug;

			p.name = newName;
			p.slug = this.toSlug(newName);
			p.description = descInp.value.trim();
			p.author = authInp.value.trim();
			p.version = verInp.value.trim() || '0.1.0';
			p.iconType = selectedCat;

			if (p.real && p.slug !== oldSlug) await this.updateCargoName(p);
			await this.updateMeta(p);
			this.savePins();

			// Clear edit mode FIRST
			this.editingId = null;
			this.editStore.clear();

			// Now rebuild grid (will include updated project)
			await this.scanDisk();
			this.loadPins();
			this.rebuildGrid();
			this.rebuildOrbits();
			this.desel();

			setTimeout(() => {
				const newCard = this.findCard(p.id);
				if (newCard) this.stampCard(newCard, 'SAVED', 'blue');
			}, 50);
		};

		const doCancel = () => {
			// Restore original values
			p.name = original.name;
			p.description = original.description;
			p.author = original.author;
			p.version = original.version;
			p.iconType = original.iconType;

			// Clear edit mode FIRST
			this.editingId = null;
			this.editStore.clear();

			// Now rebuild grid (will restore original card)
			this.rebuildGrid();
			this.desel();
		};

		const doDelete = () => {
			this.editingId = null;
			this.editStore.clear();
			this.showDeleteConfirm(p);
		};

		saveBtn.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			doSave();
		};
		
		cancelBtn.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			doCancel();
		};
		
		delBtn.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			doDelete();
		};
		
		nameInp.onkeydown = (e: KeyboardEvent) => {
			e.stopPropagation();
			if (e.key === 'Enter') {
				e.preventDefault();
				doSave();
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				doCancel();
			}
		};

		// Click outside to cancel
		setTimeout(() => {
			const clickOutside = (evt: MouseEvent) => {
				if (!card.contains(evt.target as HTMLElement)) {
					doCancel();
					document.removeEventListener('click', clickOutside);
				}
			};
			document.addEventListener('click', clickOutside);
		}, 100);
	}

	private cancelEdit(): void {
		if (!this.editingId) return;

		if (this.editingId === '__new__') {
			const inlineCard = this.gridWrap.querySelector('.vs-gc-inline');
			if (inlineCard) inlineCard.remove();
			this.editingId = null;
			this.editStore.clear();
		} else {
			// For existing project, clear edit mode and rebuild
			this.editingId = null;
			this.editStore.clear();
			this.rebuildGrid();
			this.desel();
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// MODAL OVERLAY (Delete Confirm, Info)
	// ═══════════════════════════════════════════════════════════════

	private openOv(): HTMLElement {
		this.closeOv();
		this.modalStore.clear();
		this.overlayEl = dom.append(document.body, dom.$('.vs-ov'));

		this.overlayEl.onclick = (e: MouseEvent) => {
			if ((e.target as HTMLElement).classList.contains('vs-ov')) {
				this.closeOv();
			}
		};

		// Show immediately
		this.overlayEl.classList.add('vs-ovon');
		return this.overlayEl;
	}

	private closeOv(): void {
		if (!this.overlayEl) return;
		this.overlayEl.classList.remove('vs-ovon');
		this.overlayEl.classList.add('vs-ovoff');
		const el = this.overlayEl;
		this.overlayEl = null;
		this.modalStore.clear();
		setTimeout(() => el.remove(), 220);
	}

	private mkMF(ov: HTMLElement, sheetTitle: string, small = false, warn = false): HTMLElement {
		const f = dom.append(ov, dom.$('.vs-mf'));
		if (small) f.classList.add('vs-mfsm');
		const sh = dom.append(f, dom.$('.vs-mfsh'));
		if (warn) sh.classList.add('vs-mfshw');
		dom.append(sh, dom.$('.vs-mfsht')).textContent = sheetTitle;
		dom.append(f, dom.$('.vs-mftab'));
		return f;
	}

	private mkBody(f: HTMLElement): HTMLElement {
		return dom.append(f, dom.$('.vs-mfbd'));
	}

	private mkBtns(b: HTMLElement): HTMLElement {
		return dom.append(b, dom.$('.vs-mfbtns'));
	}

	// ── Delete Confirmation ──

	private showDeleteConfirm(p: VoidProject): void {
		const ov = this.openOv();
		const f = this.mkMF(ov, 'DISPOSAL NOTICE', false, true);
		const body = this.mkBody(f);

		dom.append(body, dom.$('.vs-mfwn')).textContent = p.name;
		dom.append(body, dom.$('.vs-mfwm')).textContent =
			'This project will be permanently deleted from the launcher and from disk. This action cannot be undone.';

		const btns = this.mkBtns(body);

		const cancelBtn = dom.append(btns, dom.$('.vs-btn.vs-btng'));
		cancelBtn.textContent = 'Cancel';
		cancelBtn.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			this.closeOv();
		};

		const delBtn = dom.append(btns, dom.$('.vs-btn.vs-btnr'));
		delBtn.appendChild(this.svg(I.trash, 12));
		dom.append(delBtn, dom.$('span')).textContent = 'Delete';

		delBtn.onclick = async (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			this.closeOv();

			const card = this.findCard(p.id);
			if (card) {
				this.stampCard(card, 'VOID', 'red', 1000);
				setTimeout(() => {
					card.classList.add('vs-gcdel');
				}, 300);
			}

			setTimeout(async () => {
				await this.deleteFromDisk(p);
				await this.scanDisk();
				this.loadPins();
				this.rebuildGrid();
				this.rebuildOrbits();
				this.desel();
			}, 1000);
		};
	}

	// ── Info Modal ──

	private showInfo(p: VoidProject): void {
		const ov = this.openOv();
		const f = this.mkMF(ov, 'PROJECT INFO');
		const body = this.mkBody(f);

		const hdr = dom.append(body, dom.$('.vs-mfih'));
		const iw = dom.append(hdr, dom.$('.vs-mfiic'));
		iw.appendChild(this.svg(this.icoFor(p.iconType), 20));
		dom.append(hdr, dom.$('.vs-mfin')).textContent = p.name;

		if (p.description) {
			dom.append(body, dom.$('.vs-mfdsc')).textContent = p.description;
		}

		const list = dom.append(body, dom.$('.vs-ilst'));
		const rows: [string, string][] = [
			['Path', p.path],
			['Created', this.fmtDate(p.createdAt)],
			['Last opened', this.relTime(p.lastOpened)],
			['Version', 'v' + p.version],
			['Files', String(p.fileCount)],
			['Size', p.sizeLabel],
			['Category', p.iconType],
			['Author', p.author || '—'],
			['On disk', p.real ? 'Yes' : 'No'],
		];
		for (const [l, v] of rows) {
			const row = dom.append(list, dom.$('.vs-irow'));
			dom.append(row, dom.$('.vs-il')).textContent = l;
			dom.append(row, dom.$('.vs-iv')).textContent = v;
		}

		const btns = this.mkBtns(body);
		const ok = dom.append(btns, dom.$('.vs-btn.vs-btnp'));
		ok.textContent = 'Close';
		ok.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			this.closeOv();
		};
	}

	// ═══ Cleanup ═══

	override dispose(): void {
		if (this.rafId) cancelAnimationFrame(this.rafId);
		this.cardStore.dispose();
		this.editStore.dispose();
		this.modalStore.dispose();
		super.dispose();
	}
}

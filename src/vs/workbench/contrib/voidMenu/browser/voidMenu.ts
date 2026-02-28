/*---------------------------------------------------------------------------------------------
 *  Void Engine IDE - Custom Menu
 *  Engine-specific menu items
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { Codicon } from '../../../../base/common/codicons.js';

// Submenu IDs
const VoidProjectMenu = new MenuId('VoidProjectMenu');
const VoidBuildMenu = new MenuId('VoidBuildMenu');
const VoidToolsMenu = new MenuId('VoidToolsMenu');

// ===== PROJECT MENU =====
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
	submenu: VoidProjectMenu,
	title: localize2('voidProject', 'Project'),
	group: '1_project',
	order: 1
});

// New Project
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.project.new',
			title: localize2('void.project.new', 'New Project...'),
			icon: Codicon.add,
			menu: { id: VoidProjectMenu, group: '1_new', order: 1 }
		});
	}
	run(accessor: ServicesAccessor) {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('New Project - Coming soon!');
	}
});

// Open Project
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.project.open',
			title: localize2('void.project.open', 'Open Project...'),
			icon: Codicon.folderOpened,
			menu: { id: VoidProjectMenu, group: '1_new', order: 2 }
		});
	}
	run(accessor: ServicesAccessor) {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Open Project - Coming soon!');
	}
});

// Recent Projects
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.project.recent',
			title: localize2('void.project.recent', 'Recent Projects'),
			icon: Codicon.history,
			menu: { id: VoidProjectMenu, group: '1_new', order: 3 }
		});
	}
	run(accessor: ServicesAccessor) {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Recent Projects - Coming soon!');
	}
});

// Project Settings
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.project.settings',
			title: localize2('void.project.settings', 'Project Settings'),
			icon: Codicon.settingsGear,
			menu: { id: VoidProjectMenu, group: '2_settings', order: 1 }
		});
	}
	run(accessor: ServicesAccessor) {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Project Settings - Coming soon!');
	}
});

// ===== BUILD MENU =====
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
	submenu: VoidBuildMenu,
	title: localize2('voidBuild', 'Build'),
	group: '2_build',
	order: 2
});

// Build Project
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.build.project',
			title: localize2('void.build.project', 'Build Project'),
			icon: Codicon.tools,
			menu: { id: VoidBuildMenu, group: '1_build', order: 1 }
		});
	}
	run(accessor: ServicesAccessor) {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Building project...');
	}
});

// Build Release
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.build.release',
			title: localize2('void.build.release', 'Build Release'),
			icon: Codicon.package,
			menu: { id: VoidBuildMenu, group: '1_build', order: 2 }
		});
	}
	run(accessor: ServicesAccessor) {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Building release...');
	}
});

// Clean Build
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.build.clean',
			title: localize2('void.build.clean', 'Clean Build'),
			icon: Codicon.trash,
			menu: { id: VoidBuildMenu, group: '2_clean', order: 1 }
		});
	}
	run(accessor: ServicesAccessor) {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Cleaning build...');
	}
});

// ===== TOOLS MENU =====
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
	submenu: VoidToolsMenu,
	title: localize2('voidTools', 'Tools'),
	group: '3_tools',
	order: 3
});

// Asset Manager
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.tools.assets',
			title: localize2('void.tools.assets', 'Asset Manager'),
			icon: Codicon.fileMedia,
			menu: { id: VoidToolsMenu, group: '1_tools', order: 1 }
		});
	}
	run(accessor: ServicesAccessor) {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Asset Manager - Coming soon!');
	}
});

// Scene Editor
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.tools.scene',
			title: localize2('void.tools.scene', 'Scene Editor'),
			icon: Codicon.symbolClass,
			menu: { id: VoidToolsMenu, group: '1_tools', order: 2 }
		});
	}
	run(accessor: ServicesAccessor) {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Scene Editor - Coming soon!');
	}
});

// Shader Editor
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.tools.shader',
			title: localize2('void.tools.shader', 'Shader Editor'),
			icon: Codicon.symbolColor,
			menu: { id: VoidToolsMenu, group: '1_tools', order: 3 }
		});
	}
	run(accessor: ServicesAccessor) {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Shader Editor - Coming soon!');
	}
});

// Profiler
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'void.tools.profiler',
			title: localize2('void.tools.profiler', 'Profiler'),
			icon: Codicon.pulse,
			menu: { id: VoidToolsMenu, group: '2_debug', order: 1 }
		});
	}
	run(accessor: ServicesAccessor) {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Profiler - Coming soon!');
	}
});

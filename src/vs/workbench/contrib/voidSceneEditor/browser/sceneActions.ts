/*---------------------------------------------------------------------------------------------
 *  Void Scene Actions - Context menu actions for .vecn files
 *--------------------------------------------------------------------------------------------*/

import { Action2, registerAction2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { localize } from '../../../../nls.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';

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
// Register Actions
// ============================================================================

registerAction2(SetAsMainSceneAction);
registerAction2(CreateScriptForSceneAction);

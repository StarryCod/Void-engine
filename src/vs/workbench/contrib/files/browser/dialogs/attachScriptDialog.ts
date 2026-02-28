/*---------------------------------------------------------------------------------------------
 *  Attach Script Dialog - For attaching Rust scripts to entities
 *--------------------------------------------------------------------------------------------*/

import { IFileService } from '../../../../../platform/files/common/files.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { URI } from '../../../../../base/common/uri.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';

export interface IAttachScriptOptions {
	entityName: string;
	entityId: string;
	sceneUri: URI;
}

export class AttachScriptDialog {
	
	constructor(
		private readonly options: IAttachScriptOptions,
		@IFileService private readonly fileService: IFileService,
		@IEditorService private readonly editorService: IEditorService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService
	) {}
	
	async show(): Promise<{ scriptPath: string; scriptName: string } | null> {
		const scriptName = this.generateScriptName(this.options.entityName);
		const defaultPath = 'src/scripts/';
		const finalScriptName = scriptName;
		const scriptPath = `${defaultPath}${finalScriptName}`;
		
		// Create script file
		await this.createScriptFile(scriptPath, this.options.entityName);
		
		// Open in editor
		const workspace = this.workspaceService.getWorkspace();
		if (workspace.folders.length > 0) {
			const scriptUri = URI.joinPath(workspace.folders[0].uri, scriptPath);
			await this.editorService.openEditor({ resource: scriptUri });
		}
		
		return { scriptPath, scriptName: finalScriptName };
	}
	
	private generateScriptName(entityName: string): string {
		const normalized = entityName.toLowerCase().replace(/\s+/g, '_');
		return `${normalized}_controller.rs`;
	}
	
	private async createScriptFile(path: string, entityName: string): Promise<void> {
		const workspace = this.workspaceService.getWorkspace();
		if (workspace.folders.length === 0) {
			return;
		}
		
		const scriptUri = URI.joinPath(workspace.folders[0].uri, path);
		
		// Ensure directory exists
		const dirUri = URI.joinPath(scriptUri, '..');
		try {
			await this.fileService.createFolder(dirUri);
		} catch {
			// Directory might already exist
		}
		
		// Generate script content
		const content = this.generateScriptContent(entityName);
		
		// Write file
		await this.fileService.writeFile(scriptUri, VSBuffer.fromString(content));
	}
	
	private generateScriptContent(entityName: string): string {
		const componentName = entityName.replace(/\s+/g, '');
		
		return `use bevy::prelude::*;

#[derive(Component)]
pub struct ${componentName}Controller {
    pub speed: f32,
}

impl Default for ${componentName}Controller {
    fn default() -> Self {
        Self {
            speed: 5.0,
        }
    }
}

pub fn ${entityName.toLowerCase().replace(/\s+/g, '_')}_system(
    keyboard: Res<ButtonInput<KeyCode>>,
    mut query: Query<(&mut Transform, &${componentName}Controller)>,
    time: Res<Time>,
) {
    for (mut transform, controller) in query.iter_mut() {
        let mut direction = Vec3::ZERO;
        
        if keyboard.pressed(KeyCode::KeyW) {
            direction.z -= 1.0;
        }
        if keyboard.pressed(KeyCode::KeyS) {
            direction.z += 1.0;
        }
        if keyboard.pressed(KeyCode::KeyA) {
            direction.x -= 1.0;
        }
        if keyboard.pressed(KeyCode::KeyD) {
            direction.x += 1.0;
        }
        
        if direction.length() > 0.0 {
            direction = direction.normalize();
            transform.translation += direction * controller.speed * time.delta_seconds();
        }
    }
}

pub struct ${componentName}Plugin;

impl Plugin for ${componentName}Plugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, ${entityName.toLowerCase().replace(/\s+/g, '_')}_system);
    }
}
`;
	}
}

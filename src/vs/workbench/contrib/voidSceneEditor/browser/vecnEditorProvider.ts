/*---------------------------------------------------------------------------------------------
 *  VECN Editor Provider - Custom editor для .vecn файлов с Three.js viewport
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import * as DOM from '../../../../base/browser/dom.js';
import { ThreeViewport } from './threeViewport.js';

export class VecnEditorProvider extends Disposable {
	
	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IFileService private readonly fileService: IFileService
	) {
		super();
	}

	async openEditor(resource: URI, container: HTMLElement, vecnContent: string): Promise<void> {
		// Read .vecn file
		const content = await this.fileService.readFile(resource);
		const vecnText = content.value.toString();

		// Create Three.js viewport
		this.createThreeViewport(container, vecnText, resource);
	}

	private createThreeViewport(container: HTMLElement, vecnContent: string, resource: URI): void {
		// Clear container
		DOM.clearNode(container);

		// Create viewport container
		const viewportContainer = DOM.append(container, DOM.$('.vecn-editor-container'));
		viewportContainer.style.width = '100%';
		viewportContainer.style.height = '100%';
		viewportContainer.style.position = 'relative';
		viewportContainer.style.overflow = 'hidden';
		viewportContainer.style.background = '#1e1e1e';

		// Create Three.js viewport
		const viewport = this.instantiationService.createInstance(
			ThreeViewport,
			viewportContainer,
			vecnContent
		);

		this._register(viewport);
	}
}

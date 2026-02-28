/*---------------------------------------------------------------------------------------------
 *  Void Engine – Scene Event Bus
 *  Single source of truth for scene state propagation.
 *--------------------------------------------------------------------------------------------*/
import { Emitter, Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';

export interface VecnSceneUpdate {
	readonly uri: URI;
	readonly content: string;
	readonly source: 'editor-model' | 'viewport-writeback' | 'disk-change' | 'initial-load' | 'inspector-edit';
	readonly timestamp: number;
}

const _onVecnSceneUpdate = new Emitter<VecnSceneUpdate>();
export const onVecnSceneUpdate: Event<VecnSceneUpdate> = _onVecnSceneUpdate.event;

let _lastUpdate: VecnSceneUpdate | null = null;

export function fireVecnSceneUpdate(e: VecnSceneUpdate): void {
	_lastUpdate = e;
	_onVecnSceneUpdate.fire(e);
}

export function getLastVecnSceneUpdate(): VecnSceneUpdate | null {
	return _lastUpdate;
}

// Entity selection bus
const _onEntitySelected = new Emitter<string | null>();
export const onEntitySelected: Event<string | null> = _onEntitySelected.event;

export function fireEntitySelected(id: string | null): void {
	_onEntitySelected.fire(id);
}

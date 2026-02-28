/*---------------------------------------------------------------------------------------------
 *  Orchestrator Service - DISABLED
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';

export const IOrchestratorService = createDecorator<IOrchestratorService>('orchestratorService');

export interface IOrchestratorService {
	readonly _serviceBrand: undefined;
	readonly onDidReceiveUserMessage: Event<string>;
	readonly onDidReceiveFinalResponse: Event<string>;
	readonly onDidChangeStatus: Event<OrchestratorStatus>;
	getStatus(): OrchestratorStatus;
	sendUserMessage(content: string): Promise<void>;
	stopGeneration(): Promise<void>;
	clearChat(): Promise<void>;
}

export type OrchestratorStatus = 'idle' | 'processing' | 'error';

export class OrchestratorService extends Disposable implements IOrchestratorService {
	declare readonly _serviceBrand: undefined;

	private status: OrchestratorStatus = 'idle';

	private readonly _onDidReceiveUserMessage = this._register(new Emitter<string>());
	readonly onDidReceiveUserMessage = this._onDidReceiveUserMessage.event;

	private readonly _onDidReceiveFinalResponse = this._register(new Emitter<string>());
	readonly onDidReceiveFinalResponse = this._onDidReceiveFinalResponse.event;

	private readonly _onDidChangeStatus = this._register(new Emitter<OrchestratorStatus>());
	readonly onDidChangeStatus = this._onDidChangeStatus.event;

	constructor(@ILogService private readonly logService: ILogService) {
		super();
		this.logService.info('[Orchestrator] Service created (DISABLED)');
	}

	getStatus(): OrchestratorStatus { return this.status; }
	async sendUserMessage(_content: string): Promise<void> {}
	async stopGeneration(): Promise<void> {}
	async clearChat(): Promise<void> {}
}

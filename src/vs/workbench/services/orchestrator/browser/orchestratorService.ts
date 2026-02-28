/*---------------------------------------------------------------------------------------------
 *  Orchestrator Service - Browser Service
 *  Provides browser-side access to Orchestrator via IPC
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { OrchestratorStatus } from '../../../../platform/orchestrator/common/orchestrator.js';

export const IOrchestratorBrowserService = createDecorator<IOrchestratorBrowserService>('orchestratorBrowserService');

export interface IOrchestratorBrowserService {
	readonly _serviceBrand: undefined;
	readonly onDidReceiveUserMessage: Event<string>;
	readonly onDidReceiveFinalResponse: Event<string>;
	readonly onDidChangeStatus: Event<OrchestratorStatus>;
	getStatus(): OrchestratorStatus;
	sendUserMessage(content: string): Promise<void>;
	stopGeneration(): Promise<void>;
	clearChat(): Promise<void>;
}

export class OrchestratorBrowserService extends Disposable implements IOrchestratorBrowserService {
	declare readonly _serviceBrand: undefined;

	private status: OrchestratorStatus = 'idle';
	private readonly channel;

	// Events
	private readonly _onDidReceiveUserMessage = this._register(new Emitter<string>());
	readonly onDidReceiveUserMessage = this._onDidReceiveUserMessage.event;

	private readonly _onDidReceiveFinalResponse = this._register(new Emitter<string>());
	readonly onDidReceiveFinalResponse = this._onDidReceiveFinalResponse.event;

	private readonly _onDidChangeStatus = this._register(new Emitter<OrchestratorStatus>());
	readonly onDidChangeStatus = this._onDidChangeStatus.event;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService
	) {
		super();

		this.channel = mainProcessService.getChannel('orchestrator');

		// Listen to main process events
		this._register(this.channel.listen<OrchestratorStatus>('onDidChangeStatus')((status) => {
			this.status = status;
			this._onDidChangeStatus.fire(status);
		}));

		this._register(this.channel.listen<string>('onDidReceiveUserMessage')((msg) => {
			this._onDidReceiveUserMessage.fire(msg);
		}));

		this._register(this.channel.listen<string>('onDidReceiveFinalResponse')((response) => {
			this._onDidReceiveFinalResponse.fire(response);
		}));
	}

	getStatus(): OrchestratorStatus {
		return this.status;
	}

	async sendUserMessage(content: string): Promise<void> {
		return this.channel.call('sendUserMessage', [content]);
	}

	async stopGeneration(): Promise<void> {
		return this.channel.call('stopGeneration');
	}

	async clearChat(): Promise<void> {
		return this.channel.call('clearChat');
	}
}

registerSingleton(IOrchestratorBrowserService, OrchestratorBrowserService, InstantiationType.Delayed);


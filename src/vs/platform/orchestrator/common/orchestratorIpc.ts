/*---------------------------------------------------------------------------------------------
 *  Orchestrator Service - IPC Channel Definitions
 *--------------------------------------------------------------------------------------------*/

import { IChannel, IServerChannel } from '../../../base/parts/ipc/common/ipc.js';
import { Event } from '../../../base/common/event.js';
import { IOrchestratorService, OrchestratorStatus } from './orchestrator.js';

export const ORCHESTRATOR_CHANNEL_NAME = 'orchestrator';

export interface IOrchestratorChannel extends IChannel {
	call(command: 'sendUserMessage', content: string): Promise<void>;
	call(command: 'stopGeneration'): Promise<void>;
	call(command: 'clearChat'): Promise<void>;
	call(command: 'getStatus'): Promise<OrchestratorStatus>;
	call(command: string, ...args: any[]): Promise<any>;
	listen(event: 'onDidReceiveUserMessage'): Event<string>;
	listen(event: 'onDidReceiveFinalResponse'): Event<string>;
	listen(event: 'onDidChangeStatus'): Event<OrchestratorStatus>;
	listen(event: string, ...args: any[]): Event<any>;
}

export class OrchestratorChannel implements IServerChannel {
	constructor(private service: IOrchestratorService) { }

	listen(event: string): any {
		switch (event) {
			case 'onDidReceiveUserMessage': return this.service.onDidReceiveUserMessage;
			case 'onDidReceiveFinalResponse': return this.service.onDidReceiveFinalResponse;
			case 'onDidChangeStatus': return this.service.onDidChangeStatus;
		}
		throw new Error(`Unknown event: ${event}`);
	}

	call(context: any, command: string, ...args: any[]): Promise<any> {
		switch (command) {
			case 'sendUserMessage': return this.service.sendUserMessage(args[0]);
			case 'stopGeneration': return this.service.stopGeneration();
			case 'clearChat': return this.service.clearChat();
			case 'getStatus': return Promise.resolve(this.service.getStatus());
		}
		throw new Error(`Unknown command: ${command}`);
	}
}

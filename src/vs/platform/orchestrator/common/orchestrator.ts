/*---------------------------------------------------------------------------------------------
 *  Orchestrator Types - DISABLED
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';

export const IOrchestratorService = 'orchestratorService';

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

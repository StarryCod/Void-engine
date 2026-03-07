/*---------------------------------------------------------------------------------------------
 *  Void Engine output contribution
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IOutputChannelRegistry, IOutputService, Extensions as OutputExtensions } from '../../../services/output/common/output.js';
import { IVoidRuntimeService } from '../common/voidRuntimeService.js';
import {
	formatVoidCrashReport,
	formatVoidRuntimeEvent,
	VOID_ENGINE_OUTPUT_CHANNEL_ID,
	VOID_ENGINE_OUTPUT_CHANNEL_LABEL
} from '../common/voidRuntimeOutput.js';

const outputChannelRegistry = Registry.as<IOutputChannelRegistry>(OutputExtensions.OutputChannels);
if (!outputChannelRegistry.getChannel(VOID_ENGINE_OUTPUT_CHANNEL_ID)) {
	outputChannelRegistry.registerChannel({
		id: VOID_ENGINE_OUTPUT_CHANNEL_ID,
		label: VOID_ENGINE_OUTPUT_CHANNEL_LABEL,
		log: false
	});
}

class VoidRuntimeOutputContribution extends Disposable {
	static readonly ID = 'workbench.contrib.voidRuntimeOutput';

	constructor(
		@IOutputService private readonly outputService: IOutputService,
		@IVoidRuntimeService private readonly runtimeService: IVoidRuntimeService
	) {
		super();

		this.append(`[Void Engine] Output channel ready\n`);

		this._register(this.runtimeService.onDidPublishEvent(event => {
			this.append(formatVoidRuntimeEvent(event));
			if (event.type.endsWith('.failed') || event.type === 'listenerLeak.detected' || event.type === 'request.failed.diagnostic') {
				void this.outputService.showChannel(VOID_ENGINE_OUTPUT_CHANNEL_ID, false);
			}
		}));

		this._register(this.runtimeService.onDidCreateCrashReport(report => {
			this.append(formatVoidCrashReport(report));
			void this.outputService.showChannel(VOID_ENGINE_OUTPUT_CHANNEL_ID, false);
		}));
	}

	private append(text: string): void {
		this.outputService.getChannel(VOID_ENGINE_OUTPUT_CHANNEL_ID)?.append(text);
	}
}

registerWorkbenchContribution2(
	VoidRuntimeOutputContribution.ID,
	VoidRuntimeOutputContribution,
	WorkbenchPhase.BlockRestore
);

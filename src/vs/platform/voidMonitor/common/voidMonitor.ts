/*---------------------------------------------------------------------------------------------
 *  Void Monitor Types
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IVoidMonitorService = createDecorator<IVoidMonitorService>('voidMonitorService');

export interface IVoidMonitorService {
	readonly _serviceBrand: undefined;
	show(): void;
	hide(): void;
	log(source: 'deepseek' | 'system', message: string): void;
}

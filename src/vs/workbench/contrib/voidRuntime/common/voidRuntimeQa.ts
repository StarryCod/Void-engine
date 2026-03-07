/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IVoidPotentialListenerLeak } from './voidRuntimeService.js';

export function detectPotentialListenerLeak(args: readonly unknown[]): IVoidPotentialListenerLeak | undefined {
	const message = args.map(arg => stringifyConsoleArg(arg)).join(' ').trim();
	if (!/potential listener leak detected/i.test(message)) {
		return undefined;
	}

	const countMatch = message.match(/having\s+(\d+)\s+listeners/i);
	const listenerCount = countMatch ? Number(countMatch[1]) : 0;
	const stack = args.find((arg): arg is string => typeof arg === 'string' && /at\s+\S+/.test(arg));

	return {
		listenerCount: Number.isFinite(listenerCount) ? listenerCount : 0,
		message,
		stack
	};
}

function stringifyConsoleArg(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}
	if (value instanceof Error) {
		return `${value.message}${value.stack ? ` ${value.stack}` : ''}`;
	}
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

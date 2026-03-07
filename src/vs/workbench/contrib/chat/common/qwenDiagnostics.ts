/*---------------------------------------------------------------------------------------------
 *  Qwen IPC diagnostics normalization
 *--------------------------------------------------------------------------------------------*/

export interface IQwenFailureDiagnosis {
	readonly code?: number;
	readonly raw: string;
	readonly scriptPath?: string;
	readonly cwd?: string;
	readonly title: string;
	readonly summary: string;
	readonly hints: readonly string[];
}

function extractMatch(input: string, expression: RegExp): string | undefined {
	const match = expression.exec(input);
	return match?.[1]?.trim() || undefined;
}

export function diagnoseQwenFailure(raw: string): IQwenFailureDiagnosis {
	const normalized = String(raw ?? '').trim();
	const lower = normalized.toLowerCase();
	const code = Number(extractMatch(normalized, /process exited with code (\d+)/i));
	const scriptPath = extractMatch(normalized, /script:\s*([^,)]+)/i)
		|| extractMatch(normalized, /script file does not exist:\s*(.+)$/i);
	const cwd = extractMatch(normalized, /cwd:\s*([^,)]+)/i);
	const hints: string[] = [];

	if (scriptPath) {
		hints.push(`Check AI bridge script path: ${scriptPath}`);
	}

	if (cwd) {
		hints.push(`Check project working directory: ${cwd}`);
	}

	if (lower.includes('script file does not exist')) {
		hints.push('The Qwen bridge script is missing. Restore qwen-code-clean/void-ai-chat.js or fix VOID_QWEN_SCRIPT.');
	}

	if (lower.includes('cannot find module')) {
		hints.push('Node failed to resolve a module required by the Qwen bridge. Verify dependencies and script path.');
	}

	if (lower.includes('spawn enoent')) {
		hints.push('Node could not be spawned. Verify that Node is installed and reachable from the current environment.');
	}

	if (lower.includes('workspace path does not exist')) {
		hints.push('The workspace path is invalid. Re-open a real project folder and retry.');
	}

	if (lower.includes('no stderr/stdout diagnostics')) {
		hints.push('The bridge exited before producing JSON events. This usually means an early crash or invalid working directory.');
	}

	if (!hints.length && Number.isFinite(code) && code === 1) {
		hints.push('The Qwen bridge exited with code 1. Start with the script path, cwd, and payload size.');
	}

	return {
		code: Number.isFinite(code) ? code : undefined,
		raw: normalized,
		scriptPath,
		cwd,
		title: Number.isFinite(code) && code === 1 ? 'Qwen IPC failed with exit code 1' : 'Qwen IPC request failed',
		summary: normalized || 'Unknown Qwen IPC failure.',
		hints
	};
}

export function formatQwenFailureForUser(raw: string): string {
	const diagnosis = diagnoseQwenFailure(raw);
	const lines = [
		diagnosis.title,
		`Reason: ${diagnosis.summary}`,
	];

	if (diagnosis.hints.length) {
		lines.push('What to check:');
		for (const hint of diagnosis.hints) {
			lines.push(`- ${hint}`);
		}
	}

	return lines.join('\n');
}

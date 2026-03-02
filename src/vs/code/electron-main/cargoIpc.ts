/*---------------------------------------------------------------------------------------------
 *  Void Engine - Cargo IPC Handler
 *  Handles cargo build/run operations in main process
 *--------------------------------------------------------------------------------------------*/

import { ipcMain } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

let gameProcesses = new Map<number, ChildProcess>();
let lastBuildHashes = new Map<string, string>(); // workspace -> hash

/**
 * Calculate hash of all Rust source files in workspace
 */
function calculateProjectHash(workspacePath: string): string {
	const hasher = crypto.createHash('sha256');
	const srcPath = path.join(workspacePath, 'src');
	const cargoTomlPath = path.join(workspacePath, 'Cargo.toml');
	
	try {
		// Hash Cargo.toml
		if (fs.existsSync(cargoTomlPath)) {
			const cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
			hasher.update(cargoContent);
		}
		
		// Hash all .rs files in src/
		if (fs.existsSync(srcPath)) {
			const walkDir = (dir: string) => {
				const files = fs.readdirSync(dir);
				files.forEach(file => {
					const filePath = path.join(dir, file);
					const stat = fs.statSync(filePath);
					
					if (stat.isDirectory()) {
						walkDir(filePath);
					} else if (file.endsWith('.rs')) {
						const content = fs.readFileSync(filePath, 'utf8');
						hasher.update(content);
					}
				});
			};
			
			walkDir(srcPath);
		}
		
		return hasher.digest('hex');
	} catch (error) {
		console.error('[Cargo IPC] Error calculating hash:', error);
		return Date.now().toString(); // Fallback to timestamp
	}
}

/**
 * Check if project needs rebuild
 */
function needsRebuild(workspacePath: string): boolean {
	const currentHash = calculateProjectHash(workspacePath);
	const lastHash = lastBuildHashes.get(workspacePath);
	
	if (!lastHash) {
		console.log('[Cargo IPC] First build, no cache');
		return true;
	}
	
	if (currentHash !== lastHash) {
		console.log('[Cargo IPC] Files changed, rebuild needed');
		return true;
	}
	
	// Check if target/debug/executable exists
	const targetPath = path.join(workspacePath, 'target', 'debug');
	if (!fs.existsSync(targetPath)) {
		console.log('[Cargo IPC] No build artifacts, rebuild needed');
		return true;
	}
	
	console.log('[Cargo IPC] No changes detected, skipping rebuild');
	return false;
}

export function setupCargoIPC(): void {
	// Check cargo availability
	ipcMain.handle('vscode:cargo-check-available', async () => {
		return new Promise((resolve) => {
			const proc = spawn('cargo', ['--version'], { shell: true });
			
			proc.on('close', (code) => {
				resolve(code === 0);
			});
			
			proc.on('error', () => {
				resolve(false);
			});
		});
	});

	// F5: cargo run (debug mode for faster compilation)
	ipcMain.handle('vscode:cargo-run-release', async (event, { windowId, workspacePath }) => {
		console.log(`[Cargo IPC] cargo run (debug) for window ${windowId}:`, workspacePath);

		// Check if rebuild is needed
		if (!needsRebuild(workspacePath)) {
			// Just run the existing binary
			event.sender.send('vscode:cargo-build-progress', {
				stage: 'finished',
				message: 'No changes detected, running cached build...',
				progress: 100
			});
			
			// Find and run the executable directly
			const targetPath = path.join(workspacePath, 'target', 'debug');
			const packageName = path.basename(workspacePath).replace(/-/g, '_');
			const exePath = path.join(targetPath, process.platform === 'win32' ? `${packageName}.exe` : packageName);
			
			if (fs.existsSync(exePath)) {
				const gameProc = spawn(exePath, [], {
					cwd: workspacePath,
					shell: true
				});
				
				gameProcesses.set(windowId, gameProc);
				
				gameProc.on('close', (code) => {
					gameProcesses.delete(windowId);
					console.log(`[Cargo IPC] Game exited: ${code}`);
				});
				
				return { success: true, cached: true };
			}
		}

		// Stop any existing process for this window
		const existing = gameProcesses.get(windowId);
		if (existing) {
			existing.kill();
			gameProcesses.delete(windowId);
		}

		return new Promise((resolve) => {
			const cargoProc = spawn('cargo', ['run'], {
				cwd: workspacePath,
				shell: true
			});

			gameProcesses.set(windowId, cargoProc);

			let totalCrates = 0;
			let completedCrates = 0;

			cargoProc.stdout?.on('data', (data: Buffer) => {
				const text = data.toString();
				console.log(`[Cargo] ${text}`);

				event.sender.send('vscode:cargo-build-progress', {
					stage: 'compiling',
					message: text.trim(),
					progress: 0
				});

				const compilingMatch = text.match(/Compiling\s+(\S+)/);
				if (compilingMatch) {
					completedCrates++;
					const crateName = compilingMatch[1];
					
					if (totalCrates === 0) {
						totalCrates = 80;
					}

					const progress = Math.min(95, (completedCrates / totalCrates) * 100);

					event.sender.send('vscode:cargo-build-progress', {
						stage: 'compiling',
						message: `Compiling ${crateName}...`,
						progress,
						currentCrate: crateName,
						totalCrates,
						completedCrates
					});
				}

				if (text.includes('Finished')) {
					// Save hash after successful build
					const hash = calculateProjectHash(workspacePath);
					lastBuildHashes.set(workspacePath, hash);
					
					event.sender.send('vscode:cargo-build-progress', {
						stage: 'finished',
						message: 'Build complete, starting game...',
						progress: 100
					});
				}
				
				if (text.includes('Running')) {
					event.sender.send('vscode:cargo-build-progress', {
						stage: 'running',
						message: 'Game is running',
						progress: 100
					});
				}
			});

			cargoProc.stderr?.on('data', (data: Buffer) => {
				const text = data.toString();
				console.error(`[Cargo Error] ${text}`);
				
				// Send all stderr to terminal
				event.sender.send('vscode:cargo-build-progress', {
					stage: 'compiling',
					message: text.trim(),
					progress: 0
				});
				
				// Cargo outputs compilation info to stderr too
				if (text.includes('Compiling') || text.includes('Finished')) {
					cargoProc.stdout?.emit('data', data);
				}
			});

			cargoProc.on('close', (code) => {
				gameProcesses.delete(windowId);
				console.log(`[Cargo IPC] Process exited: ${code}`);
				
				event.sender.send('vscode:cargo-build-progress', {
					stage: code === 0 ? 'finished' : 'error',
					message: code === 0 ? 'Process completed' : `Process exited with code ${code}`,
					progress: code === 0 ? 100 : 0
				});
				
				resolve({ success: code === 0 });
			});

			cargoProc.on('error', (error) => {
				gameProcesses.delete(windowId);
				event.sender.send('vscode:cargo-build-progress', {
					stage: 'error',
					message: `Error: ${error.message}`,
					progress: 0
				});
				console.error('[Cargo IPC] Error:', error);
				resolve({ success: false, error: error.message });
			});
		});
	});

	// F6: cargo watch
	ipcMain.handle('vscode:cargo-watch', async (event, { windowId, workspacePath }) => {
		console.log(`[Cargo IPC] cargo watch for window ${windowId}:`, workspacePath);

		// Stop any existing process for this window
		const existing = gameProcesses.get(windowId);
		if (existing) {
			existing.kill();
			gameProcesses.delete(windowId);
		}

		return new Promise((resolve) => {
			const watchProc = spawn('cargo', ['watch', '-x', 'run'], {
				cwd: workspacePath,
				shell: true
			});

			gameProcesses.set(windowId, watchProc);

			let settled = false;
			const resolveOnce = (result: { success: boolean; error?: string }) => {
				if (!settled) {
					settled = true;
					resolve(result);
				}
			};

			watchProc.once('spawn', () => {
				event.sender.send('vscode:cargo-build-progress', {
					stage: 'finished',
					message: 'Cargo watch started',
					progress: 100
				});
				resolveOnce({ success: true });
			});

			watchProc.stdout?.on('data', (data: Buffer) => {
				const text = data.toString();
				console.log(`[Cargo Watch] ${text}`);
			});

			watchProc.stderr?.on('data', (data: Buffer) => {
				const text = data.toString();
				console.error(`[Cargo Watch] ${text}`);
			});

			watchProc.on('close', (code) => {
				gameProcesses.delete(windowId);
				console.log(`[Cargo IPC] cargo watch exited with code ${code}`);
				if (code !== 0) {
					event.sender.send('vscode:cargo-build-progress', {
						stage: 'error',
						message: `cargo watch exited with code ${code}`,
						progress: 0
					});
				}
				resolveOnce({
					success: code === 0,
					error: code === 0 ? undefined : `cargo watch exited with code ${code}`
				});
			});

			watchProc.on('error', (error) => {
				gameProcesses.delete(windowId);
				event.sender.send('vscode:cargo-build-progress', {
					stage: 'error',
					message: `Error: ${error.message}`,
					progress: 0
				});
				console.error('[Cargo IPC] Watch error:', error);
				resolveOnce({ success: false, error: error.message });
			});
		});
	});

	// Stop game
	ipcMain.handle('vscode:cargo-stop', async (_event, { windowId }) => {
		const gameProc = gameProcesses.get(windowId);
		if (gameProc) {
			gameProc.kill();
			gameProcesses.delete(windowId);
			console.log(`[Cargo IPC] Game stopped for window ${windowId}`);
		}

		return { success: true };
	});

	// Cleanup on window close
	ipcMain.on('vscode:cargo-cleanup', (_event, { windowId }) => {
		console.log(`[Cargo IPC] Cleanup for window ${windowId}`);
		
		const gameProc = gameProcesses.get(windowId);
		if (gameProc) {
			gameProc.kill();
			gameProcesses.delete(windowId);
		}
	});
}

/*---------------------------------------------------------------------------------------------
 *  Void Engine - Game Viewport Preload Script
 *  Exposes safe IPC methods to renderer process
 *--------------------------------------------------------------------------------------------*/

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
	// Window controls
	minimizeWindow: () => ipcRenderer.invoke('vscode:void-window-minimize'),
	maximizeWindow: () => ipcRenderer.invoke('vscode:void-window-maximize'),
	closeWindow: () => ipcRenderer.invoke('vscode:void-window-close'),
	
	// Game output listener
	onGameOutput: (callback: (data: string) => void) => {
		ipcRenderer.on('game-output', (_event: Electron.IpcRendererEvent, data: string) => callback(data));
	},
	
	// Compilation progress listener
	onCompilationProgress: (callback: (progress: { stage: string; message: string; progress: number }) => void) => {
		ipcRenderer.on('compilation-progress', (_event: Electron.IpcRendererEvent, progress: { stage: string; message: string; progress: number }) => callback(progress));
	}
});

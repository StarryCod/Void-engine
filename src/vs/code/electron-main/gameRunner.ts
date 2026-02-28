/*---------------------------------------------------------------------------------------------
 *  Void Engine IDE - Game Runner IPC Handler
 *  Creates separate frameless window for game viewport
 *--------------------------------------------------------------------------------------------*/

import { ipcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';

let gameProcesses: Map<number, ChildProcess> = new Map();
let gameWindows: Map<number, BrowserWindow> = new Map();
let processIdCounter = 0;

export function setupGameRunnerIPC(): void {
	// Create game viewport window
	ipcMain.handle('vscode:void-create-game-window', async (event, { workspacePath }) => {
		console.log('[Game Runner IPC] Creating game window for:', workspacePath);
		
		const processId = ++processIdCounter;
		const parentWindow = BrowserWindow.fromWebContents(event.sender);
		
		if (!parentWindow) {
			return { success: false, error: 'No parent window' };
		}

		// Создаем frameless окно (меньше размер, центрируем)
		const gameWindow = new BrowserWindow({
			width: 900,
			height: 700,
			frame: false,
			transparent: false,
			backgroundColor: '#1a1a1a',
			center: true,
			parent: parentWindow,
			modal: false,
			show: true,
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				sandbox: false,
				preload: __dirname + '/gameViewportPreload.js'
			}
		});

		// Загружаем полный UI с кастомным titlebar
		const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Void Game Runner</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e1e1e 0%, #1a1a1a 50%, #181818 100%);
            color: #fff;
            overflow: hidden;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .titlebar {
            height: 40px;
            background: linear-gradient(180deg, #2d2d2d 0%, #262626 50%, #252525 100%);
            border-bottom: 1px solid #404040;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 15px;
            -webkit-app-region: drag;
            user-select: none;
        }
        .titlebar-left { display: flex; align-items: center; gap: 15px; }
        .titlebar-title { font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.85); }
        .titlebar-tabs { display: flex; gap: 5px; -webkit-app-region: no-drag; }
        .titlebar-tab {
            padding: 6px 16px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 4px;
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .titlebar-tab:hover {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(255, 255, 255, 0.15);
            color: rgba(255, 255, 255, 0.95);
        }
        .titlebar-tab.active {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.25);
            color: #ffffff;
        }
        .titlebar-controls { display: flex; gap: 8px; -webkit-app-region: no-drag; }
        .titlebar-button {
            width: 32px; height: 32px;
            display: flex; align-items: center; justify-content: center;
            background: transparent; border: none; border-radius: 4px;
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            transition: all 0.2s;
        }
        .titlebar-button:hover { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.95); }
        .titlebar-button.close:hover { background: #e81123; color: #fff; }
        .content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .viewport-container { flex: 1; background: #000; position: relative; display: none; }
        .viewport-container.active { display: flex; }
        .terminal-container {
            flex: 1;
            background: linear-gradient(135deg, #0a0a0a 0%, #121212 100%);
            padding: 20px;
            overflow-y: auto;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            display: none;
            scroll-behavior: smooth;
        }
        .terminal-container.active { display: block; }
        .terminal-container::-webkit-scrollbar { width: 12px; }
        .terminal-container::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 6px;
            margin: 4px;
        }
        .terminal-container::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #ff8c00 0%, #ff6600 100%);
            border-radius: 6px;
            border: 2px solid rgba(0, 0, 0, 0.3);
        }
        .terminal-container::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, #ffa500 0%, #ff7700 100%);
        }
        .terminal-output { display: flex; flex-direction: column; gap: 6px; user-select: text; }
        .terminal-line {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.85);
            line-height: 1.8;
            padding: 4px 0;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .terminal-line.success { color: rgba(100, 255, 150, 0.95); }
        .terminal-line.error { color: rgba(255, 107, 107, 0.95); }
        .compilation-scene {
            width: 100%; height: 100%;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: radial-gradient(ellipse at center, #1a1a1a 0%, #0f0f0f 50%, #0a0a0a 100%);
            position: relative;
        }
        .fireplace-container {
            position: relative;
            width: 280px;
            height: 200px;
            margin-bottom: 30px;
        }
        .fireplace {
            width: 100%;
            height: 100%;
            background: linear-gradient(180deg, #2a1810 0%, #1a0f08 100%);
            border-radius: 8px 8px 0 0;
            position: relative;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
        }
        .fire {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 180px;
            height: 120px;
        }
        .flame {
            position: absolute;
            bottom: 0;
            width: 60px;
            height: 80px;
            background: linear-gradient(180deg, #ff6600 0%, #ff9933 30%, #ffcc00 60%, transparent 100%);
            border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
            animation: flicker 0.8s ease-in-out infinite;
            filter: blur(2px);
        }
        .flame:nth-child(1) { left: 30px; animation-delay: 0s; }
        .flame:nth-child(2) { left: 60px; height: 100px; animation-delay: 0.2s; }
        .flame:nth-child(3) { left: 90px; animation-delay: 0.4s; }
        @keyframes flicker {
            0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.9; }
            50% { transform: scaleY(1.15) scaleX(0.95); opacity: 1; }
        }
        .logs {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            width: 160px;
            height: 30px;
        }
        .log {
            position: absolute;
            width: 80px;
            height: 18px;
            background: linear-gradient(90deg, #6d3b21 0%, #8b5a3c 50%, #6d3b21 100%);
            border-radius: 10px;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        .log:nth-child(1) { left: 10px; bottom: 0; transform: rotate(-15deg); }
        .log:nth-child(2) { left: 50px; bottom: 5px; transform: rotate(10deg); }
        .log:nth-child(3) { left: 30px; bottom: 15px; transform: rotate(-5deg); }
        .compilation-text { 
            font-size: 28px; 
            font-weight: 700; 
            color: rgba(255, 255, 255, 0.95); 
            text-align: center;
            margin-bottom: 8px;
            text-shadow: 0 2px 8px rgba(255, 102, 0, 0.3);
        }
        .compilation-status { 
            font-size: 16px; 
            color: rgba(255, 255, 255, 0.7); 
            margin-bottom: 20px;
            font-style: italic;
        }
        .progress-bar {
            width: 320px; height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #ff8c00, #ff6600, #ff8c00);
            background-size: 200% 100%;
            width: 0%;
            transition: width 0.3s ease;
            animation: shimmer 2s linear infinite;
        }
        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
    </style>
</head>
<body>
    <div class="titlebar">
        <div class="titlebar-left">
            <div class="titlebar-title">🎮 Void Game Runner</div>
            <div class="titlebar-tabs">
                <button class="titlebar-tab active" data-tab="viewport">Viewport</button>
                <button class="titlebar-tab" data-tab="terminal">Terminal</button>
            </div>
        </div>
        <div class="titlebar-controls">
            <button class="titlebar-button minimize" title="Minimize">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M0 6h12" stroke="currentColor" stroke-width="1"/>
                </svg>
            </button>
            <button class="titlebar-button maximize" title="Maximize">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="1" y="1" width="10" height="10" stroke="currentColor" stroke-width="1" fill="none"/>
                </svg>
            </button>
            <button class="titlebar-button close" title="Close">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5"/>
                </svg>
            </button>
        </div>
    </div>
    <div class="content">
        <div class="viewport-container active">
            <div class="compilation-scene">
                <div class="fireplace-container">
                    <div class="fireplace">
                        <div class="fire">
                            <div class="flame"></div>
                            <div class="flame"></div>
                            <div class="flame"></div>
                        </div>
                        <div class="logs">
                            <div class="log"></div>
                            <div class="log"></div>
                            <div class="log"></div>
                        </div>
                    </div>
                </div>
                <div class="compilation-text">🔥 Запекаем вашу игру...</div>
                <div class="compilation-status">Starting build...</div>
                <div class="progress-bar"><div class="progress-fill"></div></div>
            </div>
        </div>
        <div class="terminal-container">
            <div class="terminal-output">
                <div class="terminal-line">[Void Engine] Initializing...</div>
            </div>
        </div>
    </div>
    <script>
        // Tab switching
        document.querySelectorAll('.titlebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                document.querySelectorAll('.titlebar-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.viewport-container, .terminal-container').forEach(c => c.classList.remove('active'));
                document.querySelector('.' + targetTab + '-container').classList.add('active');
            });
        });
        
        // Window controls
        document.querySelector('.minimize').addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });
        document.querySelector('.maximize').addEventListener('click', () => {
            window.electronAPI.maximizeWindow();
        });
        document.querySelector('.close').addEventListener('click', () => {
            window.electronAPI.closeWindow();
        });
        
        // Game output listener
        window.electronAPI.onGameOutput((data) => {
            const terminalOutput = document.querySelector('.terminal-output');
            const line = document.createElement('div');
            line.className = 'terminal-line';
            if (data.type === 'stderr') {
                line.classList.add('error');
            } else if (data.type === 'exit') {
                line.classList.add(data.data === 0 ? 'success' : 'error');
                line.textContent = '[Process exited with code ' + data.data + ']';
            } else {
                line.textContent = data.data;
            }
            terminalOutput.appendChild(line);
            document.querySelector('.terminal-container').scrollTop = document.querySelector('.terminal-container').scrollHeight;
        });
        
        // Compilation progress listener
        const funnyMessages = [
            'Разогреваем духовку...',
            'Добавляем специи...',
            'Запекаем с любовью...',
            'Проверяем готовность...',
            'Почти готово...',
            'Подрумяниваем корочку...',
            'Доводим до совершенства...'
        ];
        let lastMessageIndex = -1;
        
        window.electronAPI.onCompilationProgress((progress) => {
            document.querySelector('.progress-fill').style.width = progress.progress + '%';
            
            // Меняем забавные сообщения каждые 15%
            const messageIndex = Math.floor(progress.progress / 15);
            if (messageIndex !== lastMessageIndex && messageIndex < funnyMessages.length) {
                document.querySelector('.compilation-text').textContent = '🔥 ' + funnyMessages[messageIndex];
                lastMessageIndex = messageIndex;
            }
            
            document.querySelector('.compilation-status').textContent = progress.message;
            
            // Скрываем камин когда компиляция завершена (100%)
            if (progress.progress >= 100) {
                setTimeout(() => {
                    document.querySelector('.compilation-scene').style.display = 'none';
                }, 1000);
            }
        });
    </script>
</body>
</html>
		`;
		
		gameWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
		
		console.log('[Game Runner] Game window created and shown');

		// Обработка закрытия
		gameWindow.on('closed', () => {
			console.log('[Game Runner] Game window closed');
			// Останавливаем процесс игры если был запущен
			const gameProcess = gameProcesses.get(processId);
			if (gameProcess && !gameProcess.killed) {
				gameProcess.kill();
				gameProcesses.delete(processId);
			}
			gameWindows.delete(processId);
		});

		gameWindows.set(processId, gameWindow);

		return { processId, success: true };
	});

	// Forward compilation progress to game window
	ipcMain.handle('vscode:void-forward-progress', async (event, { processId, progress }) => {
		const gameWindow = gameWindows.get(processId);
		if (gameWindow && !gameWindow.isDestroyed()) {
			gameWindow.webContents.send('compilation-progress', progress);
			return { success: true };
		}
		return { success: false, error: 'Game window not found' };
	});

	// Launch game in the window
	ipcMain.handle('vscode:void-launch-game', async (event, { processId, exePath, workspacePath }) => {
		console.log('[Game Runner IPC] Launch game:', exePath);
		
		const gameWindow = gameWindows.get(processId);
		if (!gameWindow) {
			return { success: false, error: 'Game window not found' };
		}

		// Запускаем игру
		console.log('[Game Runner] Starting process:', exePath);
		const gameProcess = spawn(exePath, [], {
			cwd: workspacePath,
			stdio: ['pipe', 'pipe', 'pipe']
		});

		// Отправляем вывод в game window
		gameProcess.stdout?.on('data', (data: Buffer) => {
			const text = data.toString();
			gameWindow.webContents.send('game-output', { type: 'stdout', data: text });
		});

		gameProcess.stderr?.on('data', (data: Buffer) => {
			const text = data.toString();
			gameWindow.webContents.send('game-output', { type: 'stderr', data: text });
		});

		gameProcess.on('exit', (code) => {
			console.log('[Game Runner] Process exited:', code);
			gameWindow.webContents.send('game-output', { type: 'exit', data: code });
			gameProcesses.delete(processId);
		});

		gameProcess.on('error', (error) => {
			console.error('[Game Runner] Process error:', error);
			gameWindow.webContents.send('game-output', { type: 'error', data: error.message });
		});

		gameProcesses.set(processId, gameProcess);

		return { success: true };
	});
	
	// Stop game process
	ipcMain.handle('vscode:void-stop-game', async (event, { processId }) => {
		const gameProcess = gameProcesses.get(processId);
		if (gameProcess && !gameProcess.killed) {
			gameProcess.kill();
			gameProcesses.delete(processId);
			return { success: true };
		}
		return { success: false, error: 'Process not found' };
	});

	// Close game window
	ipcMain.handle('vscode:void-close-game-window', async (event, { processId }) => {
		const gameWindow = gameWindows.get(processId);
		if (gameWindow && !gameWindow.isDestroyed()) {
			gameWindow.close();
			return { success: true };
		}
		return { success: false, error: 'Window not found' };
	});

	// Window controls (minimize, maximize, close)
	ipcMain.handle('vscode:void-window-minimize', async (event) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		window?.minimize();
	});

	ipcMain.handle('vscode:void-window-maximize', async (event) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (window?.isMaximized()) {
			window.unmaximize();
		} else {
			window?.maximize();
		}
	});

	ipcMain.handle('vscode:void-window-close', async (event) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		window?.close();
	});
}

/*---------------------------------------------------------------------------------------------
 *  Void AI Monitor Window - DeepSeek monitoring
 *--------------------------------------------------------------------------------------------*/

import { BrowserWindow } from 'electron';
import { Disposable } from '../../../base/common/lifecycle.js';
import { Emitter } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';

export const IMonitorWindowService = createDecorator<IMonitorWindowService>('monitorWindowService');

export interface IMonitorWindowService {
	readonly _serviceBrand: undefined;
	show(): void;
	hide(): void;
	addLog(source: 'deepseek' | 'system', message: string): void;
}

export class MonitorWindowService extends Disposable implements IMonitorWindowService {
	declare readonly _serviceBrand: undefined;

	private window: BrowserWindow | undefined;
	private logs: { source: string; message: string; time: string }[] = [];

	private readonly _onDidClose = this._register(new Emitter<void>());

	constructor(@ILogService private readonly logService: ILogService) {
		super();
	}

	show(): void {
		if (this.window) {
			this.window.show();
			this.window.focus();
			return;
		}
		this.createWindow();
	}

	hide(): void {
		this.window?.hide();
	}

	private createWindow(): void {
		this.window = new BrowserWindow({
			width: 800,
			height: 600,
			backgroundColor: '#1a1a1a',
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
			},
			title: 'Void AI Monitor'
		});

		this.window.on('closed', () => {
			this.window = undefined;
			this._onDidClose.fire();
		});

		this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(this.getHTML())}`);
		this.logService.info('[Monitor] Window created');
	}

	addLog(source: 'deepseek' | 'system', message: string): void {
		const time = new Date().toLocaleTimeString();
		this.logs.push({ source, message, time });
		if (this.logs.length > 500) {
			this.logs = this.logs.slice(-500);
		}
		this.updateLogs();
	}

	private updateLogs(): void {
		if (!this.window) return;
		const logsHtml = this.logs.map(log => {
			const color = log.source === 'deepseek' ? '#4fc3f7' : '#ffb74d';
			return `<div class="log"><span class="time">${log.time}</span><span class="src" style="color:${color}">[${log.source}]</span>${this.escape(log.message)}</div>`;
		}).join('');
		this.window.webContents.executeJavaScript(`document.getElementById('logs').innerHTML=\`${logsHtml.replace(/`/g, '\\`')}\`;document.getElementById('logs').scrollTop=999999;`).catch(() => {});
	}

	private escape(t: string): string {
		return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	private getHTML(): string {
		return `<!DOCTYPE html><html><head><style>
body{background:#1a1a1a;color:#e0e0e0;font-family:Consolas,monospace;margin:0;padding:16px}
.log{padding:4px 0;border-bottom:1px solid #333;font-size:12px}
.time{color:#666;margin-right:8px}
.src{font-weight:600;margin-right:8px}
#logs{height:calc(100vh - 32px);overflow:auto}
</style></head><body><div id="logs"></div></body></html>`;
	}

	override dispose(): void {
		this.window?.close();
		super.dispose();
	}
}

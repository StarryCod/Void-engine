/*---------------------------------------------------------------------------------------------
 *  Void AI Monitor - Simple log window
 *--------------------------------------------------------------------------------------------*/

import { BrowserWindow } from 'electron';
import { Disposable } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';

export const IVoidMonitorService = createDecorator<IVoidMonitorService>('voidMonitorService');

export interface IVoidMonitorService {
	readonly _serviceBrand: undefined;
	show(): void;
	hide(): void;
	log(source: 'deepseek' | 'system', message: string): void;
}

export class VoidMonitorService extends Disposable implements IVoidMonitorService {
	declare readonly _serviceBrand: undefined;

	private window: BrowserWindow | undefined;
	private logs: string[] = [];

	constructor(@ILogService private readonly logService: ILogService) {
		super();
	}

	show(): void {
		if (this.window && !this.window.isDestroyed()) {
			this.window.show();
			return;
		}
		this.createWindow();
	}

	hide(): void {
		this.window?.hide();
	}

	private createWindow(): void {
		this.window = new BrowserWindow({
			width: 600, height: 400,
			backgroundColor: '#1a1a1a',
			webPreferences: { nodeIntegration: false, contextIsolation: true },
			title: 'Void Monitor'
		});
		this.window.on('closed', () => { this.window = undefined; });
		this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(this.getHTML())}`);
		this.logService.info('[VoidMonitor] Window created');
	}

	log(source: 'deepseek' | 'system', message: string): void {
		const time = new Date().toLocaleTimeString();
		const color = source === 'deepseek' ? '#4fc3f7' : '#ffb74d';
		const escaped = message.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 200);
		this.logs.push(`<div><span style="color:#666">${time}</span> <span style="color:${color}">[${source}]</span> ${escaped}</div>`);
		if (this.logs.length > 200) this.logs = this.logs.slice(-200);
		this.updateLogs();
	}

	private updateLogs(): void {
		if (!this.window || this.window.isDestroyed()) return;
		const html = this.logs.join('');
		this.window.webContents.executeJavaScript(`document.getElementById('logs').innerHTML=\`${html.replace(/`/g, '\\`')}\`;document.getElementById('logs').scrollTop=999999;`).catch(() => {});
	}

	private getHTML(): string {
		return `<!DOCTYPE html><html><head><style>
body{background:#1a1a1a;color:#e0e0e0;font-family:Consolas,monospace;margin:0;padding:12px;font-size:11px}
#logs{height:calc(100vh - 24px);overflow:auto}
#logs div{padding:2px 0;border-bottom:1px solid #222}
</style></head><body><div id="logs"></div></body></html>`;
	}

	override dispose(): void {
		this.window?.close();
		super.dispose();
	}
}

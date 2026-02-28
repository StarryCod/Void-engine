/*---------------------------------------------------------------------------------------------
 *  Viewport 3D - WebSocket client for Bevy rendering
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import * as DOM from '../../../../base/browser/dom.js';

export interface IViewport3DOptions {
	container: HTMLElement;
	width?: number;
	height?: number;
	onConnected?: () => void;
	onDisconnected?: () => void;
	onError?: (error: string) => void;
}

interface FrameData {
	type: 'frame';
	data: {
		width: number;
		height: number;
		format: 'rgba' | 'png_base64';
		frame_count: number;
		pixels: string; // base64 encoded
	};
}

export class Viewport3D extends Disposable {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private ws: WebSocket | null = null;
	private connected = false;
	private frameCount = 0;
	private lastFrameTime = 0;
	private fps = 0;
	
	private statusElement: HTMLElement;
	private fpsElement: HTMLElement;

	constructor(private options: IViewport3DOptions) {
		super();

		// Create canvas
		this.canvas = DOM.append(options.container, DOM.$('canvas.viewport-canvas'));
		this.canvas.width = options.width || 1280;
		this.canvas.height = options.height || 720;
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';
		this.canvas.style.objectFit = 'contain';
		this.canvas.style.backgroundColor = '#1e1e1e';

		const ctx = this.canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Failed to get 2D context');
		}
		this.ctx = ctx;

		// Create status overlay
		const overlay = DOM.append(options.container, DOM.$('.viewport-overlay'));
		overlay.style.position = 'absolute';
		overlay.style.top = '8px';
		overlay.style.left = '8px';
		overlay.style.padding = '8px 12px';
		overlay.style.background = 'rgba(0, 0, 0, 0.7)';
		overlay.style.borderRadius = '4px';
		overlay.style.color = '#fff';
		overlay.style.fontSize = '12px';
		overlay.style.fontFamily = 'monospace';
		overlay.style.pointerEvents = 'none';
		overlay.style.zIndex = '1000';

		this.statusElement = DOM.append(overlay, DOM.$('div.status'));
		this.statusElement.textContent = '🔌 Connecting to Bevy...';

		this.fpsElement = DOM.append(overlay, DOM.$('div.fps'));
		this.fpsElement.style.marginTop = '4px';
		this.fpsElement.textContent = 'FPS: 0';

		// Connect to WebSocket
		this.connect();
	}

	private connect(): void {
		try {
			this.ws = new WebSocket('ws://localhost:9002');

			this.ws.onopen = () => {
				this.connected = true;
				this.statusElement.textContent = '✅ Connected to Bevy';
				this.statusElement.style.color = '#4ec9b0';
				console.log('[Viewport3D] Connected to Bevy WebSocket');
				this.options.onConnected?.();
			};

			this.ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);
					this.handleMessage(message);
				} catch (err) {
					console.error('[Viewport3D] Failed to parse message:', err);
				}
			};

			this.ws.onerror = (error) => {
				console.error('[Viewport3D] WebSocket error:', error);
				this.statusElement.textContent = '❌ Connection error';
				this.statusElement.style.color = '#f48771';
				this.options.onError?.('WebSocket error');
			};

			this.ws.onclose = () => {
				this.connected = false;
				this.statusElement.textContent = '🔌 Disconnected';
				this.statusElement.style.color = '#858585';
				console.log('[Viewport3D] Disconnected from Bevy');
				this.options.onDisconnected?.();

				// Try to reconnect after 2 seconds
				setTimeout(() => {
					if (!this.connected) {
						console.log('[Viewport3D] Attempting to reconnect...');
						this.connect();
					}
				}, 2000);
			};
		} catch (err) {
			console.error('[Viewport3D] Failed to create WebSocket:', err);
			this.statusElement.textContent = '❌ Failed to connect';
			this.statusElement.style.color = '#f48771';
		}
	}

	private handleMessage(message: any): void {
		switch (message.type) {
			case 'connected':
				console.log('[Viewport3D] Bevy ready:', message.data);
				break;

			case 'frame':
				this.renderFrame(message as FrameData);
				break;

			case 'pong':
				console.log('[Viewport3D] Pong:', message.data);
				break;

			default:
				console.log('[Viewport3D] Unknown message type:', message.type);
		}
	}

	private renderFrame(frameData: FrameData): void {
		try {
			const { width, height, pixels, frame_count } = frameData.data;

			// Decode base64 to binary
			const binaryString = atob(pixels);
			const bytes = new Uint8ClampedArray(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			// Create ImageData
			const imageData = new ImageData(bytes, width, height);

			// Resize canvas if needed
			if (this.canvas.width !== width || this.canvas.height !== height) {
				this.canvas.width = width;
				this.canvas.height = height;
			}

			// Draw to canvas
			this.ctx.putImageData(imageData, 0, 0);

			// Update FPS
			this.frameCount++;
			const now = performance.now();
			if (now - this.lastFrameTime >= 1000) {
				this.fps = Math.round(this.frameCount * 1000 / (now - this.lastFrameTime));
				this.fpsElement.textContent = `FPS: ${this.fps} | Frame: ${frame_count}`;
				this.frameCount = 0;
				this.lastFrameTime = now;
			}
		} catch (err) {
			console.error('[Viewport3D] Failed to render frame:', err);
		}
	}

	public sendMessage(message: any): void {
		if (this.ws && this.connected) {
			this.ws.send(JSON.stringify(message));
		}
	}

	public override dispose(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		super.dispose();
	}
}

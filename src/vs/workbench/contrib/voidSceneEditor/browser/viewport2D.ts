/*---------------------------------------------------------------------------------------------
 *  Void Scene Editor - 2D Viewport (Canvas с сеткой)
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { append } from '../../../../base/browser/dom.js';

export class Viewport2D extends Disposable {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private width: number = 0;
	private height: number = 0;

	constructor(parent: HTMLElement) {
		super();
		this.canvas = document.createElement('canvas');
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';
		this.canvas.style.display = 'block';
		this.canvas.style.background = '#212121';
		
		append(parent, this.canvas);
		
		const context = this.canvas.getContext('2d');
		if (!context) throw new Error('Failed to get 2d context');
		this.ctx = context;

		// Resize observer
		const observer = new ResizeObserver(() => this.resize());
		observer.observe(parent);
		
		// Initial draw
		setTimeout(() => this.resize(), 10);
	}

	private resize(): void {
		const parent = this.canvas.parentElement;
		if (parent) {
			this.width = parent.clientWidth;
			this.height = parent.clientHeight;
			
			// Handle DPI
			const dpr = window.devicePixelRatio || 1;
			this.canvas.width = this.width * dpr;
			this.canvas.height = this.height * dpr;
			this.ctx.scale(dpr, dpr);
			
			this.renderGrid();
		}
	}

	public renderGrid(): void {
		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);

		// Center origin
		const cx = Math.floor(this.width / 2);
		const cy = Math.floor(this.height / 2);

		// Draw Grid Lines
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
		ctx.lineWidth = 1;
		const gridSize = 50;

		// Vertical lines
		for (let x = cx % gridSize; x < this.width; x += gridSize) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, this.height);
			ctx.stroke();
		}

		// Horizontal lines
		for (let y = cy % gridSize; y < this.height; y += gridSize) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(this.width, y);
			ctx.stroke();
		}

		// Draw Axis (Godot style)
		ctx.lineWidth = 2;
		
		// X Axis (Red)
		ctx.strokeStyle = '#ff5f5f';
		ctx.beginPath();
		ctx.moveTo(0, cy);
		ctx.lineTo(this.width, cy);
		ctx.stroke();

		// Y Axis (Green)
		ctx.strokeStyle = '#5fff5f';
		ctx.beginPath();
		ctx.moveTo(cx, 0);
		ctx.lineTo(cx, this.height);
		ctx.stroke();
		
		// Draw dummy 2D Object (Player)
		ctx.fillStyle = '#478cbf';
		ctx.fillRect(cx + 50, cy - 50, 40, 40);
		ctx.strokeStyle = '#fff';
		ctx.strokeRect(cx + 50, cy - 50, 40, 40);
	}

	override dispose(): void {
		super.dispose();
	}
}

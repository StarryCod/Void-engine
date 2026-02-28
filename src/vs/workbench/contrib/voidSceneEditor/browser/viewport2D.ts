/*---------------------------------------------------------------------------------------------
 *  Void Engine — 2D Viewport (Canvas2D)
 *  Godot-style 2D scene editor
 *  Coordinate system: X→right, Y→down (screen coordinates)
 *  Render zone: 4th quadrant (positive X, positive Y from origin)
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR PALETTE (Same as 3D Viewport)
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = {
	// Background (same as 3D viewport)
	background: '#1a1a1e',
	
	// Grid
	gridLine: '#252528',
	gridLineMajor: '#2d2d32',
	
	// Axes
	axisX: '#ff6b6b',  // Red for X
	axisY: '#69db7c',  // Green for Y
	
	// Render zone (camera view)
	renderZone: 'rgba(74, 158, 255, 0.08)',
	renderZoneBorder: 'rgba(74, 158, 255, 0.5)',
	
	// Outside render zone (dimmed)
	outsideRender: 'rgba(0, 0, 0, 0.35)',
	
	// Objects
	objectBounds: '#888888',
	objectSelected: '#4a9eff',
	objectHovered: '#aaaaaa',
	collider: '#4caf50',
	
	// Gizmo
	gizmoHandle: '#ffffff',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Vec2 { x: number; y: number; }

interface Transform2D {
	position: [number, number];
	rotation: number;
	scale: [number, number];
}

interface SceneEntity2D {
	id: string;
	name: string;
	transform: Transform2D;
	sprite?: { size: [number, number] };
	collider?: { type: string; size: [number, number]; radius?: number };
	visible: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEWPORT 2D CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class Viewport2D extends Disposable {
	private container: HTMLElement;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	
	// Scene
	private entities: SceneEntity2D[] = [];
	private selectedIds: Set<string> = new Set();
	
	// Camera (pan & zoom)
	private cameraX: number = 0;
	private cameraY: number = 0;
	private zoom: number = 1;
	
	// Render zone size (what will be rendered)
	private renderWidth: number = 1152;
	private renderHeight: number = 648;
	
	// Interaction
	private isPanning: boolean = false;
	private isDragging: boolean = false;
	private lastMouse: Vec2 = { x: 0, y: 0 };
	private hoveredId: string | null = null;
	
	// Rendering
	private rafId: number | null = null;
	private isRunning: boolean = false;
	
	// Events
	private readonly _onEntitySelected = this._register(new Emitter<string | null>());
	public readonly onEntitySelected: Event<string | null> = this._onEntitySelected.event;
	
	private readonly _onTransformChanged = this._register(new Emitter<{ id: string; transform: Transform2D }>());
	public readonly onTransformChanged: Event<{ id: string; transform: Transform2D }> = this._onTransformChanged.event;
	
	constructor(parent: HTMLElement) {
		super();
		
		// Container
		this.container = document.createElement('div');
		this.container.className = 'void-viewport-2d';
		this.container.style.cssText = `
			width: 100%;
			height: 100%;
			position: relative;
			background: ${COLORS.background};
			overflow: hidden;
			outline: none;
		`;
		this.container.tabIndex = 0;
		
		// Canvas
		this.canvas = document.createElement('canvas');
		this.canvas.style.cssText = `width: 100%; height: 100%; display: block;`;
		this.container.appendChild(this.canvas);
		
		// Context
		const ctx = this.canvas.getContext('2d', { alpha: false });
		if (!ctx) throw new Error('Canvas 2D context failed');
		this.ctx = ctx;
		
		// Events
		this.setupEvents();
		
		// Append
		parent.appendChild(this.container);
		
		// Initial resize
		this.handleResize();
		
		// Start
		this.startRendering();
	}
	
	// ════════════════════════════════════════════════════════════════
	// PUBLIC API
	// ════════════════════════════════════════════════════════════════
	
	public loadScene(entities: SceneEntity2D[]): void {
		this.entities = entities;
	}
	
	public selectEntity(id: string | null): void {
		this.selectedIds.clear();
		if (id) this.selectedIds.add(id);
	}
	
	public resize(): void {
		this.handleResize();
	}
	
	public startRendering(): void {
		if (this.isRunning) return;
		this.isRunning = true;
		this.renderLoop();
	}
	
	public stopRendering(): void {
		this.isRunning = false;
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}
	
	// ════════════════════════════════════════════════════════════════
	// RENDERING
	// ════════════════════════════════════════════════════════════════
	
	private renderLoop(): void {
		if (!this.isRunning) return;
		this.render();
		this.rafId = requestAnimationFrame(() => this.renderLoop());
	}
	
	private render(): void {
		const w = this.canvas.width;
		const h = this.canvas.height;
		
		if (w === 0 || h === 0) return;
		
		// Clear with background
		this.ctx.fillStyle = COLORS.background;
		this.ctx.fillRect(0, 0, w, h);
		
		// Viewport center in screen coordinates
		const centerX = w / 2;
		const centerY = h / 2;
		
		// World origin in screen coordinates
		const originX = centerX - this.cameraX * this.zoom;
		const originY = centerY - this.cameraY * this.zoom;
		
		// Draw grid
		this.drawGrid(w, h, originX, originY);
		
		// Draw axes (X = red, Y = green)
		this.drawAxes(w, h, originX, originY);
		
		// Draw render zone (4th quadrant - positive X, positive Y)
		this.drawRenderZone(w, h, originX, originY);
		
		// Draw entities
		this.ctx.save();
		this.ctx.translate(originX, originY);
		this.ctx.scale(this.zoom, this.zoom);
		
		for (const entity of this.entities) {
			if (entity.visible) {
				this.drawEntity(entity);
			}
		}
		
		this.ctx.restore();
		
		// Draw info
		this.drawInfo(w, h);
	}
	
	// ════════════════════════════════════════════════════════════════
	// GRID (Same style as 3D viewport)
	// ════════════════════════════════════════════════════════════════
	
	private drawGrid(w: number, h: number, originX: number, originY: number): void {
		const gridSize = 32;
		const majorInterval = 8;
		
		const step = gridSize * this.zoom;
		const majorStep = step * majorInterval;
		
		// Skip if too zoomed out
		if (step < 4) return;
		
		// Minor grid
		this.ctx.strokeStyle = COLORS.gridLine;
		this.ctx.lineWidth = 1;
		this.ctx.beginPath();
		
		// Vertical lines
		let startX = originX % step;
		for (let x = startX; x < w; x += step) {
			this.ctx.moveTo(x, 0);
			this.ctx.lineTo(x, h);
		}
		
		// Horizontal lines
		let startY = originY % step;
		for (let y = startY; y < h; y += step) {
			this.ctx.moveTo(0, y);
			this.ctx.lineTo(w, y);
		}
		
		this.ctx.stroke();
		
		// Major grid
		this.ctx.strokeStyle = COLORS.gridLineMajor;
		this.ctx.lineWidth = 1;
		this.ctx.beginPath();
		
		let majorStartX = originX % majorStep;
		for (let x = majorStartX; x < w; x += majorStep) {
			this.ctx.moveTo(x, 0);
			this.ctx.lineTo(x, h);
		}
		
		let majorStartY = originY % majorStep;
		for (let y = majorStartY; y < h; y += majorStep) {
			this.ctx.moveTo(0, y);
			this.ctx.lineTo(w, y);
		}
		
		this.ctx.stroke();
	}
	
	// ════════════════════════════════════════════════════════════════
	// AXES (X = Red →, Y = Green ↓)
	// ════════════════════════════════════════════════════════════════
	
	private drawAxes(w: number, h: number, originX: number, originY: number): void {
		this.ctx.lineWidth = 2;
		
		// X axis (red) - goes RIGHT from origin
		this.ctx.strokeStyle = COLORS.axisX;
		this.ctx.beginPath();
		this.ctx.moveTo(0, originY);
		this.ctx.lineTo(w, originY);
		this.ctx.stroke();
		
		// Y axis (green) - goes DOWN from origin
		this.ctx.strokeStyle = COLORS.axisY;
		this.ctx.beginPath();
		this.ctx.moveTo(originX, 0);
		this.ctx.lineTo(originX, h);
		this.ctx.stroke();
		
		// Origin marker
		this.ctx.fillStyle = '#ffffff';
		this.ctx.beginPath();
		this.ctx.arc(originX, originY, 4, 0, Math.PI * 2);
		this.ctx.fill();
		
		// Axis labels
		this.ctx.font = '11px sans-serif';
		this.ctx.textAlign = 'left';
		this.ctx.textBaseline = 'top';
		
		// X label (right side)
		this.ctx.fillStyle = COLORS.axisX;
		this.ctx.fillText('X', w - 20, originY + 6);
		
		// Y label (bottom)
		this.ctx.fillStyle = COLORS.axisY;
		this.ctx.fillText('Y', originX + 6, h - 20);
		
		// Quadrant numbers
		this.ctx.fillStyle = '#555';
		this.ctx.font = '10px sans-serif';
		
		// Quadrant 1 (top-right)
		this.ctx.fillText('1', originX + 10, originY - 20);
		// Quadrant 2 (top-left)  
		this.ctx.fillText('2', originX - 20, originY - 20);
		// Quadrant 3 (bottom-left)
		this.ctx.fillText('3', originX - 20, originY + 10);
		// Quadrant 4 (bottom-right) - this is where render zone is
		this.ctx.fillText('4', originX + 10, originY + 10);
	}
	
	// ════════════════════════════════════════════════════════════════
	// RENDER ZONE (4th Quadrant - positive X, positive Y)
	// ════════════════════════════════════════════════════════════════
	
	private drawRenderZone(w: number, h: number, originX: number, originY: number): void {
		// Render zone is in 4th quadrant
		// Top-left corner at (0,0) world = (originX, originY) screen
		// Extends to (renderWidth, renderHeight) world
		
		const screenW = this.renderWidth * this.zoom;
		const screenH = this.renderHeight * this.zoom;
		
		// Screen coordinates of render zone
		const left = originX;
		const top = originY;
		const right = originX + screenW;
		const bottom = originY + screenH;
		
		// Dim everything OUTSIDE render zone
		this.ctx.fillStyle = COLORS.outsideRender;
		
		// Left side (x < 0 in world)
		if (originX > 0) {
			this.ctx.fillRect(0, 0, originX, h);
		}
		
		// Top side (y < 0 in world)
		if (originY > 0) {
			this.ctx.fillRect(originX, 0, w - originX, originY);
		}
		
		// Right side (x > renderWidth)
		if (right < w) {
			this.ctx.fillRect(right, originY, w - right, bottom - originY);
		}
		
		// Bottom side (y > renderHeight)
		if (bottom < h) {
			this.ctx.fillRect(originX, bottom, right - originX, h - bottom);
		}
		
		// Draw render zone rectangle
		this.ctx.fillStyle = COLORS.renderZone;
		this.ctx.fillRect(originX, originY, screenW, screenH);
		
		// Border
		this.ctx.strokeStyle = COLORS.renderZoneBorder;
		this.ctx.lineWidth = 2;
		this.ctx.setLineDash([6, 3]);
		this.ctx.strokeRect(originX, originY, screenW, screenH);
		this.ctx.setLineDash([]);
		
		// Label
		this.ctx.fillStyle = COLORS.renderZoneBorder;
		this.ctx.font = '10px sans-serif';
		this.ctx.textAlign = 'left';
		this.ctx.textBaseline = 'top';
		this.ctx.fillText(`Render: ${this.renderWidth}×${this.renderHeight}`, originX + 6, originY + 6);
	}
	
	// ════════════════════════════════════════════════════════════════
	// ENTITY DRAWING
	// ════════════════════════════════════════════════════════════════
	
	private drawEntity(entity: SceneEntity2D): void {
		const isSelected = this.selectedIds.has(entity.id);
		const isHovered = this.hoveredId === entity.id;
		
		const x = entity.transform.position[0];
		const y = entity.transform.position[1];
		
		// Sprite bounds
		if (entity.sprite) {
			const sw = entity.sprite.size[0] * entity.transform.scale[0];
			const sh = entity.sprite.size[1] * entity.transform.scale[1];
			
			// Placeholder
			this.ctx.fillStyle = 'rgba(80, 80, 80, 0.4)';
			this.ctx.fillRect(x - sw/2, y - sh/2, sw, sh);
			
			// Bounds
			this.ctx.strokeStyle = isSelected ? COLORS.objectSelected : 
			                       isHovered ? COLORS.objectHovered : COLORS.objectBounds;
			this.ctx.lineWidth = isSelected ? 2 : 1;
			this.ctx.strokeRect(x - sw/2, y - sh/2, sw, sh);
		}
		
		// Collider
		if (entity.collider) {
			this.ctx.strokeStyle = COLORS.collider;
			this.ctx.lineWidth = 1;
			this.ctx.setLineDash([3, 2]);
			
			const cw = entity.collider.size[0];
			const ch = entity.collider.size[1];
			this.ctx.strokeRect(x - cw/2, y - ch/2, cw, ch);
			
			this.ctx.setLineDash([]);
		}
		
		// Name label
		if (isSelected || isHovered) {
			this.ctx.fillStyle = isSelected ? COLORS.objectSelected : COLORS.objectHovered;
			this.ctx.font = '10px sans-serif';
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'bottom';
			const labelY = y - (entity.sprite?.size[1] || 20) / 2 - 4;
			this.ctx.fillText(entity.name, x, labelY);
		}
		
		// Selection gizmo
		if (isSelected) {
			this.drawGizmo(x, y);
		}
	}
	
	private drawGizmo(x: number, y: number): void {
		const size = 10 / this.zoom;
		
		// Center
		this.ctx.fillStyle = COLORS.gizmoHandle;
		this.ctx.beginPath();
		this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
		this.ctx.fill();
		
		// X handle (red, goes right)
		this.ctx.strokeStyle = COLORS.axisX;
		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		this.ctx.moveTo(x, y);
		this.ctx.lineTo(x + size * 3, y);
		this.ctx.stroke();
		
		// Y handle (green, goes down)
		this.ctx.strokeStyle = COLORS.axisY;
		this.ctx.beginPath();
		this.ctx.moveTo(x, y);
		this.ctx.lineTo(x, y + size * 3);
		this.ctx.stroke();
	}
	
	// ════════════════════════════════════════════════════════════════
	// INFO OVERLAY
	// ════════════════════════════════════════════════════════════════
	
	private drawInfo(w: number, h: number): void {
		const padding = 8;
		const lineH = 16;
		
		// Background
		this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
		this.ctx.fillRect(padding, h - padding - lineH * 2, 140, lineH * 2);
		
		// Text
		this.ctx.fillStyle = '#aaa';
		this.ctx.font = '10px monospace';
		this.ctx.textAlign = 'left';
		this.ctx.textBaseline = 'bottom';
		
		this.ctx.fillText(`Zoom: ${Math.round(this.zoom * 100)}%`, padding + 4, h - padding - lineH);
		this.ctx.fillText(`Camera: ${Math.round(this.cameraX)}, ${Math.round(this.cameraY)}`, padding + 4, h - padding);
	}
	
	// ════════════════════════════════════════════════════════════════
	// EVENTS
	// ════════════════════════════════════════════════════════════════
	
	private setupEvents(): void {
		this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
		this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
		this.canvas.addEventListener('mouseup', () => this.onMouseUp());
		this.canvas.addEventListener('wheel', e => this.onWheel(e), { passive: false });
		this.canvas.addEventListener('contextmenu', e => e.preventDefault());
		this.container.addEventListener('keydown', e => this.onKeyDown(e));
		
		// Focus on click
		this.canvas.addEventListener('mousedown', () => this.container.focus());
	}
	
	private onMouseDown(e: MouseEvent): void {
		const rect = this.canvas.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		
		this.lastMouse = { x: sx, y: sy };
		
		if (e.button === 1 || (e.button === 0 && e.altKey)) {
			// Pan
			this.isPanning = true;
			this.container.style.cursor = 'grabbing';
		} else if (e.button === 0) {
			// Select
			const world = this.screenToWorld(sx, sy);
			const hit = this.hitTest(world.x, world.y);
			
			if (hit) {
				this.selectedIds.clear();
				this.selectedIds.add(hit.id);
				this._onEntitySelected.fire(hit.id);
				this.isDragging = true;
			} else {
				this.selectedIds.clear();
				this._onEntitySelected.fire(null);
			}
		}
	}
	
	private onMouseMove(e: MouseEvent): void {
		const rect = this.canvas.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		
		if (this.isPanning) {
			const dx = sx - this.lastMouse.x;
			const dy = sy - this.lastMouse.y;
			this.cameraX += dx / this.zoom;
			this.cameraY += dy / this.zoom;
		} else if (this.isDragging && this.selectedIds.size === 1) {
			const world = this.screenToWorld(sx, sy);
			const lastWorld = this.screenToWorld(this.lastMouse.x, this.lastMouse.y);
			
			const id = Array.from(this.selectedIds)[0];
			const ent = this.entities.find(e => e.id === id);
			if (ent) {
				ent.transform.position[0] += world.x - lastWorld.x;
				ent.transform.position[1] += world.y - lastWorld.y;
				this._onTransformChanged.fire({ id, transform: ent.transform });
			}
		} else {
			// Hover
			const world = this.screenToWorld(sx, sy);
			const hit = this.hitTest(world.x, world.y);
			this.hoveredId = hit?.id || null;
			this.container.style.cursor = hit ? 'pointer' : 'default';
		}
		
		this.lastMouse = { x: sx, y: sy };
	}
	
	private onMouseUp(): void {
		this.isPanning = false;
		this.isDragging = false;
		this.container.style.cursor = 'default';
	}
	
	private onWheel(e: WheelEvent): void {
		e.preventDefault();
		
		const rect = this.canvas.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		
		const worldBefore = this.screenToWorld(sx, sy);
		
		// Zoom
		const factor = e.deltaY > 0 ? 0.9 : 1.1;
		this.zoom = Math.max(0.1, Math.min(10, this.zoom * factor));
		
		const worldAfter = this.screenToWorld(sx, sy);
		
		// Keep point under cursor
		this.cameraX -= worldAfter.x - worldBefore.x;
		this.cameraY -= worldAfter.y - worldBefore.y;
	}
	
	private onKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Delete' || e.key === 'Backspace') {
			for (const id of this.selectedIds) {
				const idx = this.entities.findIndex(e => e.id === id);
				if (idx !== -1) this.entities.splice(idx, 1);
			}
			this.selectedIds.clear();
			this._onEntitySelected.fire(null);
		}
	}
	
	// ════════════════════════════════════════════════════════════════
	// HELPERS
	// ════════════════════════════════════════════════════════════════
	
	private handleResize(): void {
		const rect = this.container.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		this.canvas.width = rect.width * dpr;
		this.canvas.height = rect.height * dpr;
		this.ctx.scale(dpr, dpr);
	}
	
	private screenToWorld(sx: number, sy: number): Vec2 {
		const rect = this.canvas.getBoundingClientRect();
		return {
			x: (sx - rect.width / 2) / this.zoom + this.cameraX,
			y: (sy - rect.height / 2) / this.zoom + this.cameraY,
		};
	}
	
	private hitTest(wx: number, wy: number): SceneEntity2D | null {
		for (let i = this.entities.length - 1; i >= 0; i--) {
			const e = this.entities[i];
			if (!e.visible || !e.sprite) continue;
			
			const sw = e.sprite.size[0] * e.transform.scale[0];
			const sh = e.sprite.size[1] * e.transform.scale[1];
			
			if (wx >= e.transform.position[0] - sw/2 &&
			    wx <= e.transform.position[0] + sw/2 &&
			    wy >= e.transform.position[1] - sh/2 &&
			    wy <= e.transform.position[1] + sh/2) {
				return e;
			}
		}
		return null;
	}
	
	// ════════════════════════════════════════════════════════════════
	
	override dispose(): void {
		this.stopRendering();
		this.container.remove();
		super.dispose();
	}
}

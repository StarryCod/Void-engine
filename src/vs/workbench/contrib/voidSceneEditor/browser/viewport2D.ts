/*---------------------------------------------------------------------------------------------
 *  Void Engine — 2D Viewport (WebGL2)
 *  Godot-style 2D scene editor with grid, camera bounds, and object manipulation
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR PALETTE (Godot 4.x Style)
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = {
	// Viewport background
	background: '#1e1e1e',
	backgroundLight: '#252526',
	
	// Grid
	gridLine: '#2a2a2a',
	gridLineMajor: '#3a3a3a',
	gridOrigin: '#444444',
	
	// Camera bounds (render zone)
	cameraBounds: '#4a9eff',
	cameraBoundsFill: 'rgba(74, 158, 255, 0.03)',
	cameraBoundsDashed: '#4a9eff80',
	
	// Safe area (what will be rendered)
	safeArea: '#69db7c40',
	safeAreaBorder: '#69db7c',
	
	// Outside render zone (dimmed overlay)
	outsideRender: 'rgba(0, 0, 0, 0.4)',
	
	// Objects
	spriteBounds: '#ffffff',
	spriteSelected: '#4a9eff',
	collider: '#4caf50',
	colliderSelected: '#69db7c',
	
	// Selection
	selectionBox: 'rgba(74, 158, 255, 0.3)',
	selectionBorder: '#4a9eff',
	
	// Gizmo
	gizmoX: '#ff6b6b',
	gizmoY: '#69db7c',
	gizmoCenter: '#ffffff',
	
	// UI
	toolbar: '#222225',
	toolbarBorder: '#3c3c3c',
	text: '#cccccc',
	textDim: '#666666',
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
	sprite?: {
		texture?: string;
		size: [number, number];
		offset: [number, number];
		region?: [number, number, number, number];
	};
	collider?: {
		type: 'box' | 'circle' | 'capsule';
		size: [number, number];
		radius?: number;
	};
	visible: boolean;
}

interface Camera2D {
	position: [number, number];
	zoom: number;
	viewportSize: [number, number]; // pixels
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEWPORT 2D CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class Viewport2D extends Disposable {
	private container: HTMLElement;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	
	// Scene state
	private entities: SceneEntity2D[] = [];
	private selectedIds: Set<string> = new Set();
	private camera: Camera2D = {
		position: [0, 0],
		zoom: 1,
		viewportSize: [800, 600],
	};
	
	// Interaction state
	private isDragging: boolean = false;
	private isPanning: boolean = false;
	private dragStart: Vec2 = { x: 0, y: 0 };
	private selectionBox: { start: Vec2; end: Vec2 } | null = null;
	private hoveredEntity: string | null = null;
	
	// Render state
	private rafId: number | null = null;
	private gridEnabled: boolean = true;
	private gridSize: number = 32;
	private showCameraBounds: boolean = true;
	private showColliders: boolean = true;
	
	// Events
	private readonly _onEntitySelected = this._register(new Emitter<string | null>());
	public readonly onEntitySelected: Event<string | null> = this._onEntitySelected.event;
	
	private readonly _onTransformChanged = this._register(new Emitter<{ id: string; transform: Transform2D }>());
	public readonly onTransformChanged: Event<{ id: string; transform: Transform2D }> = this._onTransformChanged.event;
	
	constructor(parent: HTMLElement) {
		super();
		
		// Create container
		this.container = document.createElement('div');
		this.container.className = 'void-viewport-2d';
		this.container.style.cssText = `
			width: 100%;
			height: 100%;
			position: relative;
			background: ${COLORS.background};
			overflow: hidden;
		`;
		
		// Create canvas
		this.canvas = document.createElement('canvas');
		this.canvas.style.cssText = `
			width: 100%;
			height: 100%;
			display: block;
		`;
		this.container.appendChild(this.canvas);
		
		// Get context
		const ctx = this.canvas.getContext('2d');
		if (!ctx) throw new Error('Failed to get 2D context');
		this.ctx = ctx;
		
		// Setup interactions
		this.setupInteractions();
		
		// Append to parent
		parent.appendChild(this.container);
		
		// Initial resize
		this.resize();
		
		// Start render loop
		this.startRendering();
	}
	
	// ════════════════════════════════════════════════════════════════
	// SCENE MANAGEMENT
	// ════════════════════════════════════════════════════════════════
	
	public loadScene(entities: SceneEntity2D[]): void {
		this.entities = entities;
		this.scheduleRender();
	}
	
	public selectEntity(id: string | null): void {
		this.selectedIds.clear();
		if (id) this.selectedIds.add(id);
		this.scheduleRender();
	}
	
	public setCamera(position: [number, number], zoom: number): void {
		this.camera.position = position;
		this.camera.zoom = Math.max(0.1, Math.min(10, zoom));
		this.scheduleRender();
	}
	
	public setViewportSize(width: number, height: number): void {
		this.camera.viewportSize = [width, height];
		this.scheduleRender();
	}
	
	// ════════════════════════════════════════════════════════════════
	// RENDERING
	// ════════════════════════════════════════════════════════════════
	
	private startRendering(): void {
		const render = () => {
			this.render();
			this.rafId = requestAnimationFrame(render);
		};
		this.rafId = requestAnimationFrame(render);
	}
	
	public stopRendering(): void {
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}
	
	private scheduleRender(): void {
		// RAF already running, just let it render
	}
	
	private render(): void {
		const { width, height } = this.canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		
		// Set canvas size
		if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
			this.canvas.width = width * dpr;
			this.canvas.height = height * dpr;
			this.ctx.scale(dpr, dpr);
		}
		
		// Clear
		this.ctx.fillStyle = COLORS.background;
		this.ctx.fillRect(0, 0, width, height);
		
		// Calculate view transform
		const viewCenter = { x: width / 2, y: height / 2 };
		const cameraOffset = {
			x: viewCenter.x - this.camera.position[0] * this.camera.zoom,
			y: viewCenter.y - this.camera.position[1] * this.camera.zoom,
		};
		
		// Draw grid
		if (this.gridEnabled) {
			this.drawGrid(width, height, cameraOffset);
		}
		
		// Draw camera bounds (what will be rendered)
		if (this.showCameraBounds) {
			this.drawCameraBounds(width, height, cameraOffset);
		}
		
		// Draw entities
		this.ctx.save();
		this.ctx.translate(cameraOffset.x, cameraOffset.y);
		this.ctx.scale(this.camera.zoom, this.camera.zoom);
		
		for (const entity of this.entities) {
			if (!entity.visible) continue;
			this.drawEntity(entity);
		}
		
		this.ctx.restore();
		
		// Draw selection box
		if (this.selectionBox) {
			this.drawSelectionBox();
		}
		
		// Draw info overlay
		this.drawInfoOverlay(width, height);
	}
	
	// ════════════════════════════════════════════════════════════════
	// GRID DRAWING
	// ════════════════════════════════════════════════════════════════
	
	private drawGrid(width: number, height: number, offset: Vec2): void {
		const grid = this.gridSize * this.camera.zoom;
		const majorGrid = grid * 8;
		
		this.ctx.strokeStyle = COLORS.gridLine;
		this.ctx.lineWidth = 1;
		
		// Calculate grid start positions
		const startX = offset.x % grid;
		const startY = offset.y % grid;
		const majorStartX = offset.x % majorGrid;
		const majorStartY = offset.y % majorGrid;
		
		// Draw minor grid lines
		this.ctx.beginPath();
		for (let x = startX; x < width; x += grid) {
			this.ctx.moveTo(x, 0);
			this.ctx.lineTo(x, height);
		}
		for (let y = startY; y < height; y += grid) {
			this.ctx.moveTo(0, y);
			this.ctx.lineTo(width, y);
		}
		this.ctx.stroke();
		
		// Draw major grid lines (thicker)
		this.ctx.strokeStyle = COLORS.gridLineMajor;
		this.ctx.lineWidth = 1;
		this.ctx.beginPath();
		for (let x = majorStartX; x < width; x += majorGrid) {
			this.ctx.moveTo(x, 0);
			this.ctx.lineTo(x, height);
		}
		for (let y = majorStartY; y < height; y += majorGrid) {
			this.ctx.moveTo(0, y);
			this.ctx.lineTo(width, y);
		}
		this.ctx.stroke();
		
		// Draw origin lines (axes)
		this.ctx.strokeStyle = COLORS.gridOrigin;
		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		// X axis
		this.ctx.moveTo(0, offset.y);
		this.ctx.lineTo(width, offset.y);
		// Y axis
		this.ctx.moveTo(offset.x, 0);
		this.ctx.lineTo(offset.x, height);
		this.ctx.stroke();
	}
	
	// ════════════════════════════════════════════════════════════════
	// CAMERA BOUNDS DRAWING (RENDER ZONE)
	// ════════════════════════════════════════════════════════════════
	
	private drawCameraBounds(width: number, height: number, offset: Vec2): void {
		const { viewportSize, zoom, position } = this.camera;
		
		// Camera viewport in world coordinates
		const halfWidth = viewportSize[0] / 2 / zoom;
		const halfHeight = viewportSize[1] / 2 / zoom;
		
		// Camera bounds in screen coordinates
		const left = offset.x - halfWidth * zoom;
		const right = offset.x + halfWidth * zoom;
		const top = offset.y - halfHeight * zoom;
		const bottom = offset.y + halfHeight * zoom;
		
		// Fill area OUTSIDE camera bounds (dimmed)
		this.ctx.fillStyle = COLORS.outsideRender;
		// Top
		this.ctx.fillRect(0, 0, width, Math.max(0, top));
		// Bottom
		this.ctx.fillRect(0, bottom, width, height - bottom);
		// Left
		this.ctx.fillRect(0, top, Math.max(0, left), bottom - top);
		// Right
		this.ctx.fillRect(right, top, width - right, bottom - top);
		
		// Draw camera bounds rectangle
		this.ctx.strokeStyle = COLORS.cameraBounds;
		this.ctx.lineWidth = 2;
		this.ctx.setLineDash([8, 4]);
		this.ctx.strokeRect(left, top, right - left, bottom - top);
		this.ctx.setLineDash([]);
		
		// Draw corner labels
		this.ctx.fillStyle = COLORS.cameraBounds;
		this.ctx.font = '10px monospace';
		this.ctx.textAlign = 'left';
		this.ctx.textBaseline = 'top';
		this.ctx.fillText(`Camera: ${viewportSize[0]}×${viewportSize[1]}`, left + 4, top + 4);
		
		// Draw center crosshair
		this.ctx.strokeStyle = COLORS.cameraBoundsDashed;
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash([4, 4]);
		this.ctx.beginPath();
		// Horizontal line through center
		this.ctx.moveTo(left, offset.y);
		this.ctx.lineTo(right, offset.y);
		// Vertical line through center
		this.ctx.moveTo(offset.x, top);
		this.ctx.lineTo(offset.x, bottom);
		this.ctx.stroke();
		this.ctx.setLineDash([]);
	}
	
	// ════════════════════════════════════════════════════════════════
	// ENTITY DRAWING
	// ════════════════════════════════════════════════════════════════
	
	private drawEntity(entity: SceneEntity2D): void {
		const { transform, sprite, collider } = entity;
		const isSelected = this.selectedIds.has(entity.id);
		const isHovered = this.hoveredEntity === entity.id;
		
		this.ctx.save();
		this.ctx.translate(transform.position[0], transform.position[1]);
		this.ctx.rotate(transform.rotation * Math.PI / 180);
		this.ctx.scale(transform.scale[0], transform.scale[1]);
		
		// Draw sprite bounds
		if (sprite) {
			const halfW = sprite.size[0] / 2;
			const halfH = sprite.size[1] / 2;
			
			// Fill with placeholder color
			this.ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
			this.ctx.fillRect(-halfW, -halfH, sprite.size[0], sprite.size[1]);
			
			// Draw texture placeholder icon
			this.ctx.fillStyle = COLORS.textDim;
			this.ctx.font = '12px sans-serif';
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'middle';
			this.ctx.fillText('🖼', 0, 0);
			
			// Draw bounds
			this.ctx.strokeStyle = isSelected ? COLORS.spriteSelected : COLORS.spriteBounds;
			this.ctx.lineWidth = isSelected ? 2 : 1;
			this.ctx.strokeRect(-halfW, -halfH, sprite.size[0], sprite.size[1]);
		}
		
		// Draw collider
		if (collider && this.showColliders) {
			this.drawCollider(collider, isSelected);
		}
		
		// Draw name label
		if (isSelected || isHovered) {
			this.ctx.fillStyle = isSelected ? COLORS.spriteSelected : COLORS.text;
			this.ctx.font = '10px sans-serif';
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'bottom';
			const labelY = sprite ? -sprite.size[1] / 2 - 4 : -10;
			this.ctx.fillText(entity.name, 0, labelY);
		}
		
		this.ctx.restore();
		
		// Draw selection highlight
		if (isSelected) {
			this.drawSelectionGizmo(entity);
		}
	}
	
	private drawCollider(collider: SceneEntity2D['collider'], isSelected: boolean): void {
		if (!collider) return;
		
		this.ctx.strokeStyle = isSelected ? COLORS.colliderSelected : COLORS.collider;
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash([4, 2]);
		
		switch (collider.type) {
			case 'box':
				const halfW = collider.size[0] / 2;
				const halfH = collider.size[1] / 2;
				this.ctx.strokeRect(-halfW, -halfH, collider.size[0], collider.size[1]);
				break;
				
			case 'circle':
				this.ctx.beginPath();
				this.ctx.arc(0, 0, collider.radius || collider.size[0] / 2, 0, Math.PI * 2);
				this.ctx.stroke();
				break;
				
			case 'capsule':
				const r = collider.radius || 0.25;
				const h = collider.size[1] - r * 2;
				this.ctx.beginPath();
				this.ctx.arc(0, -h / 2, r, Math.PI, 0);
				this.ctx.lineTo(r, h / 2);
				this.ctx.arc(0, h / 2, r, 0, Math.PI);
				this.ctx.lineTo(-r, -h / 2);
				this.ctx.stroke();
				break;
		}
		
		this.ctx.setLineDash([]);
	}
	
	private drawSelectionGizmo(entity: SceneEntity2D): void {
		const { transform } = entity;
		const size = 8 / this.camera.zoom;
		
		this.ctx.save();
		this.ctx.translate(transform.position[0], transform.position[1]);
		
		// Center gizmo
		this.ctx.fillStyle = COLORS.gizmoCenter;
		this.ctx.beginPath();
		this.ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
		this.ctx.fill();
		
		// X axis handle
		this.ctx.strokeStyle = COLORS.gizmoX;
		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		this.ctx.moveTo(0, 0);
		this.ctx.lineTo(size * 3, 0);
		this.ctx.stroke();
		this.ctx.fillStyle = COLORS.gizmoX;
		this.ctx.beginPath();
		this.ctx.moveTo(size * 3, 0);
		this.ctx.lineTo(size * 2.5, -size / 2);
		this.ctx.lineTo(size * 2.5, size / 2);
		this.ctx.closePath();
		this.ctx.fill();
		
		// Y axis handle
		this.ctx.strokeStyle = COLORS.gizmoY;
		this.ctx.beginPath();
		this.ctx.moveTo(0, 0);
		this.ctx.lineTo(0, -size * 3);
		this.ctx.stroke();
		this.ctx.fillStyle = COLORS.gizmoY;
		this.ctx.beginPath();
		this.ctx.moveTo(0, -size * 3);
		this.ctx.lineTo(-size / 2, -size * 2.5);
		this.ctx.lineTo(size / 2, -size * 2.5);
		this.ctx.closePath();
		this.ctx.fill();
		
		this.ctx.restore();
	}
	
	// ════════════════════════════════════════════════════════════════
	// SELECTION BOX
	// ════════════════════════════════════════════════════════════════
	
	private drawSelectionBox(): void {
		if (!this.selectionBox) return;
		
		const { start, end } = this.selectionBox;
		const x = Math.min(start.x, end.x);
		const y = Math.min(start.y, end.y);
		const w = Math.abs(end.x - start.x);
		const h = Math.abs(end.y - start.y);
		
		this.ctx.fillStyle = COLORS.selectionBox;
		this.ctx.fillRect(x, y, w, h);
		
		this.ctx.strokeStyle = COLORS.selectionBorder;
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash([4, 2]);
		this.ctx.strokeRect(x, y, w, h);
		this.ctx.setLineDash([]);
	}
	
	// ════════════════════════════════════════════════════════════════
	// INFO OVERLAY
	// ════════════════════════════════════════════════════════════════
	
	private drawInfoOverlay(width: number, height: number): void {
		const padding = 8;
		const lineHeight = 16;
		
		// Background for text
		this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
		this.ctx.fillRect(padding, height - padding - lineHeight * 3, 150, lineHeight * 3);
		
		// Text
		this.ctx.fillStyle = COLORS.text;
		this.ctx.font = '11px monospace';
		this.ctx.textAlign = 'left';
		this.ctx.textBaseline = 'bottom';
		
		const lines = [
			`Zoom: ${(this.camera.zoom * 100).toFixed(0)}%`,
			`Camera: (${this.camera.position[0].toFixed(0)}, ${this.camera.position[1].toFixed(0)})`,
			`Viewport: ${this.camera.viewportSize[0]}×${this.camera.viewportSize[1]}`,
		];
		
		lines.forEach((line, i) => {
			this.ctx.fillText(line, padding + 4, height - padding - lineHeight * (2 - i));
		});
	}
	
	// ════════════════════════════════════════════════════════════════
	// INTERACTIONS
	// ════════════════════════════════════════════════════════════════
	
	private setupInteractions(): void {
		// Mouse events
		this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
		this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
		this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
		this.canvas.addEventListener('wheel', this.onWheel.bind(this));
		this.canvas.addEventListener('contextmenu', e => e.preventDefault());
		
		// Keyboard events
		this.container.tabIndex = 0;
		this.container.addEventListener('keydown', this.onKeyDown.bind(this));
	}
	
	private onMouseDown(e: MouseEvent): void {
		const rect = this.canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		
		this.dragStart = { x, y };
		
		if (e.button === 1 || (e.button === 0 && e.altKey)) {
			// Middle click or Alt+Left: Pan
			this.isPanning = true;
			this.container.style.cursor = 'grabbing';
		} else if (e.button === 0) {
			// Left click: Select or start selection box
			const worldPos = this.screenToWorld(x, y);
			const hitEntity = this.hitTest(worldPos.x, worldPos.y);
			
			if (hitEntity) {
				this.selectedIds.clear();
				this.selectedIds.add(hitEntity.id);
				this._onEntitySelected.fire(hitEntity.id);
				this.isDragging = true;
			} else {
				this.selectedIds.clear();
				this._onEntitySelected.fire(null);
				this.selectionBox = { start: { x, y }, end: { x, y } };
			}
		}
		
		this.scheduleRender();
	}
	
	private onMouseMove(e: MouseEvent): void {
		const rect = this.canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		
		if (this.isPanning) {
			const dx = x - this.dragStart.x;
			const dy = y - this.dragStart.y;
			this.camera.position[0] -= dx / this.camera.zoom;
			this.camera.position[1] -= dy / this.camera.zoom;
			this.dragStart = { x, y };
		} else if (this.isDragging && this.selectedIds.size === 1) {
			// Move selected entity
			const worldPos = this.screenToWorld(x, y);
			const dragWorldStart = this.screenToWorld(this.dragStart.x, this.dragStart.y);
			const dx = worldPos.x - dragWorldStart.x;
			const dy = worldPos.y - dragWorldStart.y;
			
			const entityId = Array.from(this.selectedIds)[0];
			const entity = this.entities.find(e => e.id === entityId);
			if (entity) {
				entity.transform.position[0] += dx;
				entity.transform.position[1] += dy;
				this._onTransformChanged.fire({ id: entityId, transform: entity.transform });
			}
			
			this.dragStart = { x, y };
		} else if (this.selectionBox) {
			this.selectionBox.end = { x, y };
		} else {
			// Hover detection
			const worldPos = this.screenToWorld(x, y);
			const hitEntity = this.hitTest(worldPos.x, worldPos.y);
			const newHovered = hitEntity?.id || null;
			
			if (newHovered !== this.hoveredEntity) {
				this.hoveredEntity = newHovered;
				this.container.style.cursor = hitEntity ? 'pointer' : 'default';
			}
		}
		
		this.scheduleRender();
	}
	
	private onMouseUp(e: MouseEvent): void {
		if (this.selectionBox) {
			// Select entities in box
			this.selectInBox(this.selectionBox);
			this.selectionBox = null;
		}
		
		this.isDragging = false;
		this.isPanning = false;
		this.container.style.cursor = 'default';
		this.scheduleRender();
	}
	
	private onWheel(e: WheelEvent): void {
		e.preventDefault();
		
		const rect = this.canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		
		const worldBefore = this.screenToWorld(x, y);
		
		// Zoom
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		this.camera.zoom = Math.max(0.1, Math.min(10, this.camera.zoom * delta));
		
		const worldAfter = this.screenToWorld(x, y);
		
		// Adjust camera position to zoom towards cursor
		this.camera.position[0] += worldBefore.x - worldAfter.x;
		this.camera.position[1] += worldBefore.y - worldAfter.y;
		
		this.scheduleRender();
	}
	
	private onKeyDown(e: KeyboardEvent): void {
		switch (e.key) {
			case 'Delete':
			case 'Backspace':
				// Delete selected entities
				this.selectedIds.forEach(id => {
					const idx = this.entities.findIndex(e => e.id === id);
					if (idx !== -1) this.entities.splice(idx, 1);
				});
				this.selectedIds.clear();
				this._onEntitySelected.fire(null);
				this.scheduleRender();
				break;
				
			case 'g':
				this.gridEnabled = !this.gridEnabled;
				this.scheduleRender();
				break;
				
			case 'c':
				this.showColliders = !this.showColliders;
				this.scheduleRender();
				break;
				
			case 'b':
				this.showCameraBounds = !this.showCameraBounds;
				this.scheduleRender();
				break;
		}
	}
	
	// ════════════════════════════════════════════════════════════════
	// HELPERS
	// ════════════════════════════════════════════════════════════════
	
	private screenToWorld(screenX: number, screenY: number): Vec2 {
		const rect = this.canvas.getBoundingClientRect();
		return {
			x: (screenX - rect.width / 2) / this.camera.zoom + this.camera.position[0],
			y: (screenY - rect.height / 2) / this.camera.zoom + this.camera.position[1],
		};
	}
	
	private worldToScreen(worldX: number, worldY: number): Vec2 {
		const rect = this.canvas.getBoundingClientRect();
		return {
			x: (worldX - this.camera.position[0]) * this.camera.zoom + rect.width / 2,
			y: (worldY - this.camera.position[1]) * this.camera.zoom + rect.height / 2,
		};
	}
	
	private hitTest(worldX: number, worldY: number): SceneEntity2D | null {
		// Test entities in reverse order (top to bottom in render)
		for (let i = this.entities.length - 1; i >= 0; i--) {
			const entity = this.entities[i];
			if (!entity.visible) continue;
			
			const { transform, sprite } = entity;
			if (!sprite) continue;
			
			const halfW = sprite.size[0] / 2 * transform.scale[0];
			const halfH = sprite.size[1] / 2 * transform.scale[1];
			
			const dx = worldX - transform.position[0];
			const dy = worldY - transform.position[1];
			
			if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
				return entity;
			}
		}
		return null;
	}
	
	private selectInBox(box: { start: Vec2; end: Vec2 }): void {
		const x1 = Math.min(box.start.x, box.end.x);
		const y1 = Math.min(box.start.y, box.end.y);
		const x2 = Math.max(box.start.x, box.end.x);
		const y2 = Math.max(box.start.y, box.end.y);
		
		this.selectedIds.clear();
		
		for (const entity of this.entities) {
			const screenPos = this.worldToScreen(entity.transform.position[0], entity.transform.position[1]);
			if (screenPos.x >= x1 && screenPos.x <= x2 && screenPos.y >= y1 && screenPos.y <= y2) {
				this.selectedIds.add(entity.id);
			}
		}
	}
	
	public resize(): void {
		const rect = this.container.getBoundingClientRect();
		this.canvas.width = rect.width * (window.devicePixelRatio || 1);
		this.canvas.height = rect.height * (window.devicePixelRatio || 1);
		this.scheduleRender();
	}
	
	// ════════════════════════════════════════════════════════════════
	
	override dispose(): void {
		this.stopRendering();
		this.container.remove();
		super.dispose();
	}
}

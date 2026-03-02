/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';

const COLORS = {
	background: '#1d1d1d',
	gridMinor: '#2d2d2d',
	gridMajor: '#3a3a3a',
	axisX: '#d47a4a',
	axisY: '#8ea06f',
	renderZoneFill: 'rgba(212, 122, 74, 0.08)',
	renderZoneBorder: '#9c6b4f',
	outsideRender: 'rgba(0, 0, 0, 0.30)',
	objectFill: 'rgba(170, 170, 170, 0.14)',
	objectBounds: '#9a9a9a',
	objectSelected: '#d47a4a',
	objectHovered: '#d0d0d0',
	collider: '#8ea06f',
	gizmo: '#d9d9d9',
	infoText: '#9a9a9a',
} as const;

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

type GizmoHandle = 'moveX' | 'moveY' | 'rotate' | null;

export class Viewport2D extends Disposable {
	private container: HTMLElement;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;

	private entities: SceneEntity2D[] = [];
	private selectedIds: Set<string> = new Set();

	private cameraX = 0;
	private cameraY = 0;
	private zoom = 1;

	private renderWidth = 1152;
	private renderHeight = 648;

	private isPanning = false;
	private isDragging = false;
	private lastMouse: Vec2 = { x: 0, y: 0 };
	private hoveredId: string | null = null;
	private gizmoHover: GizmoHandle = null;
	private activeGizmo: GizmoHandle = null;
	private dragStartRotation = 0;
	private dragStartAngle = 0;

	private rafId: number | null = null;
	private isRunning = false;

	private readonly _onEntitySelected = this._register(new Emitter<string | null>());
	public readonly onEntitySelected: Event<string | null> = this._onEntitySelected.event;

	private readonly _onTransformChanged = this._register(new Emitter<{ id: string; transform: Transform2D }>());
	public readonly onTransformChanged: Event<{ id: string; transform: Transform2D }> = this._onTransformChanged.event;

	constructor(parent: HTMLElement) {
		super();

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

		this.canvas = document.createElement('canvas');
		this.canvas.style.cssText = 'width: 100%; height: 100%; display: block;';
		this.container.appendChild(this.canvas);

		const ctx = this.canvas.getContext('2d', { alpha: false });
		if (!ctx) {
			throw new Error('Canvas 2D context failed');
		}
		this.ctx = ctx;

		this.setupEvents();
		parent.appendChild(this.container);
		this.handleResize();
		this.startRendering();
	}

	public loadScene(entities: SceneEntity2D[]): void {
		this.entities = entities;
	}

	public selectEntity(id: string | null): void {
		this.selectedIds.clear();
		if (id) {
			this.selectedIds.add(id);
		}
	}

	public resize(): void {
		this.handleResize();
	}

	public startRendering(): void {
		if (this.isRunning) {
			return;
		}
		this.isRunning = true;
		this.renderLoop();
	}

	public stopRendering(): void {
		this.isRunning = false;
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}

	private renderLoop(): void {
		if (!this.isRunning) {
			return;
		}
		this.render();
		this.rafId = requestAnimationFrame(() => this.renderLoop());
	}

	private render(): void {
		const w = this.canvas.width;
		const h = this.canvas.height;
		if (w === 0 || h === 0) {
			return;
		}

		this.ctx.fillStyle = COLORS.background;
		this.ctx.fillRect(0, 0, w, h);

		const centerX = w / 2;
		const centerY = h / 2;
		const originX = centerX - this.cameraX * this.zoom;
		const originY = centerY - this.cameraY * this.zoom;

		this.drawGrid(w, h, originX, originY);
		this.drawRenderZone(w, h, originX, originY);
		this.drawAxes(w, h, originX, originY);

		this.ctx.save();
		this.ctx.translate(originX, originY);
		this.ctx.scale(this.zoom, this.zoom);
		for (const entity of this.entities) {
			if (entity.visible) {
				this.drawEntity(entity);
			}
		}
		this.ctx.restore();

		this.drawInfo(w, h);
	}

	private drawGrid(w: number, h: number, originX: number, originY: number): void {
		const baseStep = 32;
		const majorEvery = 4;
		const step = baseStep * this.zoom;
		if (step < 6) {
			return;
		}

		const majorStep = step * majorEvery;

		this.ctx.strokeStyle = COLORS.gridMinor;
		this.ctx.lineWidth = 1;
		this.ctx.beginPath();
		for (let x = originX % step; x < w; x += step) {
			this.ctx.moveTo(x, 0);
			this.ctx.lineTo(x, h);
		}
		for (let y = originY % step; y < h; y += step) {
			this.ctx.moveTo(0, y);
			this.ctx.lineTo(w, y);
		}
		this.ctx.stroke();

		this.ctx.strokeStyle = COLORS.gridMajor;
		this.ctx.beginPath();
		for (let x = originX % majorStep; x < w; x += majorStep) {
			this.ctx.moveTo(x, 0);
			this.ctx.lineTo(x, h);
		}
		for (let y = originY % majorStep; y < h; y += majorStep) {
			this.ctx.moveTo(0, y);
			this.ctx.lineTo(w, y);
		}
		this.ctx.stroke();
	}

	private drawAxes(w: number, h: number, originX: number, originY: number): void {
		this.ctx.lineWidth = 1;

		if (originY >= 0 && originY <= h) {
			this.ctx.strokeStyle = COLORS.axisX;
			this.ctx.beginPath();
			this.ctx.moveTo(0, originY);
			this.ctx.lineTo(w, originY);
			this.ctx.stroke();
		}

		if (originX >= 0 && originX <= w) {
			this.ctx.strokeStyle = COLORS.axisY;
			this.ctx.beginPath();
			this.ctx.moveTo(originX, 0);
			this.ctx.lineTo(originX, h);
			this.ctx.stroke();
		}

		this.ctx.fillStyle = COLORS.gizmo;
		this.ctx.fillRect(originX - 1.5, originY - 1.5, 3, 3);
	}

	private drawRenderZone(w: number, h: number, originX: number, originY: number): void {
		const screenW = this.renderWidth * this.zoom;
		const screenH = this.renderHeight * this.zoom;

		const left = originX - screenW / 2;
		const top = originY - screenH / 2;

		this.ctx.fillStyle = COLORS.outsideRender;
		this.ctx.fillRect(0, 0, w, h);

		this.ctx.fillStyle = COLORS.renderZoneFill;
		this.ctx.fillRect(left, top, screenW, screenH);

		this.ctx.strokeStyle = COLORS.renderZoneBorder;
		this.ctx.lineWidth = 1;
		this.ctx.strokeRect(left, top, screenW, screenH);
	}

	private drawEntity(entity: SceneEntity2D): void {
		const isSelected = this.selectedIds.has(entity.id);
		const isHovered = this.hoveredId === entity.id;
		const x = entity.transform.position[0];
		const y = entity.transform.position[1];

		const spriteW = entity.sprite ? entity.sprite.size[0] * entity.transform.scale[0] : 28;
		const spriteH = entity.sprite ? entity.sprite.size[1] * entity.transform.scale[1] : 28;
		const left = x - spriteW / 2;
		const top = y - spriteH / 2;

		this.ctx.fillStyle = COLORS.objectFill;
		this.ctx.fillRect(left, top, spriteW, spriteH);

		this.ctx.strokeStyle = isSelected
			? COLORS.objectSelected
			: isHovered
				? COLORS.objectHovered
				: COLORS.objectBounds;
		this.ctx.lineWidth = isSelected ? 2 : 1;
		this.ctx.strokeRect(left, top, spriteW, spriteH);
		this.drawNodeIcon(entity, x, y);

		if (entity.collider) {
			this.ctx.strokeStyle = COLORS.collider;
			this.ctx.lineWidth = 1;
			this.ctx.setLineDash([2, 2]);
			const cw = entity.collider.size[0];
			const ch = entity.collider.size[1];
			this.ctx.strokeRect(x - cw / 2, y - ch / 2, cw, ch);
			this.ctx.setLineDash([]);
		}

		if (isSelected || isHovered) {
			this.ctx.fillStyle = isSelected ? COLORS.objectSelected : COLORS.objectHovered;
			this.ctx.font = '10px monospace';
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'bottom';
			this.ctx.fillText(entity.name, x, top - 4);
		}

		if (isSelected) {
			this.drawGizmo(entity);
		}
	}

	private drawNodeIcon(entity: SceneEntity2D, x: number, y: number): void {
		const name = entity.name.toLowerCase();
		let glyph = 'N';
		if (name.includes('camera')) {
			glyph = 'C';
		} else if (name.includes('light') || name.includes('sun')) {
			glyph = 'L';
		} else if (name.includes('player')) {
			glyph = 'P';
		} else if (name.includes('sky') || name.includes('environment')) {
			glyph = 'S';
		}
		this.ctx.fillStyle = '#cfcfcf';
		this.ctx.font = `${Math.max(8, 10 / this.zoom)}px monospace`;
		this.ctx.textAlign = 'center';
		this.ctx.textBaseline = 'middle';
		this.ctx.fillText(glyph, x, y);
	}

	private drawGizmo(entity: SceneEntity2D): void {
		const x = entity.transform.position[0];
		const y = entity.transform.position[1];
		const handle = this.getGizmoHandlePositions(entity);
		const lineW = 1.5 / this.zoom;
		const ringW = 1 / this.zoom;

		this.ctx.lineWidth = lineW;
		this.ctx.strokeStyle = this.activeGizmo === 'moveX' || this.gizmoHover === 'moveX' ? '#f0a26f' : COLORS.axisX;
		this.ctx.beginPath();
		this.ctx.moveTo(x, y);
		this.ctx.lineTo(handle.moveX.x, handle.moveX.y);
		this.ctx.stroke();

		this.ctx.strokeStyle = this.activeGizmo === 'moveY' || this.gizmoHover === 'moveY' ? '#b4c691' : COLORS.axisY;
		this.ctx.beginPath();
		this.ctx.moveTo(x, y);
		this.ctx.lineTo(handle.moveY.x, handle.moveY.y);
		this.ctx.stroke();

		this.ctx.lineWidth = ringW;
		this.ctx.strokeStyle = this.activeGizmo === 'rotate' || this.gizmoHover === 'rotate' ? '#d9d9d9' : '#8d8d8d';
		this.ctx.beginPath();
		this.ctx.arc(x, y, handle.rotateRadius, 0, Math.PI * 2);
		this.ctx.stroke();

		const handleR = 5 / this.zoom;
		this.ctx.fillStyle = this.activeGizmo === 'moveX' || this.gizmoHover === 'moveX' ? '#f0a26f' : COLORS.axisX;
		this.ctx.beginPath();
		this.ctx.arc(handle.moveX.x, handle.moveX.y, handleR, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.fillStyle = this.activeGizmo === 'moveY' || this.gizmoHover === 'moveY' ? '#b4c691' : COLORS.axisY;
		this.ctx.beginPath();
		this.ctx.arc(handle.moveY.x, handle.moveY.y, handleR, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.fillStyle = COLORS.gizmo;
		this.ctx.fillRect(x - 2 / this.zoom, y - 2 / this.zoom, 4 / this.zoom, 4 / this.zoom);
	}

	private drawInfo(w: number, _h: number): void {
		this.ctx.fillStyle = COLORS.infoText;
		this.ctx.font = '10px monospace';
		this.ctx.textAlign = 'left';
		this.ctx.textBaseline = 'top';
		this.ctx.fillText(
			`${this.renderWidth}x${this.renderHeight}  Z:${Math.round(this.zoom * 100)}%  C:${Math.round(this.cameraX)},${Math.round(this.cameraY)}`,
			8,
			8
		);
	}

	private setupEvents(): void {
		this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
		this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
		this.canvas.addEventListener('mouseup', () => this.onMouseUp());
		this.canvas.addEventListener('wheel', e => this.onWheel(e), { passive: false });
		this.canvas.addEventListener('contextmenu', e => e.preventDefault());
		this.container.addEventListener('keydown', e => this.onKeyDown(e));
		this.canvas.addEventListener('mousedown', () => this.container.focus());
	}

	private onMouseDown(e: MouseEvent): void {
		const rect = this.canvas.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		this.lastMouse = { x: sx, y: sy };

		if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
			this.isPanning = true;
			this.container.style.cursor = 'grabbing';
			return;
		}

		if (e.button !== 0) {
			return;
		}

		const world = this.screenToWorld(sx, sy);
		const gizmoHit = this.hitTestGizmo(world.x, world.y);
		if (gizmoHit) {
			const selected = this.getSelectedEntity();
			if (!selected) {
				return;
			}
			this.activeGizmo = gizmoHit;
			this.dragStartRotation = selected.transform.rotation;
			this.dragStartAngle = Math.atan2(world.y - selected.transform.position[1], world.x - selected.transform.position[0]);
			this.isDragging = true;
			this.container.style.cursor = gizmoHit === 'rotate' ? 'crosshair' : gizmoHit === 'moveX' ? 'ew-resize' : 'ns-resize';
			return;
		}

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

	private onMouseMove(e: MouseEvent): void {
		const rect = this.canvas.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;

		if (this.isPanning) {
			const dx = sx - this.lastMouse.x;
			const dy = sy - this.lastMouse.y;
			this.cameraX -= dx / this.zoom;
			this.cameraY -= dy / this.zoom;
			this.container.style.cursor = 'grabbing';
		} else if (this.isDragging && this.selectedIds.size === 1) {
			const world = this.screenToWorld(sx, sy);
			const lastWorld = this.screenToWorld(this.lastMouse.x, this.lastMouse.y);
			const selectedId = Array.from(this.selectedIds)[0];
			if (!selectedId) {
				this.lastMouse = { x: sx, y: sy };
				return;
			}
			const ent = this.entities.find(entity => entity.id === selectedId);
			if (ent) {
				if (this.activeGizmo === 'moveX') {
					ent.transform.position[0] -= world.x - lastWorld.x;
				} else if (this.activeGizmo === 'moveY') {
					ent.transform.position[1] -= world.y - lastWorld.y;
				} else if (this.activeGizmo === 'rotate') {
					const currentAngle = Math.atan2(world.y - ent.transform.position[1], world.x - ent.transform.position[0]);
					const delta = currentAngle - this.dragStartAngle;
					ent.transform.rotation = this.normalizeAngle(this.dragStartRotation - delta);
				} else {
					ent.transform.position[0] -= world.x - lastWorld.x;
					ent.transform.position[1] -= world.y - lastWorld.y;
				}
				this._onTransformChanged.fire({ id: selectedId, transform: ent.transform });
			}
		} else {
			const world = this.screenToWorld(sx, sy);
			this.gizmoHover = this.hitTestGizmo(world.x, world.y);
			const hit = this.hitTest(world.x, world.y);
			this.hoveredId = hit?.id ?? null;
			if (this.gizmoHover === 'moveX') {
				this.container.style.cursor = 'ew-resize';
			} else if (this.gizmoHover === 'moveY') {
				this.container.style.cursor = 'ns-resize';
			} else if (this.gizmoHover === 'rotate') {
				this.container.style.cursor = 'crosshair';
			} else {
				this.container.style.cursor = hit ? 'pointer' : 'default';
			}
		}

		this.lastMouse = { x: sx, y: sy };
	}

	private onMouseUp(): void {
		this.isPanning = false;
		this.isDragging = false;
		this.activeGizmo = null;
		this.gizmoHover = null;
		this.container.style.cursor = 'default';
	}

	private onWheel(e: WheelEvent): void {
		e.preventDefault();

		const rect = this.canvas.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		const worldBefore = this.screenToWorld(sx, sy);

		const factor = e.deltaY > 0 ? 1.08 : 0.92;
		this.zoom = Math.max(0.1, Math.min(10, this.zoom * factor));

		const worldAfter = this.screenToWorld(sx, sy);
		this.cameraX -= worldAfter.x - worldBefore.x;
		this.cameraY -= worldAfter.y - worldBefore.y;
	}

	private onKeyDown(e: KeyboardEvent): void {
		if (e.key !== 'Delete' && e.key !== 'Backspace') {
			return;
		}
		for (const id of this.selectedIds) {
			const idx = this.entities.findIndex(entity => entity.id === id);
			if (idx !== -1) {
				this.entities.splice(idx, 1);
			}
		}
		this.selectedIds.clear();
		this._onEntitySelected.fire(null);
	}

	private handleResize(): void {
		const rect = this.container.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		const width = Math.max(1, Math.floor(rect.width * dpr));
		const height = Math.max(1, Math.floor(rect.height * dpr));

		if (this.canvas.width !== width || this.canvas.height !== height) {
			this.canvas.width = width;
			this.canvas.height = height;
		}
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	private getSelectedEntity(): SceneEntity2D | null {
		const selectedId = Array.from(this.selectedIds)[0];
		if (!selectedId) {
			return null;
		}
		return this.entities.find(entity => entity.id === selectedId) ?? null;
	}

	private getGizmoHandlePositions(entity: SceneEntity2D): { moveX: Vec2; moveY: Vec2; rotateRadius: number } {
		const arm = 28 / this.zoom;
		return {
			moveX: { x: entity.transform.position[0] + arm, y: entity.transform.position[1] },
			moveY: { x: entity.transform.position[0], y: entity.transform.position[1] - arm },
			rotateRadius: 18 / this.zoom,
		};
	}

	private hitTestGizmo(wx: number, wy: number): GizmoHandle {
		const selected = this.getSelectedEntity();
		if (!selected) {
			return null;
		}
		const handle = this.getGizmoHandlePositions(selected);
		const hitRadius = 7 / this.zoom;

		const dxX = wx - handle.moveX.x;
		const dyX = wy - handle.moveX.y;
		if (Math.hypot(dxX, dyX) <= hitRadius) {
			return 'moveX';
		}

		const dxY = wx - handle.moveY.x;
		const dyY = wy - handle.moveY.y;
		if (Math.hypot(dxY, dyY) <= hitRadius) {
			return 'moveY';
		}

		const centerDx = wx - selected.transform.position[0];
		const centerDy = wy - selected.transform.position[1];
		const dist = Math.hypot(centerDx, centerDy);
		const ringThreshold = 4 / this.zoom;
		if (Math.abs(dist - handle.rotateRadius) <= ringThreshold) {
			return 'rotate';
		}

		return null;
	}

	private normalizeAngle(angle: number): number {
		let result = angle;
		while (result > Math.PI) {
			result -= Math.PI * 2;
		}
		while (result < -Math.PI) {
			result += Math.PI * 2;
		}
		return result;
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
			const entity = this.entities[i];
			if (!entity.visible) {
				continue;
			}

			const sw = entity.sprite ? entity.sprite.size[0] * entity.transform.scale[0] : 28;
			const sh = entity.sprite ? entity.sprite.size[1] * entity.transform.scale[1] : 28;

			if (
				wx >= entity.transform.position[0] - sw / 2 &&
				wx <= entity.transform.position[0] + sw / 2 &&
				wy >= entity.transform.position[1] - sh / 2 &&
				wy <= entity.transform.position[1] + sh / 2
			) {
				return entity;
			}
		}
		return null;
	}

	override dispose(): void {
		this.stopRendering();
		this.container.remove();
		super.dispose();
	}
}

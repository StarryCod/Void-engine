# Интерактивный Move Gizmo — Полный Патч

Этот файл содержит все изменения для внедрения полноценного интерактивного гизмо с picking и drag.

## Изменения уже внесены:

1. ✅ Plane z-fighting исправлен (translation.y = 0.01)
2. ✅ Добавлены поля в класс ThreeViewport:
   - `selectedEntityId: string | null`
   - `gizmoMode`, `draggingHandle`, `dragStartHit`, `dragStartTranslation`
   - `pendingGizmoPick`
3. ✅ Добавлено событие `onTransformEdited`

## Следующие шаги (требуют ручного внедрения):

### 1. Добавить ray casting функции

После `m4TransposeUpper3x3` добавить:

```typescript
// ============================================================================
// RAY CASTING
// ============================================================================

function getRayFromScreen(camera: EditorCamera, gl: WebGL2RenderingContext, x: number, y: number): { origin: Vec3; dir: Vec3 } {
	const nx = (x / gl.drawingBufferWidth) * 2 - 1;
	const ny = (y / gl.drawingBufferHeight) * 2 - 1;

	const near = v3(0, 0, 0);
	const far = v3(0, 0, 0);

	const inv = camera.invVpMatrix;

	const unproject = (out: Vec3, z: number) => {
		const px = nx, py = ny;
		const w = inv[3] * px + inv[7] * py + inv[11] * z + inv[15];
		out[0] = (inv[0] * px + inv[4] * py + inv[8] * z + inv[12]) / w;
		out[1] = (inv[1] * px + inv[5] * py + inv[9] * z + inv[13]) / w;
		out[2] = (inv[2] * px + inv[6] * py + inv[10] * z + inv[14]) / w;
	};

	unproject(near, -1);
	unproject(far, 1);

	const dir = v3(0, 0, 0);
	v3Sub(dir, far, near);
	v3Normalize(dir, dir);

	return { origin: near, dir };
}

function intersectRayPlane(rayO: Vec3, rayD: Vec3, planeP: Vec3, planeN: Vec3, out: Vec3): boolean {
	const denom = v3Dot(rayD, planeN);
	if (Math.abs(denom) < 1e-6) return false;
	const t = (v3Dot(planeN, planeP) - v3Dot(planeN, rayO)) / denom;
	if (t < 0) return false;
	out[0] = rayO[0] + rayD[0] * t;
	out[1] = rayO[1] + rayD[1] * t;
	out[2] = rayO[2] + rayD[2] * t;
	return true;
}
```

### 2. Заменить метод renderGizmo

Полностью заменить текущий `renderGizmo` на:

```typescript
private renderMoveGizmo(gl: WebGL2RenderingContext, center: Vec3, pickMode: boolean): void {
	if (!this.flatProgram || !this.cylinderGeo || !this.coneGeo) return;

	const dist = v3Dist(this.camera.position, center);
	const L = Math.max(0.4, dist * 0.18);
	const r = L * 0.015;
	const headH = L * 0.22;
	const headR = L * 0.05;

	const drawAxis = (axis: 'x' | 'y' | 'z', color: [number, number, number, number], handleId: number) => {
		let q: number[] = [0, 0, 0, 1];
		let dir = v3(0, 1, 0);
		if (axis === 'x') { q = [0, 0, -0.707106, 0.707106]; dir = v3(1, 0, 0); }
		else if (axis === 'z') { q = [0.707106, 0, 0, 0.707106]; dir = v3(0, 0, 1); }

		const model = m4Create();
		const mvp = m4Create();

		// STEM
		m4FromTRS(model, [center[0], center[1], center[2]], q, [r / 0.5, L / 1.0, r / 0.5]);
		m4Multiply(mvp, this.camera.vpMatrix, model);
		gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram!, 'uMVP'), false, mvp);

		if (pickMode) {
			const [cr, cg, cb, ca] = entityIdToColor(handleId);
			gl.uniform4f(gl.getUniformLocation(this.flatProgram!, 'uFlatColor'), cr, cg, cb, ca);
		} else {
			gl.uniform4f(gl.getUniformLocation(this.flatProgram!, 'uFlatColor'), color[0], color[1], color[2], color[3]);
		}
		gl.bindVertexArray(this.cylinderGeo!.vao);
		gl.drawElements(gl.TRIANGLES, this.cylinderGeo!.indexCount, gl.UNSIGNED_SHORT, 0);

		// HEAD
		const tip = v3(center[0] + dir[0] * L, center[1] + dir[1] * L, center[2] + dir[2] * L);
		m4FromTRS(model, [tip[0], tip[1], tip[2]], q, [headR / 0.5, headH / 1.0, headR / 0.5]);
		m4Multiply(mvp, this.camera.vpMatrix, model);
		gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram!, 'uMVP'), false, mvp);

		gl.bindVertexArray(this.coneGeo!.vao);
		gl.drawElements(gl.TRIANGLES, this.coneGeo!.indexCount, gl.UNSIGNED_SHORT, 0);
	};

	gl.useProgram(this.flatProgram);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);

	drawAxis('x', [0.9, 0.2, 0.2, 1.0], 10);
	drawAxis('y', [0.2, 0.9, 0.2, 1.0], 11);
	drawAxis('z', [0.2, 0.2, 0.9, 1.0], 12);

	gl.bindVertexArray(null);
	gl.enable(gl.DEPTH_TEST);
}
```

### 3. Добавить gizmo picking

```typescript
private performGizmoPick(gl: WebGL2RenderingContext, x: number, y: number): 'tx' | 'ty' | 'tz' | null {
	if (!this.pickingFBO || !this.selectedEntityId) return null;

	const items = this.getRenderList();
	const it = items.find(i => i.entity.id === this.selectedEntityId);
	if (!it) return null;

	const center = v3(it.worldMatrix[12], it.worldMatrix[13], it.worldMatrix[14]);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFBO.framebuffer);
	gl.viewport(0, 0, this.pickingFBO.width, this.pickingFBO.height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.disable(gl.BLEND);

	this.renderMoveGizmo(gl, center, true);

	const pixel = new Uint8Array(4);
	gl.readPixels(Math.floor(x), Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
	const id = colorToEntityId(pixel);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
	gl.clearColor(0, 0, 0, 1);

	if (id === 10) return 'tx';
	if (id === 11) return 'ty';
	if (id === 12) return 'tz';
	return null;
}
```

### 4. Добавить drag логику

```typescript
private startTranslateDrag(handle: 'tx'|'ty'|'tz', x: number, y: number): void {
	if (!this.scene || !this.selectedEntityId) return;

	const items = this.getRenderList();
	const it = items.find(i => i.entity.id === this.selectedEntityId);
	if (!it) return;

	const tr = it.entity.components.find(c => c.type === 'Transform') as any;
	if (!tr) return;

	this.draggingHandle = handle;
	this.dragStartTranslation = v3(tr.translation[0], tr.translation[1], tr.translation[2]);

	const center = v3(it.worldMatrix[12], it.worldMatrix[13], it.worldMatrix[14]);
	const axisDir = (handle === 'tx') ? v3(1,0,0) : (handle === 'ty') ? v3(0,1,0) : v3(0,0,1);

	const viewDir = v3(0,0,0);
	v3Sub(viewDir, this.camera.position, center);
	v3Normalize(viewDir, viewDir);

	const tmp = v3(0,0,0);
	v3Cross(tmp, viewDir, axisDir);
	const planeN = v3(0,0,0);
	v3Cross(planeN, axisDir, tmp);
	v3Normalize(planeN, planeN);

	const ray = getRayFromScreen(this.camera, this.gl!, x, y);
	intersectRayPlane(ray.origin, ray.dir, center, planeN, this.dragStartHit);
}

private updateTranslateDrag(x: number, y: number): void {
	if (!this.draggingHandle || !this.selectedEntityId) return;

	const items = this.getRenderList();
	const it = items.find(i => i.entity.id === this.selectedEntityId);
	if (!it) return;

	const tr = it.entity.components.find(c => c.type === 'Transform') as any;
	if (!tr) return;

	const center = v3(it.worldMatrix[12], it.worldMatrix[13], it.worldMatrix[14]);
	const axisDir = (this.draggingHandle === 'tx') ? v3(1,0,0) : (this.draggingHandle === 'ty') ? v3(0,1,0) : v3(0,0,1);

	const viewDir = v3(0,0,0);
	v3Sub(viewDir, this.camera.position, center);
	v3Normalize(viewDir, viewDir);

	const tmp = v3(0,0,0);
	v3Cross(tmp, viewDir, axisDir);
	const planeN = v3(0,0,0);
	v3Cross(planeN, axisDir, tmp);
	v3Normalize(planeN, planeN);

	const ray = getRayFromScreen(this.camera, this.gl!, x, y);
	const hit = v3(0,0,0);
	if (!intersectRayPlane(ray.origin, ray.dir, center, planeN, hit)) return;

	const delta = v3(0,0,0);
	v3Sub(delta, hit, this.dragStartHit);
	const amount = v3Dot(delta, axisDir);

	const newT: [number,number,number] = [
		this.dragStartTranslation[0] + axisDir[0]*amount,
		this.dragStartTranslation[1] + axisDir[1]*amount,
		this.dragStartTranslation[2] + axisDir[2]*amount,
	];

	tr.translation = newT;
	this._onTransformEdited.fire({ entityId: this.selectedEntityId, translation: newT });
}

private stopTranslateDrag(): void {
	this.draggingHandle = null;
}
```

### 5. Обновить input handlers

В `setupInputHandlers()`, заменить LMB блок в mousedown:

```typescript
} else if (e.button === 0) {
	const rect = canvas.getBoundingClientRect();
	const px = (e.clientX - rect.left) * this.dpr;
	const py = (canvas.height - (e.clientY - rect.top) * this.dpr);

	// Try gizmo first
	if (this.selectedEntityId) {
		this.pendingGizmoPick = { x: px, y: py };
		return;
	}

	// Else pick entity
	this.pendingPick = { x: px, y: py };
}
```

В mousemove, добавить в начало:

```typescript
if (this.draggingHandle) {
	const rect = canvas.getBoundingClientRect();
	const px = (e.clientX - rect.left) * this.dpr;
	const py = (canvas.height - (e.clientY - rect.top) * this.dpr);
	this.updateTranslateDrag(px, py);
	return;
}
```

В mouseup, добавить:

```typescript
if (e.button === 0) {
	this.stopTranslateDrag();
}
```

### 6. Обновить renderFrame

После `renderSelectionOutline(gl)`:

```typescript
// Draw gizmo
if (this.selectedEntityId) {
	const items = this.getRenderList();
	const it = items.find(i => i.entity.id === this.selectedEntityId);
	if (it) {
		this.renderMoveGizmo(gl, v3(it.worldMatrix[12], it.worldMatrix[13], it.worldMatrix[14]), false);
	}
}
```

После render calls, перед overlay:

```typescript
if (this.pendingGizmoPick) {
	const h = this.performGizmoPick(gl, this.pendingGizmoPick.x, this.pendingGizmoPick.y);
	if (h) {
		this.startTranslateDrag(h, this.pendingGizmoPick.x, this.pendingGizmoPick.y);
	} else {
		this.performPick(gl, this.pendingGizmoPick.x, this.pendingGizmoPick.y);
	}
	this.pendingGizmoPick = null;
}
```

### 7. Обновить performPick

В конце `performPick`, заменить:

```typescript
const items = this.getRenderList();
const picked = (pickedIndex >= 0 && pickedIndex < items.length) ? items[pickedIndex].entity : null;
this.selectedEntityId = picked?.id ?? null;
this.selectedEntityIndex = pickedIndex;
this._onEntityPicked.fire(this.selectedEntityId);
```

## Статус

- ✅ Plane z-fighting исправлен
- ✅ Поля добавлены
- ✅ События добавлены
- ⏳ Ray casting функции (требуют внедрения)
- ⏳ Новый renderMoveGizmo (требует внедрения)
- ⏳ Gizmo picking (требует внедрения)
- ⏳ Drag логика (требует внедрения)
- ⏳ Input handlers (требуют обновления)
- ⏳ renderFrame (требует обновления)

Из-за большого объема кода, рекомендую внедрять пошагово и тестировать после каждого шага.

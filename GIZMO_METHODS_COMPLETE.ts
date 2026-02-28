// ============================================================================
// ИНТЕРАКТИВНЫЙ MOVE GIZMO - ПОЛНАЯ РЕАЛИЗАЦИЯ
// Скопируй эти методы в класс ThreeViewport
// ============================================================================

// Заменить старый renderGizmo на этот:
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

// Добавить новый метод:
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

// Добавить новый метод:
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

// Добавить новый метод:
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

// Добавить новый метод:
private stopTranslateDrag(): void {
	this.draggingHandle = null;
}

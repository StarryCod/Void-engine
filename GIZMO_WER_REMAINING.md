# Оставшаяся реализация W/E/R Gizmo

Я внедрил основу, но из-за ограничений по размеру нужно добавить вручную следующие методы после `idToHandle()`:

## 1. Добавить после idToHandle():

```typescript
private renderGizmoTranslate(gl: WebGL2RenderingContext, center: Vec3, pickMode: boolean): void {
	if (!this.flatProgram || !this.cylinderGeo || !this.coneGeo) return;

	const dist = v3Dist(this.camera.position, center);
	const L = Math.max(0.4, dist * 0.18);
	const r = L * 0.012;
	const headH = L * 0.22;
	const headR = L * 0.05;

	const drawAxis = (axis: 'x' | 'y' | 'z', rgba: [number,number,number,number], handle: 'tx'|'ty'|'tz') => {
		let q: number[] = [0,0,0,1];
		let dir = v3(0,1,0);
		if (axis === 'x') { q = [0,0,-0.707106,0.707106]; dir = v3(1,0,0); }
		else if (axis === 'z') { q = [0.707106,0,0,0.707106]; dir = v3(0,0,1); }

		const stemM = m4Create(), mvp = m4Create();

		// stem
		m4FromTRS(stemM, [center[0],center[1],center[2]], q, [r/0.5, L/1.0, r/0.5]);
		m4Multiply(mvp, this.camera.vpMatrix, stemM);
		gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram!, 'uMVP'), false, mvp);

		if (pickMode) {
			const [cr,cg,cb,ca] = entityIdToColor(this.handleId(handle));
			gl.uniform4f(gl.getUniformLocation(this.flatProgram!, 'uFlatColor'), cr,cg,cb,ca);
		} else {
			gl.uniform4f(gl.getUniformLocation(this.flatProgram!, 'uFlatColor'), rgba[0],rgba[1],rgba[2],rgba[3]);
		}

		gl.bindVertexArray(this.cylinderGeo!.vao);
		gl.drawElements(gl.TRIANGLES, this.cylinderGeo!.indexCount, gl.UNSIGNED_SHORT, 0);

		// head at tip
		const tip = v3(center[0] + dir[0]*L, center[1] + dir[1]*L, center[2] + dir[2]*L);
		m4FromTRS(stemM, [tip[0],tip[1],tip[2]], q, [headR/0.5, headH/1.0, headR/0.5]);
		m4Multiply(mvp, this.camera.vpMatrix, stemM);
		gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram!, 'uMVP'), false, mvp);

		gl.bindVertexArray(this.coneGeo!.vao);
		gl.drawElements(gl.TRIANGLES, this.coneGeo!.indexCount, gl.UNSIGNED_SHORT, 0);
	};

	gl.useProgram(this.flatProgram);
	gl.disable(gl.DEPTH_TEST);
	gl.disable(gl.BLEND);

	drawAxis('x', [0.90,0.20,0.20,1.0], 'tx');
	drawAxis('y', [0.20,0.90,0.20,1.0], 'ty');
	drawAxis('z', [0.20,0.20,0.90,1.0], 'tz');

	gl.bindVertexArray(null);
	gl.enable(gl.DEPTH_TEST);
}
```

Продолжение в следующем файле из-за ограничения размера...

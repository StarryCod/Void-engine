/*---------------------------------------------------------------------------------------------
 *  Void Engine — WebGL2 2D Viewport
 *  Pure WebGL2, no dependencies, CSP-safe.
 *  Features: Grid, Zoom, Pan, 2D Sprites, Collision Shapes, Gizmos
 *  Design: Godot-style 2D editor with orange accents from AI-IDE reference
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import * as DOM from '../../../../base/browser/dom.js';
import { VecnParser, VecnScene } from '../common/vecnParser.js';
import { Entity, Component } from '../common/vecnTypes.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import {
	createNode2DGeometry,
	createCollisionShape2DGeometry,
	createCharacterBody2DGeometry,
	createRigidBody2DGeometry,
	createStaticBody2DGeometry,
	createRayCast2DGeometry,
	createNavigationAgent2DGeometry,
	createNavigationObstacle2DGeometry,
	createPathFollow2DGeometry
} from './gizmoHelpers.js';

// ============================================================================
// DESIGN SYSTEM - Godot + AI-IDE Orange Accent
// ============================================================================

export const VOID_2D_COLORS = {
	// Background
	background: [0.13, 0.13, 0.13, 1.0] as [number, number, number, number],
	
	// Grid
	gridMinor: [0.25, 0.25, 0.25, 0.3] as [number, number, number, number],
	gridMajor: [0.35, 0.35, 0.35, 0.5] as [number, number, number, number],
	
	// Axes (Godot style: X=Red, Y=Green)
	axisX: [0.95, 0.35, 0.35, 0.9] as [number, number, number, number],
	axisY: [0.35, 0.95, 0.35, 0.9] as [number, number, number, number],
	
	// Orange accent (AI-IDE style)
	accent: [0.90, 0.49, 0.13, 1.0] as [number, number, number, number], // #E67E22
	accentLight: [1.0, 0.60, 0.25, 1.0] as [number, number, number, number],
	accentDark: [0.75, 0.40, 0.10, 1.0] as [number, number, number, number],
	
	// Selection
	selection: [0.20, 0.55, 0.85, 1.0] as [number, number, number, number], // #3498DB
	selectionOutline: [0.30, 0.65, 0.95, 1.0] as [number, number, number, number],
	
	// 2D Node colors
	sprite2D: [0.60, 0.75, 0.90, 0.9] as [number, number, number, number],
	collision2D: [0.35, 0.80, 0.45, 0.9] as [number, number, number, number],
	area2D: [0.50, 0.70, 0.90, 0.7] as [number, number, number, number],
	rigidBody2D: [0.40, 0.65, 0.90, 0.9] as [number, number, number, number],
	characterBody2D: [0.25, 0.60, 0.85, 0.9] as [number, number, number, number],
	staticBody2D: [0.50, 0.52, 0.55, 0.9] as [number, number, number, number],
	rayCast2D: [0.88, 0.32, 0.32, 0.9] as [number, number, number, number],
	navAgent2D: [0.28, 0.68, 0.78, 0.9] as [number, number, number, number],
	navObstacle2D: [0.82, 0.42, 0.22, 0.9] as [number, number, number, number],
	path2D: [0.35, 0.75, 0.85, 0.9] as [number, number, number, number],
	marker2D: [0.90, 0.85, 0.35, 0.9] as [number, number, number, number],
};

// ============================================================================
// MATH - 2D specific
// ============================================================================

type Vec2 = Float32Array;
type Mat3 = Float32Array;

function v2(x: number, y: number): Vec2 {
	return new Float32Array([x, y]);
}

function v2Copy(out: Vec2, a: Vec2): Vec2 {
	out[0] = a[0]; out[1] = a[1]; return out;
}

function v2Add(out: Vec2, a: Vec2, b: Vec2): Vec2 {
	out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; return out;
}

function v2Sub(out: Vec2, a: Vec2, b: Vec2): Vec2 {
	out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; return out;
}

function v2Scale(out: Vec2, a: Vec2, s: number): Vec2 {
	out[0] = a[0] * s; out[1] = a[1] * s; return out;
}

function v2Len(a: Vec2): number {
	return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
}

function m3Create(): Mat3 { return new Float32Array(9); }

function m3Identity(out: Mat3): Mat3 {
	out.fill(0);
	out[0] = out[4] = out[8] = 1;
	return out;
}

// 2D Orthographic projection
function m3Ortho(out: Mat3, left: number, right: number, bottom: number, top: number): Mat3 {
	out.fill(0);
	out[0] = 2 / (right - left);
	out[4] = 2 / (top - bottom);
	out[6] = -(right + left) / (right - left);
	out[7] = -(top + bottom) / (top - bottom);
	out[8] = 1;
	return out;
}

// 2D Translation
function m3Translate(out: Mat3, a: Mat3, v: Vec2): Mat3 {
	const [x, y] = v;
	out[0] = a[0]; out[1] = a[1]; out[2] = a[2];
	out[3] = a[3]; out[4] = a[4]; out[5] = a[5];
	out[6] = a[0] * x + a[3] * y + a[6];
	out[7] = a[1] * x + a[4] * y + a[7];
	out[8] = a[2] * x + a[5] * y + a[8];
	return out;
}

// 2D Scale
function m3Scale(out: Mat3, a: Mat3, v: Vec2): Mat3 {
	const [x, y] = v;
	out[0] = a[0] * x; out[1] = a[1] * x; out[2] = a[2] * x;
	out[3] = a[3] * y; out[4] = a[4] * y; out[5] = a[5] * y;
	out[6] = a[6]; out[7] = a[7]; out[8] = a[8];
	return out;
}

// 2D Rotation
function m3Rotate(out: Mat3, a: Mat3, rad: number): Mat3 {
	const s = Math.sin(rad);
	const c = Math.cos(rad);
	out[0] = a[0] * c + a[3] * s;
	out[1] = a[1] * c + a[4] * s;
	out[2] = a[2] * c + a[5] * s;
	out[3] = a[0] * -s + a[3] * c;
	out[4] = a[1] * -s + a[4] * c;
	out[5] = a[2] * -s + a[5] * c;
	out[6] = a[6]; out[7] = a[7]; out[8] = a[8];
	return out;
}

// Multiply
function m3Multiply(out: Mat3, a: Mat3, b: Mat3): Mat3 {
	const a00 = a[0], a01 = a[1], a02 = a[2];
	const a10 = a[3], a11 = a[4], a12 = a[5];
	const a20 = a[6], a21 = a[7], a22 = a[8];
	const b00 = b[0], b01 = b[1], b02 = b[2];
	const b10 = b[3], b11 = b[4], b12 = b[5];
	const b20 = b[6], b21 = b[7], b22 = b[8];
	out[0] = b00 * a00 + b01 * a10 + b02 * a20;
	out[1] = b00 * a01 + b01 * a11 + b02 * a21;
	out[2] = b00 * a02 + b01 * a12 + b02 * a22;
	out[3] = b10 * a00 + b11 * a10 + b12 * a20;
	out[4] = b10 * a01 + b11 * a11 + b12 * a21;
	out[5] = b10 * a02 + b11 * a12 + b12 * a22;
	out[6] = b20 * a00 + b21 * a10 + b22 * a20;
	out[7] = b20 * a01 + b21 * a11 + b22 * a21;
	out[8] = b20 * a02 + b21 * a12 + b22 * a22;
	return out;
}

// Inverse
function m3Invert(out: Mat3, a: Mat3): Mat3 | null {
	const a00 = a[0], a01 = a[1], a02 = a[2];
	const a10 = a[3], a11 = a[4], a12 = a[5];
	const a20 = a[6], a21 = a[7], a22 = a[8];
	const b01 = a22 * a11 - a12 * a21;
	const b11 = -a22 * a10 + a12 * a20;
	const b21 = a21 * a10 - a11 * a20;
	let det = a00 * b01 + a01 * b11 + a02 * b21;
	if (!det) return null;
	det = 1.0 / det;
	out[0] = b01 * det;
	out[1] = (-a22 * a01 + a02 * a21) * det;
	out[2] = (a12 * a01 - a02 * a11) * det;
	out[3] = b11 * det;
	out[4] = (a22 * a00 - a02 * a20) * det;
	out[5] = (-a12 * a00 + a02 * a10) * det;
	out[6] = b21 * det;
	out[7] = (-a21 * a00 + a01 * a20) * det;
	out[8] = (a11 * a00 - a01 * a10) * det;
	return out;
}

// ============================================================================
// SHADERS - WebGL2
// ============================================================================

const GRID_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
uniform mat3 uProjection;
uniform mat3 uView;
out vec2 vWorldPos;
void main() {
	vWorldPos = aPosition;
	vec3 pos = uProjection * uView * vec3(aPosition, 1.0);
	gl_Position = vec4(pos.xy, 0.0, 1.0);
}`;

const GRID_FRAG = `#version 300 es
precision highp float;
in vec2 vWorldPos;
uniform vec2 uResolution;
uniform float uZoom;
uniform vec2 uPan;
uniform float uTime;
out vec4 fragColor;

// Smooth grid with anti-aliasing
float grid(vec2 pos, float scale) {
	vec2 grid = abs(fract(pos * scale - 0.5) - 0.5) / fwidth(pos * scale);
	float line = min(grid.x, grid.y);
	return 1.0 - min(line, 1.0);
}

void main() {
	// Background
	vec3 color = vec3(0.13, 0.13, 0.13);
	
	// Minor grid (1 unit)
	float minor = grid(vWorldPos, 1.0) * 0.12;
	
	// Major grid (10 units)
	float major = grid(vWorldPos, 0.1) * 0.25;
	
	// Combine grids
	float g = max(minor, major);
	color += vec3(g * 0.5);
	
	// Axis lines (thicker, colored)
	float axisWidth = 1.5 / uZoom;
	
	// X axis (red)
	float xAxis = 1.0 - smoothstep(0.0, axisWidth, abs(vWorldPos.y));
	color = mix(color, vec3(0.95, 0.35, 0.35), xAxis * 0.9);
	
	// Y axis (green)
	float yAxis = 1.0 - smoothstep(0.0, axisWidth, abs(vWorldPos.x));
	color = mix(color, vec3(0.35, 0.95, 0.35), yAxis * 0.9);
	
	// Origin marker
	float originDist = length(vWorldPos);
	float origin = 1.0 - smoothstep(3.0 / uZoom, 5.0 / uZoom, originDist);
	color = mix(color, vec3(0.90, 0.49, 0.13), origin * 0.3);
	
	fragColor = vec4(color, 1.0);
}`;

const FLAT_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
uniform mat3 uMVP;
void main() {
	vec3 pos = uMVP * vec3(aPosition, 1.0);
	gl_Position = vec4(pos.xy, 0.0, 1.0);
}`;

const FLAT_FRAG = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 fragColor;
void main() {
	fragColor = uColor;
}`;

const LINE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
uniform mat3 uMVP;
void main() {
	vec3 pos = uMVP * vec3(aPosition, 1.0);
	gl_Position = vec4(pos.xy, 0.0, 1.0);
	gl_Position.z = -0.001; // Bring lines forward
}`;

const LINE_FRAG = `#version 300 es
precision highp float;
uniform vec4 uColor;
uniform float uAlpha;
out vec4 fragColor;
void main() {
	fragColor = vec4(uColor.rgb, uColor.a * uAlpha);
}`;

const SPRITE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aTexCoord;
uniform mat3 uMVP;
out vec2 vTexCoord;
void main() {
	vTexCoord = aTexCoord;
	vec3 pos = uMVP * vec3(aPosition, 1.0);
	gl_Position = vec4(pos.xy, 0.0, 1.0);
}`;

const SPRITE_FRAG = `#version 300 es
precision highp float;
in vec2 vTexCoord;
uniform sampler2D uTexture;
uniform vec4 uColor;
out vec4 fragColor;
void main() {
	vec4 tex = texture(uTexture, vTexCoord);
	if (tex.a < 0.01) discard;
	fragColor = tex * uColor;
}`;

const RECT_OUTLINE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
uniform mat3 uMVP;
uniform vec2 uSize;
uniform vec2 uOffset;
uniform float uLineWidth;
void main() {
	// Expand rect for outline
	vec2 dir = sign(aPosition);
	vec2 expanded = aPosition + dir * uLineWidth * 0.5;
	vec3 pos = uMVP * vec3(expanded * uSize + uOffset, 1.0);
	gl_Position = vec4(pos.xy, 0.0, 1.0);
}`;

const CIRCLE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
uniform mat3 uMVP;
uniform vec2 uCenter;
uniform float uRadius;
void main() {
	vec2 pos = uCenter + aPosition * uRadius;
	vec3 clipPos = uMVP * vec3(pos, 1.0);
	gl_Position = vec4(clipPos.xy, 0.0, 1.0);
}`;

// ============================================================================
// GEOMETRY GENERATORS
// ============================================================================

interface GLBuffer {
	vao: WebGLVertexArrayObject;
	vertexCount: number;
}

function createGridVAO(gl: WebGL2RenderingContext): GLBuffer {
	// Full-screen quad for grid shader
	const vertices = new Float32Array([
		-1, -1,
		1, -1,
		-1, 1,
		1, 1
	]);
	
	const vao = gl.createVertexArray()!;
	gl.bindVertexArray(vao);
	
	const vbo = gl.createBuffer()!;
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	
	return { vao, vertexCount: 4 };
}

function createRectVAO(gl: WebGL2RenderingContext, width: number, height: number): GLBuffer {
	const hw = width / 2;
	const hh = height / 2;
	const vertices = new Float32Array([
		-hw, -hh,
		hw, -hh,
		hw, hh,
		-hw, hh
	]);
	
	const vao = gl.createVertexArray()!;
	gl.bindVertexArray(vao);
	
	const vbo = gl.createBuffer()!;
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	
	return { vao, vertexCount: 4 };
}

function createCircleVAO(gl: WebGL2RenderingContext, segments: number = 32): GLBuffer {
	const vertices: number[] = [];
	for (let i = 0; i <= segments; i++) {
		const angle = (i / segments) * Math.PI * 2;
		vertices.push(Math.cos(angle), Math.sin(angle));
	}
	
	const vao = gl.createVertexArray()!;
	gl.bindVertexArray(vao);
	
	const vbo = gl.createBuffer()!;
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	
	return { vao, vertexCount: segments + 1 };
}

function createLineVAO(gl: WebGL2RenderingContext, points: Vec2[]): GLBuffer {
	const vertices: number[] = [];
	for (const p of points) {
		vertices.push(p[0], p[1]);
	}
	
	const vao = gl.createVertexArray()!;
	gl.bindVertexArray(vao);
	
	const vbo = gl.createBuffer()!;
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	
	return { vao, vertexCount: points.length };
}

// ============================================================================
// 2D OBJECT RENDERER
// ============================================================================

interface Object2D {
	id: string;
	name: string;
	type: string;
	position: Vec2;
	rotation: number;
	scale: Vec2;
	visible: boolean;
	selected: boolean;
	// Type-specific data
	width?: number;
	height?: number;
	radius?: number;
	color?: [number, number, number, number];
	texture?: string;
	children: Object2D[];
}

// ============================================================================
// EDITOR CAMERA 2D
// ============================================================================

interface EditorCamera2D {
	position: Vec2;
	zoom: number;
	minZoom: number;
	maxZoom: number;
	projectionMatrix: Mat3;
	viewMatrix: Mat3;
	viewProjectionMatrix: Mat3;
	invViewProjectionMatrix: Mat3;
}

function createCamera2D(): EditorCamera2D {
	return {
		position: v2(0, 0),
		zoom: 1.0,
		minZoom: 0.1,
		maxZoom: 100.0,
		projectionMatrix: m3Create(),
		viewMatrix: m3Create(),
		viewProjectionMatrix: m3Create(),
		invViewProjectionMatrix: m3Create()
	};
}

function updateCamera2D(camera: EditorCamera2D, width: number, height: number): void {
	const hw = width / 2 / camera.zoom;
	const hh = height / 2 / camera.zoom;
	
	// Orthographic projection
	m3Ortho(camera.projectionMatrix, -hw, hw, -hh, hh);
	
	// View matrix (inverse of camera transform)
	m3Identity(camera.viewMatrix);
	m3Translate(camera.viewMatrix, camera.viewMatrix, v2(-camera.position[0], -camera.position[1]));
	
	// Combined
	m3Multiply(camera.viewProjectionMatrix, camera.projectionMatrix, camera.viewMatrix);
	
	// Inverse for picking
	m3Invert(camera.invViewProjectionMatrix, camera.viewProjectionMatrix);
}

// ============================================================================
// MAIN VIEWPORT CLASS
// ============================================================================

export class Viewport2DWebGL extends Disposable {
	private canvas: HTMLCanvasElement;
	private gl: WebGL2RenderingContext;
	private width: number = 0;
	private height: number = 0;
	private camera: EditorCamera2D;
	private animationFrame: number = 0;
	private startTime: number = 0;
	
	// Shaders
	private gridProgram: WebGLProgram | null = null;
	private flatProgram: WebGLProgram | null = null;
	private lineProgram: WebGLProgram | null = null;
	
	// Buffers
	private gridVAO: GLBuffer | null = null;
	private rectVAO: GLBuffer | null = null;
	private circleVAO: GLBuffer | null = null;
	
	// Scene data
	private objects: Object2D[] = [];
	private selectedId: string | null = null;
	
	// Interaction
	private isPanning: boolean = false;
	private lastMouse: Vec2 = v2(0, 0);
	
	// Events
	private readonly _onObjectSelected = new Emitter<string | null>();
	readonly onObjectSelected: Event<string | null> = this._onObjectSelected.event;
	
	constructor(parent: HTMLElement) {
		super();
		
		this.canvas = document.createElement('canvas');
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';
		this.canvas.style.display = 'block';
		this.canvas.style.background = '#212121';
		this.canvas.style.cursor = 'grab';
		
		DOM.append(parent, this.canvas);
		
		const gl = this.canvas.getContext('webgl2', {
			antialias: true,
			alpha: false,
			premultipliedAlpha: false,
			preserveDrawingBuffer: true
		});
		
		if (!gl) {
			throw new Error('WebGL2 not supported');
		}
		this.gl = gl;
		
		// Initialize camera
		this.camera = createCamera2D();
		
		// Initialize shaders
		this.initShaders();
		this.initBuffers();
		
		// Event listeners
		this.initEventListeners();
		
		// Resize observer
		const observer = new ResizeObserver(() => this.resize());
		observer.observe(parent);
		
		// Start render loop
		this.startTime = performance.now();
		this.startRenderLoop();
		
		// Initial resize
		setTimeout(() => this.resize(), 10);
	}
	
	private initShaders(): void {
		const gl = this.gl;
		
		this.gridProgram = this.createProgram(GRID_VERT, GRID_FRAG);
		this.flatProgram = this.createProgram(FLAT_VERT, FLAT_FRAG);
		this.lineProgram = this.createProgram(LINE_VERT, LINE_FRAG);
	}
	
	private initBuffers(): void {
		const gl = this.gl;
		
		this.gridVAO = createGridVAO(gl);
		this.rectVAO = createRectVAO(gl, 1, 1);
		this.circleVAO = createCircleVAO(gl, 64);
	}
	
	private initEventListeners(): void {
		// Mouse events for pan/zoom
		this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
		this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
		this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
		this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
		
		// Keyboard
		this.canvas.tabIndex = 0;
		this.canvas.addEventListener('keydown', this.onKeyDown.bind(this));
	}
	
	private createProgram(vertSrc: string, fragSrc: string): WebGLProgram | null {
		const gl = this.gl;
		
		const vert = gl.createShader(gl.VERTEX_SHADER)!;
		gl.shaderSource(vert, vertSrc);
		gl.compileShader(vert);
		if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS)) {
			console.error('Vertex shader error:', gl.getShaderInfoLog(vert));
			return null;
		}
		
		const frag = gl.createShader(gl.FRAGMENT_SHADER)!;
		gl.shaderSource(frag, fragSrc);
		gl.compileShader(frag);
		if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
			console.error('Fragment shader error:', gl.getShaderInfoLog(frag));
			return null;
		}
		
		const prog = gl.createProgram()!;
		gl.attachShader(prog, vert);
		gl.attachShader(prog, frag);
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			console.error('Program link error:', gl.getProgramInfoLog(prog));
			return null;
		}
		
		return prog;
	}
	
	private resize(): void {
		const parent = this.canvas.parentElement;
		if (!parent) return;
		
		const dpr = window.devicePixelRatio || 1;
		this.width = parent.clientWidth;
		this.height = parent.clientHeight;
		
		this.canvas.width = this.width * dpr;
		this.canvas.height = this.height * dpr;
		
		this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		updateCamera2D(this.camera, this.width, this.height);
	}
	
	private startRenderLoop(): void {
		const render = () => {
			this.render();
			this.animationFrame = requestAnimationFrame(render);
		};
		render();
	}
	
	private render(): void {
		const gl = this.gl;
		const time = (performance.now() - this.startTime) / 1000;
		
		// Clear
		gl.clearColor(...VOID_2D_COLORS.background);
		gl.clear(gl.COLOR_BUFFER_BIT);
		
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		
		// Render grid
		this.renderGrid(time);
		
		// Render objects
		this.renderObjects();
	}
	
	private renderGrid(time: number): void {
		const gl = this.gl;
		if (!this.gridProgram || !this.gridVAO) return;
		
		gl.useProgram(this.gridProgram);
		
		// Set uniforms
		gl.uniformMatrix3fv(
			gl.getUniformLocation(this.gridProgram, 'uProjection'),
			false,
			this.camera.projectionMatrix
		);
		gl.uniformMatrix3fv(
			gl.getUniformLocation(this.gridProgram, 'uView'),
			false,
			this.camera.viewMatrix
		);
		gl.uniform2f(
			gl.getUniformLocation(this.gridProgram, 'uResolution'),
			this.width, this.height
		);
		gl.uniform1f(
			gl.getUniformLocation(this.gridProgram, 'uZoom'),
			this.camera.zoom
		);
		gl.uniform2f(
			gl.getUniformLocation(this.gridProgram, 'uPan'),
			this.camera.position[0], this.camera.position[1]
		);
		gl.uniform1f(
			gl.getUniformLocation(this.gridProgram, 'uTime'),
			time
		);
		
		gl.bindVertexArray(this.gridVAO.vao);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.gridVAO.vertexCount);
	}
	
	private renderObjects(): void {
		const gl = this.gl;
		
		for (const obj of this.objects) {
			if (!obj.visible) continue;
			
			// Build model matrix
			const model = m3Create();
			m3Identity(model);
			m3Translate(model, model, obj.position);
			m3Rotate(model, model, obj.rotation);
			m3Scale(model, model, obj.scale);
			
			// Build MVP
			const mvp = m3Create();
			m3Multiply(mvp, this.camera.viewProjectionMatrix, model);
			
			// Render based on type
			this.renderObject(obj, mvp);
			
			// Render selection outline
			if (obj.selected) {
				this.renderSelectionOutline(obj, mvp);
			}
		}
	}
	
	private renderObject(obj: Object2D, mvp: Mat3): void {
		const gl = this.gl;
		if (!this.flatProgram) return;
		
		gl.useProgram(this.flatProgram);
		gl.uniformMatrix3fv(gl.getUniformLocation(this.flatProgram, 'uMVP'), false, mvp);
		gl.uniform4fv(gl.getUniformLocation(this.flatProgram, 'uColor'), obj.color || VOID_2D_COLORS.sprite2D);
		
		// Render shape based on type
		if (obj.type === 'Sprite2D' || obj.type === 'Node2D') {
			// Rectangle sprite
			if (!this.rectVAO) return;
			gl.bindVertexArray(this.rectVAO.vao);
			gl.drawArrays(gl.TRIANGLE_FAN, 0, this.rectVAO.vertexCount);
		} else if (obj.type === 'CollisionShape2D') {
			if (obj.radius) {
				// Circle collision
				if (!this.circleVAO) return;
				gl.bindVertexArray(this.circleVAO.vao);
				gl.drawArrays(gl.LINE_LOOP, 0, this.circleVAO.vertexCount);
			} else {
				// Rectangle collision
				if (!this.rectVAO) return;
				gl.bindVertexArray(this.rectVAO.vao);
				gl.drawArrays(gl.LINE_LOOP, 0, this.rectVAO.vertexCount);
			}
		}
	}
	
	private renderSelectionOutline(obj: Object2D, mvp: Mat3): void {
		const gl = this.gl;
		if (!this.lineProgram) return;
		
		gl.useProgram(this.lineProgram);
		gl.uniformMatrix3fv(gl.getUniformLocation(this.lineProgram, 'uMVP'), false, mvp);
		gl.uniform4fv(gl.getUniformLocation(this.lineProgram, 'uColor'), VOID_2D_COLORS.selectionOutline);
		gl.uniform1f(gl.getUniformLocation(this.lineProgram, 'uAlpha'), 1.0);
		
		gl.lineWidth(2);
		
		if (!this.rectVAO) return;
		gl.bindVertexArray(this.rectVAO.vao);
		gl.drawArrays(gl.LINE_LOOP, 0, this.rectVAO.vertexCount);
	}
	
	// ===== INTERACTION =====
	
	private onMouseDown(e: MouseEvent): void {
		if (e.button === 1 || (e.button === 0 && e.altKey)) {
			// Middle mouse or Alt+Left for pan
			this.isPanning = true;
			this.lastMouse = v2(e.clientX, e.clientY);
			this.canvas.style.cursor = 'grabbing';
		} else if (e.button === 0) {
			// Left click for selection
			this.pickObject(e.clientX, e.clientY);
		}
	}
	
	private onMouseMove(e: MouseEvent): void {
		if (this.isPanning) {
			const dx = (e.clientX - this.lastMouse[0]) / this.camera.zoom;
			const dy = (e.clientY - this.lastMouse[1]) / this.camera.zoom;
			
			this.camera.position[0] -= dx;
			this.camera.position[1] += dy; // Invert Y
			
			this.lastMouse = v2(e.clientX, e.clientY);
			updateCamera2D(this.camera, this.width, this.height);
		}
	}
	
	private onMouseUp(e: MouseEvent): void {
		this.isPanning = false;
		this.canvas.style.cursor = 'grab';
	}
	
	private onWheel(e: WheelEvent): void {
		e.preventDefault();
		
		const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
		this.camera.zoom = Math.max(
			this.camera.minZoom,
			Math.min(this.camera.maxZoom, this.camera.zoom * zoomFactor)
		);
		
		updateCamera2D(this.camera, this.width, this.height);
	}
	
	private onKeyDown(e: KeyboardEvent): void {
		switch (e.key) {
			case 'f':
				// Frame selected or all objects
				this.frameSelected();
				break;
			case 'Escape':
				this.selectedId = null;
				for (const obj of this.objects) obj.selected = false;
				this._onObjectSelected.fire(null);
				break;
		}
	}
	
	private pickObject(screenX: number, screenY: number): void {
		// Convert screen to world coordinates
		const rect = this.canvas.getBoundingClientRect();
		const x = ((screenX - rect.left) / rect.width) * 2 - 1;
		const y = -((screenY - rect.top) / rect.height) * 2 + 1;
		
		const worldPos = v2(0, 0);
		const clipPos = v2(x, y);
		
		// Unproject
		const inv = this.camera.invViewProjectionMatrix;
		worldPos[0] = inv[0] * clipPos[0] + inv[3] * clipPos[1] + inv[6];
		worldPos[1] = inv[1] * clipPos[0] + inv[4] * clipPos[1] + inv[7];
		
		// Check intersection with objects
		for (const obj of this.objects) {
			if (!obj.visible) continue;
			
			// Simple AABB check
			const hw = (obj.width || 100) / 2;
			const hh = (obj.height || 100) / 2;
			
			if (
				worldPos[0] >= obj.position[0] - hw &&
				worldPos[0] <= obj.position[0] + hw &&
				worldPos[1] >= obj.position[1] - hh &&
				worldPos[1] <= obj.position[1] + hh
			) {
				this.selectObject(obj.id);
				return;
			}
		}
		
		// Deselect
		this.selectObject(null);
	}
	
	private frameSelected(): void {
		// Center camera on selected or all objects
		if (this.objects.length === 0) return;
		
		const selected = this.objects.find(o => o.selected);
		if (selected) {
			this.camera.position = v2Copy(v2(0, 0), selected.position);
		} else {
			// Frame all objects
			let minX = Infinity, maxX = -Infinity;
			let minY = Infinity, maxY = -Infinity;
			
			for (const obj of this.objects) {
				const hw = (obj.width || 100) / 2;
				const hh = (obj.height || 100) / 2;
				minX = Math.min(minX, obj.position[0] - hw);
				maxX = Math.max(maxX, obj.position[0] + hw);
				minY = Math.min(minY, obj.position[1] - hh);
				maxY = Math.max(maxY, obj.position[1] + hh);
			}
			
			this.camera.position = v2((minX + maxX) / 2, (minY + maxY) / 2);
			const size = Math.max(maxX - minX, maxY - minY);
			this.camera.zoom = Math.min(1, 500 / size);
		}
		
		updateCamera2D(this.camera, this.width, this.height);
	}
	
	// ===== PUBLIC API =====
	
	public selectObject(id: string | null): void {
		this.selectedId = id;
		for (const obj of this.objects) {
			obj.selected = obj.id === id;
		}
		this._onObjectSelected.fire(id);
	}
	
	public loadScene(scene: VecnScene): void {
		this.objects = [];
		
		const convertEntity = (entity: Entity): Object2D | null => {
			// Find Transform2D
			const transform = entity.components.find(c => c.type === 'Transform2D') as 
				| { type: 'Transform2D'; position: [number, number]; rotation: number; scale: [number, number] }
				| undefined;
			
			// Find visual/physics component
			let type = 'Node2D';
			let width = 100;
			let height = 100;
			let color = VOID_2D_COLORS.sprite2D;
			
			for (const comp of entity.components) {
				switch (comp.type) {
					case 'Sprite2D':
						type = 'Sprite2D';
						color = VOID_2D_COLORS.sprite2D;
						break;
					case 'CollisionShape2D':
						type = 'CollisionShape2D';
						color = VOID_2D_COLORS.collision2D;
						if (comp.shape.type === 'Rectangle') {
							width = comp.shape.size[0];
							height = comp.shape.size[1];
						} else if (comp.shape.type === 'Circle') {
							width = height = comp.shape.radius * 2;
						}
						break;
					case 'CharacterBody2D':
						type = 'CharacterBody2D';
						color = VOID_2D_COLORS.characterBody2D;
						break;
					case 'RigidBody2D':
						type = 'RigidBody2D';
						color = VOID_2D_COLORS.rigidBody2D;
						break;
					case 'StaticBody2D':
						type = 'StaticBody2D';
						color = VOID_2D_COLORS.staticBody2D;
						break;
					case 'Area2D':
						type = 'Area2D';
						color = VOID_2D_COLORS.area2D;
						break;
				}
			}
			
			const obj: Object2D = {
				id: entity.id,
				name: entity.name,
				type,
				position: v2(transform?.position[0] || 0, transform?.position[1] || 0),
				rotation: transform?.rotation || 0,
				scale: v2(transform?.scale[0] || 1, transform?.scale[1] || 1),
				visible: entity.visible,
				selected: false,
				width,
				height,
				color,
				children: []
			};
			
			// Process children
			for (const child of entity.children) {
				const childObj = convertEntity(child);
				if (childObj) obj.children.push(childObj);
			}
			
			return obj;
		};
		
		for (const entity of scene.entities) {
			const obj = convertEntity(entity);
			if (obj) this.objects.push(obj);
		}
	}
	
	public addObject(obj: Object2D): void {
		this.objects.push(obj);
	}
	
	public removeObject(id: string): void {
		const index = this.objects.findIndex(o => o.id === id);
		if (index >= 0) this.objects.splice(index, 1);
	}
	
	public updateObjectTransform(id: string, position: Vec2, rotation?: number, scale?: Vec2): void {
		const obj = this.objects.find(o => o.id === id);
		if (!obj) return;
		
		v2Copy(obj.position, position);
		if (rotation !== undefined) obj.rotation = rotation;
		if (scale) v2Copy(obj.scale, scale);
	}
	
	public setZoom(zoom: number): void {
		this.camera.zoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, zoom));
		updateCamera2D(this.camera, this.width, this.height);
	}
	
	public pan(dx: number, dy: number): void {
		this.camera.position[0] += dx / this.camera.zoom;
		this.camera.position[1] += dy / this.camera.zoom;
		updateCamera2D(this.camera, this.width, this.height);
	}
	
	public resetView(): void {
		this.camera.position = v2(0, 0);
		this.camera.zoom = 1.0;
		updateCamera2D(this.camera, this.width, this.height);
	}
	
	override dispose(): void {
		cancelAnimationFrame(this.animationFrame);
		this._onObjectSelected.dispose();
		super.dispose();
	}
}

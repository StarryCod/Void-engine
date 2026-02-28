/*---------------------------------------------------------------------------------------------
 *  Void Engine — WebGL2 3D Viewport v8
 *  Pure WebGL2, no dependencies, CSP-safe.
 *  FIXED: RON anonymous tuples, Some() wrappers, camera fly mode
 *  UPDATED: Professional wireframe gizmos from gizmoHelpers.ts
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import * as DOM from '../../../../base/browser/dom.js';
import { VecnParser, VecnScene } from '../common/vecnParser.js';
import { Entity, Component } from '../common/vecnTypes.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import {
        createCameraFrustumGeometry,
        createWireframeCubeGeometry,
        createWireframeSphereGeometry,
        createWireframeCylinderGeometry,
        createSpotlightConeGeometry,
        createPointLightHelperGeometry,
        createSunRaysGeometry,
        createCharacterBodyGeometry,
        createRayCastGeometry,
        createAreaGeometry,
        createSpeakerGeometry,
        createFilmReelGeometry,
        createNavRegionGeometry,
        createParticleEmitterGeometry,
        createTimerGeometry,
        createMarkerGeometry,
        createShapeCastGeometry,
        createNode2DGeometry,
        createCollisionShape2DGeometry,
        createSkeletonGeometry,
        createBoneAttachmentGeometry,
        createVisibilityNotifierGeometry,
        createRemoteTransformGeometry,
        createMultiMeshGeometry,
        createCanvasLayerGeometry,
        createPath2DGeometry,
        createNavRegion2DGeometry,
        // NEW: 2D Physics gizmos
        createCharacterBody2DGeometry,
        createRigidBody2DGeometry,
        createStaticBody2DGeometry,
        createRayCast2DGeometry,
        // NEW: 2D Navigation gizmos
        createNavigationAgent2DGeometry,
        createNavigationObstacle2DGeometry,
        createPathFollow2DGeometry,
        // NEW: Viewport gizmos
        createViewportGeometry3D,
        createSubViewportGeometry
} from './gizmoHelpers.js';

// Gizmo colors for consistent styling across all helpers
const GIZMO_COLORS = {
        camera: [0.45, 0.70, 0.90] as [number, number, number],
        pointLight: [0.95, 0.88, 0.45] as [number, number, number],
        directionalLight: [1.0, 0.85, 0.35] as [number, number, number],
        spotLight: [0.95, 0.80, 0.40] as [number, number, number],
        characterBody: [0.30, 0.65, 0.90] as [number, number, number],
        area: [0.25, 0.85, 0.35] as [number, number, number],
        rayCast: [0.90, 0.35, 0.35] as [number, number, number],
        audio: [0.75, 0.55, 0.85] as [number, number, number],
        animation: [0.90, 0.65, 0.35] as [number, number, number],
        navRegion: [0.35, 0.75, 0.85] as [number, number, number],
        particles: [0.95, 0.65, 0.35] as [number, number, number],
        timer: [0.65, 0.65, 0.65] as [number, number, number],
        marker: [0.90, 0.85, 0.35] as [number, number, number],
        worldEnv: [0.35, 0.75, 0.45] as [number, number, number],
        sky: [0.45, 0.65, 0.90] as [number, number, number],
        fog: [0.70, 0.75, 0.80] as [number, number, number],
        // Additional colors for new node types
        shapeCast: [0.85, 0.45, 0.35] as [number, number, number],
        node2D: [0.60, 0.60, 0.65] as [number, number, number],
        sprite2D: [0.75, 0.75, 0.80] as [number, number, number],
        skeleton: [0.90, 0.45, 0.50] as [number, number, number],
        bone: [0.85, 0.55, 0.60] as [number, number, number],
        visibility: [0.50, 0.80, 0.50] as [number, number, number],
        remoteTransform: [0.70, 0.50, 0.90] as [number, number, number],
        multiMesh: [0.65, 0.70, 0.80] as [number, number, number],
        canvasLayer: [0.55, 0.55, 0.60] as [number, number, number],
        path2D: [0.35, 0.75, 0.85] as [number, number, number],
        physics2D: [0.45, 0.70, 0.55] as [number, number, number],
        navRegion2D: [0.30, 0.70, 0.80] as [number, number, number],
        // NEW: Additional 2D colors
        characterBody2D: [0.25, 0.60, 0.85] as [number, number, number],
        rigidBody2D: [0.35, 0.65, 0.90] as [number, number, number],
        staticBody2D: [0.50, 0.52, 0.55] as [number, number, number],
        rayCast2D: [0.88, 0.32, 0.32] as [number, number, number],
        navAgent2D: [0.28, 0.68, 0.78] as [number, number, number],
        navObstacle2D: [0.82, 0.42, 0.22] as [number, number, number],
        pathFollow2D: [0.38, 0.72, 0.82] as [number, number, number],
        viewport: [0.52, 0.58, 0.68] as [number, number, number],
        subViewport: [0.48, 0.54, 0.64] as [number, number, number],
};

// Export for use in other modules
export { GIZMO_COLORS };

// ============================================================================
// MATH
// ============================================================================

type Vec3 = Float32Array;
type Mat4 = Float32Array;

const EPSILON = 1e-6;
const DEG2RAD = Math.PI / 180;

function v3(x: number, y: number, z: number): Vec3 {
        return new Float32Array([x, y, z]);
}

function v3Copy(out: Vec3, a: Vec3): Vec3 {
        out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out;
}

function v3Add(out: Vec3, a: Vec3, b: Vec3): Vec3 {
        out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2]; return out;
}

function v3Sub(out: Vec3, a: Vec3, b: Vec3): Vec3 {
        out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2]; return out;
}

function v3ScaleAdd(out: Vec3, a: Vec3, b: Vec3, s: number): Vec3 {
        out[0] = a[0] + b[0] * s; out[1] = a[1] + b[1] * s; out[2] = a[2] + b[2] * s; return out;
}

function v3Len(a: Vec3): number {
        return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

function v3Normalize(out: Vec3, a: Vec3): Vec3 {
        const l = v3Len(a);
        if (l < EPSILON) { out[0] = out[1] = out[2] = 0; return out; }
        const inv = 1 / l;
        out[0] = a[0] * inv; out[1] = a[1] * inv; out[2] = a[2] * inv;
        return out;
}

function v3Cross(out: Vec3, a: Vec3, b: Vec3): Vec3 {
        const ax = a[0], ay = a[1], az = a[2];
        const bx = b[0], by = b[1], bz = b[2];
        out[0] = ay * bz - az * by;
        out[1] = az * bx - ax * bz;
        out[2] = ax * by - ay * bx;
        return out;
}

function v3Dot(a: Vec3, b: Vec3): number {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function v3Lerp(out: Vec3, a: Vec3, b: Vec3, t: number): Vec3 {
        out[0] = a[0] + (b[0] - a[0]) * t;
        out[1] = a[1] + (b[1] - a[1]) * t;
        out[2] = a[2] + (b[2] - a[2]) * t;
        return out;
}

function v3Dist(a: Vec3, b: Vec3): number {
        const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function m4Create(): Mat4 { return new Float32Array(16); }

function m4Identity(out: Mat4): Mat4 {
        out.fill(0); out[0] = out[5] = out[10] = out[15] = 1; return out;
}

function m4Perspective(out: Mat4, fovY: number, aspect: number, near: number, far: number): Mat4 {
        const f = 1.0 / Math.tan(fovY / 2);
        const nf = 1 / (near - far);
        out.fill(0);
        out[0] = f / aspect; out[5] = f;
        out[10] = (far + near) * nf; out[11] = -1;
        out[14] = 2 * far * near * nf;
        return out;
}

function m4LookAt(out: Mat4, eye: Vec3, center: Vec3, up: Vec3): Mat4 {
        const f = v3(0, 0, 0), s = v3(0, 0, 0), u = v3(0, 0, 0);
        v3Sub(f, center, eye); v3Normalize(f, f);
        v3Cross(s, f, up); v3Normalize(s, s);
        v3Cross(u, s, f);
        out[0] = s[0]; out[1] = u[0]; out[2] = -f[0]; out[3] = 0;
        out[4] = s[1]; out[5] = u[1]; out[6] = -f[1]; out[7] = 0;
        out[8] = s[2]; out[9] = u[2]; out[10] = -f[2]; out[11] = 0;
        out[12] = -v3Dot(s, eye); out[13] = -v3Dot(u, eye);
        out[14] = v3Dot(f, eye); out[15] = 1;
        return out;
}

function m4Multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
        for (let i = 0; i < 4; i++) {
                const ai0 = a[i], ai4 = a[i + 4], ai8 = a[i + 8], ai12 = a[i + 12];
                out[i] = ai0 * b[0] + ai4 * b[1] + ai8 * b[2] + ai12 * b[3];
                out[i + 4] = ai0 * b[4] + ai4 * b[5] + ai8 * b[6] + ai12 * b[7];
                out[i + 8] = ai0 * b[8] + ai4 * b[9] + ai8 * b[10] + ai12 * b[11];
                out[i + 12] = ai0 * b[12] + ai4 * b[13] + ai8 * b[14] + ai12 * b[15];
        }
        return out;
}

function m4Invert(out: Mat4, a: Mat4): Mat4 | null {
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
        const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
        const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
        const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
        const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
        const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
        const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        if (Math.abs(det) < EPSILON) return null;
        det = 1.0 / det;
        out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
        return out;
}

function m4FromQuat(out: Mat4, q: number[]): Mat4 {
        const [x, y, z, w] = q;
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2;
        const yy = y * y2, yz = y * z2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;
        out[0] = 1 - (yy + zz); out[1] = xy + wz; out[2] = xz - wy; out[3] = 0;
        out[4] = xy - wz; out[5] = 1 - (xx + zz); out[6] = yz + wx; out[7] = 0;
        out[8] = xz + wy; out[9] = yz - wx; out[10] = 1 - (xx + yy); out[11] = 0;
        out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
        return out;
}

function m4FromTRS(out: Mat4, t: number[], q: number[], s: number[]): Mat4 {
        m4FromQuat(out, q);
        out[0] *= s[0]; out[1] *= s[0]; out[2] *= s[0];
        out[4] *= s[1]; out[5] *= s[1]; out[6] *= s[1];
        out[8] *= s[2]; out[9] *= s[2]; out[10] *= s[2];
        out[12] = t[0]; out[13] = t[1]; out[14] = t[2];
        return out;
}

function m4TransposeUpper3x3(out: Mat4, a: Mat4): Mat4 {
        m4Identity(out);
        out[0] = a[0]; out[1] = a[4]; out[2] = a[8];
        out[4] = a[1]; out[5] = a[5]; out[6] = a[9];
        out[8] = a[2]; out[9] = a[6]; out[10] = a[10];
        return out;
}

// m4Copy removed - not used

// ====================
// QUAT helpers
// ====================
type Quat = [number, number, number, number];

function quatNormalize(q: Quat): Quat {
        const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
        return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

function quatMul(a: Quat, b: Quat): Quat {
        const ax = a[0], ay = a[1], az = a[2], aw = a[3];
        const bx = b[0], by = b[1], bz = b[2], bw = b[3];
        return [
                aw * bx + ax * bw + ay * bz - az * by,
                aw * by - ax * bz + ay * bw + az * bx,
                aw * bz + ax * by - ay * bx + az * bw,
                aw * bw - ax * bx - ay * by - az * bz,
        ];
}

function quatFromAxisAngle(axis: Vec3, angleRad: number): Quat {
        const half = angleRad * 0.5;
        const s = Math.sin(half);
        const c = Math.cos(half);
        const n = v3(0, 0, 0);
        v3Normalize(n, axis);
        return quatNormalize([n[0] * s, n[1] * s, n[2] * s, c]);
}

// quatToEulerXYZDeg removed - not used after HUD removal

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

// ============================================================================
// SHADERS
// ============================================================================

const BG_VERT = `#version 300 es
void main() {
        vec2 pos = vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1) * 2.0 - 1.0;
        gl_Position = vec4(pos, 0.999999, 1.0);
}`;

// Procedural Sky Shader - UE5-inspired with realistic sun, clouds, atmosphere
// Background modes: 0=Sky, 1=SolidColor, 2=Gradient
const BG_FRAG = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec3 uCameraPos;
uniform mat4 uInvViewProj;

// Background mode control
uniform int uBackgroundMode;  // 0=Sky, 1=SolidColor, 2=Gradient
uniform vec4 uBackgroundColor; // For solid color mode
uniform vec4 uGradientTop;     // For gradient mode
uniform vec4 uGradientBottom;  // For gradient mode

// Sky parameters
uniform vec3 uSkyTopColor;
uniform vec3 uSkyHorizonColor;
uniform float uSkyCurve;
uniform float uSkyEnergy;

// Ground parameters  
uniform vec3 uGroundBottomColor;
uniform vec3 uGroundHorizonColor;
uniform float uGroundCurve;
uniform float uGroundEnergy;

// Sun parameters
uniform bool uSunEnabled;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform float uSunEnergy;
uniform float uSunAngleMin;
uniform float uSunAngleMax;

// Clouds
uniform bool uCloudsEnabled;
uniform vec3 uCloudsColor;
uniform float uCloudsDensity;
uniform float uCloudsSpeed;
uniform float uCloudsHeight;
uniform float uCloudsCoverage;
uniform float uCloudsThickness;
uniform float uTime;

// Fog
uniform bool uFogEnabled;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uFogDepthBegin;
uniform float uFogDepthEnd;

out vec4 fragColor;

// ========================================
// NOISE FUNCTIONS - High quality
// ========================================

float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash3(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
                mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                f.y
        );
}

float noise3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float n = i.x + i.y * 57.0 + i.z * 113.0;
        return mix(
                mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
                    mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
                mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
                    mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y),
                f.z
        );
}

// Fractional Brownian Motion - higher quality
float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < 6; i++) {
                value += amplitude * noise(p * frequency);
                frequency *= 2.0;
                amplitude *= 0.5;
        }
        return value;
}

// 3D FBM for volumetric clouds
float fbm3D(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
                value += amplitude * noise3D(p);
                p *= 2.0;
                amplitude *= 0.5;
        }
        return value;
}

// ========================================
// ATMOSPHERIC SCATTERING (Simplified)
// ========================================

// Rayleigh scattering coefficient (sky blue)
vec3 rayleighScatter(vec3 dir, vec3 sunDir) {
        float cosTheta = max(dot(dir, sunDir), 0.0);
        // Rayleigh phase function: 3/16pi * (1 + cos^2)
        float phase = (3.0 / 16.0 * 3.14159) * (1.0 + cosTheta * cosTheta);
        // Wavelength-dependent scattering (more blue)
        vec3 betaR = vec3(5.8e-6, 13.5e-6, 33.1e-6);
        return betaR * phase;
}

// Mie scattering coefficient (sun glow)
float mieScatter(vec3 dir, vec3 sunDir, float g) {
        float cosTheta = dot(dir, sunDir);
        // Henyey-Greenstein phase function
        float g2 = g * g;
        float num = (1.0 - g2);
        float denom = 4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5);
        return num / denom;
}

// ========================================
// SKY COLOR WITH ATMOSPHERE
// ========================================

vec3 getAtmosphericSkyColor(vec3 dir, vec3 sunDir) {
        // Base sky gradient
        float elevation = dir.y;
        
        // Sky contribution
        float skyMix = pow(max(0.0, elevation), uSkyCurve);
        vec3 sky = mix(uSkyHorizonColor, uSkyTopColor, skyMix);
        
        // Ground contribution (for negative elevation)
        float groundMix = pow(max(0.0, -elevation), uGroundCurve);
        vec3 ground = mix(uGroundHorizonColor, uGroundBottomColor, groundMix);
        
        // Blend based on elevation
        vec3 result;
        if (elevation > 0.0) {
                result = mix(uSkyHorizonColor, sky, pow(elevation, 0.5));
        } else {
                result = mix(uSkyHorizonColor, ground, pow(-elevation, 0.5));
        }
        
        // Add atmospheric scattering for realism
        if (uSunEnabled && elevation > -0.1) {
                vec3 sunDirNorm = normalize(sunDir);
                
                // Rayleigh scattering (blue sky tint near sun)
                vec3 rayleigh = rayleighScatter(dir, sunDirNorm) * 15.0;
                
                // Mie scattering (sun glow/halo)
                float mie = mieScatter(dir, sunDirNorm, 0.76) * 0.001;
                
                // Apply scattering near horizon and towards sun
                float horizonFade = 1.0 - pow(abs(elevation), 0.3);
                float sunInfluence = max(dot(dir, sunDirNorm), 0.0);
                
                result += rayleigh * sunInfluence * horizonFade * 0.5;
                result += vec3(1.0, 0.95, 0.8) * mie * sunInfluence * uSunEnergy * 0.1;
        }
        
        return result * uSkyEnergy;
}

// ========================================
// REALISTIC SUN DISK
// ========================================

vec3 getSun(vec3 dir, vec3 sunDir) {
        if (!uSunEnabled) return vec3(0.0);
        
        float sunDist = distance(dir, normalize(sunDir));
        float sunAngle = radians(uSunAngleMin) * 0.5;
        float glowAngle = radians(uSunAngleMax);
        
        // Sun disk with limb darkening (more realistic)
        float disk = 0.0;
        if (sunDist < sunAngle) {
                // Normalized distance from center (0 at center, 1 at edge)
                float r = sunDist / sunAngle;
                // Limb darkening: I(r) = I0 * (1 - (1 - u) * (1 - sqrt(1 - r^2)))
                // where u ≈ 0.6 for the Sun
                float u = 0.6;
                float limbDarkening = 1.0 - (1.0 - u) * (1.0 - sqrt(1.0 - r * r));
                disk = limbDarkening;
        }
        
        // Soft sun glow (multiple layers for realism)
        float glow1 = exp(-sunDist * 8.0) * 0.6;   // Inner bright glow
        float glow2 = exp(-sunDist * 2.5) * 0.3;   // Medium glow
        float glow3 = exp(-sunDist * 1.0) * 0.1;   // Outer soft glow
        
        float totalGlow = (glow1 + glow2 + glow3) * uSunEnergy;
        
        // Combine disk and glow
        float intensity = (disk + totalGlow);
        
        // Sun color with energy
        return uSunColor * intensity;
}

// ========================================
// VOLUMETRIC CLOUDS
// ========================================

float getClouds(vec3 dir, float depth) {
        if (!uCloudsEnabled) return 0.0;
        
        // Project to cloud height
        if (abs(dir.y) < 0.01) return 0.0;
        
        float t = uCloudsHeight / dir.y;
        if (t < 0.0) return 0.0; // Clouds only above
        
        vec3 cloudPos = dir * t;
        
        // Animate clouds (different speeds for different layers)
        float time = uTime * uCloudsSpeed;
        vec2 wind1 = vec2(time * 10.0, time * 3.0);
        vec2 wind2 = vec2(time * 7.0, -time * 2.0);
        
        // Multi-layer cloud noise
        vec2 p1 = cloudPos.xz * 0.003 + wind1 * 0.5;
        vec2 p2 = cloudPos.xz * 0.008 + wind2 * 0.3;
        vec2 p3 = cloudPos.xz * 0.0015;
        
        float n1 = fbm(p1);
        float n2 = fbm(p2);
        float n3 = fbm(p3);
        
        // Combine layers with detail
        float cloudNoise = n1 * 0.6 + n2 * 0.3 + n3 * 0.1;
        
        // Coverage threshold
        float coverage = 1.0 - uCloudsCoverage;
        cloudNoise = smoothstep(coverage, coverage + 0.4, cloudNoise);
        
        // Cloud thickness/density variation
        float thickness = fbm(p1 * 2.0) * uCloudsThickness * 0.01;
        cloudNoise *= (0.5 + thickness);
        
        // Distance fade
        float dist = length(cloudPos.xz);
        float fadeNear = smoothstep(0.0, 200.0, dist);
        float fadeFar = 1.0 - smoothstep(800.0, 2000.0, dist);
        float fade = fadeNear * fadeFar;
        
        // Height-based density (clouds are more dense at certain altitudes)
        float heightDensity = exp(-abs(cloudPos.y - uCloudsHeight) / (uCloudsThickness * 2.0));
        
        return cloudNoise * uCloudsDensity * fade * heightDensity;
}

// ========================================
// MAIN RENDER
// ========================================

void main() {
        // Get ray direction from screen position
        vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
        vec4 nearH = uInvViewProj * vec4(uv, -1.0, 1.0);
        vec4 farH = uInvViewProj * vec4(uv, 1.0, 1.0);
        vec3 near = nearH.xyz / nearH.w;
        vec3 far = farH.xyz / farH.w;
        vec3 rayDir = normalize(far - near);
        
        vec3 color;
        
        // Check background mode
        if (uBackgroundMode == 1) {
                // Solid color mode - simple background
                color = uBackgroundColor.rgb;
        } else if (uBackgroundMode == 2) {
                // Gradient mode - vertical gradient
                float t = uv.y * 0.5 + 0.5;
                color = mix(uGradientBottom.rgb, uGradientTop.rgb, t);
        } else {
                // Sky mode (default) - full procedural sky
                vec3 sunDir = normalize(uSunDirection);
                
                // Get atmospheric sky color
                color = getAtmosphericSkyColor(rayDir, sunDir);
                
                // Add realistic sun
                vec3 sunContrib = getSun(rayDir, sunDir);
                color += sunContrib;
                
                // Add volumetric clouds
                float clouds = getClouds(rayDir, 1000.0);
                if (clouds > 0.01) {
                        // Clouds with lighting (sun-facing side brighter)
                        float sunLight = max(dot(rayDir, sunDir), 0.0);
                        vec3 cloudCol = mix(uCloudsColor * 0.7, uCloudsColor * 1.3, sunLight);
                        
                        // Darken clouds on back side
                        if (uSunEnabled) {
                                cloudCol = mix(cloudCol * 0.6, cloudCol, sunLight);
                        }
                        color = mix(color, cloudCol, clouds * 0.9);
                }
                
                // Add fog (depth-based)
                if (uFogEnabled) {
                        float depth = 1000.0;
                        float fogFactor = 1.0 - exp(-uFogDensity * depth);
                        fogFactor = clamp(fogFactor, 0.0, 1.0);
                        
                        // Fog height falloff
                        float heightFog = 1.0 - smoothstep(uFogDepthBegin, uFogDepthEnd, -rayDir.y * 100.0);
                        fogFactor *= heightFog;
                        
                        color = mix(color, uFogColor, fogFactor * 0.6);
                }
                
                // Tone mapping (ACES Filmic - more cinematic)
                float a = 2.51;
                float b = 0.03;
                float c = 2.43;
                float d = 0.59;
                float e = 0.14;
                color = clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
        }
        
        fragColor = vec4(color, 1.0);
}`;

const GRID_VERT = `#version 300 es
precision highp float;
uniform mat4 uInvViewProj;
out vec3 vNearPoint;
out vec3 vFarPoint;
void main() {
        vec2 pos = vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1) * 2.0 - 1.0;
        gl_Position = vec4(pos, 0.0, 1.0);
        vec4 nearH = uInvViewProj * vec4(pos, -1.0, 1.0);
        vec4 farH  = uInvViewProj * vec4(pos,  1.0, 1.0);
        vNearPoint = nearH.xyz / nearH.w;
        vFarPoint  = farH.xyz  / farH.w;
}`;

const GRID_FRAG = `#version 300 es
precision highp float;
in vec3 vNearPoint;
in vec3 vFarPoint;
uniform mat4 uViewProj;
out vec4 fragColor;

float computeDepth(vec3 pos) {
        vec4 clip = uViewProj * vec4(pos, 1.0);
        return (clip.z / clip.w) * 0.5 + 0.5;
}

float pristineGrid(vec3 pos, float scale) {
        vec2 coord = pos.xz * scale;
        vec2 ddx = dFdx(coord);
        vec2 ddy = dFdy(coord);
        vec2 deriv = vec2(length(vec2(ddx.x, ddy.x)), length(vec2(ddx.y, ddy.y)));
        vec2 grid = abs(fract(coord - 0.5) - 0.5) / deriv;
        float line = min(grid.x, grid.y);
        return 1.0 - min(line, 1.0);
}

void main() {
        float t = -vNearPoint.y / (vFarPoint.y - vNearPoint.y);
        if (t < 0.0) discard;
        vec3 fragPos = vNearPoint + t * (vFarPoint - vNearPoint);
        gl_FragDepth = computeDepth(fragPos);

        float dist = length(fragPos.xz);

        // Fade: close = visible, far = gone
        float fadeNear = smoothstep(0.0, 3.0, dist) * 0.3 + 0.7; // slight fade-in near origin
        float fadeFar  = 1.0 - smoothstep(25.0, 80.0, dist);
        if (fadeFar < 0.001) discard;
        float fade = fadeNear * fadeFar;

        // Minor grid: every 1 unit — barely visible, light whisper
        float minor = pristineGrid(fragPos, 1.0) * 0.07;

        // Major grid: every 10 units — darker, structural
        float major = pristineGrid(fragPos, 0.1) * 0.18;

        // Combine: major is dominant
        float g = max(minor, major);

        // Axis lines
        vec2 axDeriv = fwidth(fragPos.xz);
        float xAxis = 1.0 - min(abs(fragPos.z) / max(axDeriv.y, 0.0001), 1.0);
        float zAxis = 1.0 - min(abs(fragPos.x) / max(axDeriv.x, 0.0001), 1.0);

        // Base grid color: neutral grey
        vec3 color = vec3(g * 0.6);

        // Axis coloring — subtle but readable
        color = mix(color, vec3(0.72, 0.18, 0.16), xAxis * 0.85); // X red
        color = mix(color, vec3(0.16, 0.38, 0.72), zAxis * 0.85); // Z blue

        float alpha = max(g, max(xAxis * 0.8, zAxis * 0.8)) * fade;
        if (alpha < 0.002) discard;

        fragColor = vec4(color, alpha);
}`;

const MESH_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform mat4 uNormalMatrix;
out vec3 vWorldPos;
out vec3 vWorldNormal;
void main() {
        vec4 worldPos = uModel * vec4(aPosition, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((uNormalMatrix * vec4(aNormal, 0.0)).xyz);
        gl_Position = uProj * uView * worldPos;
}`;

const MESH_FRAG = `#version 300 es
precision highp float;
in vec3 vWorldPos;
in vec3 vWorldNormal;
uniform vec3 uColor;
uniform vec3 uCameraPos;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform float uMetallic;
uniform float uRoughness;
uniform float uNumLights;  // 0 = no lights, use preview lighting
out vec4 fragColor;

// Improved 3-point lighting for preview mode
void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(uCameraPos - vWorldPos);
        
        // Fresnel for rim lighting
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        
        vec3 finalColor = vec3(0.0);
        
        if (uNumLights < 0.5) {
                // === PREVIEW MODE: Professional 3-point studio lighting ===
                
                // Key light (main, warm, from upper-right-front)
                vec3 keyDir = normalize(vec3(0.6, 0.8, 0.5));
                float keyNdotL = max(dot(N, keyDir), 0.0);
                vec3 keyDiff = uColor * keyNdotL * vec3(1.0, 0.98, 0.95) * 0.85;
                
                // Fill light (softer, cooler, from left)
                vec3 fillDir = normalize(vec3(-0.5, 0.3, 0.4));
                float fillNdotL = max(dot(N, fillDir), 0.0);
                vec3 fillDiff = uColor * fillNdotL * vec3(0.85, 0.88, 1.0) * 0.35;
                
                // Rim/back light (from behind, creates edge definition)
                vec3 rimDir = normalize(vec3(-0.3, 0.2, -0.7));
                float rimNdotL = max(dot(N, rimDir), 0.0);
                vec3 rimDiff = uColor * rimNdotL * vec3(0.9, 0.95, 1.0) * 0.25;
                
                // Sky dome ambient (hemisphere)
                float skyFactor = N.y * 0.5 + 0.5;
                vec3 skyAmbient = uColor * mix(vec3(0.12, 0.13, 0.18), vec3(0.22, 0.24, 0.30), skyFactor) * 0.5;
                
                // Ground bounce (subtle warm from below)
                float groundFactor = -N.y * 0.5 + 0.5;
                vec3 groundBounce = uColor * vec3(0.15, 0.12, 0.10) * groundFactor * 0.3;
                
                // Combine diffuse terms
                finalColor = keyDiff + fillDiff + rimDiff + skyAmbient + groundBounce;
                
                // Specular for key light
                vec3 keyH = normalize(keyDir + V);
                float keySpec = pow(max(dot(N, keyH), 0.0), mix(16.0, 256.0, 1.0 - uRoughness));
                vec3 specColor = mix(vec3(0.04), uColor, uMetallic);
                finalColor += specColor * keySpec * vec3(1.0, 0.98, 0.95) * 0.6;
                
                // Fresnel rim (subtle, for edge definition)
                finalColor += vec3(0.15, 0.17, 0.22) * fresnel * (1.0 - uRoughness * 0.5);
                
        } else {
                // === SCENE LIGHTS MODE: Use actual scene lights ===
                vec3 L = normalize(uLightDir);
                vec3 H = normalize(L + V);
                
                float NdotL = max(dot(N, L), 0.0);
                vec3 diffuse = uColor * NdotL * uLightColor;
                
                float shininess = mix(8.0, 128.0, 1.0 - uRoughness);
                float NdotH = max(dot(N, H), 0.0);
                float spec = pow(NdotH, shininess) * (1.0 - uRoughness * 0.8);
                vec3 specColor = mix(vec3(0.04), uColor, uMetallic);
                vec3 specular = specColor * spec * uLightColor;
                
                vec3 ambient = uColor * uAmbientColor;
                
                // Hemisphere sky light
                float skyFactor = N.y * 0.5 + 0.5;
                vec3 skyLight = uColor * mix(vec3(0.08, 0.08, 0.10), vec3(0.14, 0.15, 0.18), skyFactor);
                
                // Fill light (always present, subtle)
                vec3 fillDir = normalize(vec3(-0.3, 0.2, -0.5));
                float fillDot = max(dot(N, fillDir), 0.0);
                vec3 fill = uColor * fillDot * vec3(0.08, 0.09, 0.12);
                
                finalColor = ambient + diffuse + specular + fill + skyLight;
                
                // Fresnel rim
                finalColor += vec3(0.08, 0.10, 0.14) * fresnel * (1.0 - uRoughness * 0.5);
        }
        
        // Output
        fragColor = vec4(finalColor, 1.0);
}`;

const FLAT_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
uniform mat4 uMVP;
void main() {
        gl_Position = uMVP * vec4(aPosition, 1.0);
}`;

const FLAT_FRAG = `#version 300 es
precision highp float;
uniform vec4 uFlatColor;
out vec4 fragColor;
void main() {
        fragColor = uFlatColor;
}`;

const OUTLINE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uOutlineWidth;
void main() {
        // Push vertices along normals to create outline shell
        vec3 pos = aPosition + aNormal * uOutlineWidth;
        gl_Position = uProj * uView * uModel * vec4(pos, 1.0);
}`;

const OUTLINE_FRAG = `#version 300 es
precision highp float;
uniform vec3 uOutlineColor;
out vec4 fragColor;
void main() {
        fragColor = vec4(uOutlineColor, 1.0);
}`;

const AXIS_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aColor;
uniform mat4 uVP;
out vec3 vColor;
void main() {
        vColor = aColor;
        gl_Position = uVP * vec4(aPosition, 1.0);
}`;

const AXIS_FRAG = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 fragColor;
void main() {
        fragColor = vec4(vColor, 1.0);
}`;

const COMPASS_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
uniform mat4 uMVP;
uniform mat4 uNormalMat;
out vec3 vNormal;
void main() {
        vNormal = normalize((uNormalMat * vec4(aNormal, 0.0)).xyz);
        gl_Position = uMVP * vec4(aPosition, 1.0);
}`;

const COMPASS_FRAG = `#version 300 es
precision highp float;
in vec3 vNormal;
uniform vec3 uColor;
out vec4 fragColor;
void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(vec3(0.5, 0.8, 0.3));
        float diff = max(dot(N, L), 0.0) * 0.6 + 0.4;
        fragColor = vec4(uColor * diff, 1.0);
}`;

// --- WIREFRAME GIZMO SHADER (for LINES rendering) ---
const LINE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
uniform mat4 uMVP;
void main() {
        gl_Position = uMVP * vec4(aPosition, 1.0);
        // Bring lines slightly forward to avoid z-fighting
        gl_Position.z -= 0.0001 * gl_Position.w;
}`;

const LINE_FRAG = `#version 300 es
precision highp float;
uniform vec4 uLineColor;
uniform float uAlpha;
out vec4 fragColor;
void main() {
        fragColor = vec4(uLineColor.rgb, uLineColor.a * uAlpha);
}`;

// --- ICON SHADER (Billboard) --- TODO: Implement icon rendering
/* const ICON_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;     // Center position of entity
layout(location = 1) in vec2 aUV;      // Quad UVs
uniform mat4 uVP;                      // View * Proj
uniform vec3 uCameraRight;             // Camera Right vector (for billboard)
uniform vec3 uCameraUp;                // Camera Up vector
uniform float uSize;                   // Icon size
out vec2 vUV;
void main() {
        vUV = aUV;
        // Billboarding: Position + (Right * x) + (Up * y)
        vec3 vertexPos = aPos + (uCameraRight * (aUV.x - 0.5) * uSize) + (uCameraUp * (aUV.y - 0.5) * uSize);
        gl_Position = uVP * vec4(vertexPos, 1.0);
}`;

const ICON_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTexture;
uniform vec3 uColorTint;
out vec4 fragColor;
void main() {
        vec4 tex = texture(uTexture, vUV);
        if (tex.a < 0.1) discard;
        // Mix texture with tint (e.g. selection)
        fragColor = vec4(mix(tex.rgb, uColorTint, 0.2), tex.a);
}`; */

// --- GIZMO SHADER (Arrows) --- TODO: Implement gizmo rendering
/* const GIZMO_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aColor;
uniform mat4 uMVP;
out vec3 vColor;
void main() {
        vColor = aColor;
        gl_Position = uMVP * vec4(aPos, 1.0);
        // Bring to front (hacky depth adjustment)
        gl_Position.z -= 0.001 * gl_Position.w;
}`;

const GIZMO_FRAG = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 fragColor;
void main() {
        fragColor = vec4(vColor, 1.0);
}`; */

// ============================================================================
// GEOMETRY
// ============================================================================

interface MeshBuffers {
        vao: WebGLVertexArrayObject;
        indexCount: number;
}

/** Wireframe buffers for LINES rendering */
interface WireframeBuffers {
        vao: WebGLVertexArrayObject;
        vertexCount: number;  // Number of vertices (for drawArrays) or index count (for drawElements)
        useIndices: boolean;  // Whether to use indices or direct vertex drawing
}

function buildMeshVAO(gl: WebGL2RenderingContext, pos: Float32Array, nrm: Float32Array, idx: Uint16Array): MeshBuffers {
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        const pb = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, pb);
        gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        const nb = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, nb);
        gl.bufferData(gl.ARRAY_BUFFER, nrm, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        const ib = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        return { vao, indexCount: idx.length };
}

function createCubeGeometry(gl: WebGL2RenderingContext): MeshBuffers {
        const p = new Float32Array([
                -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
                0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
                -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
                -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
                0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
                -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
        ]);
        const n = new Float32Array([
                0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
                0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
                1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
        ]);
        const idx = new Uint16Array([
                0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
                12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
        ]);
        return buildMeshVAO(gl, p, n, idx);
}

function createPlaneGeometry(gl: WebGL2RenderingContext): MeshBuffers {
        return buildMeshVAO(gl,
                new Float32Array([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5]),
                new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
                new Uint16Array([0, 1, 2, 0, 2, 3]));
}

function createSphereGeometry(gl: WebGL2RenderingContext, seg: number = 24, rings: number = 16): MeshBuffers {
        const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
        for (let r = 0; r <= rings; r++) {
                const phi = (r / rings) * Math.PI, sp = Math.sin(phi), cp = Math.cos(phi);
                for (let s = 0; s <= seg; s++) {
                        const theta = (s / seg) * Math.PI * 2;
                        const x = Math.cos(theta) * sp, y = cp, z = Math.sin(theta) * sp;
                        pos.push(x * 0.5, y * 0.5, z * 0.5); nrm.push(x, y, z);
                }
        }
        for (let r = 0; r < rings; r++)
                for (let s = 0; s < seg; s++) {
                        const a = r * (seg + 1) + s, b = a + seg + 1;
                        idx.push(a, b, a + 1, a + 1, b, b + 1);
                }
        return buildMeshVAO(gl, new Float32Array(pos), new Float32Array(nrm), new Uint16Array(idx));
}

function createCylinderGeo(gl: WebGL2RenderingContext, radius: number, height: number, seg: number): MeshBuffers {
        const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
        for (let i = 0; i <= seg; i++) {
                const a = (i / seg) * Math.PI * 2, x = Math.cos(a) * radius, z = Math.sin(a) * radius;
                pos.push(x, 0, z); nrm.push(x / radius, 0, z / radius);
                pos.push(x, height, z); nrm.push(x / radius, 0, z / radius);
        }
        for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        return buildMeshVAO(gl, new Float32Array(pos), new Float32Array(nrm), new Uint16Array(idx));
}

function createConeGeo(gl: WebGL2RenderingContext, radius: number, height: number, seg: number): MeshBuffers {
        const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
        pos.push(0, height, 0); nrm.push(0, 1, 0);
        for (let i = 0; i <= seg; i++) {
                const a = (i / seg) * Math.PI * 2, x = Math.cos(a) * radius, z = Math.sin(a) * radius;
                const ny = radius / height, len = Math.sqrt(1 + ny * ny);
                pos.push(x, 0, z); nrm.push(x / radius / len, ny / len, z / radius / len);
        }
        for (let i = 1; i <= seg; i++) idx.push(0, i, i + 1);
        return buildMeshVAO(gl, new Float32Array(pos), new Float32Array(nrm), new Uint16Array(idx));
}

function createTorusGeo(gl: WebGL2RenderingContext, radius: number, tube: number, radialSeg: number = 24, tubularSeg: number = 48): MeshBuffers {
        const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
        for (let j = 0; j <= radialSeg; j++) {
                for (let i = 0; i <= tubularSeg; i++) {
                        const u = (i / tubularSeg) * Math.PI * 2;
                        const v = (j / radialSeg) * Math.PI * 2;
                        const x = (radius + tube * Math.cos(v)) * Math.cos(u);
                        const y = tube * Math.sin(v);
                        const z = (radius + tube * Math.cos(v)) * Math.sin(u);
                        pos.push(x, y, z);
                        const cx = radius * Math.cos(u);
                        const cz = radius * Math.sin(u);
                        const nx = x - cx, ny = y, nz = z - cz;
                        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                        nrm.push(nx / len, ny / len, nz / len);
                }
        }
        for (let j = 0; j < radialSeg; j++) {
                for (let i = 0; i < tubularSeg; i++) {
                        const a = j * (tubularSeg + 1) + i;
                        const b = a + tubularSeg + 1;
                        idx.push(a, b, a + 1, a + 1, b, b + 1);
                }
        }
        return buildMeshVAO(gl, new Float32Array(pos), new Float32Array(nrm), new Uint16Array(idx));
}

function createCapsuleGeo(gl: WebGL2RenderingContext, radius: number, height: number, seg: number = 24, rings: number = 8): MeshBuffers {
        const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
        const halfHeight = height * 0.5;
        
        // Top hemisphere
        for (let r = 0; r <= rings; r++) {
                const phi = (r / rings) * (Math.PI * 0.5);
                const sp = Math.sin(phi), cp = Math.cos(phi);
                const y = halfHeight + cp * radius;
                const ringRadius = sp * radius;
                
                for (let s = 0; s <= seg; s++) {
                        const theta = (s / seg) * Math.PI * 2;
                        const x = Math.cos(theta) * ringRadius;
                        const z = Math.sin(theta) * ringRadius;
                        pos.push(x, y, z);
                        const nx = x / radius, ny = cp, nz = z / radius;
                        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                        nrm.push(nx / len, ny / len, nz / len);
                }
        }
        
        const topVertCount = (rings + 1) * (seg + 1);
        
        // Cylinder middle
        for (let i = 0; i <= seg; i++) {
                const theta = (i / seg) * Math.PI * 2;
                const x = Math.cos(theta) * radius;
                const z = Math.sin(theta) * radius;
                pos.push(x, halfHeight, z);
                nrm.push(x / radius, 0, z / radius);
                pos.push(x, -halfHeight, z);
                nrm.push(x / radius, 0, z / radius);
        }
        
        const midVertCount = (seg + 1) * 2;
        
        // Bottom hemisphere
        for (let r = 0; r <= rings; r++) {
                const phi = (r / rings) * (Math.PI * 0.5);
                const sp = Math.sin(phi), cp = Math.cos(phi);
                const y = -halfHeight - cp * radius;
                const ringRadius = sp * radius;
                
                for (let s = 0; s <= seg; s++) {
                        const theta = (s / seg) * Math.PI * 2;
                        const x = Math.cos(theta) * ringRadius;
                        const z = Math.sin(theta) * ringRadius;
                        pos.push(x, y, z);
                        const nx = x / radius, ny = -cp, nz = z / radius;
                        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                        nrm.push(nx / len, ny / len, nz / len);
                }
        }
        
        // Top hemisphere indices
        for (let r = 0; r < rings; r++) {
                for (let s = 0; s < seg; s++) {
                        const a = r * (seg + 1) + s;
                        const b = a + seg + 1;
                        idx.push(a, b, a + 1, a + 1, b, b + 1);
                }
        }
        
        // Cylinder indices
        for (let i = 0; i < seg; i++) {
                const a = topVertCount + i * 2;
                const b = a + 2;
                idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
        
        // Bottom hemisphere indices
        const bottomStart = topVertCount + midVertCount;
        for (let r = 0; r < rings; r++) {
                for (let s = 0; s < seg; s++) {
                        const a = bottomStart + r * (seg + 1) + s;
                        const b = a + seg + 1;
                        idx.push(a, b, a + 1, a + 1, b, b + 1);
                }
        }
        
        return buildMeshVAO(gl, new Float32Array(pos), new Float32Array(nrm), new Uint16Array(idx));
}
function createAxisLinesGeometry(gl: WebGL2RenderingContext): { vao: WebGLVertexArrayObject; count: number } {
        const L = 1000;
        const p = new Float32Array([0, 0, 0, 0, L, 0]);
        const c = new Float32Array([0.28, 0.65, 0.30, 0.28, 0.65, 0.30]);
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        const pb = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, p, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        const cb = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, c, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        return { vao, count: 2 };
}

function createQuadGeometry(gl: WebGL2RenderingContext): MeshBuffers {
        // Flat quad in XZ plane, centered at origin, size 1x1
        const pos = new Float32Array([
                -0.5, 0, -0.5,  0.5, 0, -0.5,  0.5, 0, 0.5,  -0.5, 0, 0.5,
        ]);
        const nrm = new Float32Array([
                0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
        ]);
        const idx = new Uint16Array([0, 1, 2, 0, 2, 3]);
        return buildMeshVAO(gl, pos, nrm, idx);
}

// ============================================================================
// WIREFRAME GIZMO VAO BUILDER
// ============================================================================

/** Build VAO for wireframe geometry (positions only, uses LINES) */
function buildWireframeVAO(gl: WebGL2RenderingContext, positions: Float32Array, indices?: Uint16Array): WireframeBuffers {
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        
        const pb = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, pb);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        
        let useIndices = false;
        let vertexCount = positions.length / 3;
        
        if (indices && indices.length > 0) {
                const ib = gl.createBuffer()!;
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
                useIndices = true;
                vertexCount = indices.length;
        }
        
        gl.bindVertexArray(null);
        return { vao, vertexCount, useIndices };
}

/** Create camera frustum wireframe gizmo */
function createCameraFrustumVAO(gl: WebGL2RenderingContext, fov: number = 60, near: number = 0.5, far: number = 3): WireframeBuffers {
        const geo = createCameraFrustumGeometry(fov, near, far, 16/9);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create wireframe sphere gizmo */
function createWireframeSphereVAO(gl: WebGL2RenderingContext, radius: number = 0.5): WireframeBuffers {
        const geo = createWireframeSphereGeometry(radius, 8, 12);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create wireframe cube gizmo */
function createWireframeCubeVAO(gl: WebGL2RenderingContext, size: number = 1): WireframeBuffers {
        const geo = createWireframeCubeGeometry(size);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create wireframe cylinder gizmo */
function createWireframeCylinderVAO(gl: WebGL2RenderingContext, radius: number = 0.5, height: number = 1): WireframeBuffers {
        const geo = createWireframeCylinderGeometry(radius, height, 12);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create spotlight cone wireframe gizmo */
function createSpotlightConeVAO(gl: WebGL2RenderingContext, angle: number = 45, range: number = 1.5): WireframeBuffers {
        const geo = createSpotlightConeGeometry(angle, range, 16);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create point light helper gizmo (rays) */
function createPointLightRaysVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createPointLightHelperGeometry(0.2, 0.15, 6);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create sun rays gizmo */
function createSunRaysVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createSunRaysGeometry(0.3, 0.2, 12);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create character body wireframe gizmo */
function createCharacterBodyVAO(gl: WebGL2RenderingContext, radius: number = 0.4, height: number = 1.6): WireframeBuffers {
        const geo = createCharacterBodyGeometry(radius, height, 12);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create raycast wireframe gizmo */
function createRayCastVAO(gl: WebGL2RenderingContext, length: number = 2): WireframeBuffers {
        const geo = createRayCastGeometry(length);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create area/trigger zone wireframe gizmo */
function createAreaWireframeVAO(gl: WebGL2RenderingContext, size: [number, number, number] = [1, 1, 1]): WireframeBuffers {
        const geo = createAreaGeometry(size);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create speaker icon gizmo */
function createSpeakerVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createSpeakerGeometry(0.3);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create film reel gizmo */
function createFilmReelVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createFilmReelGeometry(0.2, 8);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create nav region gizmo */
function createNavRegionVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createNavRegionGeometry([2, 2], 0.5);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create particle emitter gizmo */
function createParticleEmitterVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createParticleEmitterGeometry(0.3);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create timer gizmo */
function createTimerVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createTimerGeometry(0.2);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create marker gizmo */
function createMarkerVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createMarkerGeometry(0.25);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create ShapeCast VAO */
function createShapeCastVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createShapeCastGeometry(50, 0.3);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create Node2D VAO */
function createNode2DVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createNode2DGeometry(0.3);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create CollisionShape2D VAO */
function createCollisionShape2DVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createCollisionShape2DGeometry('rectangle', 0.5);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create Skeleton3D VAO */
function createSkeletonVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createSkeletonGeometry(5, 0.3);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create BoneAttachment VAO */
function createBoneAttachmentVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createBoneAttachmentGeometry(0.15);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create VisibilityNotifier VAO */
function createVisibilityNotifierVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createVisibilityNotifierGeometry(0.4);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create RemoteTransform VAO */
function createRemoteTransformVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createRemoteTransformGeometry(0.3);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create MultiMesh VAO */
function createMultiMeshVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createMultiMeshGeometry(4, 0.5);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create CanvasLayer VAO */
function createCanvasLayerVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createCanvasLayerGeometry(1.5);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create Path2D VAO */
function createPath2DVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createPath2DGeometry(5, 2);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

/** Create NavRegion2D VAO */
function createNavRegion2DVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createNavRegion2DGeometry([1.5, 1.5], 0.3);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

// ============================================================================
// NEW: 2D PHYSICS VAO CREATION FUNCTIONS
// ============================================================================

function createCharacterBody2DVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createCharacterBody2DGeometry(0.25, 0.8);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

function createRigidBody2DVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createRigidBody2DGeometry(0.4);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

function createStaticBody2DVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createStaticBody2DGeometry(0.4);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

function createRayCast2DVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createRayCast2DGeometry(1.5);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

// ============================================================================
// NEW: 2D NAVIGATION VAO CREATION FUNCTIONS
// ============================================================================

function createNavigationAgent2DVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createNavigationAgent2DGeometry(0.25);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

function createNavigationObstacle2DVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createNavigationObstacle2DGeometry(0.3);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

function createPathFollow2DVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createPathFollow2DGeometry(0.25);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

// ============================================================================
// NEW: VIEWPORT VAO CREATION FUNCTIONS
// ============================================================================

function createViewportVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createViewportGeometry3D(1.6, 0.9);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

function createSubViewportVAO(gl: WebGL2RenderingContext): WireframeBuffers {
        const geo = createSubViewportGeometry(1.2, 0.7);
        return buildWireframeVAO(gl, geo.positions, geo.indices);
}

// ============================================================================
// SHADER UTIL
// ============================================================================

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, source); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.error('[Viewport] Shader error:', gl.getShaderInfoLog(s));
                gl.deleteShader(s); return null;
        }
        return s;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram | null {
        const v = compileShader(gl, gl.VERTEX_SHADER, vs);
        const f = compileShader(gl, gl.FRAGMENT_SHADER, fs);
        if (!v || !f) return null;
        const p = gl.createProgram()!;
        gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
                console.error('[Viewport] Link error:', gl.getProgramInfoLog(p));
                gl.deleteProgram(p); return null;
        }
        gl.deleteShader(v); gl.deleteShader(f);
        return p;
}

// ============================================================================
// EDITOR CAMERA
// ============================================================================

class EditorCamera {
        pivot: Vec3 = v3(0, 0, 0);
        distance: number = 8;
        yaw: number = 0.5;
        pitch: number = 0.3;

        position: Vec3 = v3(0, 0, 0);
        viewMatrix: Mat4 = m4Create();
        projMatrix: Mat4 = m4Create();
        vpMatrix: Mat4 = m4Create();
        invVpMatrix: Mat4 = m4Create();

        private targetPivot: Vec3 = v3(0, 0, 0);
        private targetDistance: number = 8;
        private isAnimating: boolean = false;

        fov: number = 60 * DEG2RAD;
        near: number = 0.01;
        far: number = 500;
        aspect: number = 1;

        flyMode: boolean = false;

        constructor() {
                this.update();
        }

        setAspect(w: number, h: number): void { this.aspect = w / h; }

        private orbitOffset(dist: number): Vec3 {
                return v3(
                        Math.sin(this.yaw) * Math.cos(this.pitch) * dist,
                        Math.sin(this.pitch) * dist,
                        Math.cos(this.yaw) * Math.cos(this.pitch) * dist
                );
        }

        private lookDir(): Vec3 {
                return v3(
                        -Math.sin(this.yaw) * Math.cos(this.pitch),
                        -Math.sin(this.pitch),
                        -Math.cos(this.yaw) * Math.cos(this.pitch)
                );
        }

        private rightDir(): Vec3 {
                return v3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        }

        orbit(dx: number, dy: number): void {
                this.yaw -= dx * 0.003;
                this.pitch += dy * 0.003;
                this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
        }

        pan(dx: number, dy: number): void {
                if (this.flyMode) return;
                const panScale = this.distance * 0.002;
                const right = this.rightDir();
                v3ScaleAdd(this.pivot, this.pivot, right, -dx * panScale);
                this.pivot[1] += dy * panScale;
        }

        zoom(delta: number): void {
                if (this.flyMode) return;
                this.distance *= Math.exp(delta * 0.002);
                this.distance = Math.max(0.1, Math.min(200, this.distance));
        }

        flyMove(forward: number, right: number, up: number, speed: number): void {
                if (!this.flyMode) return;
                const fwd = this.lookDir();
                const rt = this.rightDir();
                v3ScaleAdd(this.position, this.position, fwd, forward * speed);
                v3ScaleAdd(this.position, this.position, rt, right * speed);
                this.position[1] += up * speed;
        }

        enterFlyMode(): void {
                if (this.flyMode) return;
                this.flyMode = true;
        }

        exitFlyMode(): void {
                if (!this.flyMode) return;
                this.flyMode = false;
                const fwd = this.lookDir();
                v3ScaleAdd(this.pivot, this.position, fwd, this.distance);
        }

        focusOn(center: Vec3, radius: number): void {
                v3Copy(this.targetPivot, center);
                this.targetDistance = Math.max(radius * 2.5, 1);
                this.isAnimating = true;
        }

        update(): void {
                if (this.isAnimating) {
                        const t = 0.12;
                        v3Lerp(this.pivot, this.pivot, this.targetPivot, t);
                        this.distance += (this.targetDistance - this.distance) * t;
                        if (v3Dist(this.pivot, this.targetPivot) < 0.01 && Math.abs(this.distance - this.targetDistance) < 0.01) {
                                v3Copy(this.pivot, this.targetPivot);
                                this.distance = this.targetDistance;
                                this.isAnimating = false;
                        }
                }

                this.near = Math.max(0.01, this.distance * 0.001);
                this.far = Math.max(this.distance * 50, 500);

                if (this.flyMode) {
                        const target = v3(0, 0, 0);
                        const fwd = this.lookDir();
                        v3Add(target, this.position, fwd);
                        m4LookAt(this.viewMatrix, this.position, target, v3(0, 1, 0));
                } else {
                        const off = this.orbitOffset(this.distance);
                        v3Add(this.position, this.pivot, off);
                        m4LookAt(this.viewMatrix, this.position, this.pivot, v3(0, 1, 0));
                }

                m4Perspective(this.projMatrix, this.fov, this.aspect, this.near, this.far);
                m4Multiply(this.vpMatrix, this.projMatrix, this.viewMatrix);
                m4Invert(this.invVpMatrix, this.vpMatrix);
        }
}

// ============================================================================
// PICKING
// ============================================================================

interface PickingFBO {
        framebuffer: WebGLFramebuffer;
        colorTexture: WebGLTexture;
        depthRenderbuffer: WebGLRenderbuffer;
        width: number; height: number;
}

function createPickingFBO(gl: WebGL2RenderingContext, w: number, h: number): PickingFBO {
        const fb = gl.createFramebuffer()!, ct = gl.createTexture()!, dr = gl.createRenderbuffer()!;
        gl.bindTexture(gl.TEXTURE_2D, ct);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.bindRenderbuffer(gl.RENDERBUFFER, dr);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ct, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, dr);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { framebuffer: fb, colorTexture: ct, depthRenderbuffer: dr, width: w, height: h };
}

function resizePickingFBO(gl: WebGL2RenderingContext, fbo: PickingFBO, w: number, h: number): void {
        fbo.width = w; fbo.height = h;
        gl.bindTexture(gl.TEXTURE_2D, fbo.colorTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, fbo.depthRenderbuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
}

function entityIdToColor(index: number): [number, number, number, number] {
        const i = index + 1;
        return [(i & 0xFF) / 255, ((i >> 8) & 0xFF) / 255, ((i >> 16) & 0xFF) / 255, 1.0];
}

function colorToEntityId(pixel: Uint8Array): number {
        return (pixel[0] | (pixel[1] << 8) | (pixel[2] << 16)) - 1;
}

// ============================================================================
// MAIN VIEWPORT
// ============================================================================

export class ThreeViewport extends Disposable {
        private scene: VecnScene | null = null;
        private glCanvas: HTMLCanvasElement | null = null;
        private overlayCanvas: HTMLCanvasElement | null = null;
        private info: HTMLElement | null = null;
        private isRendering: boolean = false;
        private animationFrameId: number | null = null;

        private gl: WebGL2RenderingContext | null = null;
        private camera: EditorCamera = new EditorCamera();

        private bgProgram: WebGLProgram | null = null;
        private gridProgram: WebGLProgram | null = null;
        private meshProgram: WebGLProgram | null = null;
        private flatProgram: WebGLProgram | null = null;
        private axisProgram: WebGLProgram | null = null;
        private compassProgram: WebGLProgram | null = null;
        private outlineProgram: WebGLProgram | null = null;

        private cubeGeo: MeshBuffers | null = null;
        private planeGeo: MeshBuffers | null = null;
        private sphereGeo: MeshBuffers | null = null;
        private cylinderGeo: MeshBuffers | null = null;
        private coneGeo: MeshBuffers | null = null;
        private torusGeo: MeshBuffers | null = null;
        private capsuleGeo: MeshBuffers | null = null;
        private gizmoTorusGeo: MeshBuffers | null = null;
        private axisGeo: { vao: WebGLVertexArrayObject; count: number } | null = null;
        private quadGeo: MeshBuffers | null = null;
        private emptyVAO: WebGLVertexArrayObject | null = null;
        private compassCylinder: MeshBuffers | null = null;
        private compassCone: MeshBuffers | null = null;
        private compassSphere: MeshBuffers | null = null;
        
        // Wireframe gizmo program and buffers
        private lineProgram: WebGLProgram | null = null;
        private cameraFrustumVAO: WireframeBuffers | null = null;
        private wireframeSphereVAO: WireframeBuffers | null = null;
        private wireframeCubeVAO: WireframeBuffers | null = null;
        private wireframeCylinderVAO: WireframeBuffers | null = null;
        private spotlightConeVAO: WireframeBuffers | null = null;
        private pointLightRaysVAO: WireframeBuffers | null = null;
        private sunRaysVAO: WireframeBuffers | null = null;
        private characterBodyVAO: WireframeBuffers | null = null;
        private rayCastVAO: WireframeBuffers | null = null;
        private areaWireframeVAO: WireframeBuffers | null = null;
        private speakerVAO: WireframeBuffers | null = null;
        private filmReelVAO: WireframeBuffers | null = null;
        private navRegionVAO: WireframeBuffers | null = null;
        private particleEmitterVAO: WireframeBuffers | null = null;
        private timerVAO: WireframeBuffers | null = null;
        private markerVAO: WireframeBuffers | null = null;
        
        // Additional VAOs for missing node types
        private shapeCastVAO: WireframeBuffers | null = null;
        private node2DVAO: WireframeBuffers | null = null;
        private collisionShape2DVAO: WireframeBuffers | null = null;
        private skeletonVAO: WireframeBuffers | null = null;
        private boneAttachmentVAO: WireframeBuffers | null = null;
        private visibilityNotifierVAO: WireframeBuffers | null = null;
        private remoteTransformVAO: WireframeBuffers | null = null;
        private multiMeshVAO: WireframeBuffers | null = null;
        private canvasLayerVAO: WireframeBuffers | null = null;
        private path2DVAO: WireframeBuffers | null = null;
        private navRegion2DVAO: WireframeBuffers | null = null;

        // NEW: Additional 2D Physics VAOs
        private characterBody2DVAO: WireframeBuffers | null = null;
        private rigidBody2DVAO: WireframeBuffers | null = null;
        private staticBody2DVAO: WireframeBuffers | null = null;
        private rayCast2DVAO: WireframeBuffers | null = null;

        // NEW: Additional 2D Navigation VAOs
        private navAgent2DVAO: WireframeBuffers | null = null;
        private navObstacle2DVAO: WireframeBuffers | null = null;
        private pathFollow2DVAO: WireframeBuffers | null = null;

        // NEW: Viewport VAOs
        private viewportVAO: WireframeBuffers | null = null;
        private subViewportVAO: WireframeBuffers | null = null;

        private pickingFBO: PickingFBO | null = null;
        private selectedEntityIndex: number = -1;
        private selectedEntityId: string | null = null;
        private pendingPick: { x: number; y: number } | null = null;

        // Gizmo state - now always shows all controls (translate, rotate, scale)
        // Removed gizmoMode as all gizmos are displayed simultaneously

        private draggingHandle:
                | 'tx' | 'ty' | 'tz'
                | 'txy' | 'txz' | 'tyz'
                | 'rx' | 'ry' | 'rz'
                | 'sx' | 'sy' | 'sz' | 'sxyz'
                | null = null;

        private dragStartHit: Vec3 = v3(0, 0, 0);
        private dragStartTranslation: Vec3 = v3(0, 0, 0);
        private dragStartScale: Vec3 = v3(1, 1, 1);
        private dragStartRotation: Quat = [0, 0, 0, 1];
        private dragStartAngle: number = 0;

        private pendingGizmoPick: { x: number; y: number } | null = null;

        // HUD (mini inspector) - removed, inspector is docked
        private hud: HTMLElement | null = null;

        // More complete transform edit event (translation only remains for backward compat)
        private _onTransformEditedTRS = this._register(new Emitter<{
                entityId: string;
                translation: [number, number, number];
                rotation: [number, number, number, number];
                scale: [number, number, number];
        }>());
        public readonly onTransformEditedTRS: Event<{
                entityId: string;
                translation: [number, number, number];
                rotation: [number, number, number, number];
                scale: [number, number, number];
        }> = this._onTransformEditedTRS.event;

        private isRightMouseDown: boolean = false;
        private isMiddleMouseDown: boolean = false;
        private lastMouseX: number = 0;
        private lastMouseY: number = 0;
        private keys: { [key: string]: boolean } = {};
        private flySpeed: number = 0.08;
        private pointerLocked: boolean = false;

        private frameCount: number = 0;
        private lastFPSTime: number = 0;
        private currentFPS: number = 0;
        private dpr: number = 1;

        private _onSceneModified = this._register(new Emitter<Entity[]>());
        public readonly onSceneModified: Event<Entity[]> = this._onSceneModified.event;

        private _onEntityPicked = this._register(new Emitter<string | null>());
        public readonly onEntityPicked: Event<string | null> = this._onEntityPicked.event;

        private _onTransformEdited = this._register(new Emitter<{ entityId: string; translation: [number, number, number] }>());
        public readonly onTransformEdited: Event<{ entityId: string; translation: [number, number, number] }> = this._onTransformEdited.event;

        constructor(
                private container: HTMLElement,
                vecnContent: string
        ) {
                super();
                this.scene = VecnParser.parse(vecnContent);
                this.createViewport();
        }

        public startRendering(): void {
                if (this.isRendering) return;
                this.isRendering = true;
                this.lastFPSTime = performance.now();
                this.frameCount = 0;
                this.renderLoop();
        }

        public stopRendering(): void {
                this.isRendering = false;
                if (this.animationFrameId !== null) {
                        cancelAnimationFrame(this.animationFrameId);
                        this.animationFrameId = null;
                }
        }

        public updateScene(vecnContent: string): void {
                // this.rawVecnContent // REMOVED = vecnContent;

                const parsed = VecnParser.parse(vecnContent);
                if (!parsed) {
                        // Важное поведение: пока пользователь печатает и файл временно невалидный —
                        // не обнуляем сцену (иначе всё мигает/пропадает).
                        // Можно вывести ошибку в this.info при желании.
                        return;
                }

                this.scene = parsed;
        }


        private createViewport(): void {
                this.glCanvas = DOM.append(this.container, DOM.$('canvas.viewport-gl')) as HTMLCanvasElement;
                this.glCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';

                this.overlayCanvas = DOM.append(this.container, DOM.$('canvas.viewport-overlay')) as HTMLCanvasElement;
                this.overlayCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;';

                this.info = DOM.append(this.container, DOM.$('.viewport-info'));
                this.info.style.cssText = `
                        position:absolute;bottom:8px;left:8px;padding:4px 8px;
                        background:rgba(20,20,22,0.75);color:#666;border-radius:3px;
                        font:9px/1.5 Consolas,monospace;z-index:10;
                        pointer-events:none;white-space:pre;
                        border:1px solid rgba(255,255,255,0.04);
                `;

                // Mini Inspector HUD (top-right) — COMPACT
                this.hud = DOM.append(this.container, DOM.$('.viewport-hud'));
                this.hud.style.cssText = `
                        position:absolute;
                        top:8px;
                        right:8px;
                        padding:8px 12px;
                        min-width:190px;
                        max-width:220px;
                        background:rgba(28,28,29,0.94);
                        border:1px solid #33333c;
                        border-radius:6px;
                        backdrop-filter:blur(20px);
                        color:#999;
                        font:10px/1.5 'Consolas','Courier New',monospace;
                        z-index:30;
                        pointer-events:none;
                        display:none;
                        box-shadow:0 4px 16px rgba(0,0,0,0.4);
                `;
                // hudText removed - inspector is docked

                this.gl = this.glCanvas.getContext('webgl2', {
                        antialias: true, alpha: false, depth: true, stencil: true,
                        premultipliedAlpha: false, preserveDrawingBuffer: false,
                });

                if (!this.gl) {
                        if (this.info) this.info.textContent = 'WebGL2 not available';
                        return;
                }

                this.initWebGL();
                this.setupInputHandlers();
                this.handleResize();

                const ro = new ResizeObserver(() => this.handleResize());
                ro.observe(this.glCanvas);
                this._register({ dispose: () => ro.disconnect() });

                this.startRendering();
        }

        private initWebGL(): void {
                const gl = this.gl!;
                this.bgProgram = createProgram(gl, BG_VERT, BG_FRAG);
                this.gridProgram = createProgram(gl, GRID_VERT, GRID_FRAG);
                this.meshProgram = createProgram(gl, MESH_VERT, MESH_FRAG);
                this.flatProgram = createProgram(gl, FLAT_VERT, FLAT_FRAG);
                this.axisProgram = createProgram(gl, AXIS_VERT, AXIS_FRAG);
                this.compassProgram = createProgram(gl, COMPASS_VERT, COMPASS_FRAG);
                this.outlineProgram = createProgram(gl, OUTLINE_VERT, OUTLINE_FRAG);
                this.lineProgram = createProgram(gl, LINE_VERT, LINE_FRAG);

                // Геометрия (solid meshes)
                this.cubeGeo = createCubeGeometry(gl);
                this.planeGeo = createPlaneGeometry(gl);
                this.sphereGeo = createSphereGeometry(gl);
                this.cylinderGeo = createCylinderGeo(gl, 0.5, 1.0, 24);
                this.coneGeo = createConeGeo(gl, 0.5, 1.0, 24);
                this.torusGeo = createTorusGeo(gl, 0.5, 0.2, 24, 32);
                this.capsuleGeo = createCapsuleGeo(gl, 0.5, 1.0, 24, 8);
                // Ultra-thin torus for rotation gizmo (Godot-style: tube = 0.015)
                this.gizmoTorusGeo = createTorusGeo(gl, 0.5, 0.015, 48, 64);

                this.axisGeo = createAxisLinesGeometry(gl);
                this.quadGeo = createQuadGeometry(gl);
                this.emptyVAO = gl.createVertexArray();

                this.compassCylinder = createCylinderGeo(gl, 0.04, 0.6, 8);
                this.compassCone = createConeGeo(gl, 0.1, 0.25, 8);
                this.compassSphere = createSphereGeometry(gl, 10, 6);
                
                // Professional wireframe gizmos
                this.cameraFrustumVAO = createCameraFrustumVAO(gl, 60, 0.3, 1.5);
                this.wireframeSphereVAO = createWireframeSphereVAO(gl, 0.25);
                this.wireframeCubeVAO = createWireframeCubeVAO(gl, 1);
                this.wireframeCylinderVAO = createWireframeCylinderVAO(gl, 0.5, 1);
                this.spotlightConeVAO = createSpotlightConeVAO(gl, 45, 1.2);
                this.pointLightRaysVAO = createPointLightRaysVAO(gl);
                this.sunRaysVAO = createSunRaysVAO(gl);
                this.characterBodyVAO = createCharacterBodyVAO(gl, 0.4, 1.6);
                this.rayCastVAO = createRayCastVAO(gl, 2);
                this.areaWireframeVAO = createAreaWireframeVAO(gl, [1, 1, 1]);
                this.speakerVAO = createSpeakerVAO(gl);
                this.filmReelVAO = createFilmReelVAO(gl);
                this.navRegionVAO = createNavRegionVAO(gl);
                this.particleEmitterVAO = createParticleEmitterVAO(gl);
                this.timerVAO = createTimerVAO(gl);
                this.markerVAO = createMarkerVAO(gl);
                
                // Initialize additional VAOs for missing node types
                this.shapeCastVAO = createShapeCastVAO(gl);
                this.node2DVAO = createNode2DVAO(gl);
                this.collisionShape2DVAO = createCollisionShape2DVAO(gl);
                this.skeletonVAO = createSkeletonVAO(gl);
                this.boneAttachmentVAO = createBoneAttachmentVAO(gl);
                this.visibilityNotifierVAO = createVisibilityNotifierVAO(gl);
                this.remoteTransformVAO = createRemoteTransformVAO(gl);
                this.multiMeshVAO = createMultiMeshVAO(gl);
                this.canvasLayerVAO = createCanvasLayerVAO(gl);
                this.path2DVAO = createPath2DVAO(gl);
                this.navRegion2DVAO = createNavRegion2DVAO(gl);

                // NEW: Initialize 2D Physics VAOs
                this.characterBody2DVAO = createCharacterBody2DVAO(gl);
                this.rigidBody2DVAO = createRigidBody2DVAO(gl);
                this.staticBody2DVAO = createStaticBody2DVAO(gl);
                this.rayCast2DVAO = createRayCast2DVAO(gl);

                // NEW: Initialize 2D Navigation VAOs
                this.navAgent2DVAO = createNavigationAgent2DVAO(gl);
                this.navObstacle2DVAO = createNavigationObstacle2DVAO(gl);
                this.pathFollow2DVAO = createPathFollow2DVAO(gl);

                // NEW: Initialize Viewport VAOs
                this.viewportVAO = createViewportVAO(gl);
                this.subViewportVAO = createSubViewportVAO(gl);

                this.pickingFBO = createPickingFBO(gl, 1, 1);

                // --- ВАЖНЫЕ НАСТРОЙКИ РЕНДЕРА ---
                gl.enable(gl.DEPTH_TEST);           // Включаем тест глубины (чтобы нос не просвечивал)
                gl.depthFunc(gl.LEQUAL);            // Ближние объекты перекрывают дальние
                gl.disable(gl.CULL_FACE);           // ОТКЛЮЧАЕМ отсечение граней (пусть рисует всё, чтобы не было "вывернутости")
                // gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); // <-- Это было причиной "вывернутости" если нормали смотрят не туда

                gl.clearColor(0.145, 0.15, 0.165, 1);
        }

        private handleResize(): void {
                if (!this.glCanvas || !this.gl) return;
                this.dpr = window.devicePixelRatio || 1;
                const w = this.glCanvas.clientWidth, h = this.glCanvas.clientHeight;
                const pw = Math.floor(w * this.dpr), ph = Math.floor(h * this.dpr);
                if (this.glCanvas.width !== pw || this.glCanvas.height !== ph) {
                        this.glCanvas.width = pw; this.glCanvas.height = ph;
                }
                if (this.overlayCanvas) { this.overlayCanvas.width = pw; this.overlayCanvas.height = ph; }
                this.gl.viewport(0, 0, pw, ph);
                this.camera.setAspect(pw, ph);
                if (this.pickingFBO) resizePickingFBO(this.gl, this.pickingFBO, pw, ph);
        }

        // ========================================================================
        // INPUT
        // ========================================================================

        private setupInputHandlers(): void {
                const canvas = this.glCanvas!;

                const onPointerLockChange = () => {
                        this.pointerLocked = (document.pointerLockElement === canvas);
                        if (!this.pointerLocked && this.isRightMouseDown) {
                                this.isRightMouseDown = false;
                                this.camera.exitFlyMode();
                                canvas.style.cursor = 'default';
                        }
                };
                document.addEventListener('pointerlockchange', onPointerLockChange);
                this._register({ dispose: () => document.removeEventListener('pointerlockchange', onPointerLockChange) });

                canvas.addEventListener('mousedown', (e) => {
                        canvas.focus();
                        if (e.button === 2) {
                                e.preventDefault();
                                this.isRightMouseDown = true;
                                this.lastMouseX = e.clientX;
                                this.lastMouseY = e.clientY;
                                this.camera.enterFlyMode();
                                canvas.requestPointerLock();
                        } else if (e.button === 1) {
                                e.preventDefault();
                                this.isMiddleMouseDown = true;
                                this.lastMouseX = e.clientX;
                                this.lastMouseY = e.clientY;
                                canvas.style.cursor = 'move';
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
                });

                canvas.addEventListener('mousemove', (e) => {
                        if (this.draggingHandle) {
                                const rect = canvas.getBoundingClientRect();
                                const px = (e.clientX - rect.left) * this.dpr;
                                const py = (canvas.height - (e.clientY - rect.top) * this.dpr);
                                this.updateGizmoDrag(px, py);
                                return;
                        }

                        if (this.pointerLocked && this.isRightMouseDown) {
                                this.camera.orbit(e.movementX, e.movementY);
                        } else if (this.isMiddleMouseDown) {
                                const dx = e.clientX - this.lastMouseX;
                                const dy = e.clientY - this.lastMouseY;
                                this.camera.pan(dx, dy);
                                this.lastMouseX = e.clientX;
                                this.lastMouseY = e.clientY;
                        }
                });

                const onMouseUp = (e: MouseEvent) => {
                        if (e.button === 2) {
                                this.isRightMouseDown = false;
                                this.camera.exitFlyMode();
                                if (this.pointerLocked) document.exitPointerLock();
                                canvas.style.cursor = 'default';
                        } else if (e.button === 1) {
                                this.isMiddleMouseDown = false;
                                canvas.style.cursor = 'default';
                        } else if (e.button === 0) {
                                this.stopGizmoDrag();
                        }
                };
                canvas.addEventListener('mouseup', onMouseUp);
                window.addEventListener('mouseup', onMouseUp);
                this._register({ dispose: () => window.removeEventListener('mouseup', onMouseUp) });

                canvas.addEventListener('contextmenu', (e) => e.preventDefault());

                canvas.addEventListener('wheel', (e) => {
                        e.preventDefault();
                        if (this.isRightMouseDown) {
                                this.flySpeed *= e.deltaY > 0 ? 1.15 : 0.87;
                                this.flySpeed = Math.max(0.01, Math.min(2.0, this.flySpeed));
                        } else {
                                this.camera.zoom(e.deltaY);
                        }
                }, { passive: false });

                const onKeyDown = (e: KeyboardEvent) => {
                        const k = e.key.toLowerCase();
                        this.keys[k] = true;

                        // W/E/R keys no longer switch gizmo mode - all gizmos are always visible
                        // Removed mode switching logic

                        if (k === 'f' && !this.isRightMouseDown) this.focusSelected();
                };
                const onKeyUp = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = false; };
                window.addEventListener('keydown', onKeyDown);
                window.addEventListener('keyup', onKeyUp);
                this._register({ dispose: () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); } });

                canvas.tabIndex = 0;
                canvas.style.outline = 'none';
        }

        private focusSelected(): void {
                if (!this.scene || !this.selectedEntityId) return;

                const find = (list: Entity[]): Entity | null => {
                        for (const e of list) {
                                if (e.id === this.selectedEntityId) return e;
                                const c = find(e.children);
                                if (c) return c;
                        }
                        return null;
                };

                const entity = find(this.scene.entities);
                if (!entity) return;

                const t = entity.components.find((c: Component) => c.type === 'Transform') as any;
                const m = entity.components.find((c: Component) => c.type === 'Mesh') as any;
                if (!t) return;

                const center = v3(t.translation[0], t.translation[1], t.translation[2]);

                let radius = 1;
                if (m) {
                        const sh = m.shape;
                        const sc = t.scale;
                        if (sh.type === 'Cube') radius = (sh.size || 1) * 0.5 * Math.max(sc[0], sc[1], sc[2]);
                        else if (sh.type === 'Sphere') radius = (sh.radius || 1) * Math.max(sc[0], sc[1], sc[2]);
                        else if (sh.type === 'Plane') radius = (sh.size || 1) * 0.5 * Math.max(sc[0], sc[2]);
                }
                this.camera.focusOn(center, radius);
        }

        // ========================================================================
        // RENDER
        // ========================================================================

        private renderLoop = (): void => {
                if (!this.isRendering) return;
                this.animationFrameId = requestAnimationFrame(this.renderLoop);
                this.renderFrame();
        };

        private renderFrame(): void {
                const gl = this.gl;
                if (!gl) return;
                this.updateFlyMovement();
                this.camera.update();
                const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
                if (w === 0 || h === 0) return;

                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, w, h);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

                this.renderBackground(gl, w, h);
                this.renderGrid(gl);
                this.renderAxisLines(gl);
                this.renderEntities(gl, false);
                this.renderSelectionOutline(gl);

                // Draw gizmo (W/E/R)
                if (this.selectedEntityId) {
                        const items = this.getRenderList();
                        const it = items.find(i => i.entity.id === this.selectedEntityId);
                        if (it) {
                                const c = v3(it.worldMatrix[12], it.worldMatrix[13], it.worldMatrix[14]);
                                this.renderGizmo(gl, c, false);
                        }
                }

                this.render3DCompass(gl, w, h);

                if (this.pendingGizmoPick) {
                        const handle = this.performGizmoPick(gl, this.pendingGizmoPick.x, this.pendingGizmoPick.y);
                        if (handle) {
                                this.startGizmoDrag(handle, this.pendingGizmoPick.x, this.pendingGizmoPick.y);
                        } else {
                                this.performPick(gl, this.pendingGizmoPick.x, this.pendingGizmoPick.y);
                        }
                        this.pendingGizmoPick = null;
                }

                if (this.pendingPick) {
                        this.performPick(gl, this.pendingPick.x, this.pendingPick.y);
                        this.pendingPick = null;
                }

                this.updateHud();
                this.renderOverlay();

                this.frameCount++;
                const now = performance.now();
                if (now - this.lastFPSTime >= 1000) {
                        this.currentFPS = Math.round(this.frameCount * 1000 / (now - this.lastFPSTime));
                        this.frameCount = 0; this.lastFPSTime = now;
                        this.updateInfoText();
                }
        }

        private renderBackground(gl: WebGL2RenderingContext, w: number, h: number): void {
                if (!this.bgProgram) return;
                gl.useProgram(this.bgProgram);
                gl.disable(gl.DEPTH_TEST);
                gl.bindVertexArray(this.emptyVAO);
                gl.uniform2f(gl.getUniformLocation(this.bgProgram, 'uResolution'), w, h);
                
                // Find WorldEnvironment and Sky components in scene
                const entities = this.scene?.entities ?? [];
                let worldEnv: any = null;
                let sky: any = null;
                
                const findEnvComponents = (list: Entity[]) => {
                        for (const e of list) {
                                for (const c of e.components) {
                                        if (c.type === 'WorldEnvironment') worldEnv = c;
                                        if (c.type === 'Sky') sky = c;
                                }
                                findEnvComponents(e.children);
                        }
                };
                findEnvComponents(entities);
                
                // Apply WorldEnvironment settings
                if (worldEnv) {
                        // Background mode: Sky, Color, Gradient, Canvas, Keep
                        const bgMode = worldEnv.background_mode ?? 'Sky';
                        gl.uniform1i(gl.getUniformLocation(this.bgProgram, 'uBackgroundMode'), 
                                bgMode === 'Sky' ? 0 : bgMode === 'Color' ? 1 : bgMode === 'Gradient' ? 2 : 3);
                        
                        // Background color for Color mode
                        const bgColor = worldEnv.background_color ?? [0.2, 0.2, 0.2, 1.0];
                        gl.uniform4f(gl.getUniformLocation(this.bgProgram, 'uBackgroundColor'), 
                                bgColor[0], bgColor[1], bgColor[2], bgColor[3]);
                        
                        // Gradient colors for Gradient mode
                        const gradTop = worldEnv.gradient_top ?? [0.4, 0.4, 0.5, 1.0];
                        const gradBottom = worldEnv.gradient_bottom ?? [0.15, 0.15, 0.18, 1.0];
                        gl.uniform4f(gl.getUniformLocation(this.bgProgram, 'uGradientTop'),
                                gradTop[0], gradTop[1], gradTop[2], gradTop[3]);
                        gl.uniform4f(gl.getUniformLocation(this.bgProgram, 'uGradientBottom'),
                                gradBottom[0], gradBottom[1], gradBottom[2], gradBottom[3]);
                        
                        // Ambient light
                        const ambEnergy = worldEnv.ambient_light_energy ?? 1.0;
                        const ambColor = worldEnv.ambient_light_color ?? [0.5, 0.5, 0.5, 1.0];
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uAmbientLightColor'),
                                ambColor[0] * ambEnergy, ambColor[1] * ambEnergy, ambColor[2] * ambEnergy);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uAmbientLightEnergy'), ambEnergy);
                        
                        // Tonemap
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uTonemapExposure'), worldEnv.tonemap_exposure ?? 1.0);
                        
                        // Glow/Bloom
                        if (worldEnv.glow_enabled) {
                                gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uGlowIntensity'), worldEnv.glow_intensity ?? 0.8);
                                gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uGlowThreshold'), worldEnv.glow_threshold ?? 0.9);
                        }
                } else {
                        // No WorldEnvironment - use neutral gray background (no sky/sun)
                        // Background mode 1 = solid color
                        gl.uniform1i(gl.getUniformLocation(this.bgProgram, 'uBackgroundMode'), 1);
                        gl.uniform4f(gl.getUniformLocation(this.bgProgram, 'uBackgroundColor'), 0.18, 0.18, 0.18, 1.0);
                        // Gradient uniforms (not used but must be set)
                        gl.uniform4f(gl.getUniformLocation(this.bgProgram, 'uGradientTop'), 0.3, 0.3, 0.35, 1.0);
                        gl.uniform4f(gl.getUniformLocation(this.bgProgram, 'uGradientBottom'), 0.15, 0.15, 0.18, 1.0);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uAmbientLightColor'), 0.4, 0.4, 0.4);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uAmbientLightEnergy'), 1.0);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uTonemapExposure'), 1.0);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uGlowIntensity'), 0.0);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uGlowThreshold'), 1.0);
                }
                
                // Camera uniforms
                gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uCameraPos'), 
                        this.camera.position[0], this.camera.position[1], this.camera.position[2]);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.bgProgram, 'uInvViewProj'), false, this.camera.invVpMatrix);
                
                // Sky colors
                if (sky) {
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uSkyTopColor'), 
                                sky.sky_top_color?.[0] ?? 0.35, sky.sky_top_color?.[1] ?? 0.55, sky.sky_top_color?.[2] ?? 0.85);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uSkyHorizonColor'),
                                sky.sky_horizon_color?.[0] ?? 0.65, sky.sky_horizon_color?.[1] ?? 0.78, sky.sky_horizon_color?.[2] ?? 0.90);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uSkyCurve'), sky.sky_curve ?? 0.15);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uSkyEnergy'), sky.sky_energy ?? 1.0);
                        
                        // Ground colors
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uGroundBottomColor'),
                                sky.ground_bottom_color?.[0] ?? 0.12, sky.ground_bottom_color?.[1] ?? 0.10, sky.ground_bottom_color?.[2] ?? 0.08);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uGroundHorizonColor'),
                                sky.ground_horizon_color?.[0] ?? 0.35, sky.ground_horizon_color?.[1] ?? 0.30, sky.ground_horizon_color?.[2] ?? 0.25);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uGroundCurve'), sky.ground_curve ?? 0.1);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uGroundEnergy'), sky.ground_energy ?? 1.0);
                        
                        // Sun - with enable/disable toggle
                        const sunEnabled = sky.sun_enabled !== false; // Default true
                        gl.uniform1i(gl.getUniformLocation(this.bgProgram, 'uSunEnabled'), sunEnabled ? 1 : 0);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uSunDirection'),
                                sky.sun_position?.[0] ?? 0.5, sky.sun_position?.[1] ?? 0.8, sky.sun_position?.[2] ?? -0.3);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uSunColor'),
                                sky.sun_color?.[0] ?? 1.0, sky.sun_color?.[1] ?? 0.95, sky.sun_color?.[2] ?? 0.85);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uSunEnergy'), sunEnabled ? (sky.sun_energy ?? 16.0) : 0.0);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uSunAngleMin'), sky.sun_angle_min ?? 0.5);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uSunAngleMax'), sky.sun_angle_max ?? 2.0);
                        
                        // Clouds
                        gl.uniform1i(gl.getUniformLocation(this.bgProgram, 'uCloudsEnabled'), sky.clouds_enabled ? 1 : 0);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uCloudsColor'),
                                sky.clouds_color?.[0] ?? 1.0, sky.clouds_color?.[1] ?? 1.0, sky.clouds_color?.[2] ?? 1.0);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uCloudsDensity'), sky.clouds_density ?? 0.5);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uCloudsSpeed'), sky.clouds_speed ?? 0.1);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uCloudsHeight'), sky.clouds_height ?? 500.0);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uCloudsCoverage'), sky.clouds_coverage ?? 0.5);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uCloudsThickness'), sky.clouds_thickness ?? 100.0);
                        
                        // Fog
                        gl.uniform1i(gl.getUniformLocation(this.bgProgram, 'uFogEnabled'), sky.fog_enabled ? 1 : 0);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uFogColor'),
                                sky.fog_color?.[0] ?? 0.7, sky.fog_color?.[1] ?? 0.75, sky.fog_color?.[2] ?? 0.80);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uFogDensity'), sky.fog_density ?? 0.001);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uFogDepthBegin'), sky.fog_depth_begin ?? 10.0);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uFogDepthEnd'), sky.fog_depth_end ?? 100.0);
                } else {
                        // Default sky values (nice blue sky)
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uSkyTopColor'), 0.35, 0.55, 0.85);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uSkyHorizonColor'), 0.65, 0.78, 0.90);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uSkyCurve'), 0.15);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uSkyEnergy'), 1.0);
                        
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uGroundBottomColor'), 0.12, 0.10, 0.08);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uGroundHorizonColor'), 0.35, 0.30, 0.25);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uGroundCurve'), 0.1);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uGroundEnergy'), 1.0);
                        
                        // Default sun (enabled by default)
                        gl.uniform1i(gl.getUniformLocation(this.bgProgram, 'uSunEnabled'), 1);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uSunDirection'), 0.5, 0.8, -0.3);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uSunColor'), 1.0, 0.95, 0.85);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uSunEnergy'), 16.0);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uSunAngleMin'), 0.5);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uSunAngleMax'), 2.0);
                        
                        // No clouds by default
                        gl.uniform1i(gl.getUniformLocation(this.bgProgram, 'uCloudsEnabled'), 0);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uCloudsColor'), 1.0, 1.0, 1.0);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uCloudsDensity'), 0.5);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uCloudsSpeed'), 0.1);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uCloudsHeight'), 500.0);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uCloudsCoverage'), 0.5);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uCloudsThickness'), 100.0);
                        
                        // No fog by default
                        gl.uniform1i(gl.getUniformLocation(this.bgProgram, 'uFogEnabled'), 0);
                        gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'uFogColor'), 0.7, 0.75, 0.80);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uFogDensity'), 0.001);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uFogDepthBegin'), 10.0);
                        gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uFogDepthEnd'), 100.0);
                }
                
                // Time for animations
                gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'uTime'), performance.now() / 1000.0);
                
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                gl.enable(gl.DEPTH_TEST);
                gl.bindVertexArray(null);
        }

        private renderGrid(gl: WebGL2RenderingContext): void {
                if (!this.gridProgram) return;
                gl.useProgram(this.gridProgram);
                gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                gl.bindVertexArray(this.emptyVAO);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.gridProgram, 'uInvViewProj'), false, this.camera.invVpMatrix);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.gridProgram, 'uViewProj'), false, this.camera.vpMatrix);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                gl.disable(gl.BLEND);
                gl.bindVertexArray(null);
        }

        private renderAxisLines(gl: WebGL2RenderingContext): void {
                if (!this.axisProgram || !this.axisGeo) return;
                gl.useProgram(this.axisProgram);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.axisProgram, 'uVP'), false, this.camera.vpMatrix);
                gl.bindVertexArray(this.axisGeo.vao);
                gl.drawArrays(gl.LINES, 0, this.axisGeo.count);
                gl.bindVertexArray(null);
        }

        // Хелпер: Пройтись по дереву и получить плоский список объектов с УЖЕ посчитанными мировыми матрицами
        private getRenderList(): { entity: Entity; worldMatrix: Mat4 }[] {
                if (!this.scene?.entities) return [];

                const result: { entity: Entity; worldMatrix: Mat4 }[] = [];
                const identity = m4Identity(m4Create());

                const traverse = (entities: Entity[], parentMatrix: Mat4) => {
                        for (const e of entities) {
                                if (!e.visible) continue;

                                // 1. Local Matrix (T * R * S)
                                const tr = e.components.find(c => c.type === 'Transform');
                                const tr2D = e.components.find(c => c.type === 'Transform2D');
                                const localMat = m4Create();
                                if (tr && tr.type === 'Transform') {
                                        m4FromTRS(localMat, tr.translation, tr.rotation, tr.scale);
                                } else if (tr2D && tr2D.type === 'Transform2D') {
                                        // Transform2D: position (x,y), rotation (angle), scale (x,y)
                                        // Convert to 3D matrix (Z=0)
                                        const cos = Math.cos(tr2D.rotation);
                                        const sin = Math.sin(tr2D.rotation);
                                        m4Identity(localMat);
                                        localMat[0] = cos * tr2D.scale[0];
                                        localMat[1] = sin * tr2D.scale[0];
                                        localMat[4] = -sin * tr2D.scale[1];
                                        localMat[5] = cos * tr2D.scale[1];
                                        localMat[12] = tr2D.position[0];
                                        localMat[13] = tr2D.position[1];
                                } else {
                                        m4Identity(localMat);
                                }

                                // 2. World Matrix (Parent * Local)
                                const worldMat = m4Create();
                                m4Multiply(worldMat, parentMatrix, localMat);

                                // 3. Add to list if it has ANY component (all entities should be rendered with gizmos)
                                // Include entities with Transform OR any other component type
                                const hasTransform = e.components.some(c => c.type === 'Transform');
                                const hasOtherComponents = e.components.length > 0;
                                if (hasTransform || hasOtherComponents) {
                                        result.push({ entity: e, worldMatrix: worldMat });
                                }

                                // 4. Recurse
                                if (e.children.length > 0) {
                                        traverse(e.children, worldMat);
                                }
                        }
                };

                traverse(this.scene.entities, identity);
                return result;
        }
        private renderEntities(gl: WebGL2RenderingContext, pickMode: boolean): void {
                // ИСПОЛЬЗУЕМ НОВЫЙ МЕТОД с иерархией
                const renderItems = this.getRenderList();
                // Rendering entities
                if (renderItems.length === 0) return;
                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;
                gl.useProgram(prog);

                if (!pickMode) {
                        // Use REAL lights from scene instead of default light
                        let lightPos = v3(2, 5, 3);
                        let lightColor = v3(1.2, 1.15, 1.08);
                        let lightIntensity = 1.0;
                        let hasLight = false;

                        // Find first PointLight or DirectionalLight in scene
                        for (const item of renderItems) {
                                const pl = item.entity.components.find((c: Component) => c.type === 'PointLight');
                                if (pl && pl.type === 'PointLight') {
                                        // Type guard: now TypeScript knows pl is PointLightComponent
                                        lightPos = v3(item.worldMatrix[12], item.worldMatrix[13], item.worldMatrix[14]);
                                        lightColor = v3(pl.color[0], pl.color[1], pl.color[2]);
                                        lightIntensity = pl.intensity / 1000.0;
                                        hasLight = true;
                                        break;
                                }
                                
                                const dl = item.entity.components.find((c: Component) => c.type === 'DirectionalLight');
                                if (dl && dl.type === 'DirectionalLight') {
                                        // Type guard: now TypeScript knows dl is DirectionalLightComponent
                                        // For directional light, use the forward direction (-Z in local space)
                                        const fwd = v3(-item.worldMatrix[8], -item.worldMatrix[9], -item.worldMatrix[10]);
                                        v3Normalize(fwd, fwd);
                                        lightPos = fwd; // Reuse as direction
                                        lightColor = v3(dl.color[0], dl.color[1], dl.color[2]);
                                        lightIntensity = dl.illuminance;
                                        hasLight = true;
                                        break;
                                }
                        }

                        // Pass number of lights for shader branching
                        gl.uniform1f(gl.getUniformLocation(prog, 'uNumLights'), hasLight ? 1.0 : 0.0);

                        // If no lights in scene, use professional 3-point preview lighting
                        if (!hasLight) {
                                // Preview mode - shader handles 3-point lighting internally
                                const ld = v3(0.6, 0.8, 0.5); // Key light direction (matches shader)
                                gl.uniform3fv(gl.getUniformLocation(prog, 'uLightDir'), ld);
                                gl.uniform3f(gl.getUniformLocation(prog, 'uLightColor'), 1.0, 0.98, 0.95);
                                gl.uniform3f(gl.getUniformLocation(prog, 'uAmbientColor'), 0.15, 0.16, 0.20); // Brighter ambient
                        } else {
                                // Use scene light
                                v3Normalize(lightPos, lightPos);
                                gl.uniform3fv(gl.getUniformLocation(prog, 'uLightDir'), lightPos);
                                gl.uniform3f(gl.getUniformLocation(prog, 'uLightColor'), 
                                        lightColor[0] * lightIntensity, 
                                        lightColor[1] * lightIntensity, 
                                        lightColor[2] * lightIntensity);
                                gl.uniform3f(gl.getUniformLocation(prog, 'uAmbientColor'), 0.08, 0.08, 0.10);
                        }
                        
                        gl.uniform3fv(gl.getUniformLocation(prog, 'uCameraPos'), this.camera.position);
                }

                const normMat = m4Create(), mvp = m4Create();

                for (let i = 0; i < renderItems.length; i++) {
                        const { entity, worldMatrix } = renderItems[i];
                        const me = entity.components.find((c: Component) => c.type === 'Mesh');
                        const ma = entity.components.find((c: Component) => c.type === 'Material');
                        const cam = entity.components.find((c: Component) => c.type === 'Camera');
                        const pointLight = entity.components.find((c: Component) => c.type === 'PointLight');
                        const dirLight = entity.components.find((c: Component) => c.type === 'DirectionalLight');
                        const spotLight = entity.components.find((c: Component) => c.type === 'SpotLight');
                        const characterBody = entity.components.find((c: Component) => c.type === 'CharacterBody');
                        const rigidBody = entity.components.find((c: Component) => c.type === 'RigidBody');
                        const staticBody = entity.components.find((c: Component) => c.type === 'StaticBody');
                        const area = entity.components.find((c: Component) => c.type === 'Area');
                        const rayCast = entity.components.find((c: Component) => c.type === 'RayCast');
                        const collisionShape = entity.components.find((c: Component) => c.type === 'CollisionShape');
                        
                        // Render CollisionShape helper (wireframe)
                        if (collisionShape && !me) {
                                this.renderCollisionShapeHelper(gl, worldMatrix, i, pickMode, collisionShape);
                                continue;
                        }
                        
                        // Render 3D helper for Camera (always visible, even in pick mode for selection)
                        if (cam) {
                                this.renderCameraHelper(gl, worldMatrix, i, pickMode);
                                if (!me) continue; // Skip mesh rendering if this is just a camera
                        }
                        
                        // Render 3D helper for PointLight (bulb)
                        if (pointLight) {
                                this.renderPointLightHelper(gl, worldMatrix, i, pickMode);
                                if (!me) continue; // Skip mesh rendering if this is just a light
                        }
                        
                        // Render 3D helper for DirectionalLight (sun)
                        if (dirLight) {
                                this.renderDirectionalLightHelper(gl, worldMatrix, i, pickMode);
                                if (!me) continue; // Skip mesh rendering if this is just a light
                        }
                        
                        // Render 3D helper for SpotLight (cone)
                        if (spotLight) {
                                this.renderSpotLightHelper(gl, worldMatrix, i, pickMode);
                                if (!me) continue;
                        }
                        
                        // Render physics body helpers
                        if (characterBody || rigidBody || staticBody) {
                                this.renderPhysicsBodyHelper(gl, worldMatrix, i, pickMode);
                                if (!me) continue;
                        }
                        
                        // Render Area3D helper (wireframe box)
                        if (area) {
                                this.renderAreaHelper(gl, worldMatrix, i, pickMode);
                                if (!me) continue;
                        }
                        
                        // Render RayCast3D helper (arrow)
                        if (rayCast) {
                                this.renderRayCastHelper(gl, worldMatrix, i, pickMode);
                                if (!me) continue;
                        }
                        
                        // NEW: Audio helpers
                        const audioPlayer = entity.components.find((c: Component) => c.type === 'AudioStreamPlayer');
                        const audioPlayer2D = entity.components.find((c: Component) => c.type === 'AudioStreamPlayer2D');
                        const audioPlayer3D = entity.components.find((c: Component) => c.type === 'AudioStreamPlayer3D');
                        if (audioPlayer || audioPlayer2D || audioPlayer3D) {
                                this.renderAudioHelper(gl, worldMatrix, i, pickMode, audioPlayer3D ? '3D' : audioPlayer2D ? '2D' : '');
                                if (!me) continue;
                        }
                        
                        // NEW: Animation helpers
                        const animPlayer = entity.components.find((c: Component) => c.type === 'AnimationPlayer');
                        const animTree = entity.components.find((c: Component) => c.type === 'AnimationTree');
                        const tween = entity.components.find((c: Component) => c.type === 'Tween');
                        if (animPlayer || animTree || tween) {
                                this.renderAnimationHelper(gl, worldMatrix, i, pickMode, animTree ? 'tree' : tween ? 'tween' : 'player');
                                if (!me) continue;
                        }
                        
                        // NEW: Navigation helpers
                        const navRegion3D = entity.components.find((c: Component) => c.type === 'NavigationRegion3D');
                        const navAgent3D = entity.components.find((c: Component) => c.type === 'NavigationAgent3D');
                        const navObstacle3D = entity.components.find((c: Component) => c.type === 'NavigationObstacle3D');
                        if (navRegion3D || navAgent3D || navObstacle3D) {
                                this.renderNavigationHelper(gl, worldMatrix, i, pickMode, navRegion3D ? 'region' : navObstacle3D ? 'obstacle' : 'agent');
                                if (!me) continue;
                        }
                        
                        // NEW: Utility helpers
                        const timer = entity.components.find((c: Component) => c.type === 'Timer');
                        const marker3D = entity.components.find((c: Component) => c.type === 'Marker3D');
                        const path3D = entity.components.find((c: Component) => c.type === 'Path3D');
                        const pathFollow3D = entity.components.find((c: Component) => c.type === 'PathFollow3D');
                        if (timer || marker3D || path3D || pathFollow3D) {
                                this.renderUtilityHelper(gl, worldMatrix, i, pickMode, timer ? 'timer' : marker3D ? 'marker' : path3D ? 'path' : 'pathfollow');
                                if (!me) continue;
                        }
                        
                        // NEW: Environment helpers
                        const worldEnv = entity.components.find((c: Component) => c.type === 'WorldEnvironment');
                        const fogVolume = entity.components.find((c: Component) => c.type === 'FogVolume');
                        const sky = entity.components.find((c: Component) => c.type === 'Sky');
                        const reflectionProbe = entity.components.find((c: Component) => c.type === 'ReflectionProbe');
                        if (worldEnv || fogVolume || sky || reflectionProbe) {
                                this.renderEnvironmentHelper(gl, worldMatrix, i, pickMode, worldEnv ? 'world' : fogVolume ? 'fog' : sky ? 'sky' : 'probe');
                                if (!me) continue;
                        }
                        
                        // NEW: Particles helpers
                        const gpuParticles = entity.components.find((c: Component) => c.type === 'GPUParticles3D');
                        const cpuParticles = entity.components.find((c: Component) => c.type === 'CPUParticles3D');
                        if (gpuParticles || cpuParticles) {
                                this.renderParticlesHelper(gl, worldMatrix, i, pickMode, gpuParticles ? 'gpu' : 'cpu');
                                if (!me) continue;
                        }
                        
                        // NEW: Sprite helpers
                        const sprite3D = entity.components.find((c: Component) => c.type === 'Sprite3D');
                        const animSprite3D = entity.components.find((c: Component) => c.type === 'AnimatedSprite3D');
                        const label3D = entity.components.find((c: Component) => c.type === 'Label3D');
                        if (sprite3D || animSprite3D || label3D) {
                                this.renderSpriteHelper(gl, worldMatrix, i, pickMode, animSprite3D ? 'animated' : label3D ? 'label' : 'sprite');
                                if (!me) continue;
                        }
                        
                        // NEW: ShapeCast helper
                        const shapeCast = entity.components.find((c: Component) => c.type === 'ShapeCast');
                        if (shapeCast) {
                                if (!pickMode && this.shapeCastVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.shapeCastVAO, GIZMO_COLORS.shapeCast, 0.0);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.3);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: 2D Node helpers (rendered in XY plane at Z=0)
                        const transform2D = entity.components.find((c: Component) => c.type === 'Transform2D');
                        const sprite2D = entity.components.find((c: Component) => c.type === 'Sprite2D');
                        const marker2D = entity.components.find((c: Component) => c.type === 'Marker2D');
                        const animSprite2D = entity.components.find((c: Component) => c.type === 'AnimatedSprite2D');
                        if (transform2D || sprite2D || marker2D || animSprite2D) {
                                if (!pickMode && this.node2DVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.node2DVAO, GIZMO_COLORS.node2D, 0.0);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.3);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: 2D Physics helpers
                        const collisionShape2D = entity.components.find((c: Component) => c.type === 'CollisionShape2D');
                        const area2D = entity.components.find((c: Component) => c.type === 'Area2D');
                        if (collisionShape2D || area2D) {
                                if (!pickMode && this.collisionShape2DVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.collisionShape2DVAO, GIZMO_COLORS.physics2D, 1.0);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.4);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: Skeleton and Bone helpers
                        const skeleton3D = entity.components.find((c: Component) => c.type === 'Skeleton3D');
                        const boneAttachment = entity.components.find((c: Component) => c.type === 'BoneAttachment3D');
                        if (skeleton3D || boneAttachment) {
                                if (!pickMode && skeleton3D && this.skeletonVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.skeletonVAO, GIZMO_COLORS.skeleton, 1.0);
                                } else if (!pickMode && boneAttachment && this.boneAttachmentVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.boneAttachmentVAO, GIZMO_COLORS.bone, 1.0);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.2);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: Visibility Notifier helper
                        const visibilityNotifier3D = entity.components.find((c: Component) => c.type === 'VisibleOnScreenNotifier3D');
                        const visibilityNotifier2D = entity.components.find((c: Component) => c.type === 'VisibleOnScreenNotifier2D');
                        if (visibilityNotifier3D || visibilityNotifier2D) {
                                if (!pickMode && this.visibilityNotifierVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.visibilityNotifierVAO, GIZMO_COLORS.visibility, 0.7);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.4);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: Remote Transform helper
                        const remoteTransform3D = entity.components.find((c: Component) => c.type === 'RemoteTransform3D');
                        const remoteTransform2D = entity.components.find((c: Component) => c.type === 'RemoteTransform2D');
                        if (remoteTransform3D || remoteTransform2D) {
                                if (!pickMode && this.remoteTransformVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.remoteTransformVAO, GIZMO_COLORS.remoteTransform, 1.0);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.3);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: MultiMesh helper
                        const multiMesh = entity.components.find((c: Component) => c.type === 'MultiMeshInstance3D');
                        if (multiMesh) {
                                if (!pickMode && this.multiMeshVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.multiMeshVAO, GIZMO_COLORS.multiMesh, 0.8);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.5);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: CanvasLayer helper
                        const canvasLayer = entity.components.find((c: Component) => c.type === 'CanvasLayer');
                        if (canvasLayer) {
                                if (!pickMode && this.canvasLayerVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.canvasLayerVAO, GIZMO_COLORS.canvasLayer, 0.6);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.5);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: Path2D and NavRegion2D helpers
                        const path2D = entity.components.find((c: Component) => c.type === 'Path2D');
                        const navRegion2D = entity.components.find((c: Component) => c.type === 'NavigationRegion2D');
                        if (path2D || navRegion2D) {
                                if (!pickMode && path2D && this.path2DVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.path2DVAO, GIZMO_COLORS.path2D, 0.9);
                                } else if (!pickMode && navRegion2D && this.navRegion2DVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.navRegion2DVAO, GIZMO_COLORS.navRegion, 0.8);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.4);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: 2D Physics Body helpers
                        const characterBody2D = entity.components.find((c: Component) => c.type === 'CharacterBody2D');
                        const rigidBody2D = entity.components.find((c: Component) => c.type === 'RigidBody2D');
                        const staticBody2D = entity.components.find((c: Component) => c.type === 'StaticBody2D');
                        if (characterBody2D || rigidBody2D || staticBody2D) {
                                if (!pickMode && characterBody2D && this.characterBody2DVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.characterBody2DVAO, GIZMO_COLORS.characterBody2D, 1.0);
                                } else if (!pickMode && rigidBody2D && this.rigidBody2DVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.rigidBody2DVAO, GIZMO_COLORS.rigidBody2D, 1.0);
                                } else if (!pickMode && staticBody2D && this.staticBody2DVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.staticBody2DVAO, GIZMO_COLORS.staticBody2D, 1.0);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.4);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: RayCast2D helper
                        const rayCast2D = entity.components.find((c: Component) => c.type === 'RayCast2D');
                        if (rayCast2D) {
                                if (!pickMode && this.rayCast2DVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.rayCast2DVAO, GIZMO_COLORS.rayCast2D, 1.0);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.3);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: NavigationAgent2D and NavigationObstacle2D helpers
                        const navAgent2D = entity.components.find((c: Component) => c.type === 'NavigationAgent2D');
                        const navObstacle2D = entity.components.find((c: Component) => c.type === 'NavigationObstacle2D');
                        if (navAgent2D || navObstacle2D) {
                                if (!pickMode && navAgent2D && this.navAgent2DVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.navAgent2DVAO, GIZMO_COLORS.navAgent2D, 1.0);
                                } else if (!pickMode && navObstacle2D && this.navObstacle2DVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.navObstacle2DVAO, GIZMO_COLORS.navObstacle2D, 1.0);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.3);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: PathFollow2D helper
                        const pathFollow2D = entity.components.find((c: Component) => c.type === 'PathFollow2D');
                        if (pathFollow2D) {
                                if (!pickMode && this.pathFollow2DVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.pathFollow2DVAO, GIZMO_COLORS.pathFollow2D, 1.0);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.25);
                                }
                                if (!me) continue;
                        }
                        
                        // NEW: Viewport and SubViewport helpers
                        const viewport = entity.components.find((c: Component) => c.type === 'Viewport');
                        const subViewport = entity.components.find((c: Component) => c.type === 'SubViewport');
                        if (viewport || subViewport) {
                                if (!pickMode && viewport && this.viewportVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.viewportVAO, GIZMO_COLORS.viewport, 0.8);
                                } else if (!pickMode && subViewport && this.subViewportVAO) {
                                        this.renderWireframeHelper(gl, worldMatrix, this.subViewportVAO, GIZMO_COLORS.subViewport, 0.8);
                                }
                                if (pickMode) {
                                        this.renderPickingSphere(gl, worldMatrix, i, 0.5);
                                }
                                if (!me) continue;
                        }
                        
                        if (!me) continue;

                        const shape = me.shape;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];

                        let shapeScale = [1, 1, 1];
                        if (shape.type === 'Cube') { const sz = shape.size || 1; shapeScale = [sz, sz, sz]; }
                        else if (shape.type === 'Plane') { const sz = shape.size || 10; shapeScale = [sz, 1, sz]; }
                        else if (shape.type === 'Sphere') { const rad = (shape.radius || 0.5) * 2; shapeScale = [rad, rad, rad]; }
                        else if (shape.type === 'Cylinder') { const r = (shape.radius || 0.5) * 2; const h = shape.height || 1; shapeScale = [r, h, r]; }
                        else if (shape.type === 'Cone') { const r = (shape.radius || 0.5) * 2; const h = shape.height || 1; shapeScale = [r, h, r]; }
                        else if (shape.type === 'Torus') { const r = (shape.radius || 0.5) * 2; shapeScale = [r, r, r]; }
                        else if (shape.type === 'Capsule') { const r = (shape.radius || 0.5) * 2; const h = shape.height || 1; shapeScale = [r, h, r]; }

                        drawMatrix[0] *= shapeScale[0]; drawMatrix[1] *= shapeScale[0]; drawMatrix[2] *= shapeScale[0];
                        drawMatrix[4] *= shapeScale[1]; drawMatrix[5] *= shapeScale[1]; drawMatrix[6] *= shapeScale[1];
                        drawMatrix[8] *= shapeScale[2]; drawMatrix[9] *= shapeScale[2]; drawMatrix[10] *= shapeScale[2];

                        if (pickMode) {
                                m4Multiply(mvp, this.camera.vpMatrix, drawMatrix);
                                gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uMVP'), false, mvp);
                                const [cr, cg, cb, ca] = entityIdToColor(i);
                                gl.uniform4f(gl.getUniformLocation(prog, 'uFlatColor'), cr, cg, cb, ca);
                        } else {
                                gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uModel'), false, drawMatrix);
                                gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uView'), false, this.camera.viewMatrix);
                                gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uProj'), false, this.camera.projMatrix);
                                m4TransposeUpper3x3(normMat, drawMatrix);
                                gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uNormalMatrix'), false, normMat);
                                let color = [0.6, 0.6, 0.6], metallic = 0, roughness = 0.8;
                                if (ma) {
                                        if (ma.color) color = [ma.color[0], ma.color[1], ma.color[2]];
                                        metallic = ma.metallic ?? 0; roughness = ma.roughness ?? 0.8;
                                }
                                gl.uniform3fv(gl.getUniformLocation(prog, 'uColor'), color);
                                gl.uniform1f(gl.getUniformLocation(prog, 'uMetallic'), metallic);
                                gl.uniform1f(gl.getUniformLocation(prog, 'uRoughness'), roughness);
                        }

                        let geo: MeshBuffers | null = null;
                        if (shape.type === 'Cube') geo = this.cubeGeo;
                        else if (shape.type === 'Plane') geo = this.planeGeo;
                        else if (shape.type === 'Sphere') geo = this.sphereGeo;
                        else if (shape.type === 'Cylinder') geo = this.cylinderGeo;
                        else if (shape.type === 'Cone') geo = this.coneGeo;
                        else if (shape.type === 'Torus') geo = this.torusGeo;
                        else if (shape.type === 'Capsule') geo = this.capsuleGeo;

                        if (geo) {
                                gl.bindVertexArray(geo.vao);
                                gl.drawElements(gl.TRIANGLES, geo.indexCount, gl.UNSIGNED_SHORT, 0);
                                gl.bindVertexArray(null);
                        }
                }
        }

        // ========================================================================
        // 3D HELPERS FOR CAMERA AND LIGHTS
        // ========================================================================

        private renderCameraHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean): void {
                if (!this.meshProgram || !this.cubeGeo || !this.coneGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;

                // Camera is a single unified mesh - render as one pickable object
                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                // Camera body (main cube)
                const bodyScale = 0.35;
                const drawMatrix = m4Create();
                for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                drawMatrix[0] *= bodyScale; drawMatrix[1] *= bodyScale; drawMatrix[2] *= bodyScale;
                drawMatrix[4] *= bodyScale * 0.6; drawMatrix[5] *= bodyScale * 0.6; drawMatrix[6] *= bodyScale * 0.6;
                drawMatrix[8] *= bodyScale * 0.8; drawMatrix[9] *= bodyScale * 0.8; drawMatrix[10] *= bodyScale * 0.8;

                this.renderHelperMesh(gl, prog, drawMatrix, this.cubeGeo, pickMode, pickColor, GIZMO_COLORS.camera, 0.2, 0.6);

                // Lens (cone pointing forward along -Z)
                const lensScale = 0.18;
                const lensM = m4Create();
                const lensQ: [number, number, number, number] = [0.7071068, 0, 0, 0.7071068]; // 90 deg around X
                m4FromQuat(lensM, lensQ);
                m4Multiply(lensM, worldMatrix, lensM);
                // Move forward
                lensM[12] += worldMatrix[8] * 0.35;
                lensM[13] += worldMatrix[9] * 0.35;
                lensM[14] += worldMatrix[10] * 0.35;
                lensM[0] *= lensScale; lensM[1] *= lensScale; lensM[2] *= lensScale;
                lensM[4] *= lensScale * 0.9; lensM[5] *= lensScale * 0.9; lensM[6] *= lensScale * 0.9;
                lensM[8] *= lensScale; lensM[9] *= lensScale; lensM[10] *= lensScale;

                this.renderHelperMesh(gl, prog, lensM, this.coneGeo, pickMode, pickColor, [0.25, 0.35, 0.45], 0.4, 0.4);

                // Camera frustum wireframe (professional visualization)
                if (!pickMode && this.cameraFrustumVAO) {
                        // Create frustum matrix - scaled and positioned in front of camera
                        const frustumM = m4Create();
                        for (let k = 0; k < 16; k++) frustumM[k] = worldMatrix[k];
                        // Move frustum forward along camera's -Z direction
                        frustumM[12] += worldMatrix[8] * 0.5;
                        frustumM[13] += worldMatrix[9] * 0.5;
                        frustumM[14] += worldMatrix[10] * 0.5;
                        
                        this.renderWireframeHelper(gl, frustumM, this.cameraFrustumVAO, GIZMO_COLORS.camera, 0.7);
                }

                // Direction indicator (thin line showing where camera looks)
                if (!pickMode) {
                        this.renderDirectionLine(gl, worldMatrix, GIZMO_COLORS.camera, 1.5);
                }
        }

        private renderPointLightHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean): void {
                if (!this.meshProgram || !this.sphereGeo || !this.cylinderGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;

                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                // Bulb (main sphere)
                const bulbScale = 0.28;
                const drawMatrix = m4Create();
                for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                drawMatrix[0] *= bulbScale; drawMatrix[1] *= bulbScale; drawMatrix[2] *= bulbScale;
                drawMatrix[4] *= bulbScale; drawMatrix[5] *= bulbScale; drawMatrix[6] *= bulbScale;
                drawMatrix[8] *= bulbScale; drawMatrix[9] *= bulbScale; drawMatrix[10] *= bulbScale;

                this.renderHelperMesh(gl, prog, drawMatrix, this.sphereGeo, pickMode, pickColor, GIZMO_COLORS.pointLight, 0.0, 0.3);

                // Base (small cylinder)
                const baseScale = 0.14;
                const baseM = m4Create();
                for (let k = 0; k < 16; k++) baseM[k] = worldMatrix[k];
                baseM[12] -= worldMatrix[4] * 0.32;
                baseM[13] -= worldMatrix[5] * 0.32;
                baseM[14] -= worldMatrix[6] * 0.32;
                baseM[0] *= baseScale; baseM[1] *= baseScale; baseM[2] *= baseScale;
                baseM[4] *= 0.18; baseM[5] *= 0.18; baseM[6] *= 0.18;
                baseM[8] *= baseScale; baseM[9] *= baseScale; baseM[10] *= baseScale;

                this.renderHelperMesh(gl, prog, baseM, this.cylinderGeo, pickMode, pickColor, [0.3, 0.3, 0.32], 0.6, 0.5);
                
                // Wireframe range indicator (professional visualization)
                if (!pickMode && this.wireframeSphereVAO) {
                        const rangeM = m4Create();
                        for (let k = 0; k < 16; k++) rangeM[k] = worldMatrix[k];
                        const rangeScale = 1.0; // Represents light range
                        rangeM[0] *= rangeScale; rangeM[1] *= rangeScale; rangeM[2] *= rangeScale;
                        rangeM[4] *= rangeScale; rangeM[5] *= rangeScale; rangeM[6] *= rangeScale;
                        rangeM[8] *= rangeScale; rangeM[9] *= rangeScale; rangeM[10] *= rangeScale;
                        
                        this.renderWireframeHelper(gl, rangeM, this.wireframeSphereVAO, GIZMO_COLORS.pointLight, 0.4);
                }
                
                // Light rays (Godot-style)
                if (!pickMode && this.pointLightRaysVAO) {
                        this.renderWireframeHelper(gl, worldMatrix, this.pointLightRaysVAO, GIZMO_COLORS.pointLight, 0.8);
                }
        }

        private renderDirectionalLightHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean): void {
                if (!this.meshProgram || !this.sphereGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;

                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                // Sun core (main sphere)
                const sunScale = 0.4;
                const drawMatrix = m4Create();
                for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                drawMatrix[0] *= sunScale; drawMatrix[1] *= sunScale; drawMatrix[2] *= sunScale;
                drawMatrix[4] *= sunScale; drawMatrix[5] *= sunScale; drawMatrix[6] *= sunScale;
                drawMatrix[8] *= sunScale; drawMatrix[9] *= sunScale; drawMatrix[10] *= sunScale;

                this.renderHelperMesh(gl, prog, drawMatrix, this.sphereGeo, pickMode, pickColor, GIZMO_COLORS.directionalLight, 0.0, 0.2);

                // Professional sun rays wireframe (Godot-style)
                if (!pickMode && this.sunRaysVAO) {
                        this.renderWireframeHelper(gl, worldMatrix, this.sunRaysVAO, GIZMO_COLORS.directionalLight, 0.9);
                } else if (pickMode) {
                        // Fallback for picking - use solid cubes
                        const rayScale = 0.06;
                        const rayDist = 0.55;
                        for (let i = 0; i < 8; i++) {
                                const angle = (i / 8) * Math.PI * 2;
                                const rayM = m4Create();
                                for (let k = 0; k < 16; k++) rayM[k] = worldMatrix[k];
                                
                                const offsetX = Math.cos(angle) * rayDist;
                                const offsetY = Math.sin(angle) * rayDist;
                                rayM[12] += worldMatrix[0] * offsetX + worldMatrix[4] * offsetY;
                                rayM[13] += worldMatrix[1] * offsetX + worldMatrix[5] * offsetY;
                                rayM[14] += worldMatrix[2] * offsetX + worldMatrix[6] * offsetY;
                                
                                rayM[0] *= rayScale; rayM[1] *= rayScale; rayM[2] *= rayScale;
                                rayM[4] *= rayScale * 2.5; rayM[5] *= rayScale * 2.5; rayM[6] *= rayScale * 2.5;
                                rayM[8] *= rayScale; rayM[9] *= rayScale; rayM[10] *= rayScale;

                                this.renderHelperMesh(gl, prog, rayM, this.cubeGeo, pickMode, pickColor, [1.0, 0.85, 0.35], 0.0, 0.2);
                        }
                }

                // Direction indicator (arrow showing light direction)
                if (!pickMode) {
                        this.renderDirectionLine(gl, worldMatrix, [1.0, 0.85, 0.35], 2.0);
                }
        }

        // Helper method to render a single mesh part
        private renderHelperMesh(
                gl: WebGL2RenderingContext,
                prog: WebGLProgram,
                matrix: Mat4,
                geo: MeshBuffers | null,
                pickMode: boolean,
                pickColor: [number, number, number, number] | null,
                color: [number, number, number],
                metallic: number,
                roughness: number
        ): void {
                if (!geo) return;

                gl.useProgram(prog);
                const normMat = m4Create();
                const mvp = m4Create();

                if (pickMode && pickColor) {
                        m4Multiply(mvp, this.camera.vpMatrix, matrix);
                        gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uMVP'), false, mvp);
                        gl.uniform4f(gl.getUniformLocation(prog, 'uFlatColor'), pickColor[0], pickColor[1], pickColor[2], pickColor[3]);
                } else {
                        gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uModel'), false, matrix);
                        gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uView'), false, this.camera.viewMatrix);
                        gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uProj'), false, this.camera.projMatrix);
                        m4TransposeUpper3x3(normMat, matrix);
                        gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uNormalMatrix'), false, normMat);
                        gl.uniform3f(gl.getUniformLocation(prog, 'uColor'), color[0], color[1], color[2]);
                        gl.uniform1f(gl.getUniformLocation(prog, 'uMetallic'), metallic);
                        gl.uniform1f(gl.getUniformLocation(prog, 'uRoughness'), roughness);
                }

                gl.bindVertexArray(geo.vao);
                gl.drawElements(gl.TRIANGLES, geo.indexCount, gl.UNSIGNED_SHORT, 0);
                gl.bindVertexArray(null);
        }

        // Wireframe gizmo helper - renders line-based gizmos
        private renderWireframeHelper(
                gl: WebGL2RenderingContext,
                matrix: Mat4,
                wireframe: WireframeBuffers | null,
                color: [number, number, number],
                alpha: number = 1.0
        ): void {
                if (!wireframe || !this.lineProgram) return;

                gl.useProgram(this.lineProgram);
                
                const mvp = m4Create();
                m4Multiply(mvp, this.camera.vpMatrix, matrix);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.lineProgram, 'uMVP'), false, mvp);
                gl.uniform4f(gl.getUniformLocation(this.lineProgram, 'uLineColor'), color[0], color[1], color[2], 1.0);
                gl.uniform1f(gl.getUniformLocation(this.lineProgram, 'uAlpha'), alpha);

                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                gl.depthMask(false);

                gl.bindVertexArray(wireframe.vao);
                if (wireframe.useIndices) {
                        gl.drawElements(gl.LINES, wireframe.vertexCount, gl.UNSIGNED_SHORT, 0);
                } else {
                        gl.drawArrays(gl.LINES, 0, wireframe.vertexCount);
                }
                gl.bindVertexArray(null);

                gl.depthMask(true);
                gl.disable(gl.BLEND);
        }

        // Render a simple sphere for picking (used for nodes without mesh)
        private renderPickingSphere(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, radius: number): void {
                if (!this.flatProgram || !this.sphereGeo) return;
                
                const pickColor = entityIdToColor(entityIndex);
                gl.useProgram(this.flatProgram);
                
                const drawMatrix = m4Create();
                for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                drawMatrix[0] *= radius; drawMatrix[1] *= radius; drawMatrix[2] *= radius;
                drawMatrix[4] *= radius; drawMatrix[5] *= radius; drawMatrix[6] *= radius;
                drawMatrix[8] *= radius; drawMatrix[9] *= radius; drawMatrix[10] *= radius;
                
                const mvp = m4Create();
                m4Multiply(mvp, this.camera.vpMatrix, drawMatrix);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram, 'uMVP'), false, mvp);
                gl.uniform4f(gl.getUniformLocation(this.flatProgram, 'uFlatColor'), pickColor[0], pickColor[1], pickColor[2], pickColor[3]);
                
                gl.bindVertexArray(this.sphereGeo.vao);
                gl.drawElements(gl.TRIANGLES, this.sphereGeo.indexCount, gl.UNSIGNED_SHORT, 0);
                gl.bindVertexArray(null);
        }

        // Render direction line (arrow) for lights and cameras
        private renderDirectionLine(gl: WebGL2RenderingContext, worldMatrix: Mat4, color: [number, number, number], length: number): void {
                if (!this.flatProgram || !this.cylinderGeo || !this.coneGeo) return;

                gl.useProgram(this.flatProgram);

                // Line shaft (thin cylinder along -Z direction)
                const shaftM = m4Create();
                const shaftQ: [number, number, number, number] = [0.7071068, 0, 0, 0.7071068]; // 90 deg around X
                m4FromQuat(shaftM, shaftQ);
                m4Multiply(shaftM, worldMatrix, shaftM);
                
                // Move forward to start of line
                shaftM[12] += worldMatrix[8] * 0.3;
                shaftM[13] += worldMatrix[9] * 0.3;
                shaftM[14] += worldMatrix[10] * 0.3;
                
                const shaftScale = 0.02;
                shaftM[0] *= shaftScale; shaftM[1] *= shaftScale; shaftM[2] *= shaftScale;
                shaftM[4] *= length * 0.8; shaftM[5] *= length * 0.8; shaftM[6] *= length * 0.8;
                shaftM[8] *= shaftScale; shaftM[9] *= shaftScale; shaftM[10] *= shaftScale;

                const mvp = m4Create();
                m4Multiply(mvp, this.camera.vpMatrix, shaftM);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram, 'uMVP'), false, mvp);
                gl.uniform4f(gl.getUniformLocation(this.flatProgram, 'uFlatColor'), color[0], color[1], color[2], 0.6);
                
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                gl.bindVertexArray(this.cylinderGeo.vao);
                gl.drawElements(gl.TRIANGLES, this.cylinderGeo.indexCount, gl.UNSIGNED_SHORT, 0);

                // Arrow head (cone at the end)
                const headM = m4Create();
                m4FromQuat(headM, shaftQ);
                m4Multiply(headM, worldMatrix, headM);
                
                headM[12] += worldMatrix[8] * (0.3 + length * 0.8);
                headM[13] += worldMatrix[9] * (0.3 + length * 0.8);
                headM[14] += worldMatrix[10] * (0.3 + length * 0.8);
                
                const headScale = 0.08;
                headM[0] *= headScale; headM[1] *= headScale; headM[2] *= headScale;
                headM[4] *= length * 0.25; headM[5] *= length * 0.25; headM[6] *= length * 0.25;
                headM[8] *= headScale; headM[9] *= headScale; headM[10] *= headScale;

                m4Multiply(mvp, this.camera.vpMatrix, headM);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram, 'uMVP'), false, mvp);
                gl.uniform4f(gl.getUniformLocation(this.flatProgram, 'uFlatColor'), color[0], color[1], color[2], 0.8);
                
                gl.bindVertexArray(this.coneGeo!.vao);
                gl.drawElements(gl.TRIANGLES, this.coneGeo!.indexCount, gl.UNSIGNED_SHORT, 0);
                gl.bindVertexArray(null);
                gl.disable(gl.BLEND);
        }

        // Render SpotLight helper (cone-shaped light visualization)
        private renderSpotLightHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean): void {
                if (!this.meshProgram || !this.coneGeo || !this.sphereGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;

                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                // Light bulb (small sphere at origin)
                const bulbScale = 0.22;
                const drawMatrix = m4Create();
                for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                drawMatrix[0] *= bulbScale; drawMatrix[1] *= bulbScale; drawMatrix[2] *= bulbScale;
                drawMatrix[4] *= bulbScale; drawMatrix[5] *= bulbScale; drawMatrix[6] *= bulbScale;
                drawMatrix[8] *= bulbScale; drawMatrix[9] *= bulbScale; drawMatrix[10] *= bulbScale;

                this.renderHelperMesh(gl, prog, drawMatrix, this.sphereGeo, pickMode, pickColor, GIZMO_COLORS.pointLight, 0.0, 0.3);

                // Professional wireframe cone (shows spotlight angle and direction)
                if (!pickMode && this.spotlightConeVAO) {
                        const coneM = m4Create();
                        const coneQ: [number, number, number, number] = [0.7071068, 0, 0, 0.7071068]; // 90 deg around X
                        m4FromQuat(coneM, coneQ);
                        m4Multiply(coneM, worldMatrix, coneM);
                        
                        // Move forward along -Z direction
                        coneM[12] += worldMatrix[8] * 0.3;
                        coneM[13] += worldMatrix[9] * 0.3;
                        coneM[14] += worldMatrix[10] * 0.3;
                        
                        this.renderWireframeHelper(gl, coneM, this.spotlightConeVAO, GIZMO_COLORS.spotLight, 0.8);
                }
                
                // Direction indicator
                if (!pickMode) {
                        this.renderDirectionLine(gl, worldMatrix, GIZMO_COLORS.spotLight, 1.8);
                }
        }

        // Render physics body helper (wireframe capsule/box for CharacterBody/RigidBody/StaticBody)
        private renderPhysicsBodyHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean): void {
                if (!this.meshProgram || !this.capsuleGeo || !this.cubeGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;

                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                // Professional wireframe capsule for physics bodies
                if (!pickMode && this.characterBodyVAO) {
                        this.renderWireframeHelper(gl, worldMatrix, this.characterBodyVAO, GIZMO_COLORS.characterBody, 0.8);
                }
                
                // Solid mesh for picking
                if (pickMode) {
                        const bodyScale = 0.8;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                        drawMatrix[0] *= bodyScale; drawMatrix[1] *= bodyScale; drawMatrix[2] *= bodyScale;
                        drawMatrix[4] *= bodyScale * 1.8; drawMatrix[5] *= bodyScale * 1.8; drawMatrix[6] *= bodyScale * 1.8;
                        drawMatrix[8] *= bodyScale; drawMatrix[9] *= bodyScale; drawMatrix[10] *= bodyScale;

                        this.renderHelperMesh(gl, prog, drawMatrix, this.capsuleGeo, pickMode, pickColor, GIZMO_COLORS.characterBody, 0.1, 0.7);
                }
        }

        // Render Area3D helper (wireframe box for trigger zones)
        private renderAreaHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean): void {
                if (!this.meshProgram || !this.cubeGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;

                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                // Professional wireframe box for trigger areas (Godot-style green)
                if (!pickMode && this.areaWireframeVAO) {
                        this.renderWireframeHelper(gl, worldMatrix, this.areaWireframeVAO, GIZMO_COLORS.area, 0.8);
                }
                
                // Solid mesh for picking
                if (pickMode) {
                        const areaScale = 1.0;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                        drawMatrix[0] *= areaScale; drawMatrix[1] *= areaScale; drawMatrix[2] *= areaScale;
                        drawMatrix[4] *= areaScale; drawMatrix[5] *= areaScale; drawMatrix[6] *= areaScale;
                        drawMatrix[8] *= areaScale; drawMatrix[9] *= areaScale; drawMatrix[10] *= areaScale;

                        this.renderHelperMesh(gl, prog, drawMatrix, this.cubeGeo, pickMode, pickColor, GIZMO_COLORS.area, 0.0, 0.8);
                }
        }

        // Render CollisionShape helper (wireframe box/sphere/capsule/cylinder)
        private renderCollisionShapeHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean, collisionShape: any): void {
                if (!this.flatProgram || !this.cubeGeo || !this.sphereGeo || !this.capsuleGeo || !this.cylinderGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;

                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;
                const shape = collisionShape.shape || { type: 'Box', size: 1 };
                const color: [number, number, number] = [0.30, 0.75, 0.45]; // Green for collision

                // Use wireframe gizmos based on shape type
                if (!pickMode) {
                        if (shape.type === 'Box' && this.wireframeCubeVAO) {
                                const size = shape.size || 1;
                                const scaleM = m4Create();
                                for (let k = 0; k < 16; k++) scaleM[k] = worldMatrix[k];
                                scaleM[0] *= size; scaleM[1] *= size; scaleM[2] *= size;
                                scaleM[4] *= size; scaleM[5] *= size; scaleM[6] *= size;
                                scaleM[8] *= size; scaleM[9] *= size; scaleM[10] *= size;
                                this.renderWireframeHelper(gl, scaleM, this.wireframeCubeVAO, color, 0.8);
                        } else if (shape.type === 'Sphere' && this.wireframeSphereVAO) {
                                const radius = (shape.radius || 0.5) * 2;
                                const scaleM = m4Create();
                                for (let k = 0; k < 16; k++) scaleM[k] = worldMatrix[k];
                                scaleM[0] *= radius; scaleM[1] *= radius; scaleM[2] *= radius;
                                scaleM[4] *= radius; scaleM[5] *= radius; scaleM[6] *= radius;
                                scaleM[8] *= radius; scaleM[9] *= radius; scaleM[10] *= radius;
                                this.renderWireframeHelper(gl, scaleM, this.wireframeSphereVAO, color, 0.8);
                        } else if ((shape.type === 'Capsule' || shape.type === 'Cylinder') && this.wireframeCylinderVAO) {
                                const radius = (shape.radius || 0.5) * 2;
                                const height = shape.height || 1;
                                const scaleM = m4Create();
                                for (let k = 0; k < 16; k++) scaleM[k] = worldMatrix[k];
                                scaleM[0] *= radius; scaleM[1] *= radius; scaleM[2] *= radius;
                                scaleM[4] *= height; scaleM[5] *= height; scaleM[6] *= height;
                                scaleM[8] *= radius; scaleM[9] *= radius; scaleM[10] *= radius;
                                this.renderWireframeHelper(gl, scaleM, this.wireframeCylinderVAO, color, 0.8);
                        } else if (this.wireframeCubeVAO) {
                                // Fallback to cube
                                const size = 1;
                                const scaleM = m4Create();
                                for (let k = 0; k < 16; k++) scaleM[k] = worldMatrix[k];
                                scaleM[0] *= size; scaleM[1] *= size; scaleM[2] *= size;
                                scaleM[4] *= size; scaleM[5] *= size; scaleM[6] *= size;
                                scaleM[8] *= size; scaleM[9] *= size; scaleM[10] *= size;
                                this.renderWireframeHelper(gl, scaleM, this.wireframeCubeVAO, color, 0.8);
                        }
                }

                // Solid mesh for picking
                if (pickMode) {
                        let geo: MeshBuffers | null = null;
                        let scale = 1;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];

                        if (shape.type === 'Box') {
                                geo = this.cubeGeo;
                                scale = shape.size || 1;
                        } else if (shape.type === 'Sphere') {
                                geo = this.sphereGeo;
                                scale = (shape.radius || 0.5) * 2;
                        } else if (shape.type === 'Capsule') {
                                geo = this.capsuleGeo;
                                scale = 1;
                                const r = (shape.radius || 0.5) * 2;
                                const h = shape.height || 1;
                                drawMatrix[0] *= r; drawMatrix[1] *= r; drawMatrix[2] *= r;
                                drawMatrix[4] *= h; drawMatrix[5] *= h; drawMatrix[6] *= h;
                                drawMatrix[8] *= r; drawMatrix[9] *= r; drawMatrix[10] *= r;
                        } else if (shape.type === 'Cylinder') {
                                geo = this.cylinderGeo;
                                const r = (shape.radius || 0.5) * 2;
                                const h = shape.height || 1;
                                drawMatrix[0] *= r; drawMatrix[1] *= r; drawMatrix[2] *= r;
                                drawMatrix[4] *= h; drawMatrix[5] *= h; drawMatrix[6] *= h;
                                drawMatrix[8] *= r; drawMatrix[9] *= r; drawMatrix[10] *= r;
                        } else {
                                geo = this.cubeGeo;
                        }

                        if (scale !== 1) {
                                drawMatrix[0] *= scale; drawMatrix[1] *= scale; drawMatrix[2] *= scale;
                                drawMatrix[4] *= scale; drawMatrix[5] *= scale; drawMatrix[6] *= scale;
                                drawMatrix[8] *= scale; drawMatrix[9] *= scale; drawMatrix[10] *= scale;
                        }

                        if (geo) {
                                this.renderHelperMesh(gl, prog, drawMatrix, geo, pickMode, pickColor, color, 0.1, 0.8);
                        }
                }
        }

        // Render RayCast3D helper (arrow showing ray direction)
        private renderRayCastHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean): void {
                if (!this.flatProgram || !this.cylinderGeo || !this.coneGeo || !this.sphereGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;

                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                // Simple ray visualization - just a line from origin pointing forward
                if (!pickMode) {
                        this.renderDirectionLine(gl, worldMatrix, GIZMO_COLORS.rayCast, 3.0);
                }
                
                // Solid mesh for picking
                if (pickMode) {
                        const originScale = 0.15;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                        drawMatrix[0] *= originScale; drawMatrix[1] *= originScale; drawMatrix[2] *= originScale;
                        drawMatrix[4] *= originScale; drawMatrix[5] *= originScale; drawMatrix[6] *= originScale;
                        drawMatrix[8] *= originScale; drawMatrix[9] *= originScale; drawMatrix[10] *= originScale;

                        this.renderHelperMesh(gl, prog, drawMatrix, this.sphereGeo, pickMode, pickColor, GIZMO_COLORS.rayCast, 0.2, 0.5);
                }
        }

        // NEW: Audio helper (speaker icon)
        private renderAudioHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean, type: string): void {
                if (!this.meshProgram || !this.cubeGeo || !this.coneGeo || !this.sphereGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;
                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                // Use wireframe speaker gizmo
                if (!pickMode && this.speakerVAO) {
                        this.renderWireframeHelper(gl, worldMatrix, this.speakerVAO, GIZMO_COLORS.audio, 0.9);
                }

                // Solid mesh for picking
                if (pickMode) {
                        const bodyScale = 0.25;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                        drawMatrix[0] *= bodyScale; drawMatrix[1] *= bodyScale; drawMatrix[2] *= bodyScale;
                        drawMatrix[4] *= bodyScale * 0.8; drawMatrix[5] *= bodyScale * 0.8; drawMatrix[6] *= bodyScale * 0.8;
                        drawMatrix[8] *= bodyScale; drawMatrix[9] *= bodyScale; drawMatrix[10] *= bodyScale;

                        this.renderHelperMesh(gl, prog, drawMatrix, this.cubeGeo, pickMode, pickColor, GIZMO_COLORS.audio, 0.2, 0.6);
                }

                // Range sphere for 3D audio (semi-transparent)
                if (type === '3D' && !pickMode) {
                        const rangeScale = 2.0;
                        const rangeM = m4Create();
                        for (let k = 0; k < 16; k++) rangeM[k] = worldMatrix[k];
                        rangeM[0] *= rangeScale; rangeM[1] *= rangeScale; rangeM[2] *= rangeScale;
                        rangeM[4] *= rangeScale; rangeM[5] *= rangeScale; rangeM[6] *= rangeScale;
                        rangeM[8] *= rangeScale; rangeM[9] *= rangeScale; rangeM[10] *= rangeScale;

                        gl.enable(gl.BLEND);
                        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                        this.renderHelperMesh(gl, prog, rangeM, this.sphereGeo, false, null, GIZMO_COLORS.audio, 0.0, 0.9);
                        gl.disable(gl.BLEND);
                }
        }

        // NEW: Animation helper (film reel / tree / curve)
        private renderAnimationHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean, type: string): void {
                if (!this.meshProgram || !this.torusGeo || !this.cubeGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;
                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                if (type === 'player') {
                        // Use wireframe film reel gizmo
                        if (!pickMode && this.filmReelVAO) {
                                this.renderWireframeHelper(gl, worldMatrix, this.filmReelVAO, GIZMO_COLORS.animation, 0.9);
                        }
                        // Solid mesh for picking
                        if (pickMode) {
                                const reelScale = 0.35;
                                const drawMatrix = m4Create();
                                const reelQ: [number, number, number, number] = [0.7071068, 0, 0, 0.7071068];
                                m4FromQuat(drawMatrix, reelQ);
                                m4Multiply(drawMatrix, worldMatrix, drawMatrix);
                                drawMatrix[0] *= reelScale; drawMatrix[1] *= reelScale; drawMatrix[2] *= reelScale;
                                drawMatrix[4] *= reelScale; drawMatrix[5] *= reelScale; drawMatrix[6] *= reelScale;
                                drawMatrix[8] *= reelScale; drawMatrix[9] *= reelScale; drawMatrix[10] *= reelScale;

                                this.renderHelperMesh(gl, prog, drawMatrix, this.torusGeo, pickMode, pickColor, GIZMO_COLORS.animation, 0.3, 0.5);
                        }
                } else if (type === 'tree') {
                        // Tree structure (multiple cubes)
                        const sizes = [[0, 0, 0, 0.3], [0.3, 0.2, 0, 0.2], [-0.3, 0.2, 0, 0.2], [0, 0.4, 0, 0.15]];
                        for (const [x, y, z, s] of sizes) {
                                const m = m4Create();
                                for (let k = 0; k < 16; k++) m[k] = worldMatrix[k];
                                m[12] += worldMatrix[0] * x + worldMatrix[4] * y + worldMatrix[8] * z;
                                m[13] += worldMatrix[1] * x + worldMatrix[5] * y + worldMatrix[9] * z;
                                m[14] += worldMatrix[2] * x + worldMatrix[6] * y + worldMatrix[10] * z;
                                m[0] *= s; m[1] *= s; m[2] *= s;
                                m[4] *= s; m[5] *= s; m[6] *= s;
                                m[8] *= s; m[9] *= s; m[10] *= s;
                                this.renderHelperMesh(gl, prog, m, this.cubeGeo, pickMode, pickColor, GIZMO_COLORS.animation, 0.3, 0.5);
                        }
                } else {
                        // Tween (small torus)
                        const tweenScale = 0.25;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                        drawMatrix[0] *= tweenScale; drawMatrix[1] *= tweenScale; drawMatrix[2] *= tweenScale;
                        drawMatrix[4] *= tweenScale; drawMatrix[5] *= tweenScale; drawMatrix[6] *= tweenScale;
                        drawMatrix[8] *= tweenScale; drawMatrix[9] *= tweenScale; drawMatrix[10] *= tweenScale;

                        this.renderHelperMesh(gl, prog, drawMatrix, this.torusGeo, pickMode, pickColor, GIZMO_COLORS.animation, 0.3, 0.5);
                }
        }

        // NEW: Navigation helper (region / agent / obstacle)
        private renderNavigationHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean, type: string): void {
                if (!this.meshProgram || !this.cubeGeo || !this.sphereGeo || !this.cylinderGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;
                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                if (type === 'region') {
                        // Use wireframe navigation region gizmo (grid)
                        if (!pickMode && this.navRegionVAO) {
                                this.renderWireframeHelper(gl, worldMatrix, this.navRegionVAO, GIZMO_COLORS.navRegion, 0.9);
                        }
                        // Solid mesh for picking
                        if (pickMode) {
                                const regionScale = 2.0;
                                const drawMatrix = m4Create();
                                for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                                drawMatrix[0] *= regionScale; drawMatrix[1] *= regionScale; drawMatrix[2] *= regionScale;
                                drawMatrix[4] *= 0.1; drawMatrix[5] *= 0.1; drawMatrix[6] *= 0.1;
                                drawMatrix[8] *= regionScale; drawMatrix[9] *= regionScale; drawMatrix[10] *= regionScale;

                                this.renderHelperMesh(gl, prog, drawMatrix, this.cubeGeo, pickMode, pickColor, GIZMO_COLORS.navRegion, 0.1, 0.8);
                        }
                } else if (type === 'agent') {
                        // Navigation agent (cyan sphere)
                        const agentScale = 0.3;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                        drawMatrix[0] *= agentScale; drawMatrix[1] *= agentScale; drawMatrix[2] *= agentScale;
                        drawMatrix[4] *= agentScale; drawMatrix[5] *= agentScale; drawMatrix[6] *= agentScale;
                        drawMatrix[8] *= agentScale; drawMatrix[9] *= agentScale; drawMatrix[10] *= agentScale;

                        this.renderHelperMesh(gl, prog, drawMatrix, this.sphereGeo, pickMode, pickColor, [0.35, 0.75, 0.85], 0.2, 0.6);
                } else {
                        // Navigation obstacle (red-orange cylinder)
                        const obstacleScale = 0.4;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                        drawMatrix[0] *= obstacleScale; drawMatrix[1] *= obstacleScale; drawMatrix[2] *= obstacleScale;
                        drawMatrix[4] *= obstacleScale * 1.5; drawMatrix[5] *= obstacleScale * 1.5; drawMatrix[6] *= obstacleScale * 1.5;
                        drawMatrix[8] *= obstacleScale; drawMatrix[9] *= obstacleScale; drawMatrix[10] *= obstacleScale;

                        if (!pickMode) {
                                gl.enable(gl.BLEND);
                                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                        }
                        this.renderHelperMesh(gl, prog, drawMatrix, this.cylinderGeo, pickMode, pickColor, [0.85, 0.45, 0.25], 0.3, 0.6);
                        if (!pickMode) gl.disable(gl.BLEND);
                }
        }

        // NEW: Utility helper (timer / marker / path)
        private renderUtilityHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean, type: string): void {
                if (!this.meshProgram || !this.torusGeo || !this.cubeGeo || !this.sphereGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;
                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                if (type === 'timer') {
                        // Use wireframe timer gizmo (clock face)
                        if (!pickMode && this.timerVAO) {
                                this.renderWireframeHelper(gl, worldMatrix, this.timerVAO, GIZMO_COLORS.timer, 0.9);
                        }
                        // Solid mesh for picking
                        if (pickMode) {
                                const clockScale = 0.3;
                                const drawMatrix = m4Create();
                                const clockQ: [number, number, number, number] = [0.7071068, 0, 0, 0.7071068];
                                m4FromQuat(drawMatrix, clockQ);
                                m4Multiply(drawMatrix, worldMatrix, drawMatrix);
                                drawMatrix[0] *= clockScale; drawMatrix[1] *= clockScale; drawMatrix[2] *= clockScale;
                                drawMatrix[4] *= clockScale; drawMatrix[5] *= clockScale; drawMatrix[6] *= clockScale;
                                drawMatrix[8] *= clockScale; drawMatrix[9] *= clockScale; drawMatrix[10] *= clockScale;

                                this.renderHelperMesh(gl, prog, drawMatrix, this.torusGeo, pickMode, pickColor, GIZMO_COLORS.timer, 0.4, 0.6);
                        }
                } else if (type === 'marker') {
                        // Use wireframe marker gizmo (cross axes)
                        if (!pickMode && this.markerVAO) {
                                this.renderWireframeHelper(gl, worldMatrix, this.markerVAO, GIZMO_COLORS.marker, 0.9);
                        }
                        // Solid mesh for picking
                        if (pickMode) {
                                const markerScale = 0.15;
                                const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
                                for (const [dx, dy, dz] of axes) {
                                        const m = m4Create();
                                        for (let k = 0; k < 16; k++) m[k] = worldMatrix[k];
                                        m[0] *= (dx ? 0.6 : markerScale); m[1] *= (dx ? 0.6 : markerScale); m[2] *= (dx ? 0.6 : markerScale);
                                        m[4] *= (dy ? 0.6 : markerScale); m[5] *= (dy ? 0.6 : markerScale); m[6] *= (dy ? 0.6 : markerScale);
                                        m[8] *= (dz ? 0.6 : markerScale); m[9] *= (dz ? 0.6 : markerScale); m[10] *= (dz ? 0.6 : markerScale);
                                        this.renderHelperMesh(gl, prog, m, this.cubeGeo, pickMode, pickColor, GIZMO_COLORS.marker, 0.3, 0.5);
                                }
                        }
                } else if (type === 'path') {
                        // Path (small spheres along curve - simplified as single sphere)
                        const pathScale = 0.2;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                        drawMatrix[0] *= pathScale; drawMatrix[1] *= pathScale; drawMatrix[2] *= pathScale;
                        drawMatrix[4] *= pathScale; drawMatrix[5] *= pathScale; drawMatrix[6] *= pathScale;
                        drawMatrix[8] *= pathScale; drawMatrix[9] *= pathScale; drawMatrix[10] *= pathScale;

                        this.renderHelperMesh(gl, prog, drawMatrix, this.sphereGeo, pickMode, pickColor, [0.35, 0.75, 0.85], 0.2, 0.6);
                } else {
                        // PathFollow (sphere on path)
                        const followScale = 0.25;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                        drawMatrix[0] *= followScale; drawMatrix[1] *= followScale; drawMatrix[2] *= followScale;
                        drawMatrix[4] *= followScale; drawMatrix[5] *= followScale; drawMatrix[6] *= followScale;
                        drawMatrix[8] *= followScale; drawMatrix[9] *= followScale; drawMatrix[10] *= followScale;

                        this.renderHelperMesh(gl, prog, drawMatrix, this.sphereGeo, pickMode, pickColor, [0.35, 0.75, 0.85], 0.3, 0.5);
                }
        }

        // NEW: Environment helper (world / fog / sky / probe)
        private renderEnvironmentHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean, type: string): void {
                if (!this.meshProgram || !this.sphereGeo || !this.cubeGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;
                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                if (type === 'world') {
                        // WorldEnvironment - Sky dome icon with sun rays
                        // Show as a hemisphere with gradient-like appearance (sky colors)
                        const skyTopColor: [number, number, number] = [0.35, 0.55, 0.85];    // Sky blue
                        const skyHorizonColor: [number, number, number] = [0.65, 0.78, 0.90]; // Light blue
                        
                        // Wireframe sphere (sky dome)
                        if (!pickMode && this.wireframeSphereVAO) {
                                const domeScale = 0.6;
                                const drawMatrix = m4Create();
                                for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                                drawMatrix[0] *= domeScale; drawMatrix[1] *= domeScale * 0.5; drawMatrix[2] *= domeScale;
                                drawMatrix[4] *= domeScale; drawMatrix[5] *= domeScale * 0.5; drawMatrix[6] *= domeScale;
                                drawMatrix[8] *= domeScale; drawMatrix[9] *= domeScale * 0.5; drawMatrix[10] *= domeScale;
                                
                                this.renderWireframeHelper(gl, drawMatrix, this.wireframeSphereVAO, skyTopColor, 0.9);
                        }
                        
                        // Sun indicator (small yellow sphere at top)
                        if (!pickMode) {
                                const sunScale = 0.12;
                                const sunMatrix = m4Create();
                                for (let k = 0; k < 16; k++) sunMatrix[k] = worldMatrix[k];
                                // Position sun at top-right of dome
                                sunMatrix[12] += worldMatrix[0] * 0.25 + worldMatrix[4] * 0.15;
                                sunMatrix[13] += worldMatrix[1] * 0.25 + worldMatrix[5] * 0.15 + 0.25;
                                sunMatrix[14] += worldMatrix[2] * 0.25 + worldMatrix[6] * 0.15;
                                sunMatrix[0] *= sunScale; sunMatrix[1] *= sunScale; sunMatrix[2] *= sunScale;
                                sunMatrix[4] *= sunScale; sunMatrix[5] *= sunScale; sunMatrix[6] *= sunScale;
                                sunMatrix[8] *= sunScale; sunMatrix[9] *= sunScale; sunMatrix[10] *= sunScale;
                                
                                const sunColor: [number, number, number] = [1.0, 0.85, 0.35];
                                this.renderHelperMesh(gl, prog, sunMatrix, this.sphereGeo, false, null, sunColor, 0.0, 0.3);
                        }
                        
                        // Picking sphere
                        if (pickMode) {
                                const pickScale = 0.5;
                                const drawMatrix = m4Create();
                                for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                                drawMatrix[0] *= pickScale; drawMatrix[1] *= pickScale; drawMatrix[2] *= pickScale;
                                drawMatrix[4] *= pickScale; drawMatrix[5] *= pickScale; drawMatrix[6] *= pickScale;
                                drawMatrix[8] *= pickScale; drawMatrix[9] *= pickScale; drawMatrix[10] *= pickScale;
                                this.renderHelperMesh(gl, prog, drawMatrix, this.sphereGeo, pickMode, pickColor, skyTopColor, 0.2, 0.6);
                        }
                } else if (type === 'fog') {
                        // Fog volume (semi-transparent white box)
                        const fogScale = 1.5;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                        drawMatrix[0] *= fogScale; drawMatrix[1] *= fogScale; drawMatrix[2] *= fogScale;
                        drawMatrix[4] *= fogScale; drawMatrix[5] *= fogScale; drawMatrix[6] *= fogScale;
                        drawMatrix[8] *= fogScale; drawMatrix[9] *= fogScale; drawMatrix[10] *= fogScale;

                        if (!pickMode) {
                                gl.enable(gl.BLEND);
                                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                        }
                        this.renderHelperMesh(gl, prog, drawMatrix, this.cubeGeo, pickMode, pickColor, GIZMO_COLORS.fog, 0.0, 0.9);
                        if (!pickMode) gl.disable(gl.BLEND);
                } else if (type === 'sky') {
                        // Sky dome (hemisphere - using sphere)
                        const skyScale = 0.6;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                        drawMatrix[0] *= skyScale; drawMatrix[1] *= skyScale; drawMatrix[2] *= skyScale;
                        drawMatrix[4] *= skyScale * 0.5; drawMatrix[5] *= skyScale * 0.5; drawMatrix[6] *= skyScale * 0.5;
                        drawMatrix[8] *= skyScale; drawMatrix[9] *= skyScale; drawMatrix[10] *= skyScale;

                        this.renderHelperMesh(gl, prog, drawMatrix, this.sphereGeo, pickMode, pickColor, GIZMO_COLORS.sky, 0.1, 0.7);
                } else {
                        // Reflection probe (wireframe sphere)
                        const probeScale = 0.8;
                        const drawMatrix = m4Create();
                        for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];
                        drawMatrix[0] *= probeScale; drawMatrix[1] *= probeScale; drawMatrix[2] *= probeScale;
                        drawMatrix[4] *= probeScale; drawMatrix[5] *= probeScale; drawMatrix[6] *= probeScale;
                        drawMatrix[8] *= probeScale; drawMatrix[9] *= probeScale; drawMatrix[10] *= probeScale;

                        if (!pickMode) {
                                gl.enable(gl.BLEND);
                                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                        }
                        this.renderHelperMesh(gl, prog, drawMatrix, this.sphereGeo, pickMode, pickColor, [0.85, 0.75, 0.55], 0.3, 0.6);
                        if (!pickMode) gl.disable(gl.BLEND);
                }
        }

        // NEW: Particles helper (cone with dots)
        private renderParticlesHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean, type: string): void {
                if (!this.meshProgram || !this.coneGeo || !this.sphereGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;
                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                // Use wireframe particle emitter gizmo
                if (!pickMode && this.particleEmitterVAO) {
                        this.renderWireframeHelper(gl, worldMatrix, this.particleEmitterVAO, GIZMO_COLORS.particles, 0.9);
                }

                // Solid mesh for picking
                if (pickMode) {
                        const coneScale = 0.4;
                        const drawMatrix = m4Create();
                        const coneQ: [number, number, number, number] = [0.7071068, 0, 0, 0.7071068];
                        m4FromQuat(drawMatrix, coneQ);
                        m4Multiply(drawMatrix, worldMatrix, drawMatrix);
                        drawMatrix[0] *= coneScale; drawMatrix[1] *= coneScale; drawMatrix[2] *= coneScale;
                        drawMatrix[4] *= coneScale * 1.2; drawMatrix[5] *= coneScale * 1.2; drawMatrix[6] *= coneScale * 1.2;
                        drawMatrix[8] *= coneScale; drawMatrix[9] *= coneScale; drawMatrix[10] *= coneScale;

                        this.renderHelperMesh(gl, prog, drawMatrix, this.coneGeo, pickMode, pickColor, GIZMO_COLORS.particles, 0.2, 0.5);
                }

                // Particle dots (small spheres) - always visible
                if (!pickMode) {
                        const dotScale = 0.05;
                        const positions = [[0.2, 0.3, 0], [-0.15, 0.4, 0.1], [0.1, 0.5, -0.1], [-0.1, 0.6, 0]];
                        for (const [x, y, z] of positions) {
                                const m = m4Create();
                                for (let k = 0; k < 16; k++) m[k] = worldMatrix[k];
                                m[12] += worldMatrix[0] * x + worldMatrix[4] * y + worldMatrix[8] * z;
                                m[13] += worldMatrix[1] * x + worldMatrix[5] * y + worldMatrix[9] * z;
                                m[14] += worldMatrix[2] * x + worldMatrix[6] * y + worldMatrix[10] * z;
                                m[0] *= dotScale; m[1] *= dotScale; m[2] *= dotScale;
                                m[4] *= dotScale; m[5] *= dotScale; m[6] *= dotScale;
                                m[8] *= dotScale; m[9] *= dotScale; m[10] *= dotScale;
                                this.renderHelperMesh(gl, prog, m, this.sphereGeo, false, null, [0.95, 0.65, 0.35], 0.0, 0.3);
                        }
                }
        }

        // NEW: Sprite helper (billboard rectangle)
        private renderSpriteHelper(gl: WebGL2RenderingContext, worldMatrix: Mat4, entityIndex: number, pickMode: boolean, type: string): void {
                if (!this.meshProgram || !this.quadGeo || !this.cubeGeo) return;

                const prog = pickMode ? this.flatProgram : this.meshProgram;
                if (!prog) return;
                const pickColor = pickMode ? entityIdToColor(entityIndex) : null;

                // Billboard quad (always faces camera)
                const spriteScale = 0.5;
                const drawMatrix = m4Create();
                
                // Billboard rotation (face camera)
                const camDir = v3(0, 0, 0);
                v3Sub(camDir, this.camera.position, v3(worldMatrix[12], worldMatrix[13], worldMatrix[14]));
                v3Normalize(camDir, camDir);
                
                // Simple billboard: use identity rotation + position
                m4Identity(drawMatrix);
                drawMatrix[12] = worldMatrix[12];
                drawMatrix[13] = worldMatrix[13];
                drawMatrix[14] = worldMatrix[14];
                drawMatrix[0] *= spriteScale; drawMatrix[1] *= spriteScale; drawMatrix[2] *= spriteScale;
                drawMatrix[4] *= spriteScale; drawMatrix[5] *= spriteScale; drawMatrix[6] *= spriteScale;
                drawMatrix[8] *= spriteScale; drawMatrix[9] *= spriteScale; drawMatrix[10] *= spriteScale;

                const color = type === 'label' ? [0.85, 0.85, 0.95] : type === 'animated' ? [0.85, 0.75, 0.55] : [0.85, 0.85, 0.85];
                
                if (!pickMode) {
                        gl.enable(gl.BLEND);
                        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                }
                this.renderHelperMesh(gl, prog, drawMatrix, this.quadGeo, pickMode, pickColor, color as [number, number, number], 0.1, 0.8);
                if (!pickMode) gl.disable(gl.BLEND);
        }

        private renderSelectionOutline(gl: WebGL2RenderingContext): void {
                if (this.selectedEntityIndex < 0 || !this.outlineProgram || !this.meshProgram) return;

                const items = this.getRenderList();
                if (this.selectedEntityIndex >= items.length) return;

                const { entity, worldMatrix } = items[this.selectedEntityIndex];
                const me = entity.components.find((c: Component) => c.type === 'Mesh');
                const shape = me ? me.shape : { type: 'Cube', size: 1 };

                // Build draw matrix with shape scale
                const drawMatrix = m4Create();
                for (let k = 0; k < 16; k++) drawMatrix[k] = worldMatrix[k];

                let shapeScale = [1, 1, 1];
                if (shape.type === 'Cube') { const s = (shape as any).size || 1; shapeScale = [s, s, s]; }
                else if (shape.type === 'Sphere') { const s = ((shape as any).radius || 0.5) * 2; shapeScale = [s, s, s]; }
                else if (shape.type === 'Plane') { const s = (shape as any).size || 10; shapeScale = [s, 1, s]; }
                else if (shape.type === 'Cylinder') { const r = ((shape as any).radius || 0.5) * 2; const h = (shape as any).height || 1; shapeScale = [r, h, r]; }
                else if (shape.type === 'Cone') { const r = ((shape as any).radius || 0.5) * 2; const h = (shape as any).height || 1; shapeScale = [r, h, r]; }
                else if (shape.type === 'Torus') { const r = ((shape as any).radius || 0.5) * 2; shapeScale = [r, r, r]; }
                else if (shape.type === 'Capsule') { const r = ((shape as any).radius || 0.5) * 2; const h = (shape as any).height || 1; shapeScale = [r, h, r]; }

                drawMatrix[0] *= shapeScale[0]; drawMatrix[1] *= shapeScale[0]; drawMatrix[2] *= shapeScale[0];
                drawMatrix[4] *= shapeScale[1]; drawMatrix[5] *= shapeScale[1]; drawMatrix[6] *= shapeScale[1];
                drawMatrix[8] *= shapeScale[2]; drawMatrix[9] *= shapeScale[2]; drawMatrix[10] *= shapeScale[2];

                let geo = this.cubeGeo;
                if (shape.type === 'Sphere') geo = this.sphereGeo!;
                else if (shape.type === 'Plane') geo = this.planeGeo!;
                else if (shape.type === 'Cylinder') geo = this.cylinderGeo!;
                else if (shape.type === 'Cone') geo = this.coneGeo!;
                else if (shape.type === 'Torus') geo = this.torusGeo!;
                else if (shape.type === 'Capsule') geo = this.capsuleGeo!;
                if (!geo) return;

                // === STEP 1: Enable stencil, render object to stencil buffer ===
                gl.enable(gl.STENCIL_TEST);
                gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
                gl.stencilMask(0xFF);
                gl.colorMask(false, false, false, false);
                gl.depthMask(false);

                // Render object silhouette to stencil using mesh shader
                gl.useProgram(this.meshProgram);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.meshProgram, 'uModel'), false, drawMatrix);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.meshProgram, 'uView'), false, this.camera.viewMatrix);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.meshProgram, 'uProj'), false, this.camera.projMatrix);
                const normMat = m4Create();
                m4TransposeUpper3x3(normMat, drawMatrix);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.meshProgram, 'uNormalMatrix'), false, normMat);
                gl.uniform3f(gl.getUniformLocation(this.meshProgram, 'uColor'), 1, 1, 1);
                gl.uniform1f(gl.getUniformLocation(this.meshProgram, 'uMetallic'), 0);
                gl.uniform1f(gl.getUniformLocation(this.meshProgram, 'uRoughness'), 1);
                gl.uniform3fv(gl.getUniformLocation(this.meshProgram, 'uCameraPos'), this.camera.position);
                const ld = v3(0.4, 0.8, 0.3); v3Normalize(ld, ld);
                gl.uniform3fv(gl.getUniformLocation(this.meshProgram, 'uLightDir'), ld);
                gl.uniform3f(gl.getUniformLocation(this.meshProgram, 'uLightColor'), 1, 1, 1);
                gl.uniform3f(gl.getUniformLocation(this.meshProgram, 'uAmbientColor'), 0.2, 0.2, 0.2);

                gl.bindVertexArray(geo.vao);
                gl.drawElements(gl.TRIANGLES, geo.indexCount, gl.UNSIGNED_SHORT, 0);

                // === STEP 2: Render outline — enlarged mesh, only where stencil != 1 ===
                gl.stencilFunc(gl.NOTEQUAL, 1, 0xFF);
                gl.stencilMask(0x00);
                gl.colorMask(true, true, true, true);
                gl.depthMask(false);
                gl.disable(gl.DEPTH_TEST);

                gl.useProgram(this.outlineProgram);

                // Calculate distance from camera to object center
                const center = v3(drawMatrix[12], drawMatrix[13], drawMatrix[14]);
                const dist = v3Dist(this.camera.position, center);

                // Thin crisp outline — scales gently with distance
                const outlineWidth = Math.max(0.005, Math.min(0.035, dist * 0.0018));

                gl.uniformMatrix4fv(gl.getUniformLocation(this.outlineProgram, 'uModel'), false, drawMatrix);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.outlineProgram, 'uView'), false, this.camera.viewMatrix);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.outlineProgram, 'uProj'), false, this.camera.projMatrix);
                gl.uniform1f(gl.getUniformLocation(this.outlineProgram, 'uOutlineWidth'), outlineWidth);
                // Godot orange, slightly softer
                gl.uniform3f(gl.getUniformLocation(this.outlineProgram, 'uOutlineColor'), 0.93, 0.57, 0.13);

                gl.drawElements(gl.TRIANGLES, geo.indexCount, gl.UNSIGNED_SHORT, 0);
                gl.bindVertexArray(null);

                // === CLEANUP: Reset stencil state ===
                gl.stencilMask(0xFF);
                gl.disable(gl.STENCIL_TEST);
                gl.depthMask(true);
                gl.enable(gl.DEPTH_TEST);
        }

        // ========================================================================
        // ИКОНКИ И ГИЗМО
        // ========================================================================

        // renderIcons removed - using renderSceneIcons2D instead

        // ========================================================================
        // GIZMO (W/E/R) — render + pick + drag
        // ========================================================================

        private renderGizmo(gl: WebGL2RenderingContext, center: Vec3, pickMode: boolean): void {
                if (!this.flatProgram) return;

                const dist = v3Dist(this.camera.position, center);
                const S = Math.max(0.4, dist * 0.14);

                // === GIZMO ALWAYS ON TOP ===
                gl.clear(gl.DEPTH_BUFFER_BIT);
                gl.disable(gl.DEPTH_TEST);

                // Draw all gizmos with different sizes to avoid overlap (Godot-style)
                // Translate arrows - largest, more prominent
                this.gizmoTranslate(gl, center, S * 1.15, pickMode);
                
                // Rotate circles - larger sphere, thinner lines
                this.gizmoRotate(gl, center, S * 1.25, pickMode);
                
                // Scale handles - smaller but visible
                this.gizmoScale(gl, center, S * 0.75, pickMode);

                gl.enable(gl.DEPTH_TEST);
        }

        // ---- IDs for handles (must be > 0)
        private handleId(handle: NonNullable<ThreeViewport['draggingHandle']>): number {
                switch (handle) {
                        case 'tx': return 10; case 'ty': return 11; case 'tz': return 12;
                        case 'txy': return 13; case 'txz': return 14; case 'tyz': return 15;
                        case 'rx': return 20; case 'ry': return 21; case 'rz': return 22;
                        case 'sx': return 30; case 'sy': return 31; case 'sz': return 32;
                        case 'sxyz': return 33;
                }
        }

        private idToHandle(id: number): ThreeViewport['draggingHandle'] {
                if (id === 10) return 'tx'; if (id === 11) return 'ty'; if (id === 12) return 'tz';
                if (id === 13) return 'txy'; if (id === 14) return 'txz'; if (id === 15) return 'tyz';
                if (id === 20) return 'rx'; if (id === 21) return 'ry'; if (id === 22) return 'rz';
                if (id === 30) return 'sx'; if (id === 31) return 'sy'; if (id === 32) return 'sz';
                if (id === 33) return 'sxyz';
                return null;
        }

        private gizmoTranslate(gl: WebGL2RenderingContext, c: Vec3, S: number, pick: boolean): void {
                if (!this.flatProgram || !this.cylinderGeo || !this.coneGeo || !this.quadGeo) return;

                // Godot-style: bigger arrows
                const shaftR = S * 0.018;  // Thicker shaft
                const shaftL = S * 1.05;   // Longer shaft
                const headR = S * 0.07;    // Bigger cone base
                const headH = S * 0.22;    // Taller cone
                const planeOff = S * 0.28;
                const planeS = S * 0.22;

                gl.useProgram(this.flatProgram);

                // --- ARROWS ---
                const drawArrow = (ax: 'x' | 'y' | 'z', col: number[], h: 'tx' | 'ty' | 'tz') => {
                        let q = [0, 0, 0, 1], dir = v3(0, 1, 0);
                        if (ax === 'x') { q = [0, 0, -0.7071068, 0.7071068]; dir = v3(1, 0, 0); }
                        else if (ax === 'z') { q = [0.7071068, 0, 0, 0.7071068]; dir = v3(0, 0, 1); }

                        const fc = (!pick && this.draggingHandle === h) ? [1, 1, 0.15, 1] : [...col, 1];
                        const m = m4Create(), mvp = m4Create();

                        // Shaft
                        m4FromTRS(m, [c[0], c[1], c[2]], q, [shaftR / 0.5, shaftL, shaftR / 0.5]);
                        m4Multiply(mvp, this.camera.vpMatrix, m);
                        gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram!, 'uMVP'), false, mvp);
                        if (pick) { const pc = entityIdToColor(this.handleId(h)); gl.uniform4f(gl.getUniformLocation(this.flatProgram!, 'uFlatColor'), pc[0], pc[1], pc[2], pc[3]); }
                        else gl.uniform4f(gl.getUniformLocation(this.flatProgram!, 'uFlatColor'), fc[0], fc[1], fc[2], fc[3]);
                        gl.bindVertexArray(this.cylinderGeo!.vao);
                        gl.drawElements(gl.TRIANGLES, this.cylinderGeo!.indexCount, gl.UNSIGNED_SHORT, 0);

                        // Cone
                        const tip = v3(c[0] + dir[0] * shaftL, c[1] + dir[1] * shaftL, c[2] + dir[2] * shaftL);
                        m4FromTRS(m, [tip[0], tip[1], tip[2]], q, [headR / 0.5, headH, headR / 0.5]);
                        m4Multiply(mvp, this.camera.vpMatrix, m);
                        gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram!, 'uMVP'), false, mvp);
                        gl.bindVertexArray(this.coneGeo!.vao);
                        gl.drawElements(gl.TRIANGLES, this.coneGeo!.indexCount, gl.UNSIGNED_SHORT, 0);
                };

                // Dark colors like reference: #990000, #009900, #000099
                drawArrow('x', [0.6, 0.0, 0.0], 'tx');
                drawArrow('y', [0.0, 0.6, 0.0], 'ty');
                drawArrow('z', [0.0, 0.0, 0.6], 'tz');

                // --- PLANE HANDLES (semi-transparent quads) ---
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                const drawPlane = (h: 'txy' | 'txz' | 'tyz', ox: number, oy: number, oz: number, col: number[], rotQ: number[]) => {
                        const fc = (!pick && this.draggingHandle === h) ? [1, 1, 0.15, 0.5] : [...col, 0.25];
                        const pos = v3(c[0] + ox * planeOff, c[1] + oy * planeOff, c[2] + oz * planeOff);
                        const m = m4Create(), mvp = m4Create();
                        m4FromTRS(m, [pos[0], pos[1], pos[2]], rotQ, [planeS, 1, planeS]);
                        m4Multiply(mvp, this.camera.vpMatrix, m);
                        gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram!, 'uMVP'), false, mvp);
                        if (pick) { const pc = entityIdToColor(this.handleId(h)); gl.uniform4f(gl.getUniformLocation(this.flatProgram!, 'uFlatColor'), pc[0], pc[1], pc[2], pc[3]); }
                        else gl.uniform4f(gl.getUniformLocation(this.flatProgram!, 'uFlatColor'), fc[0], fc[1], fc[2], fc[3]);
                        gl.bindVertexArray(this.quadGeo!.vao);
                        gl.drawElements(gl.TRIANGLES, this.quadGeo!.indexCount, gl.UNSIGNED_SHORT, 0);
                };

                // XZ (green), XY (blue), YZ (red)
                drawPlane('txz', 1, 0, 1, [0.0, 0.6, 0.0], [0, 0, 0, 1]);
                drawPlane('txy', 1, 1, 0, [0.0, 0.0, 0.6], [0.7071068, 0, 0, 0.7071068]);
                drawPlane('tyz', 0, 1, 1, [0.6, 0.0, 0.0], [0, 0, -0.7071068, 0.7071068]);

                gl.disable(gl.BLEND);
                gl.bindVertexArray(null);
        }

        private gizmoScale(gl: WebGL2RenderingContext, c: Vec3, S: number, pick: boolean): void {
                if (!this.flatProgram || !this.cylinderGeo || !this.cubeGeo) return;

                // Godot-style: bigger cubes
                const shaftR = S * 0.018;  // Thicker shaft
                const shaftL = S * 0.88;   // Slightly longer
                const boxS = S * 0.11;     // Bigger cubes
                const centerS = S * 0.07;  // Bigger center cube

                gl.useProgram(this.flatProgram);

                const drawAxis = (ax: 'x' | 'y' | 'z', col: number[], h: 'sx' | 'sy' | 'sz') => {
                        let q = [0, 0, 0, 1], dir = v3(0, 1, 0);
                        if (ax === 'x') { q = [0, 0, -0.7071068, 0.7071068]; dir = v3(1, 0, 0); }
                        else if (ax === 'z') { q = [0.7071068, 0, 0, 0.7071068]; dir = v3(0, 0, 1); }

                        const fc = (!pick && this.draggingHandle === h) ? [1, 1, 0.15, 1] : [...col, 1];
                        const m = m4Create(), mvp = m4Create();

                        // Shaft
                        m4FromTRS(m, [c[0], c[1], c[2]], q, [shaftR / 0.5, shaftL, shaftR / 0.5]);
                        m4Multiply(mvp, this.camera.vpMatrix, m);
                        gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram!, 'uMVP'), false, mvp);
                        if (pick) { const pc = entityIdToColor(this.handleId(h)); gl.uniform4f(gl.getUniformLocation(this.flatProgram!, 'uFlatColor'), pc[0], pc[1], pc[2], pc[3]); }
                        else gl.uniform4f(gl.getUniformLocation(this.flatProgram!, 'uFlatColor'), fc[0], fc[1], fc[2], fc[3]);
                        gl.bindVertexArray(this.cylinderGeo!.vao);
                        gl.drawElements(gl.TRIANGLES, this.cylinderGeo!.indexCount, gl.UNSIGNED_SHORT, 0);

                        // Cube at tip
                        const tip = v3(c[0] + dir[0] * shaftL, c[1] + dir[1] * shaftL, c[2] + dir[2] * shaftL);
                        m4FromTRS(m, [tip[0], tip[1], tip[2]], [0, 0, 0, 1], [boxS, boxS, boxS]);
                        m4Multiply(mvp, this.camera.vpMatrix, m);
                        gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram!, 'uMVP'), false, mvp);
                        gl.bindVertexArray(this.cubeGeo!.vao);
                        gl.drawElements(gl.TRIANGLES, this.cubeGeo!.indexCount, gl.UNSIGNED_SHORT, 0);
                };

                drawAxis('x', [0.6, 0.0, 0.0], 'sx');
                drawAxis('y', [0.0, 0.6, 0.0], 'sy');
                drawAxis('z', [0.0, 0.0, 0.6], 'sz');

                // Center cube (uniform scale)
                const m = m4Create(), mvp = m4Create();
                m4FromTRS(m, [c[0], c[1], c[2]], [0, 0, 0, 1], [centerS, centerS, centerS]);
                m4Multiply(mvp, this.camera.vpMatrix, m);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram, 'uMVP'), false, mvp);
                const uc = (!pick && this.draggingHandle === 'sxyz') ? [1, 1, 0.15, 1] : [0.7, 0.7, 0.7, 1];
                if (pick) { const pc = entityIdToColor(this.handleId('sxyz')); gl.uniform4f(gl.getUniformLocation(this.flatProgram, 'uFlatColor'), pc[0], pc[1], pc[2], pc[3]); }
                else gl.uniform4f(gl.getUniformLocation(this.flatProgram, 'uFlatColor'), uc[0], uc[1], uc[2], uc[3]);
                gl.bindVertexArray(this.cubeGeo!.vao);
                gl.drawElements(gl.TRIANGLES, this.cubeGeo!.indexCount, gl.UNSIGNED_SHORT, 0);

                gl.bindVertexArray(null);
        }

        private gizmoRotate(gl: WebGL2RenderingContext, c: Vec3, S: number, pick: boolean): void {
                if (!this.flatProgram || !this.gizmoTorusGeo) return;

                const ringR = S * 1.1;

                gl.useProgram(this.flatProgram);

                const drawRing = (ax: 'x' | 'y' | 'z', col: number[], h: 'rx' | 'ry' | 'rz') => {
                        const isHover = (this.draggingHandle === h);
                        const color = pick 
                                ? entityIdToColor(this.handleId(h))
                                : (isHover ? [1, 1, 0, 1] : [...col, 1]);

                        // Torus is in XZ plane by default (lying flat)
                        let q: [number, number, number, number] = [0, 0, 0, 1];
                        
                        if (ax === 'y') {
                                // Ring around Y axis. Torus is in XZ. Perfect.
                                q = [0, 0, 0, 1];
                        } else if (ax === 'x') {
                                // Ring around X axis. Rotate Z 90.
                                q = [0, 0, 0.7071068, 0.7071068];
                        } else if (ax === 'z') {
                                // Ring around Z axis. Rotate X 90.
                                q = [0.7071068, 0, 0, 0.7071068];
                        }

                        const m = m4Create(), mvp = m4Create();
                        m4FromTRS(m, [c[0], c[1], c[2]], q, [ringR, ringR, ringR]);
                        m4Multiply(mvp, this.camera.vpMatrix, m);
                        gl.uniformMatrix4fv(gl.getUniformLocation(this.flatProgram!, 'uMVP'), false, mvp);
                        gl.uniform4f(gl.getUniformLocation(this.flatProgram!, 'uFlatColor'), color[0], color[1], color[2], color[3]);
                        
                        gl.bindVertexArray(this.gizmoTorusGeo!.vao);
                        gl.drawElements(gl.TRIANGLES, this.gizmoTorusGeo!.indexCount, gl.UNSIGNED_SHORT, 0);
                };

                drawRing('x', [0.85, 0.2, 0.2], 'rx');
                drawRing('y', [0.2, 0.85, 0.2], 'ry');
                drawRing('z', [0.2, 0.2, 0.85], 'rz');

                gl.bindVertexArray(null);
        }

        private performGizmoPick(gl: WebGL2RenderingContext, x: number, y: number): ThreeViewport['draggingHandle'] {
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

                this.renderGizmo(gl, center, true);

                const pixel = new Uint8Array(4);
                gl.readPixels(Math.floor(x), Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
                const id = colorToEntityId(pixel);

                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
                gl.clearColor(0, 0, 0, 1);

                return this.idToHandle(id);
        }

        private startGizmoDrag(handle: NonNullable<ThreeViewport['draggingHandle']>, x: number, y: number): void {
                if (!this.scene || !this.selectedEntityId || !this.gl) return;

                const items = this.getRenderList();
                const it = items.find(i => i.entity.id === this.selectedEntityId);
                if (!it) return;

                const tr = it.entity.components.find(c => c.type === 'Transform') as any;
                if (!tr) return;

                this.draggingHandle = handle;

                this.dragStartTranslation = v3(tr.translation[0], tr.translation[1], tr.translation[2]);
                this.dragStartScale = v3(tr.scale[0], tr.scale[1], tr.scale[2]);
                this.dragStartRotation = [tr.rotation[0], tr.rotation[1], tr.rotation[2], tr.rotation[3]];
                this.dragStartAngle = 0;

                const center = v3(it.worldMatrix[12], it.worldMatrix[13], it.worldMatrix[14]);

                if (handle === 'tx' || handle === 'ty' || handle === 'tz' || handle === 'sx' || handle === 'sy' || handle === 'sz') {
                        const axisDir = (handle === 'tx' || handle === 'sx') ? v3(1, 0, 0)
                                : (handle === 'ty' || handle === 'sy') ? v3(0, 1, 0)
                                        : v3(0, 0, 1);

                        const viewDir = v3(0, 0, 0);
                        v3Sub(viewDir, this.camera.position, center);
                        v3Normalize(viewDir, viewDir);

                        const tmp = v3(0, 0, 0);
                        v3Cross(tmp, viewDir, axisDir);
                        const planeN = v3(0, 0, 0);
                        v3Cross(planeN, axisDir, tmp);
                        v3Normalize(planeN, planeN);

                        const ray = getRayFromScreen(this.camera, this.gl, x, y);
                        intersectRayPlane(ray.origin, ray.dir, center, planeN, this.dragStartHit);
                        return;
                }

                // Plane handles
                if (handle === 'txy' || handle === 'txz' || handle === 'tyz') {
                        let planeN = v3(0, 1, 0); // normal of the plane
                        if (handle === 'txy') planeN = v3(0, 0, 1);  // XY plane → normal Z
                        else if (handle === 'txz') planeN = v3(0, 1, 0); // XZ plane → normal Y
                        else if (handle === 'tyz') planeN = v3(1, 0, 0);  // YZ plane → normal X

                        const ray = getRayFromScreen(this.camera, this.gl, x, y);
                        intersectRayPlane(ray.origin, ray.dir, center, planeN, this.dragStartHit);
                        return;
                }

                if (handle === 'rx' || handle === 'ry' || handle === 'rz') {
                        const axisDir = (handle === 'rx') ? v3(1, 0, 0) : (handle === 'ry') ? v3(0, 1, 0) : v3(0, 0, 1);
                        const ray = getRayFromScreen(this.camera, this.gl, x, y);
                        const hit = v3(0, 0, 0);
                        if (!intersectRayPlane(ray.origin, ray.dir, center, axisDir, hit)) return;

                        const u = v3(0, 0, 0);
                        const v = v3(0, 0, 0);

                        const a = axisDir;
                        const ref = Math.abs(a[1]) > 0.9 ? v3(1, 0, 0) : v3(0, 1, 0);
                        v3Cross(u, a, ref); v3Normalize(u, u);
                        v3Cross(v, a, u);

                        const d = v3(0, 0, 0);
                        v3Sub(d, hit, center); v3Normalize(d, d);

                        this.dragStartAngle = Math.atan2(v3Dot(d, v), v3Dot(d, u));
                        v3Copy(this.dragStartHit, hit);
                        return;
                }

                if (handle === 'sxyz') {
                        this.dragStartHit[0] = x;
                        this.dragStartHit[1] = y;
                        this.dragStartHit[2] = 0;
                }
        }

        private updateGizmoDrag(x: number, y: number): void {
                if (!this.draggingHandle || !this.selectedEntityId || !this.gl || !this.scene) return;

                const items = this.getRenderList();
                const it = items.find(i => i.entity.id === this.selectedEntityId);
                if (!it) return;

                const tr = it.entity.components.find(c => c.type === 'Transform') as any;
                if (!tr) return;

                const center = v3(it.worldMatrix[12], it.worldMatrix[13], it.worldMatrix[14]);

                if (this.draggingHandle === 'tx' || this.draggingHandle === 'ty' || this.draggingHandle === 'tz'
                        || this.draggingHandle === 'sx' || this.draggingHandle === 'sy' || this.draggingHandle === 'sz') {

                        const axisDir = (this.draggingHandle === 'tx' || this.draggingHandle === 'sx') ? v3(1, 0, 0)
                                : (this.draggingHandle === 'ty' || this.draggingHandle === 'sy') ? v3(0, 1, 0)
                                        : v3(0, 0, 1);

                        const viewDir = v3(0, 0, 0);
                        v3Sub(viewDir, this.camera.position, center);
                        v3Normalize(viewDir, viewDir);

                        const tmp = v3(0, 0, 0);
                        v3Cross(tmp, viewDir, axisDir);
                        const planeN = v3(0, 0, 0);
                        v3Cross(planeN, axisDir, tmp);
                        v3Normalize(planeN, planeN);

                        const ray = getRayFromScreen(this.camera, this.gl, x, y);
                        const hit = v3(0, 0, 0);
                        if (!intersectRayPlane(ray.origin, ray.dir, center, planeN, hit)) return;

                        const delta = v3(0, 0, 0);
                        v3Sub(delta, hit, this.dragStartHit);
                        const amount = v3Dot(delta, axisDir);

                        if (this.draggingHandle === 'tx' || this.draggingHandle === 'ty' || this.draggingHandle === 'tz') {
                                const newT: [number, number, number] = [
                                        this.dragStartTranslation[0] + axisDir[0] * amount,
                                        this.dragStartTranslation[1] + axisDir[1] * amount,
                                        this.dragStartTranslation[2] + axisDir[2] * amount,
                                ];
                                tr.translation = newT;
                                this._onTransformEdited.fire({ entityId: this.selectedEntityId, translation: newT });
                                this._onTransformEditedTRS.fire({ entityId: this.selectedEntityId, translation: newT, rotation: tr.rotation, scale: tr.scale });
                                return;
                        }

                        const k = 1 + amount * 0.6;
                        const ns: [number, number, number] = [
                                this.dragStartScale[0],
                                this.dragStartScale[1],
                                this.dragStartScale[2],
                        ];
                        if (this.draggingHandle === 'sx') ns[0] = Math.max(0.01, this.dragStartScale[0] * k);
                        if (this.draggingHandle === 'sy') ns[1] = Math.max(0.01, this.dragStartScale[1] * k);
                        if (this.draggingHandle === 'sz') ns[2] = Math.max(0.01, this.dragStartScale[2] * k);

                        tr.scale = ns;
                        this._onTransformEditedTRS.fire({ entityId: this.selectedEntityId, translation: tr.translation, rotation: tr.rotation, scale: ns });
                        return;
                }

                // Plane drag
                if (this.draggingHandle === 'txy' || this.draggingHandle === 'txz' || this.draggingHandle === 'tyz') {
                        let planeN = v3(0, 1, 0);
                        if (this.draggingHandle === 'txy') planeN = v3(0, 0, 1);
                        else if (this.draggingHandle === 'txz') planeN = v3(0, 1, 0);
                        else if (this.draggingHandle === 'tyz') planeN = v3(1, 0, 0);

                        const ray = getRayFromScreen(this.camera, this.gl, x, y);
                        const hit = v3(0, 0, 0);
                        if (!intersectRayPlane(ray.origin, ray.dir, center, planeN, hit)) return;

                        const delta = v3(0, 0, 0);
                        v3Sub(delta, hit, this.dragStartHit);

                        const newT: [number, number, number] = [
                                this.dragStartTranslation[0] + delta[0],
                                this.dragStartTranslation[1] + delta[1],
                                this.dragStartTranslation[2] + delta[2],
                        ];

                        // Zero out the axis that shouldn't move
                        if (this.draggingHandle === 'txy') newT[2] = this.dragStartTranslation[2]; // don't move Z
                        else if (this.draggingHandle === 'txz') newT[1] = this.dragStartTranslation[1]; // don't move Y
                        else if (this.draggingHandle === 'tyz') newT[0] = this.dragStartTranslation[0]; // don't move X

                        tr.translation = newT;
                        this._onTransformEdited.fire({ entityId: this.selectedEntityId!, translation: newT });
                        this._onTransformEditedTRS.fire({ entityId: this.selectedEntityId!, translation: newT, rotation: tr.rotation, scale: tr.scale });
                        return;
                }

                if (this.draggingHandle === 'sxyz') {
                        const dy = (this.dragStartHit[1] - y);
                        const k = 1 + (dy / 200);
                        const ns: [number, number, number] = [
                                Math.max(0.01, this.dragStartScale[0] * k),
                                Math.max(0.01, this.dragStartScale[1] * k),
                                Math.max(0.01, this.dragStartScale[2] * k),
                        ];
                        tr.scale = ns;
                        this._onTransformEditedTRS.fire({ entityId: this.selectedEntityId, translation: tr.translation, rotation: tr.rotation, scale: ns });
                        return;
                }

                if (this.draggingHandle === 'rx' || this.draggingHandle === 'ry' || this.draggingHandle === 'rz') {
                        const axisDir = (this.draggingHandle === 'rx') ? v3(1, 0, 0) : (this.draggingHandle === 'ry') ? v3(0, 1, 0) : v3(0, 0, 1);

                        const ray = getRayFromScreen(this.camera, this.gl, x, y);
                        const hit = v3(0, 0, 0);
                        if (!intersectRayPlane(ray.origin, ray.dir, center, axisDir, hit)) return;

                        const u = v3(0, 0, 0);
                        const v = v3(0, 0, 0);
                        const ref = Math.abs(axisDir[1]) > 0.9 ? v3(1, 0, 0) : v3(0, 1, 0);
                        v3Cross(u, axisDir, ref); v3Normalize(u, u);
                        v3Cross(v, axisDir, u);

                        const d = v3(0, 0, 0);
                        v3Sub(d, hit, center); v3Normalize(d, d);

                        const ang = Math.atan2(v3Dot(d, v), v3Dot(d, u));
                        const delta = ang - this.dragStartAngle;

                        const dq = quatFromAxisAngle(axisDir, delta);
                        const nr = quatMul(dq, this.dragStartRotation);

                        tr.rotation = nr;
                        this._onTransformEditedTRS.fire({ entityId: this.selectedEntityId, translation: tr.translation, rotation: nr, scale: tr.scale });
                }
        }

        private stopGizmoDrag(): void {
                this.draggingHandle = null;
        }

        private updateHud(): void {
                // HUD no longer needed — inspector is docked
                if (this.hud) this.hud.style.display = 'none';
        }

        // ========================================================================
        // 3D COMPASS
        // ========================================================================

        private render3DCompass(gl: WebGL2RenderingContext, canvasW: number, canvasH: number): void {
                if (!this.compassProgram || !this.compassCylinder || !this.compassCone || !this.compassSphere) return;

                const compassSize = Math.floor(90 * this.dpr);
                const margin = Math.floor(12 * this.dpr);
                gl.viewport(canvasW - compassSize - margin, canvasH - compassSize - margin, compassSize, compassSize);
                gl.clear(gl.DEPTH_BUFFER_BIT);

                const compassView = m4Create();
                for (let i = 0; i < 16; i++) compassView[i] = this.camera.viewMatrix[i];
                compassView[12] = 0; compassView[13] = 0; compassView[14] = -3.0;

                const compassProj = m4Create(), compassVP = m4Create();
                m4Perspective(compassProj, 45 * DEG2RAD, 1, 0.1, 100);
                m4Multiply(compassVP, compassProj, compassView);

                gl.useProgram(this.compassProgram);
                const model = m4Create(), mvp = m4Create(), normMat = m4Create();

                m4Identity(model);
                const ss = 0.12; model[0] = ss; model[5] = ss; model[10] = ss;
                m4Multiply(mvp, compassVP, model); m4TransposeUpper3x3(normMat, model);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.compassProgram, 'uMVP'), false, mvp);
                gl.uniformMatrix4fv(gl.getUniformLocation(this.compassProgram, 'uNormalMat'), false, normMat);
                // Use #33333c = (0.2, 0.2, 0.235)
                gl.uniform3f(gl.getUniformLocation(this.compassProgram, 'uColor'), 0.20, 0.20, 0.235);
                gl.bindVertexArray(this.compassSphere.vao);
                gl.drawElements(gl.TRIANGLES, this.compassSphere.indexCount, gl.UNSIGNED_SHORT, 0);

                const axes = [
                        { dir: [1, 0, 0], color: [0.75, 0.22, 0.20] },
                        { dir: [0, 1, 0], color: [0.28, 0.65, 0.30] },
                        { dir: [0, 0, 1], color: [0.20, 0.40, 0.75] },
                ];

                for (const axis of axes) {
                        const [dx, dy, dz] = axis.dir;
                        this.buildAxisRotation(model, dx, dy, dz);
                        m4Multiply(mvp, compassVP, model); m4TransposeUpper3x3(normMat, model);
                        gl.uniformMatrix4fv(gl.getUniformLocation(this.compassProgram, 'uMVP'), false, mvp);
                        gl.uniformMatrix4fv(gl.getUniformLocation(this.compassProgram, 'uNormalMat'), false, normMat);
                        gl.uniform3f(gl.getUniformLocation(this.compassProgram, 'uColor'), axis.color[0], axis.color[1], axis.color[2]);
                        gl.bindVertexArray(this.compassCylinder.vao);
                        gl.drawElements(gl.TRIANGLES, this.compassCylinder.indexCount, gl.UNSIGNED_SHORT, 0);

                        this.buildAxisRotation(model, dx, dy, dz, 0.6);
                        m4Multiply(mvp, compassVP, model); m4TransposeUpper3x3(normMat, model);
                        gl.uniformMatrix4fv(gl.getUniformLocation(this.compassProgram, 'uMVP'), false, mvp);
                        gl.uniformMatrix4fv(gl.getUniformLocation(this.compassProgram, 'uNormalMat'), false, normMat);
                        gl.bindVertexArray(this.compassCone.vao);
                        gl.drawElements(gl.TRIANGLES, this.compassCone.indexCount, gl.UNSIGNED_SHORT, 0);
                }
                gl.bindVertexArray(null);
                gl.viewport(0, 0, canvasW, canvasH);
        }

        private buildAxisRotation(out: Mat4, dx: number, dy: number, dz: number, offset: number = 0): void {
                m4Identity(out);
                if (Math.abs(dx) > 0.5) {
                        out[0] = 0; out[4] = -1; out[8] = 0;
                        out[1] = 1; out[5] = 0; out[9] = 0;
                        out[2] = 0; out[6] = 0; out[10] = 1;
                        out[12] = offset * dx;
                } else if (Math.abs(dz) > 0.5) {
                        out[0] = 1; out[4] = 0; out[8] = 0;
                        out[1] = 0; out[5] = 0; out[9] = -1;
                        out[2] = 0; out[6] = 1; out[10] = 0;
                        out[14] = offset * dz;
                } else {
                        out[13] = offset * dy;
                }
        }

        // ========================================================================
        // PICKING
        // ========================================================================

        private performPick(gl: WebGL2RenderingContext, x: number, y: number): void {
                if (!this.pickingFBO || !this.flatProgram) return;
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFBO.framebuffer);
                gl.viewport(0, 0, this.pickingFBO.width, this.pickingFBO.height);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                gl.disable(gl.BLEND);
                this.renderEntities(gl, true);
                const pixel = new Uint8Array(4);
                gl.readPixels(Math.floor(x), Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
                const pickedIndex = colorToEntityId(pixel);
                
                // Ищем в renderList (теперь используем getRenderList для правильной индексации)
                const items = this.getRenderList();
                const picked = (pickedIndex >= 0 && pickedIndex < items.length) ? items[pickedIndex].entity : null;
                this.selectedEntityId = picked?.id ?? null;
                this.selectedEntityIndex = pickedIndex;
                this._onEntityPicked.fire(this.selectedEntityId);
                
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
                gl.clearColor(0, 0, 0, 1);
        }

        // ========================================================================
        // FLY MOVEMENT
        // ========================================================================

        private updateFlyMovement(): void {
                if (!this.isRightMouseDown || !this.camera.flyMode) return;
                const speed = this.keys['shift'] ? this.flySpeed * 3 : this.flySpeed;
                let fwd = 0, rt = 0, up = 0;
                if (this.keys['w'] || this.keys['ц']) fwd += 1;
                if (this.keys['s'] || this.keys['ы']) fwd -= 1;
                if (this.keys['d'] || this.keys['в']) rt += 1;
                if (this.keys['a'] || this.keys['ф']) rt -= 1;
                if (this.keys['e'] || this.keys['у']) up += 1;
                if (this.keys['q'] || this.keys['й']) up -= 1;
                this.camera.flyMove(fwd, rt, up, speed);
        }

        // ========================================================================
        // 2D OVERLAY
        // ========================================================================

        private renderOverlay(): void {
                if (!this.overlayCanvas) return;
                const ctx = this.overlayCanvas.getContext('2d');
                if (!ctx) return;
                ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                this.renderCompassLabels(ctx, this.overlayCanvas.width, this.overlayCanvas.height);
                this.renderSceneIcons2D(ctx);
        }

        private renderCompassLabels(ctx: CanvasRenderingContext2D, cw: number, ch: number): void {
                const compassSize = Math.floor(90 * this.dpr), margin = Math.floor(12 * this.dpr);
                const cx = cw - compassSize / 2 - margin, cy = margin + compassSize / 2;
                const vm = this.camera.viewMatrix;
                const fontSize = Math.max(10, Math.floor(12 * this.dpr));
                ctx.font = `bold ${fontSize}px 'Consolas',monospace`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

                const axes = [
                        { label: 'X', color: '#b84040', vx: vm[0], vy: vm[1], vz: vm[2] },
                        { label: 'Y', color: '#48a84c', vx: vm[4], vy: vm[5], vz: vm[6] },
                        { label: 'Z', color: '#4068b8', vx: vm[8], vy: vm[9], vz: vm[10] },
                ];
                axes.sort((a, b) => a.vz - b.vz);

                const ld = compassSize * 0.48;
                for (const axis of axes) {
                        const lx = cx + axis.vx * ld, ly = cy - axis.vy * ld;
                        const tw = ctx.measureText(axis.label).width + 6 * this.dpr;
                        const th = fontSize + 4 * this.dpr;
                        ctx.fillStyle = 'rgba(28,28,29,0.90)';
                        ctx.beginPath();
                        ctx.roundRect(lx - tw / 2, ly - th / 2, tw, th, 3 * this.dpr);
                        ctx.fill();
                        ctx.fillStyle = axis.color;
                        ctx.fillText(axis.label, lx, ly);
                }
        }

        private renderSceneIcons2D(ctx: CanvasRenderingContext2D): void {
                const gl = this.gl;
                if (!gl || !this.scene) return;

                const w = gl.drawingBufferWidth;
                const h = gl.drawingBufferHeight;

                const items = this.getRenderList();
                for (const it of items) {
                        const e = it.entity;
                        const hasCam = e.components.some(c => c.type === 'Camera');
                        const hasPL = e.components.some(c => c.type === 'PointLight');
                        const hasDL = e.components.some(c => c.type === 'DirectionalLight');
                        const label3D = e.components.find(c => c.type === 'Label3D');
                        
                        // Skip if not a special type
                        if (!hasCam && !hasPL && !hasDL && !label3D) continue;

                        const p = v3(it.worldMatrix[12], it.worldMatrix[13], it.worldMatrix[14]);

                        const m = this.camera.vpMatrix;
                        const cx = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
                        const cy = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
                        const cw = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
                        if (cw <= 0.0001) continue;

                        const ndcX = cx / cw;
                        const ndcY = cy / cw;
                        const sx = (ndcX * 0.5 + 0.5) * w;
                        const sy = (1 - (ndcY * 0.5 + 0.5)) * h;

                        const dist = v3Dist(this.camera.position, p);
                        const size = Math.max(10, Math.min(22, 220 / dist)) * this.dpr;

                        // Render Label3D text
                        if (label3D && label3D.type === 'Label3D') {
                                const text = (label3D as any).text || 'Label';
                                const fontSize = Math.max(12, Math.min(24, (label3D as any).font_size || 16)) * this.dpr;
                                
                                ctx.save();
                                ctx.font = `${fontSize}px 'Consolas',monospace`;
                                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                                
                                const textWidth = ctx.measureText(text).width;
                                const padding = 6 * this.dpr;
                                
                                // Background
                                ctx.fillStyle = 'rgba(28,28,29,0.85)';
                                ctx.beginPath();
                                ctx.roundRect(sx - textWidth / 2 - padding, sy - fontSize / 2 - padding / 2, 
                                        textWidth + padding * 2, fontSize + padding, 4 * this.dpr);
                                ctx.fill();
                                
                                // Text
                                const modulate = (label3D as any).modulate || [1, 1, 1, 1];
                                ctx.fillStyle = `rgba(${Math.floor(modulate[0] * 255)}, ${Math.floor(modulate[1] * 255)}, ${Math.floor(modulate[2] * 255)}, ${modulate[3] ?? 1})`;
                                ctx.fillText(text, sx, sy);
                                
                                ctx.restore();
                                continue;
                        }

                        ctx.save();
                        ctx.translate(sx, sy);

                        ctx.fillStyle = 'rgba(28,28,29,0.88)';
                        ctx.strokeStyle = '#33333c';
                        ctx.lineWidth = 1 * this.dpr;
                        const bw = size + 10 * this.dpr;
                        const bh = size + 10 * this.dpr;

                        ctx.beginPath();
                        ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 6 * this.dpr);
                        ctx.fill();
                        ctx.stroke();

                        if (hasCam) this.drawCameraIcon(ctx, size);
                        else if (hasDL) this.drawSunIcon(ctx, size);
                        else this.drawBulbIcon(ctx, size);

                        ctx.restore();
                }
        }

        private drawCameraIcon(ctx: CanvasRenderingContext2D, s: number): void {
                ctx.strokeStyle = '#7ab4d8';
                ctx.lineWidth = 2 * this.dpr;
                ctx.beginPath();
                ctx.rect(-s * 0.35, -s * 0.20, s * 0.70, s * 0.45);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, s * 0.14, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-s * 0.18, -s * 0.25);
                ctx.lineTo(0, -s * 0.38);
                ctx.lineTo(s * 0.18, -s * 0.25);
                ctx.stroke();
        }

        private drawBulbIcon(ctx: CanvasRenderingContext2D, s: number): void {
                ctx.strokeStyle = '#d4b050';
                ctx.lineWidth = 2 * this.dpr;
                ctx.beginPath();
                ctx.arc(0, -s * 0.05, s * 0.22, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.rect(-s * 0.12, s * 0.15, s * 0.24, s * 0.14);
                ctx.stroke();
        }

        private drawSunIcon(ctx: CanvasRenderingContext2D, s: number): void {
                ctx.strokeStyle = '#c8a850';
                ctx.lineWidth = 2 * this.dpr;
                ctx.beginPath();
                ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
                ctx.stroke();
                for (let i = 0; i < 8; i++) {
                        const a = (i / 8) * Math.PI * 2;
                        const x0 = Math.cos(a) * s * 0.26, y0 = Math.sin(a) * s * 0.26;
                        const x1 = Math.cos(a) * s * 0.36, y1 = Math.sin(a) * s * 0.36;
                        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
                }
        }

        // ========================================================================
        // INFO
        // ========================================================================

        private updateInfoText(): void {
                if (!this.info) return;
                const ec = this.getVisibleEntities().length;
                this.info.textContent = `${this.currentFPS} fps · ${ec} obj`;
        }

        private getVisibleEntities(): Entity[] {
                if (!this.scene?.entities) return [];
                const result: Entity[] = [];
                const collect = (entities: Entity[]) => {
                        for (const e of entities) {
                                if (e.visible && e.components.some((c: Component) => c.type === 'Mesh')) {
                                        result.push(e);
                                }
                                if (e.children.length > 0) collect(e.children);
                        }
                };
                collect(this.scene.entities);
                return result;
        }

        /** Called externally (from Bridge/Hierarchy) to select entity by ID */
        public selectEntityById(id: string | null): void {
                if (!id) {
                        this.selectedEntityId = null;
                        this.selectedEntityIndex = -1;
                        return;
                }

                this.selectedEntityId = id;

                // Find index in render list
                const items = this.getRenderList();
                const idx = items.findIndex(i => i.entity.id === id);
                this.selectedEntityIndex = idx;
        }

        override dispose(): void {
                this.stopRendering();
                if (this.pointerLocked) document.exitPointerLock();
                super.dispose();
        }
}

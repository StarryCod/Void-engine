/*---------------------------------------------------------------------------------------------
 *  Void Engine - Professional Gizmo Helpers
 *  Beautiful, professional-grade gizmos for all 80+ node types
 *  Inspired by Godot, Unity, Unreal Engine
 *--------------------------------------------------------------------------------------------*/

// ============================================================================
// CONSTANTS - Professional colors matching industry standards
// ============================================================================

/** Godot-style colors for gizmos */
export const GIZMO_COLORS = {
        // Axis colors (Godot standard: R-G-B for X-Y-Z)
        axisX: [0.92, 0.25, 0.20] as [number, number, number],      // Red
        axisY: [0.35, 0.78, 0.38] as [number, number, number],      // Green  
        axisZ: [0.30, 0.50, 0.95] as [number, number, number],      // Blue
        
        // Selection highlight
        selected: [0.95, 0.60, 0.10] as [number, number, number],   // Orange (Godot selection)
        
        // Camera
        camera: [0.45, 0.70, 0.90] as [number, number, number],     // Light blue
        cameraFrustum: [0.35, 0.55, 0.80] as [number, number, number],
        
        // Lights
        pointLight: [0.95, 0.88, 0.45] as [number, number, number], // Warm yellow
        directionalLight: [1.0, 0.85, 0.35] as [number, number, number], // Sun yellow
        spotLight: [0.95, 0.80, 0.40] as [number, number, number],  // Orange-yellow
        
        // Physics
        characterBody: [0.30, 0.65, 0.90] as [number, number, number], // Cyan-blue
        rigidBody: [0.40, 0.70, 0.95] as [number, number, number],  // Blue
        staticBody: [0.55, 0.58, 0.62] as [number, number, number], // Gray
        area: [0.25, 0.85, 0.35] as [number, number, number],       // Green
        rayCast: [0.90, 0.35, 0.35] as [number, number, number],    // Red
        collisionShape: [0.30, 0.75, 0.45] as [number, number, number], // Green
        
        // Audio
        audio: [0.75, 0.55, 0.85] as [number, number, number],      // Purple
        audio3D: [0.65, 0.45, 0.80] as [number, number, number],
        
        // Animation
        animation: [0.90, 0.65, 0.35] as [number, number, number],  // Orange
        animationTree: [0.85, 0.55, 0.35] as [number, number, number],
        tween: [0.80, 0.60, 0.40] as [number, number, number],
        
        // Navigation
        navRegion: [0.35, 0.75, 0.85] as [number, number, number],  // Cyan
        navAgent: [0.30, 0.70, 0.80] as [number, number, number],
        navObstacle: [0.85, 0.45, 0.25] as [number, number, number], // Orange-red
        
        // Environment
        worldEnv: [0.55, 0.75, 0.95] as [number, number, number],    // Sky blue
        fog: [0.75, 0.78, 0.82] as [number, number, number],         // Light gray
        sky: [0.50, 0.70, 0.95] as [number, number, number],         // Blue
        reflectionProbe: [0.85, 0.75, 0.55] as [number, number, number], // Gold
        
        // Particles
        particles: [0.95, 0.65, 0.35] as [number, number, number],   // Orange
        particlesGPU: [0.98, 0.70, 0.40] as [number, number, number],
        
        // Sprites
        sprite: [0.85, 0.85, 0.85] as [number, number, number],      // White-gray
        spriteAnimated: [0.85, 0.75, 0.55] as [number, number, number],
        label: [0.85, 0.85, 0.95] as [number, number, number],
        
        // Utility
        timer: [0.65, 0.65, 0.65] as [number, number, number],       // Gray
        marker: [0.90, 0.85, 0.35] as [number, number, number],      // Yellow
        path: [0.35, 0.75, 0.85] as [number, number, number],        // Cyan
        pathFollow: [0.40, 0.70, 0.80] as [number, number, number],
        
        // Special
        viewport: [0.55, 0.60, 0.70] as [number, number, number],
        skeleton: [0.90, 0.45, 0.50] as [number, number, number],     // Pink-red
        boneAttachment: [0.85, 0.55, 0.60] as [number, number, number],
        
        // 2D
        sprite2D: [0.80, 0.80, 0.85] as [number, number, number],
};

// ============================================================================
// GEOMETRY GENERATORS
// ============================================================================

/** Create frustum lines for camera (8 corners + 12 edges) */
export function createCameraFrustumGeometry(
        fovDegrees: number,
        near: number,
        far: number,
        aspectRatio: number = 16/9
): { positions: Float32Array; indices: Uint16Array } {
        const fovRad = fovDegrees * Math.PI / 180;
        const tanHalfFov = Math.tan(fovRad / 2);
        
        // Near plane corners
        const nearHalfHeight = near * tanHalfFov;
        const nearHalfWidth = nearHalfHeight * aspectRatio;
        
        // Far plane corners
        const farHalfHeight = far * tanHalfFov;
        const farHalfWidth = farHalfHeight * aspectRatio;
        
        // 8 corners: near(0-3), far(4-7)
        const positions = new Float32Array([
                // Near plane (Z = -near)
                -nearHalfWidth, -nearHalfHeight, -near,  // 0: near bottom-left
                 nearHalfWidth, -nearHalfHeight, -near,  // 1: near bottom-right
                 nearHalfWidth,  nearHalfHeight, -near,  // 2: near top-right
                -nearHalfWidth,  nearHalfHeight, -near,  // 3: near top-left
                // Far plane (Z = -far)
                -farHalfWidth, -farHalfHeight, -far,     // 4: far bottom-left
                 farHalfWidth, -farHalfHeight, -far,     // 5: far bottom-right
                 farHalfWidth,  farHalfHeight, -far,     // 6: far top-right
                -farHalfWidth,  farHalfHeight, -far,     // 7: far top-left
        ]);
        
        // 12 edges as lines (24 vertices for LINE drawing)
        const indices = new Uint16Array([
                // Near plane edges
                0, 1,  1, 2,  2, 3,  3, 0,
                // Far plane edges
                4, 5,  5, 6,  6, 7,  7, 4,
                // Connecting edges
                0, 4,  1, 5,  2, 6,  3, 7,
        ]);
        
        return { positions, indices };
}

/** Create wireframe cube */
export function createWireframeCubeGeometry(size: number = 1): { positions: Float32Array; indices: Uint16Array } {
        const s = size / 2;
        const positions = new Float32Array([
                -s, -s, -s,   s, -s, -s,   s,  s, -s,  -s,  s, -s,  // Back face
                -s, -s,  s,   s, -s,  s,   s,  s,  s,  -s,  s,  s,  // Front face
        ]);
        const indices = new Uint16Array([
                0, 1, 1, 2, 2, 3, 3, 0,  // Back face
                4, 5, 5, 6, 6, 7, 7, 4,  // Front face
                0, 4, 1, 5, 2, 6, 3, 7,  // Connecting edges
        ]);
        return { positions, indices };
}

/** Create wireframe sphere (latitude/longitude lines) */
export function createWireframeSphereGeometry(
        radius: number = 0.5,
        latSegments: number = 12,
        lonSegments: number = 16
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Longitude lines (vertical)
        for (let lon = 0; lon < lonSegments; lon++) {
                const theta = (lon / lonSegments) * Math.PI * 2;
                const cosTheta = Math.cos(theta);
                const sinTheta = Math.sin(theta);
                const baseIndex = positions.length / 3;
                
                for (let lat = 0; lat <= latSegments; lat++) {
                        const phi = (lat / latSegments) * Math.PI;
                        const y = Math.cos(phi);
                        const r = Math.sin(phi);
                        positions.push(
                                radius * r * cosTheta,
                                radius * y,
                                radius * r * sinTheta
                        );
                }
                
                for (let i = 0; i < latSegments; i++) {
                        indices.push(baseIndex + i, baseIndex + i + 1);
                }
        }
        
        // Latitude lines (horizontal)
        for (let lat = 1; lat < latSegments; lat++) {
                const phi = (lat / latSegments) * Math.PI;
                const y = Math.cos(phi);
                const r = Math.sin(phi);
                const baseIndex = positions.length / 3;
                
                for (let lon = 0; lon <= lonSegments; lon++) {
                        const theta = (lon / lonSegments) * Math.PI * 2;
                        positions.push(
                                radius * r * Math.cos(theta),
                                radius * y,
                                radius * r * Math.sin(theta)
                        );
                }
                
                for (let i = 0; i < lonSegments; i++) {
                        indices.push(baseIndex + i, baseIndex + i + 1);
                }
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create wireframe cylinder */
export function createWireframeCylinderGeometry(
        radius: number = 0.5,
        height: number = 1,
        segments: number = 16
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        const halfHeight = height / 2;
        
        // Top and bottom circles
        for (let ring = 0; ring < 2; ring++) {
                const y = ring === 0 ? halfHeight : -halfHeight;
                const baseIndex = positions.length / 3;
                
                for (let i = 0; i <= segments; i++) {
                        const theta = (i / segments) * Math.PI * 2;
                        positions.push(
                                radius * Math.cos(theta),
                                y,
                                radius * Math.sin(theta)
                        );
                }
                
                for (let i = 0; i < segments; i++) {
                        indices.push(baseIndex + i, baseIndex + i + 1);
                }
        }
        
        // Vertical lines
        for (let i = 0; i < segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                const x = radius * Math.cos(theta);
                const z = radius * Math.sin(theta);
                const baseIndex = positions.length / 3;
                
                positions.push(x, halfHeight, z, x, -halfHeight, z);
                indices.push(baseIndex, baseIndex + 1);
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create arrow geometry (cone + cylinder) */
export function createArrowGeometry(
        shaftRadius: number = 0.02,
        shaftLength: number = 0.8,
        headRadius: number = 0.07,
        headLength: number = 0.2
): { positions: Float32Array; indices: Uint16Array; normals: Float32Array } {
        // This creates a solid arrow (not wireframe) for better visibility
        const segments = 12;
        const positions: number[] = [];
        const normals: number[] = [];
        const indices: number[] = [];
        
        // Shaft cylinder
        let baseIndex = 0;
        for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                const cosTheta = Math.cos(theta);
                const sinTheta = Math.sin(theta);
                // Bottom
                positions.push(shaftRadius * cosTheta, 0, shaftRadius * sinTheta);
                normals.push(cosTheta, 0, sinTheta);
                // Top
                positions.push(shaftRadius * cosTheta, shaftLength, shaftRadius * sinTheta);
                normals.push(cosTheta, 0, sinTheta);
        }
        
        for (let i = 0; i < segments; i++) {
                const b = i * 2;
                indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
        
        // Head cone
        baseIndex = positions.length / 3;
        const tipY = shaftLength + headLength;
        
        // Cone base
        for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                positions.push(headRadius * Math.cos(theta), shaftLength, headRadius * Math.sin(theta));
                // Approximate normals for cone
                const ny = headRadius / headLength;
                const nyLen = Math.sqrt(1 + ny * ny);
                normals.push(Math.cos(theta) / nyLen, ny / nyLen, Math.sin(theta) / nyLen);
        }
        
        // Tip
        positions.push(0, tipY, 0);
        normals.push(0, 1, 0);
        const tipIndex = positions.length / 3 - 1;
        
        for (let i = 0; i < segments; i++) {
                indices.push(baseIndex + i, baseIndex + i + 1, tipIndex);
        }
        
        return {
                positions: new Float32Array(positions),
                normals: new Float32Array(normals),
                indices: new Uint16Array(indices)
        };
}

/** Create cone geometry for spotlight visualization */
export function createSpotlightConeGeometry(
        angle: number = 45,
        range: number = 2,
        segments: number = 24
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Apex at origin
        positions.push(0, 0, 0);
        
        // Base circle
        const angleRad = angle * Math.PI / 180;
        const baseRadius = range * Math.tan(angleRad);
        
        for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                positions.push(
                        baseRadius * Math.cos(theta),
                        range,
                        baseRadius * Math.sin(theta)
                );
        }
        
        // Lines from apex to base
        for (let i = 1; i <= segments; i++) {
                indices.push(0, i);
        }
        
        // Base circle
        for (let i = 1; i < segments; i++) {
                indices.push(i, i + 1);
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create point light helper (sphere + rays) */
export function createPointLightHelperGeometry(
        bulbRadius: number = 0.15,
        rayLength: number = 0.3,
        rayCount: number = 6
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Central sphere is rendered separately, here we just have rays
        // Rays pointing in 6 directions: +/- X, Y, Z
        const directions = [
                [1, 0, 0], [-1, 0, 0],
                [0, 1, 0], [0, -1, 0],
                [0, 0, 1], [0, 0, -1],
        ];
        
        for (const [dx, dy, dz] of directions) {
                const baseIndex = positions.length / 3;
                positions.push(
                        bulbRadius * dx, bulbRadius * dy, bulbRadius * dz,
                        (bulbRadius + rayLength) * dx, (bulbRadius + rayLength) * dy, (bulbRadius + rayLength) * dz
                );
                indices.push(baseIndex, baseIndex + 1);
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create sun rays for directional light */
export function createSunRaysGeometry(
        coreRadius: number = 0.25,
        rayLength: number = 0.2,
        rayCount: number = 8
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        for (let i = 0; i < rayCount; i++) {
                const angle = (i / rayCount) * Math.PI * 2;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                const baseIndex = positions.length / 3;
                
                // Ray line from core edge outward
                positions.push(
                        coreRadius * cosA, coreRadius * sinA, 0,
                        (coreRadius + rayLength) * cosA, (coreRadius + rayLength) * sinA, 0
                );
                indices.push(baseIndex, baseIndex + 1);
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create character body helper (capsule wireframe) */
export function createCharacterBodyGeometry(
        radius: number = 0.5,
        height: number = 1.8,
        segments: number = 12
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        const halfHeight = height / 2 - radius;
        
        // Top hemisphere
        for (let ring = 0; ring <= segments / 2; ring++) {
                const phi = (ring / segments) * Math.PI;
                const y = radius * Math.cos(phi) + halfHeight;
                const r = radius * Math.sin(phi);
                const baseIndex = positions.length / 3;
                
                for (let i = 0; i <= segments; i++) {
                        const theta = (i / segments) * Math.PI * 2;
                        positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
                }
                
                for (let i = 0; i < segments; i++) {
                        indices.push(baseIndex + i, baseIndex + i + 1);
                }
        }
        
        // Cylinder
        // Top circle
        const topBase = positions.length / 3;
        for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                positions.push(radius * Math.cos(theta), halfHeight, radius * Math.sin(theta));
        }
        for (let i = 0; i < segments; i++) {
                indices.push(topBase + i, topBase + i + 1);
        }
        
        // Bottom circle
        const botBase = positions.length / 3;
        for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                positions.push(radius * Math.cos(theta), -halfHeight, radius * Math.sin(theta));
        }
        for (let i = 0; i < segments; i++) {
                indices.push(botBase + i, botBase + i + 1);
        }
        
        // Vertical lines
        for (let i = 0; i < 4; i++) {
                const theta = (i / 4) * Math.PI * 2;
                const x = radius * Math.cos(theta);
                const z = radius * Math.sin(theta);
                const baseIndex = positions.length / 3;
                positions.push(x, halfHeight, z, x, -halfHeight, z);
                indices.push(baseIndex, baseIndex + 1);
        }
        
        // Bottom hemisphere
        for (let ring = segments / 2; ring <= segments; ring++) {
                const phi = (ring / segments) * Math.PI;
                const y = radius * Math.cos(phi) - halfHeight;
                const r = radius * Math.sin(phi);
                const baseIndex = positions.length / 3;
                
                for (let i = 0; i <= segments; i++) {
                        const theta = (i / segments) * Math.PI * 2;
                        positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
                }
                
                for (let i = 0; i < segments; i++) {
                        indices.push(baseIndex + i, baseIndex + i + 1);
                }
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create raycast visualization - long "infinite" ray */
export function createRayCastGeometry(
        length: number = 100, // Very long ray to appear "infinite"
        originRadius: number = 0.08,
        tipRadius: number = 0.08
): { positions: Float32Array; indices: Uint16Array } {
        // Create dashed line effect with multiple segments
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Origin marker (small cross)
        const o = originRadius;
        positions.push(
                -o, 0, 0, o, 0, 0,  // X axis
                0, -o, 0, 0, o, 0,  // Y axis  
                0, 0, -o, 0, 0, o   // Z axis
        );
        indices.push(0, 1, 2, 3, 4, 5);
        
        // Main ray line (long line in -Z direction which is forward in Godot)
        const rayBase = positions.length / 3;
        positions.push(0, 0, 0, 0, 0, -length);
        indices.push(rayBase, rayBase + 1);
        
        // Dashed segments along the ray for better visibility
        const dashCount = 10;
        for (let i = 0; i < dashCount; i++) {
                const start = -length * (i * 2 + 1) / (dashCount * 2);
                const end = -length * (i * 2 + 2) / (dashCount * 2);
                const baseIndex = positions.length / 3;
                positions.push(0, 0, start, 0, 0, end);
                indices.push(baseIndex, baseIndex + 1);
        }
        
        // Arrow head at far end
        const tipZ = -length;
        const t = tipRadius * 2;
        positions.push(
                -t, 0, tipZ + t * 2,  t, 0, tipZ + t * 2,  // X cross
                0, -t, tipZ + t * 2,  0, t, tipZ + t * 2,  // Y cross
                0, 0, tipZ,  0, 0, tipZ + t * 3  // Center line
        );
        const tipBase = positions.length / 3 - 6;
        indices.push(tipBase, tipBase + 1, tipBase + 2, tipBase + 3, tipBase + 4, tipBase + 5);
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create area/trigger zone visualization */
export function createAreaGeometry(
        size: [number, number, number] = [1, 1, 1]
): { positions: Float32Array; indices: Uint16Array } {
        const [sx, sy, sz] = size;
        const positions = new Float32Array([
                -sx/2, -sy/2, -sz/2,
                 sx/2, -sy/2, -sz/2,
                 sx/2,  sy/2, -sz/2,
                -sx/2,  sy/2, -sz/2,
                -sx/2, -sy/2,  sz/2,
                 sx/2, -sy/2,  sz/2,
                 sx/2,  sy/2,  sz/2,
                -sx/2,  sy/2,  sz/2,
        ]);
        
        const indices = new Uint16Array([
                0, 1, 1, 2, 2, 3, 3, 0,  // Back
                4, 5, 5, 6, 6, 7, 7, 4,  // Front
                0, 4, 1, 5, 2, 6, 3, 7,  // Edges
        ]);
        
        return { positions, indices };
}

/** Create speaker icon for audio */
export function createSpeakerGeometry(
        size: number = 0.3
): { positions: Float32Array; indices: Uint16Array } {
        const s = size;
        const positions = new Float32Array([
                // Speaker body (trapezoid)
                -s * 0.3, -s * 0.2, 0,
                -s * 0.3,  s * 0.2, 0,
                 s * 0.1,  s * 0.35, 0,
                 s * 0.1, -s * 0.35, 0,
                // Sound waves (arcs)
                // Wave 1
                s * 0.15, 0, 0,
                s * 0.35, s * 0.3, 0,
                s * 0.35, -s * 0.3, 0,
        ]);
        
        const indices = new Uint16Array([
                0, 1, 1, 2, 2, 3, 3, 0,  // Body outline
                4, 5, 4, 6,              // Wave lines
        ]);
        
        return { positions, indices };
}

/** Create film reel for animation player */
export function createFilmReelGeometry(
        radius: number = 0.2,
        holeCount: number = 8
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Outer circle
        const outerBase = 0;
        for (let i = 0; i <= 24; i++) {
                const theta = (i / 24) * Math.PI * 2;
                positions.push(radius * Math.cos(theta), 0, radius * Math.sin(theta));
        }
        for (let i = 0; i < 24; i++) {
                indices.push(outerBase + i, outerBase + i + 1);
        }
        
        // Inner circle (hole)
        const innerBase = positions.length / 3;
        const innerRadius = radius * 0.4;
        for (let i = 0; i <= 12; i++) {
                const theta = (i / 12) * Math.PI * 2;
                positions.push(innerRadius * Math.cos(theta), 0, innerRadius * Math.sin(theta));
        }
        for (let i = 0; i < 12; i++) {
                indices.push(innerBase + i, innerBase + i + 1);
        }
        
        // Spokes
        for (let i = 0; i < holeCount; i++) {
                const angle = (i / holeCount) * Math.PI * 2;
                const baseIndex = positions.length / 3;
                positions.push(
                        innerRadius * Math.cos(angle), 0, innerRadius * Math.sin(angle),
                        radius * 0.85 * Math.cos(angle), 0, radius * 0.85 * Math.sin(angle)
                );
                indices.push(baseIndex, baseIndex + 1);
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create navigation region visualization */
export function createNavRegionGeometry(
        size: [number, number] = [2, 2],
        cellSize: number = 0.5
): { positions: Float32Array; indices: Uint16Array } {
        const [sx, sz] = size;
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Grid
        const nx = Math.ceil(sx / cellSize);
        const nz = Math.ceil(sz / cellSize);
        
        for (let i = 0; i <= nx; i++) {
                const baseIndex = positions.length / 3;
                const x = -sx/2 + i * cellSize;
                positions.push(x, 0, -sz/2, x, 0, sz/2);
                indices.push(baseIndex, baseIndex + 1);
        }
        
        for (let j = 0; j <= nz; j++) {
                const baseIndex = positions.length / 3;
                const z = -sz/2 + j * cellSize;
                positions.push(-sx/2, 0, z, sx/2, 0, z);
                indices.push(baseIndex, baseIndex + 1);
        }
        
        // Border
        const borderBase = positions.length / 3;
        positions.push(
                -sx/2, 0, -sz/2,
                sx/2, 0, -sz/2,
                sx/2, 0, sz/2,
                -sx/2, 0, sz/2
        );
        indices.push(borderBase, borderBase + 1, borderBase + 1, borderBase + 2, 
                     borderBase + 2, borderBase + 3, borderBase + 3, borderBase);
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create particle emitter visualization */
export function createParticleEmitterGeometry(
        size: number = 0.3
): { positions: Float32Array; indices: Uint16Array } {
        const s = size;
        const positions = new Float32Array([
                // Emitter cone outline
                0, 0, 0,           // Apex
                -s, 0, -s,          // Base corners
                s, 0, -s,
                s, 0, s,
                -s, 0, s,
                // Particle dots
                0, s * 1.5, 0,
                s * 0.3, s * 2, s * 0.2,
                -s * 0.2, s * 2.5, -s * 0.1,
                s * 0.1, s * 3, 0,
        ]);
        
        const indices = new Uint16Array([
                0, 1, 0, 2, 0, 3, 0, 4,  // Cone edges
                1, 2, 2, 3, 3, 4, 4, 1,  // Base
        ]);
        
        return { positions, indices };
}

/** Create timer visualization (clock) */
export function createTimerGeometry(
        radius: number = 0.15
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Clock face circle
        for (let i = 0; i <= 24; i++) {
                const theta = (i / 24) * Math.PI * 2;
                positions.push(radius * Math.cos(theta), radius * Math.sin(theta), 0);
        }
        for (let i = 0; i < 24; i++) {
                indices.push(i, i + 1);
        }
        
        // Hour hand
        const hourBase = positions.length / 3;
        positions.push(0, 0, 0, 0, radius * 0.5, 0);
        indices.push(hourBase, hourBase + 1);
        
        // Minute hand
        const minBase = positions.length / 3;
        positions.push(0, 0, 0, radius * 0.7, 0, 0);
        indices.push(minBase, minBase + 1);
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create marker 3D visualization (cross/axes) */
export function createMarkerGeometry(
        size: number = 0.2
): { positions: Float32Array; indices: Uint16Array } {
        const s = size;
        const positions = new Float32Array([
                // X axis
                -s, 0, 0, s, 0, 0,
                // Y axis
                0, -s, 0, 0, s, 0,
                // Z axis
                0, 0, -s, 0, 0, s,
        ]);
        
        const indices = new Uint16Array([0, 1, 2, 3, 4, 5]);
        
        return { positions, indices };
}

/** Create viewport visualization */
export function createViewportGeometry(
        size: [number, number] = [1, 0.75]
): { positions: Float32Array; indices: Uint16Array } {
        const [w, h] = size;
        const positions = new Float32Array([
                -w/2, -h/2, 0,
                w/2, -h/2, 0,
                w/2, h/2, 0,
                -w/2, h/2, 0,
        ]);
        
        const indices = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0]);
        
        return { positions, indices };
}

// ============================================================================
// ADDITIONAL GIZMO GEOMETRIES FOR MISSING NODE TYPES
// ============================================================================

/** Create ShapeCast visualization - like RayCast but with a shape at the end */
export function createShapeCastGeometry(
        length: number = 50,
        shapeSize: number = 0.3
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Main ray line
        positions.push(0, 0, 0, 0, 0, -length);
        indices.push(0, 1);
        
        // Shape at end (wireframe cube)
        const s = shapeSize;
        const z = -length;
        const baseIndex = positions.length / 3;
        positions.push(
                -s, -s, z - s,  s, -s, z - s,  s, s, z - s,  -s, s, z - s,
                -s, -s, z + s,  s, -s, z + s,  s, s, z + s,  -s, s, z + s
        );
        indices.push(
                baseIndex, baseIndex + 1, baseIndex + 1, baseIndex + 2,
                baseIndex + 2, baseIndex + 3, baseIndex + 3, baseIndex,
                baseIndex + 4, baseIndex + 5, baseIndex + 5, baseIndex + 6,
                baseIndex + 6, baseIndex + 7, baseIndex + 7, baseIndex + 4,
                baseIndex, baseIndex + 4, baseIndex + 1, baseIndex + 5,
                baseIndex + 2, baseIndex + 6, baseIndex + 3, baseIndex + 7
        );
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create 2D node visualization (flat square in XY plane) */
export function createNode2DGeometry(
        size: number = 0.3
): { positions: Float32Array; indices: Uint16Array } {
        const s = size;
        const positions = new Float32Array([
                -s, -s, 0,  s, -s, 0,  s, s, 0,  -s, s, 0,
                0, 0, 0,  0, s * 1.5, 0,  // Up arrow
        ]);
        const indices = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5]);
        return { positions, indices };
}

/** Create Sprite2D visualization (billboard quad) */
export function createSprite2DGeometry(
        size: number = 0.5
): { positions: Float32Array; indices: Uint16Array } {
        const s = size;
        const positions = new Float32Array([
                -s, -s, 0,  s, -s, 0,  s, s, 0,  -s, s, 0,
                // Diagonal cross
                -s, -s, 0,  s, s, 0,
                s, -s, 0,  -s, s, 0,
        ]);
        const indices = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 6, 7]);
        return { positions, indices };
}

/** Create 2D collision shape visualization */
export function createCollisionShape2DGeometry(
        shapeType: 'rectangle' | 'circle' | 'capsule' = 'rectangle',
        size: number = 0.5
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        if (shapeType === 'rectangle') {
                const s = size;
                positions.push(-s, -s, 0, s, -s, 0, s, s, 0, -s, s, 0);
                indices.push(0, 1, 1, 2, 2, 3, 3, 0);
        } else if (shapeType === 'circle') {
                const segments = 24;
                for (let i = 0; i <= segments; i++) {
                        const angle = (i / segments) * Math.PI * 2;
                        positions.push(Math.cos(angle) * size, Math.sin(angle) * size, 0);
                }
                for (let i = 0; i < segments; i++) {
                        indices.push(i, i + 1);
                }
        } else {
                // Capsule - two semicircles + rectangle
                const segments = 12;
                // Top semicircle
                for (let i = 0; i <= segments / 2; i++) {
                        const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
                        positions.push(Math.cos(angle) * size * 0.5, Math.sin(angle) * size * 0.5 + size * 0.5, 0);
                }
                // Bottom semicircle
                for (let i = 0; i <= segments / 2; i++) {
                        const angle = (i / segments) * Math.PI * 2 + Math.PI / 2;
                        positions.push(Math.cos(angle) * size * 0.5, Math.sin(angle) * size * 0.5 - size * 0.5, 0);
                }
                for (let i = 0; i < positions.length / 3 - 1; i++) {
                        indices.push(i, i + 1);
                }
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create Skeleton3D visualization */
export function createSkeletonGeometry(
        boneCount: number = 5,
        boneLength: number = 0.3
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Create a simple bone chain
        for (let i = 0; i < boneCount; i++) {
                const y = i * boneLength;
                const s = 0.05 * (1 - i / boneCount * 0.5); // Tapering
                
                // Diamond shape for each bone
                const baseIndex = positions.length / 3;
                positions.push(
                        0, y, 0,  // Bone origin
                        -s, y + boneLength * 0.3, -s,
                        s, y + boneLength * 0.3, -s,
                        s, y + boneLength * 0.3, s,
                        -s, y + boneLength * 0.3, s,
                        0, y + boneLength, 0  // Bone tip
                );
                indices.push(
                        baseIndex, baseIndex + 1, baseIndex, baseIndex + 2,
                        baseIndex, baseIndex + 3, baseIndex, baseIndex + 4,
                        baseIndex + 5, baseIndex + 1, baseIndex + 5, baseIndex + 2,
                        baseIndex + 5, baseIndex + 3, baseIndex + 5, baseIndex + 4
                );
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create BoneAttachment visualization */
export function createBoneAttachmentGeometry(
        size: number = 0.15
): { positions: Float32Array; indices: Uint16Array } {
        const s = size;
        const positions = new Float32Array([
                // Cross
                -s, 0, 0, s, 0, 0,
                0, -s, 0, 0, s, 0,
                0, 0, -s, 0, 0, s,
                // Circle in Y
        ]);
        
        // Add circle
        const segments = 12;
        const baseIndex = positions.length / 3;
        const circlePositions: number[] = [];
        for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                circlePositions.push(Math.cos(angle) * s, 0, Math.sin(angle) * s);
        }
        
        const allPositions = Array.from(positions).concat(circlePositions);
        const indices: number[] = [0, 1, 2, 3, 4, 5];
        for (let i = 0; i < segments; i++) {
                indices.push(baseIndex + i, baseIndex + i + 1);
        }
        
        return { positions: new Float32Array(allPositions), indices: new Uint16Array(indices) };
}

/** Create VisibleOnScreenNotifier visualization */
export function createVisibilityNotifierGeometry(
        size: number = 0.4
): { positions: Float32Array; indices: Uint16Array } {
        const s = size;
        const positions = new Float32Array([
                // Box outline
                -s, -s, -s, s, -s, -s, s, s, -s, -s, s, -s,
                -s, -s, s, s, -s, s, s, s, s, -s, s, s,
                // Eye symbol in front
                0, 0, s, s * 0.3, s * 0.15, s, -s * 0.3, s * 0.15, s,
                0, 0, s, s * 0.3, -s * 0.15, s, -s * 0.3, -s * 0.15, s,
        ]);
        const indices = new Uint16Array([
                0, 1, 1, 2, 2, 3, 3, 0,
                4, 5, 5, 6, 6, 7, 7, 4,
                0, 4, 1, 5, 2, 6, 3, 7,
                8, 9, 8, 10,  // Eye
        ]);
        return { positions, indices };
}

/** Create RemoteTransform visualization */
export function createRemoteTransformGeometry(
        size: number = 0.3
): { positions: Float32Array; indices: Uint16Array } {
        const s = size;
        const positions = new Float32Array([
                // Origin cross
                -s, 0, 0, s, 0, 0,
                0, -s, 0, 0, s, 0,
                0, 0, -s, 0, 0, s,
                // Arrow pointing outward
                s * 1.2, 0, 0, s * 2, 0, 0,
                s * 1.6, s * 0.2, 0, s * 1.6, -s * 0.2, 0,
        ]);
        const indices = new Uint16Array([0, 1, 2, 3, 4, 5, 6, 7, 7, 8, 7, 9]);
        return { positions, indices };
}

/** Create MultiMeshInstance visualization */
export function createMultiMeshGeometry(
        instanceCount: number = 4,
        spacing: number = 0.5
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        const s = 0.15;
        
        // Create a grid of small boxes
        const gridSize = Math.ceil(Math.sqrt(instanceCount));
        let idx = 0;
        for (let i = 0; i < gridSize && idx < instanceCount; i++) {
                for (let j = 0; j < gridSize && idx < instanceCount; j++) {
                        const x = (i - gridSize / 2 + 0.5) * spacing;
                        const z = (j - gridSize / 2 + 0.5) * spacing;
                        const baseIndex = positions.length / 3;
                        
                        // Simple cross for each instance
                        positions.push(
                                x - s, 0, z, x + s, 0, z,
                                x, -s, z, x, s, z,
                                x, 0, z - s, x, 0, z + s
                        );
                        indices.push(
                                baseIndex, baseIndex + 1,
                                baseIndex + 2, baseIndex + 3,
                                baseIndex + 4, baseIndex + 5
                        );
                        idx++;
                }
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create CanvasLayer visualization */
export function createCanvasLayerGeometry(
        size: number = 1.5
): { positions: Float32Array; indices: Uint16Array } {
        const s = size;
        const positions = new Float32Array([
                // Rectangle frame
                -s, -s, 0, s, -s, 0, s, s, 0, -s, s, 0,
                // Layer indicator (stack effect)
                -s * 0.9, -s * 0.9, 0.05, s * 0.9, -s * 0.9, 0.05,
                s * 0.9, s * 0.9, 0.05, -s * 0.9, s * 0.9, 0.05,
        ]);
        const indices = new Uint16Array([
                0, 1, 1, 2, 2, 3, 3, 0,
                4, 5, 5, 6, 6, 7, 7, 4,
        ]);
        return { positions, indices };
}

/** Create Path2D visualization */
export function createPath2DGeometry(
        points: number = 5,
        length: number = 2
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Simple curved path in XY plane
        for (let i = 0; i <= points; i++) {
                const t = i / points;
                const x = -length / 2 + t * length;
                const y = Math.sin(t * Math.PI) * 0.5;
                positions.push(x, y, 0);
        }
        
        for (let i = 0; i < points; i++) {
                indices.push(i, i + 1);
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create NavigationRegion2D visualization */
export function createNavRegion2DGeometry(
        size: [number, number] = [1.5, 1.5],
        cellSize: number = 0.3
): { positions: Float32Array; indices: Uint16Array } {
        const [sx, sy] = size;
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Grid in XY plane
        const nx = Math.ceil(sx / cellSize);
        const ny = Math.ceil(sy / cellSize);
        
        for (let i = 0; i <= nx; i++) {
                const baseIndex = positions.length / 3;
                const x = -sx/2 + i * cellSize;
                positions.push(x, -sy/2, 0, x, sy/2, 0);
                indices.push(baseIndex, baseIndex + 1);
        }
        
        for (let j = 0; j <= ny; j++) {
                const baseIndex = positions.length / 3;
                const y = -sy/2 + j * cellSize;
                positions.push(-sx/2, y, 0, sx/2, y, 0);
                indices.push(baseIndex, baseIndex + 1);
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

// ============================================================================
// 2D PHYSICS GIZMOS
// ============================================================================

/** Create CharacterBody2D visualization - capsule in XY plane */
export function createCharacterBody2DGeometry(
        radius: number = 0.25,
        height: number = 0.8
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        const halfHeight = height / 2 - radius;
        
        // Top semicircle
        const segments = 12;
        for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI - Math.PI / 2;
                positions.push(
                        Math.cos(angle) * radius,
                        Math.sin(angle) * radius + halfHeight,
                        0
                );
        }
        for (let i = 0; i < segments; i++) {
                indices.push(i, i + 1);
        }
        
        // Sides
        const topBase = positions.length / 3;
        positions.push(-radius, halfHeight, 0, radius, halfHeight, 0);
        const botBase = positions.length / 3;
        positions.push(-radius, -halfHeight, 0, radius, -halfHeight, 0);
        indices.push(topBase, topBase + 1, botBase, botBase + 1);
        indices.push(topBase, botBase, topBase + 1, botBase + 1);
        
        // Bottom semicircle
        const botSemiBase = positions.length / 3;
        for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI + Math.PI / 2;
                positions.push(
                        Math.cos(angle) * radius,
                        Math.sin(angle) * radius - halfHeight,
                        0
                );
        }
        for (let i = 0; i < segments; i++) {
                indices.push(botSemiBase + i, botSemiBase + i + 1);
        }
        
        // Up arrow indicator
        const arrowBase = positions.length / 3;
        positions.push(0, halfHeight + radius + 0.1, 0, 0, halfHeight + radius + 0.3, 0);
        positions.push(-0.08, halfHeight + radius + 0.22, 0, 0.08, halfHeight + radius + 0.22, 0);
        indices.push(arrowBase, arrowBase + 1, arrowBase + 2, arrowBase + 3);
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create RigidBody2D visualization - box with rotation indicator */
export function createRigidBody2DGeometry(
        size: number = 0.5
): { positions: Float32Array; indices: Uint16Array } {
        const s = size;
        const positions = new Float32Array([
                // Box outline
                -s, -s, 0, s, -s, 0, s, s, 0, -s, s, 0,
                // Rotation indicator (arc)
                0, 0, 0,
                0.4, 0.2, 0,
                0.3, 0.35, 0,
                // Center cross
                -s * 0.3, 0, 0, s * 0.3, 0,
                0, -s * 0.3, 0, 0, s * 0.3, 0,
        ]);
        const indices = new Uint16Array([
                0, 1, 1, 2, 2, 3, 3, 0,  // Box
                4, 5, 5, 6,  // Arc
                7, 8, 9, 10,  // Cross
        ]);
        return { positions, indices };
}

/** Create StaticBody2D visualization - solid box with grid */
export function createStaticBody2DGeometry(
        size: number = 0.5
): { positions: Float32Array; indices: Uint16Array } {
        const s = size;
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Outer box (thicker appearance)
        positions.push(-s, -s, 0, s, -s, 0, s, s, 0, -s, s, 0);
        indices.push(0, 1, 1, 2, 2, 3, 3, 0);
        
        // Inner grid (cross hatch pattern)
        const gridCount = 3;
        for (let i = 1; i < gridCount; i++) {
                const t = (i / gridCount) * 2 - 1;
                const baseIndex = positions.length / 3;
                positions.push(t * s, -s, 0, t * s, s, 0);
                indices.push(baseIndex, baseIndex + 1);
                
                const baseIndex2 = positions.length / 3;
                positions.push(-s, t * s, 0, s, t * s, 0);
                indices.push(baseIndex2, baseIndex2 + 1);
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create RayCast2D visualization - ray in XY plane */
export function createRayCast2DGeometry(
        length: number = 2
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Origin marker (cross)
        const o = 0.1;
        positions.push(-o, 0, 0, o, 0, 0, 0, -o, 0, 0, o, 0);
        indices.push(0, 1, 2, 3);
        
        // Main ray line
        const rayBase = positions.length / 3;
        positions.push(0, 0, 0, length, 0, 0);
        indices.push(rayBase, rayBase + 1);
        
        // Arrow head
        const a = 0.15;
        const arrowBase = positions.length / 3;
        positions.push(length - a, a, 0, length, 0, 0, length - a, -a, 0, length, 0, 0);
        indices.push(arrowBase, arrowBase + 1, arrowBase + 2, arrowBase + 3);
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

// ============================================================================
// 2D NAVIGATION GIZMOS
// ============================================================================

/** Create NavigationAgent2D visualization - circle with direction arrow */
export function createNavigationAgent2DGeometry(
        radius: number = 0.25
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Circle
        const segments = 16;
        for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        }
        for (let i = 0; i < segments; i++) {
                indices.push(i, i + 1);
        }
        
        // Direction arrow
        const arrowBase = positions.length / 3;
        positions.push(0, 0, 0, 0, radius * 1.5, 0);
        positions.push(-radius * 0.4, radius * 1.0, 0, radius * 0.4, radius * 1.0, 0);
        indices.push(arrowBase, arrowBase + 1, arrowBase + 2, arrowBase + 1, arrowBase + 3, arrowBase + 1);
        
        // Target dot (represents target_position)
        const dotBase = positions.length / 3;
        for (let i = 0; i <= 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                positions.push(Math.cos(angle) * 0.05 + radius, Math.sin(angle) * 0.05, 0);
        }
        for (let i = 0; i < 8; i++) {
                indices.push(dotBase + i, dotBase + i + 1);
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create NavigationObstacle2D visualization - cylinder-like obstacle */
export function createNavigationObstacle2DGeometry(
        radius: number = 0.3
): { positions: Float32Array; indices: Uint16Array } {
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Outer circle
        const segments = 16;
        for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        }
        for (let i = 0; i < segments; i++) {
                indices.push(i, i + 1);
        }
        
        // Inner X pattern (shows it's an obstacle)
        const xSize = radius * 0.6;
        const xBase = positions.length / 3;
        positions.push(-xSize, -xSize, 0, xSize, xSize, 0);
        positions.push(xSize, -xSize, 0, -xSize, xSize, 0);
        indices.push(xBase, xBase + 1, xBase + 2, xBase + 3);
        
        // Warning dashes around edge
        const dashCount = 4;
        for (let i = 0; i < dashCount; i++) {
                const angle = (i / dashCount) * Math.PI * 2;
                const innerR = radius * 1.1;
                const outerR = radius * 1.25;
                const baseIndex = positions.length / 3;
                positions.push(
                        Math.cos(angle) * innerR, Math.sin(angle) * innerR, 0,
                        Math.cos(angle) * outerR, Math.sin(angle) * outerR, 0
                );
                indices.push(baseIndex, baseIndex + 1);
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create PathFollow2D visualization - marker on path */
export function createPathFollow2DGeometry(
        size: number = 0.25
): { positions: Float32Array; indices: Uint16Array } {
        const s = size;
        const positions = new Float32Array([
                // Diamond shape
                0, -s, 0, s, 0, 0, 0, s, 0, -s, 0, 0,
                // Up direction indicator
                0, s, 0, 0, s * 1.8, 0,
                // Arrow head
                -s * 0.3, s * 1.4, 0, 0, s * 1.8, 0, s * 0.3, s * 1.4, 0, 0, s * 1.8, 0,
        ]);
        const indices = new Uint16Array([
                0, 1, 1, 2, 2, 3, 3, 0,  // Diamond
                4, 5,  // Direction
                6, 7, 8, 9,  // Arrow
        ]);
        return { positions, indices };
}

// ============================================================================
// VIEWPORT GIZMOS
// ============================================================================

/** Create Viewport visualization - rectangle with camera icon */
export function createViewportGeometry3D(
        width: number = 1.6,
        height: number = 0.9
): { positions: Float32Array; indices: Uint16Array } {
        const w = width / 2;
        const h = height / 2;
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Outer frame
        positions.push(-w, -h, 0, w, -h, 0, w, h, 0, -w, h, 0);
        indices.push(0, 1, 1, 2, 2, 3, 3, 0);
        
        // Camera icon in center
        const camW = 0.15;
        const camH = 0.1;
        const camBase = positions.length / 3;
        positions.push(-camW, -camH, 0, camW, -camH, 0, camW, camH, 0, -camW, camH, 0);
        // Lens
        positions.push(camW, -camH * 0.5, 0, camW + camH * 0.8, 0, 0, camW, camH * 0.5, 0);
        indices.push(
                camBase, camBase + 1, camBase + 1, camBase + 2, camBase + 2, camBase + 3, camBase + 3, camBase,
                camBase + 4, camBase + 5, camBase + 5, camBase + 6
        );
        
        // Corner brackets (shows it's a viewport)
        const bracketSize = 0.1;
        const corners: [number, number][] = [[-w, -h], [w, -h], [w, h], [-w, h]];
        for (const [cx, cy] of corners) {
                const baseIndex = positions.length / 3;
                const dx = cx > 0 ? -bracketSize : bracketSize;
                const dy = cy > 0 ? -bracketSize : bracketSize;
                positions.push(cx, cy, 0, cx + dx, cy, 0, cx, cy, 0, cx, cy + dy, 0);
                indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 3);
        }
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

/** Create SubViewport visualization - nested rectangle */
export function createSubViewportGeometry(
        width: number = 1.2,
        height: number = 0.7
): { positions: Float32Array; indices: Uint16Array } {
        const w = width / 2;
        const h = height / 2;
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Outer frame
        positions.push(-w, -h, 0, w, -h, 0, w, h, 0, -w, h, 0);
        indices.push(0, 1, 1, 2, 2, 3, 3, 0);
        
        // Inner frame (nested effect)
        const innerScale = 0.8;
        const innerBase = positions.length / 3;
        positions.push(-w * innerScale, -h * innerScale, 0, w * innerScale, -h * innerScale, 0, 
                       w * innerScale, h * innerScale, 0, -w * innerScale, h * innerScale, 0);
        indices.push(innerBase, innerBase + 1, innerBase + 1, innerBase + 2, 
                     innerBase + 2, innerBase + 3, innerBase + 3, innerBase);
        
        // Link icon (chain) in corner
        const linkBase = positions.length / 3;
        const lx = w * 0.6;
        const ly = -h * 0.6;
        positions.push(lx, ly, 0, lx + 0.1, ly + 0.05, 0);
        positions.push(lx + 0.1, ly, 0, lx + 0.1, ly + 0.1, 0);
        indices.push(linkBase, linkBase + 1, linkBase + 2, linkBase + 3);
        
        return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

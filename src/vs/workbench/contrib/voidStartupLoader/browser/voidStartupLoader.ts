/*---------------------------------------------------------------------------------------------
 *  Void Engine IDE - Startup Loader
 *  3D rotating cube with shader loading simulation
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import * as dom from '../../../../base/browser/dom.js';

export class VoidStartupLoader extends Disposable {
	
	private container: HTMLElement | undefined;
	private canvas: HTMLCanvasElement | undefined;
	private ctx: CanvasRenderingContext2D | undefined;
	private animationFrame: number | undefined;
	private rotation = 0;
	private loadingProgress = 0;
	private loadingStage = 0;
	private loadingStages = [
		'Initializing Engine...',
		'Loading Shaders...',
		'Compiling Materials...',
		'Setting up Renderer...',
		'Loading Assets...',
		'Finalizing...'
	];

	constructor() {
		super();
	}

	show(parent: HTMLElement): void {
		console.log('[Void Startup] Showing loader...');
		
		// Create overlay
		this.container = dom.append(parent, dom.$('.void-startup-loader'));
		
		// Create content box
		const contentBox = dom.append(this.container, dom.$('.void-loader-box'));
		
		// Create canvas for 3D cube
		this.canvas = document.createElement('canvas');
		this.canvas.width = 200;
		this.canvas.height = 200;
		this.canvas.className = 'void-loader-canvas';
		contentBox.appendChild(this.canvas);
		
		this.ctx = this.canvas.getContext('2d')!;
		
		// Loading text
		const loadingText = dom.append(contentBox, dom.$('.void-loader-text'));
		loadingText.textContent = this.loadingStages[0];
		
		// Progress bar container
		const progressContainer = dom.append(contentBox, dom.$('.void-loader-progress-container'));
		const progressBar = dom.append(progressContainer, dom.$('.void-loader-progress-bar'));
		const progressFill = dom.append(progressBar, dom.$('.void-loader-progress-fill'));
		
		// Start animation
		this.animate(loadingText, progressFill);
		
		// Simulate loading stages
		this.simulateLoading();
	}

	private animate(loadingText: HTMLElement, progressFill: HTMLElement): void {
		if (!this.ctx || !this.canvas) return;
		
		const animate = () => {
			if (!this.ctx || !this.canvas || !this.container) return;
			
			// Clear canvas
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			
			// Draw rotating cube
			this.drawCube();
			
			// Update rotation
			this.rotation += 0.02;
			
			// Update progress
			progressFill.style.width = `${this.loadingProgress}%`;
			
			// Update loading text
			loadingText.textContent = this.loadingStages[this.loadingStage];
			
			this.animationFrame = requestAnimationFrame(animate);
		};
		
		animate();
	}

	private drawCube(): void {
		if (!this.ctx || !this.canvas) return;
		
		const ctx = this.ctx;
		const centerX = this.canvas.width / 2;
		const centerY = this.canvas.height / 2;
		const size = 60;
		
		// 3D cube vertices
		const vertices = [
			[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], // Front face
			[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]      // Back face
		];
		
		// Rotate vertices
		const rotated = vertices.map(v => {
			const [x, y, z] = v;
			
			// Rotate around Y axis
			const cosY = Math.cos(this.rotation);
			const sinY = Math.sin(this.rotation);
			const x1 = x * cosY - z * sinY;
			const z1 = x * sinY + z * cosY;
			
			// Rotate around X axis
			const cosX = Math.cos(this.rotation * 0.7);
			const sinX = Math.sin(this.rotation * 0.7);
			const y1 = y * cosX - z1 * sinX;
			const z2 = y * sinX + z1 * cosX;
			
			return [x1, y1, z2];
		});
		
		// Project to 2D
		const projected = rotated.map(v => {
			const scale = 200 / (200 + v[2] * 50);
			return [
				centerX + v[0] * size * scale,
				centerY + v[1] * size * scale,
				v[2]
			];
		});
		
		// Draw faces (back to front)
		const faces = [
			[4, 5, 6, 7], // Back
			[0, 1, 5, 4], // Bottom
			[2, 3, 7, 6], // Top
			[0, 3, 7, 4], // Left
			[1, 2, 6, 5], // Right
			[0, 1, 2, 3]  // Front
		];
		
		// Calculate face depths for sorting
		const faceDepths = faces.map(face => {
			const avgZ = face.reduce((sum, i) => sum + projected[i][2], 0) / face.length;
			return { face, depth: avgZ };
		});
		
		// Sort faces by depth (back to front)
		faceDepths.sort((a, b) => a.depth - b.depth);
		
		// Draw faces
		faceDepths.forEach(({ face }, index) => {
			ctx.beginPath();
			ctx.moveTo(projected[face[0]][0], projected[face[0]][1]);
			for (let i = 1; i < face.length; i++) {
				ctx.lineTo(projected[face[i]][0], projected[face[i]][1]);
			}
			ctx.closePath();
			
			// Color based on depth
			const brightness = 100 + index * 20;
			ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
			ctx.fill();
			
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 2;
			ctx.stroke();
		});
	}

	private simulateLoading(): void {
		// Simulate loading progress
		const interval = setInterval(() => {
			if (!this.container) {
				clearInterval(interval);
				return;
			}
			
			this.loadingProgress += Math.random() * 3 + 1;
			
			if (this.loadingProgress >= 100) {
				this.loadingProgress = 100;
				clearInterval(interval);
				// Will be hidden when workbench is ready
			} else if (this.loadingProgress > (this.loadingStage + 1) * 16.66) {
				this.loadingStage = Math.min(this.loadingStage + 1, this.loadingStages.length - 1);
			}
		}, 100);
	}

	hide(): void {
		console.log('[Void Startup] Hiding loader...');
		
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
			this.animationFrame = undefined;
		}
		
		if (this.container && this.container.parentElement) {
			// Fade out
			this.container.style.opacity = '0';
			setTimeout(() => {
				if (this.container && this.container.parentElement) {
					this.container.parentElement.removeChild(this.container);
				}
				this.container = undefined;
			}, 300);
		}
	}

	override dispose(): void {
		this.hide();
		super.dispose();
	}
}

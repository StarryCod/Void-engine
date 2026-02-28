/*---------------------------------------------------------------------------------------------
 *  Void Engine — Inspector Panel (Godot-style)
 *  Right panel for editing properties of selected nodes
 *  Design: Godot 4.x style with orange accents, collapsible sections
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import * as DOM from '../../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Entity, Component } from '../../common/vecnTypes.js';

// ============================================================================
// DESIGN SYSTEM COLORS
// ============================================================================

const COLORS = {
	// Panel background
	panelBg: '#1e1e1e',
	panelBgLighter: '#252526',
	panelBgHover: '#2a2d2e',
	panelBgInput: '#3c3c3c',
	
	// Text
	textPrimary: '#cccccc',
	textSecondary: '#858585',
	textDisabled: '#5a5a5a',
	textValue: '#e0e0e0',
	
	// Accents (Orange AI-IDE style)
	accent: '#E67E22',
	accentHover: '#F39C12',
	
	// Types
	number: '#B5CEA8',      // Green for numbers
	string: '#CE9178',     // Orange for strings
	boolean: '#569CD6',    // Blue for booleans
	vector: '#DCDCAA',     // Yellow for vectors
	color: '#CE4B4B',      // Red for colors
	
	// Section header
	sectionHeader: '#2d2d2d',
	sectionBorder: '#3c3c3c'
};

// ============================================================================
// PROPERTY EDITOR INTERFACES
// ============================================================================

interface PropertyEditor {
	label: string;
	key: string;
	type: 'number' | 'string' | 'boolean' | 'vector2' | 'vector3' | 'vector4' | 'color' | 'enum' | 'resource';
	value: unknown;
	onChange: (value: unknown) => void;
	options?: string[]; // For enum type
	min?: number;
	max?: number;
	step?: number;
}

// ============================================================================
// INSPECTOR PANEL
// ============================================================================

export class InspectorPanel extends Disposable {
	private container: HTMLElement;
	private header: HTMLElement;
	private tabsContainer: HTMLElement;
	private contentContainer: HTMLElement;
	private sectionsContainer: HTMLElement;
	private selectedEntity: Entity | null = null;
	private currentTab: 'node' | 'history' = 'node';
	
	// Events
	private readonly _onPropertyChanged = new Emitter<{ key: string; value: unknown }>();
	readonly onPropertyChanged: Event<{ key: string; value: unknown }> = this._onPropertyChanged.event;
	
	constructor(parent: HTMLElement) {
		super();
		
		// Main container
		this.container = document.createElement('div');
		this.container.className = 'void-inspector-panel';
		this.container.style.cssText = `
			display: flex;
			flex-direction: column;
			width: 100%;
			height: 100%;
			background: ${COLORS.panelBg};
			color: ${COLORS.textPrimary};
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			font-size: 12px;
			overflow: hidden;
		`;
		
		// Header
		this.header = document.createElement('div');
		this.header.style.cssText = `
			display: flex;
			flex-direction: column;
			background: ${COLORS.panelBgLighter};
			border-bottom: 1px solid #3c3c3c;
		`;
		
		// Title
		const titleEl = document.createElement('div');
		titleEl.style.cssText = `
			display: flex;
			align-items: center;
			padding: 8px 10px;
			font-weight: 500;
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: ${COLORS.textSecondary};
		`;
		titleEl.textContent = 'Инспектор';
		this.header.appendChild(titleEl);
		
		// Tabs
		this.tabsContainer = document.createElement('div');
		this.tabsContainer.style.cssText = `
			display: flex;
			border-bottom: 1px solid ${COLORS.sectionBorder};
		`;
		
		this.createTabs();
		this.header.appendChild(this.tabsContainer);
		
		this.container.appendChild(this.header);
		
		// Content container
		this.contentContainer = document.createElement('div');
		this.contentContainer.style.cssText = `
			flex: 1;
			overflow-y: auto;
			overflow-x: hidden;
		`;
		
		// Sections container
		this.sectionsContainer = document.createElement('div');
		this.sectionsContainer.style.cssText = `
			display: flex;
			flex-direction: column;
		`;
		this.contentContainer.appendChild(this.sectionsContainer);
		
		this.container.appendChild(this.contentContainer);
		
		DOM.append(parent, this.container);
		
		// Show placeholder
		this.showPlaceholder();
	}
	
	private createTabs(): void {
		const tabs = [
			{ id: 'node' as const, label: 'Узел' },
			{ id: 'history' as const, label: 'История' }
		];
		
		for (const tab of tabs) {
			const tabEl = document.createElement('div');
			tabEl.className = 'void-inspector-tab';
			tabEl.dataset.tab = tab.id;
			tabEl.style.cssText = `
				flex: 1;
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 6px 12px;
				cursor: pointer;
				color: ${this.currentTab === tab.id ? COLORS.accent : COLORS.textSecondary};
				border-bottom: 2px solid ${this.currentTab === tab.id ? COLORS.accent : 'transparent'};
				transition: all 0.15s;
				font-size: 11px;
			`;
			
			tabEl.textContent = tab.label;
			
			tabEl.addEventListener('click', () => {
				this.switchTab(tab.id);
			});
			
			tabEl.addEventListener('mouseenter', () => {
				if (this.currentTab !== tab.id) {
					tabEl.style.color = COLORS.textPrimary;
				}
			});
			tabEl.addEventListener('mouseleave', () => {
				if (this.currentTab !== tab.id) {
					tabEl.style.color = COLORS.textSecondary;
				}
			});
			
			this.tabsContainer.appendChild(tabEl);
		}
	}
	
	private switchTab(tab: 'node' | 'history'): void {
		this.currentTab = tab;
		
		// Update tab styles
		const tabs = this.tabsContainer.querySelectorAll('.void-inspector-tab');
		tabs.forEach(el => {
			const tabId = (el as HTMLElement).dataset.tab as 'node' | 'history';
			(el as HTMLElement).style.color = tabId === tab ? COLORS.accent : COLORS.textSecondary;
			(el as HTMLElement).style.borderBottomColor = tabId === tab ? COLORS.accent : 'transparent';
		});
		
		// Re-render
		if (this.selectedEntity) {
			this.renderEntity(this.selectedEntity);
		}
	}
	
	private showPlaceholder(): void {
		this.sectionsContainer.innerHTML = '';
		
		const placeholder = document.createElement('div');
		placeholder.style.cssText = `
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 40px 20px;
			color: ${COLORS.textSecondary};
			text-align: center;
		`;
		placeholder.innerHTML = `
			<div style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;">🔍</div>
			<div style="margin-bottom: 8px;">Выберите узел</div>
			<div style="font-size: 11px; color: ${COLORS.textDisabled};">Выберите узел для редактирования его свойств</div>
		`;
		this.sectionsContainer.appendChild(placeholder);
	}
	
	public setEntity(entity: Entity | null): void {
		this.selectedEntity = entity;
		if (entity) {
			this.renderEntity(entity);
		} else {
			this.showPlaceholder();
		}
	}
	
	private renderEntity(entity: Entity): void {
		this.sectionsContainer.innerHTML = '';
		
		if (this.currentTab === 'history') {
			this.renderHistoryTab();
			return;
		}
		
		// Node section
		this.renderNodeSection(entity);
		
		// Component sections
		for (const component of entity.components) {
			this.renderComponentSection(component);
		}
	}
	
	private renderNodeSection(entity: Entity): void {
		const section = this.createSection('Узел', entity.name);
		
		// Name property
		this.addPropertyRow(section.content, {
			label: 'Имя',
			key: 'name',
			type: 'string',
			value: entity.name,
			onChange: (value) => {
				if (typeof value === 'string') {
					entity.name = value;
					this._onPropertyChanged.fire({ key: 'name', value });
				}
			}
		});
		
		// Visible property
		this.addPropertyRow(section.content, {
			label: 'Видимый',
			key: 'visible',
			type: 'boolean',
			value: entity.visible,
			onChange: (value) => {
				if (typeof value === 'boolean') {
					entity.visible = value;
					this._onPropertyChanged.fire({ key: 'visible', value });
				}
			}
		});
		
		this.sectionsContainer.appendChild(section.container);
	}
	
	private renderComponentSection(component: Component): void {
		const sectionTitle = this.getComponentTitle(component);
		const section = this.createSection(sectionTitle, null, this.getComponentIcon(component));
		
		// Render properties based on component type
		switch (component.type) {
			case 'Transform':
				this.renderTransformProperties(section.content, component);
				break;
			case 'Transform2D':
				this.renderTransform2DProperties(section.content, component);
				break;
			case 'Sprite2D':
				this.renderSprite2DProperties(section.content, component);
				break;
			case 'CollisionShape2D':
				this.renderCollisionShape2DProperties(section.content, component);
				break;
			case 'RigidBody2D':
				this.renderRigidBody2DProperties(section.content, component);
				break;
			case 'CharacterBody2D':
				this.renderCharacterBody2DProperties(section.content, component);
				break;
			default:
				this.renderGenericProperties(section.content, component);
		}
		
		this.sectionsContainer.appendChild(section.container);
	}
	
	private createSection(title: string, subtitle?: string | null, icon?: string): { container: HTMLElement; content: HTMLElement } {
		const container = document.createElement('div');
		container.className = 'void-inspector-section';
		container.style.cssText = `
			border-bottom: 1px solid ${COLORS.sectionBorder};
		`;
		
		// Header
		const header = document.createElement('div');
		header.style.cssText = `
			display: flex;
			align-items: center;
			padding: 8px 10px;
			background: ${COLORS.sectionHeader};
			cursor: pointer;
			user-select: none;
		`;
		
		// Expand icon
		const expandIcon = document.createElement('div');
		expandIcon.style.cssText = `
			width: 16px;
			height: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
			color: ${COLORS.textSecondary};
			font-size: 10px;
			transform: rotate(90deg);
			transition: transform 0.15s;
		`;
		expandIcon.textContent = '▶';
		header.appendChild(expandIcon);
		
		// Type icon
		if (icon) {
			const typeIcon = document.createElement('div');
			typeIcon.style.cssText = `
				width: 16px;
				height: 16px;
				margin-right: 6px;
				display: flex;
				align-items: center;
				justify-content: center;
			`;
			typeIcon.innerHTML = icon;
			header.appendChild(typeIcon);
		}
		
		// Title
		const titleEl = document.createElement('div');
		titleEl.style.cssText = `
			flex: 1;
			font-weight: 500;
			font-size: 11px;
		`;
		titleEl.textContent = title;
		header.appendChild(titleEl);
		
		// Subtitle
		if (subtitle) {
			const subtitleEl = document.createElement('div');
			subtitleEl.style.cssText = `
				color: ${COLORS.textSecondary};
				font-size: 10px;
				margin-left: 8px;
			`;
			subtitleEl.textContent = subtitle;
			header.appendChild(subtitleEl);
		}
		
		container.appendChild(header);
		
		// Content
		const content = document.createElement('div');
		content.className = 'void-section-content';
		content.style.cssText = `
			padding: 4px 10px 8px 26px;
		`;
		container.appendChild(content);
		
		// Toggle collapse
		let collapsed = false;
		header.addEventListener('click', () => {
			collapsed = !collapsed;
			content.style.display = collapsed ? 'none' : 'block';
			expandIcon.style.transform = collapsed ? 'rotate(0deg)' : 'rotate(90deg)';
		});
		
		return { container, content };
	}
	
	private addPropertyRow(parent: HTMLElement, property: PropertyEditor): void {
		const row = document.createElement('div');
		row.className = 'void-property-row';
		row.style.cssText = `
			display: flex;
			align-items: center;
			padding: 3px 0;
		`;
		
		// Label
		const labelEl = document.createElement('div');
		labelEl.style.cssText = `
			width: 80px;
			min-width: 80px;
			color: ${COLORS.textSecondary};
			font-size: 11px;
			padding-right: 8px;
		`;
		labelEl.textContent = property.label;
		row.appendChild(labelEl);
		
		// Editor
		const editorEl = this.createPropertyEditor(property);
		row.appendChild(editorEl);
		
		parent.appendChild(row);
	}
	
	private createPropertyEditor(property: PropertyEditor): HTMLElement {
		const container = document.createElement('div');
		container.style.cssText = `
			flex: 1;
			display: flex;
			align-items: center;
			gap: 4px;
		`;
		
		switch (property.type) {
			case 'number':
				container.appendChild(this.createNumberInput(property));
				break;
			case 'string':
				container.appendChild(this.createStringInput(property));
				break;
			case 'boolean':
				container.appendChild(this.createCheckbox(property));
				break;
			case 'vector2':
				container.appendChild(this.createVector2Input(property));
				break;
			case 'vector3':
				container.appendChild(this.createVector3Input(property));
				break;
			case 'vector4':
				container.appendChild(this.createVector4Input(property));
				break;
			case 'color':
				container.appendChild(this.createColorInput(property));
				break;
			case 'enum':
				container.appendChild(this.createEnumSelect(property));
				break;
			default:
				const valueEl = document.createElement('div');
				valueEl.style.cssText = `color: ${COLORS.textValue};`;
				valueEl.textContent = String(property.value);
				container.appendChild(valueEl);
		}
		
		return container;
	}
	
	private createNumberInput(property: PropertyEditor): HTMLInputElement {
		const input = document.createElement('input');
		input.type = 'number';
		input.value = String(property.value ?? 0);
		input.style.cssText = `
			flex: 1;
			padding: 3px 6px;
			background: ${COLORS.panelBgInput};
			border: 1px solid #3c3c3c;
			border-radius: 2px;
			color: ${COLORS.number};
			font-size: 11px;
			outline: none;
			min-width: 0;
		`;
		
		if (property.min !== undefined) input.min = String(property.min);
		if (property.max !== undefined) input.max = String(property.max);
		if (property.step !== undefined) input.step = String(property.step);
		
		input.addEventListener('focus', () => {
			input.style.borderColor = COLORS.accent;
		});
		input.addEventListener('blur', () => {
			input.style.borderColor = '#3c3c3c';
		});
		input.addEventListener('change', () => {
			property.onChange(parseFloat(input.value));
		});
		
		return input;
	}
	
	private createStringInput(property: PropertyEditor): HTMLInputElement {
		const input = document.createElement('input');
		input.type = 'text';
		input.value = String(property.value ?? '');
		input.style.cssText = `
			flex: 1;
			padding: 3px 6px;
			background: ${COLORS.panelBgInput};
			border: 1px solid #3c3c3c;
			border-radius: 2px;
			color: ${COLORS.string};
			font-size: 11px;
			outline: none;
			min-width: 0;
		`;
		
		input.addEventListener('focus', () => {
			input.style.borderColor = COLORS.accent;
		});
		input.addEventListener('blur', () => {
			input.style.borderColor = '#3c3c3c';
		});
		input.addEventListener('change', () => {
			property.onChange(input.value);
		});
		
		return input;
	}
	
	private createCheckbox(property: PropertyEditor): HTMLInputElement {
		const input = document.createElement('input');
		input.type = 'checkbox';
		input.checked = Boolean(property.value);
		input.style.cssText = `
			width: 14px;
			height: 14px;
			accent-color: ${COLORS.accent};
		`;
		
		input.addEventListener('change', () => {
			property.onChange(input.checked);
		});
		
		return input;
	}
	
	private createVector2Input(property: PropertyEditor): HTMLElement {
		const container = document.createElement('div');
		container.style.cssText = `
			flex: 1;
			display: flex;
			gap: 4px;
		`;
		
		const value = property.value as [number, number] || [0, 0];
		const labels = ['X', 'Y'];
		
		value.forEach((v, i) => {
			const labelEl = document.createElement('span');
			labelEl.style.cssText = `
				color: ${i === 0 ? '#ff6b6b' : '#69db7c'};
				font-size: 10px;
				line-height: 20px;
			`;
			labelEl.textContent = labels[i];
			container.appendChild(labelEl);
			
			const input = document.createElement('input');
			input.type = 'number';
			input.value = String(v);
			input.style.cssText = `
				flex: 1;
				padding: 3px 4px;
				background: ${COLORS.panelBgInput};
				border: 1px solid #3c3c3c;
				border-radius: 2px;
				color: ${COLORS.number};
				font-size: 11px;
				outline: none;
				min-width: 0;
			`;
			
			input.addEventListener('change', () => {
				const newValue = [...value] as [number, number];
				newValue[i] = parseFloat(input.value);
				property.onChange(newValue);
			});
			
			container.appendChild(input);
		});
		
		return container;
	}
	
	private createVector3Input(property: PropertyEditor): HTMLElement {
		const container = document.createElement('div');
		container.style.cssText = `
			flex: 1;
			display: flex;
			gap: 4px;
		`;
		
		const value = property.value as [number, number, number] || [0, 0, 0];
		const labels = ['X', 'Y', 'Z'];
		const colors = ['#ff6b6b', '#69db7c', '#74c0fc'];
		
		value.forEach((v, i) => {
			const labelEl = document.createElement('span');
			labelEl.style.cssText = `
				color: ${colors[i]};
				font-size: 10px;
				line-height: 20px;
			`;
			labelEl.textContent = labels[i];
			container.appendChild(labelEl);
			
			const input = document.createElement('input');
			input.type = 'number';
			input.value = String(v);
			input.step = '0.1';
			input.style.cssText = `
				flex: 1;
				padding: 3px 4px;
				background: ${COLORS.panelBgInput};
				border: 1px solid #3c3c3c;
				border-radius: 2px;
				color: ${COLORS.number};
				font-size: 11px;
				outline: none;
				min-width: 0;
			`;
			
			input.addEventListener('change', () => {
				const newValue = [...value] as [number, number, number];
				newValue[i] = parseFloat(input.value);
				property.onChange(newValue);
			});
			
			container.appendChild(input);
		});
		
		return container;
	}
	
	private createVector4Input(property: PropertyEditor): HTMLElement {
		const container = document.createElement('div');
		container.style.cssText = `
			flex: 1;
			display: flex;
			gap: 4px;
		`;
		
		const value = property.value as [number, number, number, number] || [0, 0, 0, 1];
		const labels = ['X', 'Y', 'Z', 'W'];
		const colors = ['#ff6b6b', '#69db7c', '#74c0fc', '#da77f2'];
		
		value.forEach((v, i) => {
			const labelEl = document.createElement('span');
			labelEl.style.cssText = `
				color: ${colors[i]};
				font-size: 10px;
				line-height: 20px;
			`;
			labelEl.textContent = labels[i];
			container.appendChild(labelEl);
			
			const input = document.createElement('input');
			input.type = 'number';
			input.value = String(v);
			input.step = '0.1';
			input.style.cssText = `
				flex: 1;
				padding: 3px 4px;
				background: ${COLORS.panelBgInput};
				border: 1px solid #3c3c3c;
				border-radius: 2px;
				color: ${COLORS.number};
				font-size: 11px;
				outline: none;
				min-width: 0;
			`;
			
			input.addEventListener('change', () => {
				const newValue = [...value] as [number, number, number, number];
				newValue[i] = parseFloat(input.value);
				property.onChange(newValue);
			});
			
			container.appendChild(input);
		});
		
		return container;
	}
	
	private createColorInput(property: PropertyEditor): HTMLElement {
		const container = document.createElement('div');
		container.style.cssText = `
			flex: 1;
			display: flex;
			align-items: center;
			gap: 4px;
		`;
		
		const value = property.value as [number, number, number, number] || [1, 1, 1, 1];
		
		// Color preview
		const preview = document.createElement('div');
		preview.style.cssText = `
			width: 24px;
			height: 24px;
			border-radius: 4px;
			border: 1px solid #3c3c3c;
			background: rgba(${value[0] * 255}, ${value[1] * 255}, ${value[2] * 255}, ${value[3]});
			cursor: pointer;
		`;
		container.appendChild(preview);
		
		// RGBA inputs
		value.forEach((v, i) => {
			const input = document.createElement('input');
			input.type = 'number';
			input.value = String(v);
			input.min = '0';
			input.max = '1';
			input.step = '0.01';
			input.style.cssText = `
				flex: 1;
				padding: 3px 4px;
				background: ${COLORS.panelBgInput};
				border: 1px solid #3c3c3c;
				border-radius: 2px;
				color: ${COLORS.color};
				font-size: 10px;
				outline: none;
				min-width: 0;
			`;
			
			input.addEventListener('change', () => {
				const newValue = [...value] as [number, number, number, number];
				newValue[i] = parseFloat(input.value);
				property.onChange(newValue);
				preview.style.background = `rgba(${newValue[0] * 255}, ${newValue[1] * 255}, ${newValue[2] * 255}, ${newValue[3]})`;
			});
			
			container.appendChild(input);
		});
		
		return container;
	}
	
	private createEnumSelect(property: PropertyEditor): HTMLSelectElement {
		const select = document.createElement('select');
		select.style.cssText = `
			flex: 1;
			padding: 4px 6px;
			background: ${COLORS.panelBgInput};
			border: 1px solid #3c3c3c;
			border-radius: 2px;
			color: ${COLORS.textPrimary};
			font-size: 11px;
			outline: none;
		`;
		
		for (const option of property.options || []) {
			const optionEl = document.createElement('option');
			optionEl.value = option;
			optionEl.textContent = option;
			if (option === property.value) {
				optionEl.selected = true;
			}
			select.appendChild(optionEl);
		}
		
		select.addEventListener('change', () => {
			property.onChange(select.value);
		});
		
		return select;
	}
	
	private renderTransformProperties(content: HTMLElement, component: { type: 'Transform'; translation: [number, number, number]; rotation: [number, number, number, number]; scale: [number, number, number] }): void {
		this.addPropertyRow(content, { label: 'Позиция', key: 'translation', type: 'vector3', value: component.translation, onChange: (v) => { component.translation = v as [number, number, number]; } });
		this.addPropertyRow(content, { label: 'Вращение', key: 'rotation', type: 'vector4', value: component.rotation, onChange: (v) => { component.rotation = v as [number, number, number, number]; } });
		this.addPropertyRow(content, { label: 'Масштаб', key: 'scale', type: 'vector3', value: component.scale, onChange: (v) => { component.scale = v as [number, number, number]; } });
	}
	
	private renderTransform2DProperties(content: HTMLElement, component: { type: 'Transform2D'; position: [number, number]; rotation: number; scale: [number, number] }): void {
		this.addPropertyRow(content, { label: 'Позиция', key: 'position', type: 'vector2', value: component.position, onChange: (v) => { component.position = v as [number, number]; } });
		this.addPropertyRow(content, { label: 'Вращение', key: 'rotation', type: 'number', value: component.rotation, onChange: (v) => { component.rotation = v as number; } });
		this.addPropertyRow(content, { label: 'Масштаб', key: 'scale', type: 'vector2', value: component.scale, onChange: (v) => { component.scale = v as [number, number]; } });
	}
	
	private renderSprite2DProperties(content: HTMLElement, component: { type: 'Sprite2D'; texture: string; region_enabled: boolean; region_rect: [number, number, number, number]; offset: [number, number] }): void {
		this.addPropertyRow(content, { label: 'Текстура', key: 'texture', type: 'resource', value: component.texture, onChange: (v) => { component.texture = v as string; } });
		this.addPropertyRow(content, { label: 'Регион', key: 'region_enabled', type: 'boolean', value: component.region_enabled, onChange: (v) => { component.region_enabled = v as boolean; } });
		if (component.region_enabled) {
			this.addPropertyRow(content, { label: 'Rect', key: 'region_rect', type: 'vector4', value: component.region_rect, onChange: (v) => { component.region_rect = v as [number, number, number, number]; } });
		}
		this.addPropertyRow(content, { label: 'Смещение', key: 'offset', type: 'vector2', value: component.offset, onChange: (v) => { component.offset = v as [number, number]; } });
	}
	
	private renderCollisionShape2DProperties(content: HTMLElement, component: { type: 'CollisionShape2D'; shape: { type: string; size?: [number, number]; radius?: number }; disabled: boolean; one_way_collision: boolean }): void {
		this.addPropertyRow(content, { label: 'Форма', key: 'shape_type', type: 'enum', value: component.shape.type, options: ['Rectangle', 'Circle', 'Capsule'], onChange: (v) => { component.shape.type = v as string; } });
		
		if (component.shape.type === 'Rectangle' && component.shape.size) {
			this.addPropertyRow(content, { label: 'Размер', key: 'size', type: 'vector2', value: component.shape.size, onChange: (v) => { component.shape.size = v as [number, number]; } });
		} else if (component.shape.type === 'Circle' && component.shape.radius !== undefined) {
			this.addPropertyRow(content, { label: 'Радиус', key: 'radius', type: 'number', value: component.shape.radius, min: 0, onChange: (v) => { component.shape.radius = v as number; } });
		}
		
		this.addPropertyRow(content, { label: 'Отключен', key: 'disabled', type: 'boolean', value: component.disabled, onChange: (v) => { component.disabled = v as boolean; } });
		this.addPropertyRow(content, { label: 'Односторонний', key: 'one_way_collision', type: 'boolean', value: component.one_way_collision, onChange: (v) => { component.one_way_collision = v as boolean; } });
	}
	
	private renderRigidBody2DProperties(content: HTMLElement, component: { type: 'RigidBody2D'; mass: number; gravity_scale: number; linear_damp: number; angular_damp: number; lock_rotation: boolean }): void {
		this.addPropertyRow(content, { label: 'Масса', key: 'mass', type: 'number', value: component.mass, min: 0, onChange: (v) => { component.mass = v as number; } });
		this.addPropertyRow(content, { label: 'Гравитация', key: 'gravity_scale', type: 'number', value: component.gravity_scale, onChange: (v) => { component.gravity_scale = v as number; } });
		this.addPropertyRow(content, { label: 'Лин. затух.', key: 'linear_damp', type: 'number', value: component.linear_damp, min: 0, onChange: (v) => { component.linear_damp = v as number; } });
		this.addPropertyRow(content, { label: 'Угл. затух.', key: 'angular_damp', type: 'number', value: component.angular_damp, min: 0, onChange: (v) => { component.angular_damp = v as number; } });
		this.addPropertyRow(content, { label: 'Блок. вращ.', key: 'lock_rotation', type: 'boolean', value: component.lock_rotation, onChange: (v) => { component.lock_rotation = v as boolean; } });
	}
	
	private renderCharacterBody2DProperties(content: HTMLElement, component: { type: 'CharacterBody2D'; motion_mode: string; up_direction: [number, number]; velocity: [number, number]; max_slides: number; floor_stop_on_slope: boolean }): void {
		this.addPropertyRow(content, { label: 'Режим', key: 'motion_mode', type: 'enum', value: component.motion_mode, options: ['Grounded', 'Floating'], onChange: (v) => { component.motion_mode = v as string; } });
		this.addPropertyRow(content, { label: 'Направление', key: 'up_direction', type: 'vector2', value: component.up_direction, onChange: (v) => { component.up_direction = v as [number, number]; } });
		this.addPropertyRow(content, { label: 'Скорость', key: 'velocity', type: 'vector2', value: component.velocity, onChange: (v) => { component.velocity = v as [number, number]; } });
		this.addPropertyRow(content, { label: 'Макс. слайды', key: 'max_slides', type: 'number', value: component.max_slides, min: 1, onChange: (v) => { component.max_slides = v as number; } });
		this.addPropertyRow(content, { label: 'Стоп на склоне', key: 'floor_stop_on_slope', type: 'boolean', value: component.floor_stop_on_slope, onChange: (v) => { component.floor_stop_on_slope = v as boolean; } });
	}
	
	private renderGenericProperties(content: HTMLElement, component: Component): void {
		const componentData = component as unknown as Record<string, unknown>;
		for (const [key, value] of Object.entries(componentData)) {
			if (key === 'type') continue;
			
			let type: PropertyEditor['type'] = 'string';
			if (typeof value === 'number') type = 'number';
			else if (typeof value === 'boolean') type = 'boolean';
			else if (Array.isArray(value)) {
				if (value.length === 2) type = 'vector2';
				else if (value.length === 3) type = 'vector3';
				else if (value.length === 4) type = 'vector4';
			}
			
			this.addPropertyRow(content, {
				label: key,
				key,
				type,
				value,
				onChange: (v) => { componentData[key] = v; }
			});
		}
	}
	
	private renderHistoryTab(): void {
		this.sectionsContainer.innerHTML = '';
		
		const placeholder = document.createElement('div');
		placeholder.style.cssText = `
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 40px 20px;
			color: ${COLORS.textSecondary};
			text-align: center;
		`;
		placeholder.innerHTML = `
			<div style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;">📋</div>
			<div style="margin-bottom: 8px;">История изменений</div>
			<div style="font-size: 11px; color: ${COLORS.textDisabled};">Здесь будет отображаться история изменений узла</div>
		`;
		this.sectionsContainer.appendChild(placeholder);
	}
	
	private getComponentTitle(component: Component): string {
		const titles: Record<string, string> = {
			Transform: 'Transform',
			Transform2D: 'Transform2D',
			Sprite2D: 'Sprite2D',
			AnimatedSprite2D: 'AnimatedSprite2D',
			CollisionShape2D: 'CollisionShape2D',
			RigidBody2D: 'RigidBody2D',
			CharacterBody2D: 'CharacterBody2D',
			StaticBody2D: 'StaticBody2D',
			Area2D: 'Area2D',
			Camera: 'Camera',
			PointLight: 'PointLight',
			DirectionalLight: 'DirectionalLight',
			AudioStreamPlayer: 'AudioStreamPlayer',
			AnimationPlayer: 'AnimationPlayer'
		};
		return titles[component.type] || component.type;
	}
	
	private getComponentIcon(component: Component): string {
		const colors: Record<string, string> = {
			Transform: '#69db7c',
			Transform2D: '#69db7c',
			Sprite2D: '#8EE486',
			CollisionShape2D: '#5FBF5F',
			RigidBody2D: '#7E9FC9',
			CharacterBody2D: '#6B9BD1',
			Camera: '#85C1E9',
			PointLight: '#F4D03F'
		};
		const color = colors[component.type] || '#808080';
		return `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="${color}"/></svg>`;
	}
	
	override dispose(): void {
		this._onPropertyChanged.dispose();
		super.dispose();
	}
}

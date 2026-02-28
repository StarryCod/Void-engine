/*---------------------------------------------------------------------------------------------
 *  Void AI - Hardcoded Dark Theme
 *  This file overrides default VS Code colors for Void AI branding
 *  Pure black/white/gray color scheme - NO blue, NO purple
 *--------------------------------------------------------------------------------------------*/

import { Color } from '../../base/common/color.js';

// Void AI Color Palette
export const VOID_COLORS = {
	// Backgrounds (darkest to lightest)
	bg_darkest: '#000000',      // Pure black
	bg_darker: '#0a0a0a',       // Near black
	bg_dark: '#121212',         // Main editor background
	bg_medium: '#1a1a1a',       // Sidebar, panels
	bg_light: '#252525',        // Hover states, selections
	bg_lighter: '#2a2a2a',      // Active elements
	bg_lightest: '#333333',     // Borders, separators

	// Foregrounds
	fg_primary: '#ffffff',      // Primary text
	fg_secondary: '#cccccc',    // Secondary text
	fg_muted: '#808080',        // Muted/disabled text
	fg_dim: '#666666',          // Very dim text

	// Borders
	border_subtle: '#2a2a2a',   // Subtle borders
	border_medium: '#3a3a3a',   // Medium borders
	border_strong: '#4a4a4a',   // Strong borders

	// Accents (white-based, no colors)
	accent_primary: '#ffffff',  // Primary accent (white)
	accent_hover: '#e0e0e0',    // Hover accent
	accent_active: '#cccccc',   // Active accent

	// Status (grayscale versions)
	error: '#ff6b6b',           // Error (soft red, only exception)
	warning: '#ffd93d',         // Warning (soft yellow, only exception)
	success: '#6bcf6b',         // Success (soft green, only exception)
} as const;

// Convert hex to Color objects for use in VS Code
export function voidColor(hex: string): Color {
	return Color.fromHex(hex);
}

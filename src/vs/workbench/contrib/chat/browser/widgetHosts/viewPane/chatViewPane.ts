/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// VOID ENGINE: Minimal Qwen Chat View

import './media/chatViewPane.css';
import { $, append } from '../../../../../../base/browser/dom.js';
import { URI } from '../../../../../../base/common/uri.js';
import { UriList } from '../../../../../../base/common/dataTransfer.js';
import { DataTransfers } from '../../../../../../base/browser/dnd.js';
import { IViewPaneOptions, ViewPane } from '../../../../../browser/parts/views/viewPane.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../../../common/views.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../../../platform/hover/browser/hover.js';
import { IWorkspaceContextService } from '../../../../../../platform/workspace/common/workspace.js';
import { ITerminalService } from '../../../../terminal/browser/terminal.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { IExplorerService } from '../../../../files/browser/files.js';
import { QwenChatService } from './qwenChatService.js';

export class ChatViewPane extends ViewPane {
	private container: HTMLElement | undefined;
	private messagesContainer: HTMLElement | undefined;
	private inputElement: HTMLTextAreaElement | undefined;
	private qwenService: QwenChatService | undefined;
	private attachedFiles: URI[] = [];
	private attachedImages: URI[] = [];
	private imagePreviewContainer: HTMLElement | undefined;
	private fileRefreshInterval: any = undefined;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@ITerminalService private readonly terminalService: ITerminalService,
		@IFileService private readonly fileService: IFileService,
		@IExplorerService private readonly explorerService: IExplorerService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, undefined);
		
		// Initialize Qwen service
		this.qwenService = new QwenChatService();
		this._register(this.qwenService);
		
		// Set workspace path for Qwen
		const workspace = this.workspaceContextService.getWorkspace();
		if (workspace.folders.length > 0) {
			const workspacePath = workspace.folders[0].uri.fsPath;
			this.qwenService.setWorkspacePath(workspacePath);
		}
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		
		this.container = container;
		container.classList.add('void-chat-container');
		
		// Messages area
		const messagesContainer = append(container, $('.void-chat-messages'));
		this.messagesContainer = messagesContainer;
		
		// Input container - just a border box
		const inputBox = append(container, $('.void-input-box'));
		
		// Drag overlay
		const dragOverlay = append(inputBox, $('.void-drag-overlay'));
		const dragText = append(dragOverlay, $('.void-drag-text'));
		dragText.textContent = 'Drop file here';
		
		// Attached files container
		const attachedFilesContainer = append(inputBox, $('.void-attached-files'));
		
		// Image preview container (above input)
		const imagePreviewContainer = append(inputBox, $('.void-image-preview-container'));
		this.imagePreviewContainer = imagePreviewContainer;
		
		// Input row (text + actions)
		const inputRow = append(inputBox, $('.void-input-row'));
		
		// Text input inside - no border
		const input = append(inputRow, $('textarea.void-input')) as HTMLTextAreaElement;
		this.inputElement = input;
		input.placeholder = 'Спросите что-нибудь...';
		input.rows = 1;
		
		// Bottom toolbar (left side)
		const bottomToolbar = append(inputBox, $('.void-input-toolbar'));
		
		// Context button (#) - bottom left
		const contextBtn = append(bottomToolbar, $('button.void-toolbar-btn')) as HTMLButtonElement;
		contextBtn.textContent = '#';
		contextBtn.setAttribute('aria-label', 'Добавить контекст');
		contextBtn.title = 'Добавить контекст (#)';
		contextBtn.addEventListener('click', () => {
			// TODO: Open context menu
			console.log('[Qwen] Add context clicked');
		});
		
		// Image attach button (gallery icon)
		const imageBtn = append(bottomToolbar, $('button.void-toolbar-btn.codicon.codicon-file-media')) as HTMLButtonElement;
		imageBtn.setAttribute('aria-label', 'Прикрепить изображение');
		imageBtn.title = 'Прикрепить изображение';
		imageBtn.addEventListener('click', () => {
			this.openImagePicker();
		});
		
		// Action buttons container (right side)
		const actionsContainer = append(inputRow, $('.void-input-actions'));
		
		// Send button
		const sendBtn = append(actionsContainer, $('button.void-send-btn.codicon.codicon-arrow-up')) as HTMLButtonElement;
		sendBtn.setAttribute('aria-label', 'Отправить');
		sendBtn.title = 'Отправить';
		sendBtn.disabled = true; // Initially disabled
		
		// Enable/disable send button based on input + auto-resize
		input.addEventListener('input', () => {
			sendBtn.disabled = input.value.trim().length === 0;
			
			// Auto-resize up to 8 lines
			input.style.height = 'auto';
			const lineHeight = 18; // from CSS
			const maxLines = 8;
			const scrollHeight = input.scrollHeight;
			const newHeight = Math.min(scrollHeight, lineHeight * maxLines);
			input.style.height = newHeight + 'px';
			
			// Enable scroll only after 8 lines
			if (scrollHeight > lineHeight * maxLines) {
				input.style.overflowY = 'auto';
			} else {
				input.style.overflowY = 'hidden';
			}
		});
		
		// Send message on button click
		sendBtn.addEventListener('click', () => {
			this.sendMessage();
		});
		
		// Send message on Enter (Shift+Enter for new line)
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				if (input.value.trim().length > 0) {
					this.sendMessage();
				}
			}
		});
		
		// Drag and drop handlers
		let dragCounter = 0;
		
		inputBox.addEventListener('dragenter', (e) => {
			e.preventDefault();
			e.stopPropagation();
			dragCounter++;
			if (dragCounter === 1) {
				inputBox.classList.add('void-dragging');
			}
		});
		
		inputBox.addEventListener('dragleave', (e) => {
			e.preventDefault();
			e.stopPropagation();
			dragCounter--;
			if (dragCounter === 0) {
				inputBox.classList.remove('void-dragging');
			}
		});
		
		inputBox.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
		
		inputBox.addEventListener('drop', (e) => {
			e.preventDefault();
			e.stopPropagation();
			dragCounter = 0;
			inputBox.classList.remove('void-dragging');
			
			// Try to get URIs from internal drag
			const internal = e.dataTransfer?.getData(DataTransfers.INTERNAL_URI_LIST);
			if (internal) {
				const uriList = UriList.parse(internal);
				for (const uriStr of uriList) {
					const uri = URI.parse(uriStr);
					this.attachFile(uri, attachedFilesContainer);
				}
			}
		});
		
		// Subscribe to Qwen events
		if (this.qwenService) {
			this._register(this.qwenService.onEvent((event) => {
				this.handleQwenEvent(event);
			}));
		}
	}
	
	private sendMessage(): void {
		if (!this.inputElement || !this.qwenService) {
			return;
		}
		
		const text = this.inputElement.value.trim();
		if (text.length === 0) {
			return;
		}
		
		// Add user message to UI
		this.addUserMessage(text);
		
		// Add loading indicator
		this.addLoadingIndicator();
		
		// Clear input
		this.inputElement.value = '';
		this.inputElement.dispatchEvent(new Event('input')); // Trigger button disable
		
		// Send to Qwen (combine files and images)
		const allAttachments = [
			...this.attachedFiles.map(uri => uri.toString()),
			...this.attachedImages.map(uri => uri.toString())
		];
		this.qwenService.sendMessage(text, allAttachments);
		
		// Clear attached files and images
		this.attachedFiles = [];
		this.attachedImages = [];
		const attachedFilesContainer = this.container?.querySelector('.void-attached-files');
		if (attachedFilesContainer) {
			while (attachedFilesContainer.firstChild) {
				attachedFilesContainer.removeChild(attachedFilesContainer.firstChild);
			}
		}
		this.renderImagePreview();
	}
	
	private addLoadingIndicator(): void {
		if (!this.messagesContainer) {
			return;
		}
		
		const loadingDiv = append(this.messagesContainer, $('.void-loading-indicator'));
		loadingDiv.setAttribute('data-loading', 'true');
		
		// Create five dots for breathing animation
		for (let i = 0; i < 5; i++) {
			append(loadingDiv, $('.void-loading-dot'));
		}
		
		this.scrollToBottom();
	}
	
	private removeLoadingIndicator(): void {
		if (!this.messagesContainer) {
			return;
		}
		
		const loadingIndicator = this.messagesContainer.querySelector('[data-loading="true"]');
		if (loadingIndicator) {
			loadingIndicator.remove();
		}
	}
	
	private addUserMessage(text: string): void {
		if (!this.messagesContainer) {
			return;
		}
		
		const messageDiv = append(this.messagesContainer, $('.void-message.void-message-user'));
		const contentDiv = append(messageDiv, $('.void-message-content'));
		contentDiv.textContent = text;
		
		this.scrollToBottom();
	}
	
	private handleQwenEvent(event: any): void {
		if (!this.messagesContainer) {
			return;
		}
		
		const eventType = event.type;
		
		// Remove loading indicator if exists
		this.removeLoadingIndicator();
		
		// Start file refresh interval when assistant starts responding
		if (eventType === 'assistant' || eventType === 'tool-call') {
			this.startFileRefreshInterval();
		}
		
		switch (eventType) {
			case 'system':
				// Skip system initialization messages
				break;
			case 'assistant':
				this.addAssistantMessage(event.message?.content || '');
				break;
			case 'tool-call':
				this.addToolCallMessage(event.message);
				break;
			case 'tool-result':
				this.addToolResultMessage(event.message);
				break;
			case 'error':
				this.addErrorMessage(event.message?.content || 'An error occurred');
				this.stopFileRefreshInterval();
				break;
			case 'result':
				// Stop refresh interval when conversation completes
				this.stopFileRefreshInterval();
				break;
		}
		
		this.scrollToBottom();
	}
	
	private startFileRefreshInterval(): void {
		if (this.fileRefreshInterval) {
			return; // Already running
		}
		
		// Refresh file tree every second while Qwen is responding
		this.fileRefreshInterval = setInterval(() => {
			this.refreshFileTree();
		}, 1000);
		
		console.log('[Qwen] Started file refresh interval');
	}
	
	private stopFileRefreshInterval(): void {
		if (this.fileRefreshInterval) {
			clearInterval(this.fileRefreshInterval);
			this.fileRefreshInterval = undefined;
			console.log('[Qwen] Stopped file refresh interval');
			
			// Do one final refresh
			this.refreshFileTree();
		}
	}
	
	private addAssistantMessage(text: string): void {
		if (!this.messagesContainer) {
			return;
		}
		
		const messageDiv = append(this.messagesContainer, $('.void-message.void-message-assistant'));
		
		// Message content with markdown - use DOM API for security
		const contentDiv = append(messageDiv, $('.void-message-content'));
		this.renderMarkdownSafe(contentDiv, text);
	}
	
	private renderMarkdownSafe(container: HTMLElement, text: string): void {
		// Split by code blocks first
		const parts = text.split(/(```[\s\S]*?```)/g);
		
		for (const part of parts) {
			if (part.startsWith('```')) {
				// Code block
				const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
				if (match) {
					const lang = match[1] || 'text';
					const code = match[2].trim();
					
					const pre = append(container, $('pre.void-code-block'));
					const codeEl = append(pre, $('code'));
					codeEl.className = `language-${lang}`;
					codeEl.textContent = code;
				}
			} else if (part.trim()) {
				// Regular text with inline markdown
				this.renderInlineMarkdown(container, part);
			}
		}
	}
	
	private renderInlineMarkdown(container: HTMLElement, text: string): void {
		const lines = text.split('\n');
		let i = 0;
		
		while (i < lines.length) {
			const line = lines[i];
			
			// Check for table (starts with |)
			if (line.trim().startsWith('|')) {
				const tableLines: string[] = [];
				let j = i;
				
				// Collect all table lines
				while (j < lines.length && lines[j].trim().startsWith('|')) {
					tableLines.push(lines[j]);
					j++;
				}
				
				if (tableLines.length >= 2) {
					this.renderTable(container, tableLines);
					i = j;
					continue;
				}
			}
			
			// Headers
			if (line.startsWith('# ')) {
				const h1 = append(container, $('h1.void-h1'));
				this.parseInlineFormatting(h1, line.substring(2));
				i++;
				continue;
			}
			if (line.startsWith('## ')) {
				const h2 = append(container, $('h2.void-h2'));
				this.parseInlineFormatting(h2, line.substring(3));
				i++;
				continue;
			}
			if (line.startsWith('### ')) {
				const h3 = append(container, $('h3.void-h3'));
				this.parseInlineFormatting(h3, line.substring(4));
				i++;
				continue;
			}
			
			// Lists
			if (line.match(/^[\*\-]\s/)) {
				const li = append(container, $('div.void-li'));
				const bullet = append(li, $('span.void-bullet'));
				bullet.textContent = '•';
				const content = append(li, $('span'));
				this.parseInlineFormatting(content, line.substring(2));
				i++;
				continue;
			}
			
			// Numbered lists
			if (line.match(/^\d+\.\s/)) {
				const li = append(container, $('div.void-li'));
				const numMatch = line.match(/^(\d+)\./);
				const num = numMatch ? numMatch[1] : '1';
				const bullet = append(li, $('span.void-bullet'));
				bullet.textContent = num + '.';
				const content = append(li, $('span'));
				this.parseInlineFormatting(content, line.replace(/^\d+\.\s/, ''));
				i++;
				continue;
			}
			
			// Blockquote
			if (line.startsWith('> ')) {
				const quote = append(container, $('div.void-blockquote'));
				this.parseInlineFormatting(quote, line.substring(2));
				i++;
				continue;
			}
			
			// Regular paragraph
			if (line.trim()) {
				const p = append(container, $('p.void-p'));
				this.parseInlineFormatting(p, line);
			} else if (i < lines.length - 1) {
				append(container, $('br'));
			}
			
			i++;
		}
	}
	
	private renderTable(container: HTMLElement, lines: string[]): void {
		const wrapper = append(container, $('div.void-table-wrapper'));
		const table = append(wrapper, $('table.void-table'));
		const thead = append(table, $('thead'));
		const tbody = append(table, $('tbody'));
		
		// Parse header row
		const headerCells = lines[0].split('|').map(c => c.trim()).filter(c => c);
		const headerRow = append(thead, $('tr'));
		for (const cell of headerCells) {
			const th = append(headerRow, $('th'));
			this.parseInlineFormatting(th, cell);
		}
		
		// Skip separator line (line 1)
		// Parse data rows
		for (let i = 2; i < lines.length; i++) {
			const cells = lines[i].split('|').map(c => c.trim()).filter(c => c);
			const row = append(tbody, $('tr'));
			for (const cell of cells) {
				const td = append(row, $('td'));
				this.parseInlineFormatting(td, cell);
			}
		}
	}
	
	private parseInlineFormatting(container: HTMLElement, text: string): void {
		let remaining = text;
		
		while (remaining) {
			// Bold **text**
			const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
			if (boldMatch && boldMatch.index !== undefined) {
				if (boldMatch.index > 0) {
					this.parseLinks(container, remaining.substring(0, boldMatch.index));
				}
				const strong = append(container, $('strong'));
				strong.textContent = boldMatch[1];
				remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
				continue;
			}
			
			// Italic *text*
			const italicMatch = remaining.match(/\*([^*]+)\*/);
			if (italicMatch && italicMatch.index !== undefined) {
				if (italicMatch.index > 0) {
					this.parseLinks(container, remaining.substring(0, italicMatch.index));
				}
				const em = append(container, $('em'));
				em.textContent = italicMatch[1];
				remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
				continue;
			}
			
			// Inline code `code`
			const codeMatch = remaining.match(/`([^`]+)`/);
			if (codeMatch && codeMatch.index !== undefined) {
				if (codeMatch.index > 0) {
					this.parseLinks(container, remaining.substring(0, codeMatch.index));
				}
				const code = append(container, $('code.void-inline-code'));
				code.textContent = codeMatch[1];
				remaining = remaining.substring(codeMatch.index + codeMatch[0].length);
				continue;
			}
			
			// No more formatting
			this.parseLinks(container, remaining);
			break;
		}
	}
	
	private parseLinks(container: HTMLElement, text: string): void {
		const linkMatch = text.match(/\[([^\]]+)\]\(([^)]+)\)/);
		if (linkMatch && linkMatch.index !== undefined) {
			if (linkMatch.index > 0) {
				const textNode = document.createTextNode(text.substring(0, linkMatch.index));
				container.appendChild(textNode);
			}
			const link = append(container, $('a.void-link')) as HTMLAnchorElement;
			link.textContent = linkMatch[1];
			link.href = linkMatch[2];
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			
			const rest = text.substring(linkMatch.index + linkMatch[0].length);
			if (rest) {
				this.parseLinks(container, rest);
			}
		} else {
			const textNode = document.createTextNode(text);
			container.appendChild(textNode);
		}
	}
	
	private addToolCallMessage(data: any): void {
		if (!this.messagesContainer) {
			return;
		}
		
		const toolName = data.metadata?.toolName || '';
		const toolInput = data.metadata?.toolInput || {};
		
		// Intercept terminal commands and execute in VSCode terminal
		if (toolName.includes('shell') || toolName.includes('execute') || toolName.includes('command') || toolName.includes('run')) {
			const command = toolInput.command || toolInput.cmd || toolInput.code || '';
			if (command) {
				// Execute in VSCode terminal (async, don't wait)
				this.executeCommandInTerminal(command, toolName).catch(err => {
					console.error('[Qwen] Terminal execution failed:', err);
				});
			}
		}
		
		const messageDiv = append(this.messagesContainer, $('.void-message.void-message-tool'));
		
		// Header with icon and title
		const header = append(messageDiv, $('.void-message-tool-header'));
		
		// Icon
		const iconDiv = append(header, $('.void-message-tool-icon'));
		this.setToolIcon(iconDiv, toolName, false);
		
		// Title
		const title = append(header, $('.void-message-tool-title'));
		title.textContent = this.getToolTitle(toolName);
		
		// Info section (content)
		const info = append(messageDiv, $('.void-message-tool-info'));
		
		// Content based on tool type
		this.renderToolContent(info, toolName, toolInput);
	}
	
	private setToolIcon(iconDiv: HTMLElement, toolName: string, isError: boolean): void {
		if (isError) {
			iconDiv.classList.add('error');
			return;
		}
		
		// Set CSS class based on tool for custom icons
		if (toolName.includes('write') || toolName.includes('edit') || toolName.includes('str_replace')) {
			iconDiv.classList.add('success');
		} else if (toolName.includes('read')) {
			iconDiv.classList.add('read');
		} else if (toolName.includes('search') || toolName.includes('grep')) {
			iconDiv.classList.add('search');
		} else if (toolName.includes('web')) {
			iconDiv.classList.add('web');
		} else if (toolName.includes('execute') || toolName.includes('command')) {
			iconDiv.classList.add('command');
		} else if (toolName.includes('process') || toolName.includes('control')) {
			iconDiv.classList.add('process');
		} else {
			iconDiv.classList.add('success');
		}
	}
	
	private getToolTitle(toolName: string): string {
		if (toolName.includes('plan')) {
			return 'Plan';
		} else if (toolName.includes('write') || toolName.includes('edit') || toolName.includes('str_replace')) {
			return 'Edit file(s)';
		} else if (toolName.includes('read')) {
			return 'Read file(s)';
		} else if (toolName.includes('grep') || toolName.includes('search')) {
			return 'Search';
		} else if (toolName.includes('web')) {
			return 'Web Search';
		} else if (toolName.includes('execute')) {
			return 'Command';
		} else if (toolName.includes('control') || toolName.includes('process')) {
			return 'Background Process';
		}
		return toolName;
	}
	
	private renderToolContent(container: HTMLElement, toolName: string, toolInput: any): void {
		console.log('[Tool Content] Rendering:', toolName, 'Full input:', JSON.stringify(toolInput));
		
		const filesContainer = append(container, $('.void-message-tool-files'));
		
		// Plan/Todo tool
		if (toolName.includes('plan')) {
			const action = toolInput.action || '';
			const task = toolInput.task || '';
			const taskIndex = toolInput.taskIndex;
			
			if (action === 'list' || action === 'add' || action === 'complete' || action === 'uncomplete' || action === 'create') {
				// Will be rendered in tool result
				this.createQueryCard(filesContainer, `${action}${task ? `: ${task}` : ''}${taskIndex ? ` #${taskIndex}` : ''}`);
			}
			return;
		}
		
		// File operations (read, write, edit, delete, append)
		if (toolName.includes('read') || toolName.includes('write') || toolName.includes('edit') || 
		    toolName.includes('str_replace') || toolName.includes('delete') || toolName.includes('append')) {
			let paths: string[] = [];
			
			// Check for absolute_path (used by Qwen tools)
			if (toolInput.absolute_path) {
				paths = [toolInput.absolute_path];
			}
			// Check for paths array
			else if (toolInput.paths && Array.isArray(toolInput.paths)) {
				paths = toolInput.paths;
			}
			// Check for other common field names
			else if (toolInput.path) {
				paths = [toolInput.path];
			} else if (toolInput.targetFile) {
				paths = [toolInput.targetFile];
			} else if (toolInput.file) {
				paths = [toolInput.file];
			} else if (toolInput.file_path) {
				paths = [toolInput.file_path];
			}
			
			if (paths.length > 0) {
				for (const path of paths) {
					// For edit operations, show what was changed
					if (toolName.includes('edit') || toolName.includes('str_replace')) {
						const oldStr = toolInput.oldStr || toolInput.old_str || '';
						const newStr = toolInput.newStr || toolInput.new_str || '';
						this.createEditCard(filesContainer, path, oldStr, newStr);
					} else {
						this.createFileCard(filesContainer, path);
					}
				}
			}
		}
		// Directory listing
		else if (toolName.includes('ls') || toolName.includes('list')) {
			const dirPath = toolInput.absolute_path || toolInput.path || toolInput.directory || '';
			if (dirPath) {
				this.createQueryCard(filesContainer, dirPath);
			}
		}
		// Glob/File search operations
		else if (toolName.includes('glob')) {
			const pattern = toolInput.pattern || toolInput.glob || toolInput.query || '';
			if (pattern) {
				this.createQueryCard(filesContainer, pattern);
			}
		}
		// Grep/Content search operations
		else if (toolName.includes('grep') || toolName.includes('search')) {
			const query = toolInput.pattern || toolInput.query || toolInput.search || '';
			const glob = toolInput.glob || '';
			if (query) {
				this.createQueryCard(filesContainer, `"${query}"${glob ? ` in ${glob}` : ''}`);
			}
		}
		// Web search/fetch
		else if (toolName.includes('web')) {
			const query = toolInput.query || toolInput.url || toolInput.search || '';
			if (query) {
				this.createQueryCard(filesContainer, query);
			}
		}
		// Shell/Execute/Command operations
		else if (toolName.includes('shell') || toolName.includes('execute') || toolName.includes('command') || toolName.includes('run')) {
			const command = toolInput.command || toolInput.cmd || toolInput.code || '';
			if (command) {
				this.createCommandCard(filesContainer, command);
			}
		}
		// Process control (start/stop background processes)
		else if (toolName.includes('control') || toolName.includes('process')) {
			const command = toolInput.command || toolInput.cmd || '';
			const action = toolInput.action || 'run';
			if (command) {
				this.createCommandCard(filesContainer, `${action}: ${command}`);
			}
		}
		// Hook creation
		else if (toolName.includes('hook')) {
			const hookName = toolInput.name || toolInput.id || 'hook';
			this.createQueryCard(filesContainer, hookName);
		}
		// Diagnostics
		else if (toolName.includes('diagnostic')) {
			const paths = toolInput.paths || [];
			if (paths.length > 0) {
				for (const path of paths) {
					this.createFileCard(filesContainer, path);
				}
			}
		}
		// Memory/Save operations
		else if (toolName.includes('memory') || toolName.includes('save')) {
			const fact = toolInput.fact || toolInput.content || '';
			if (fact) {
				this.createQueryCard(filesContainer, fact.substring(0, 50) + '...');
			}
		}
		
		// Trigger file tree refresh after tool execution
		this.refreshFileTree();
	}
	
	private refreshFileTree(): void {
		// Use ExplorerService to force UI refresh
		try {
			// Method 1: Refresh the explorer view directly
			if (this.explorerService) {
				const explorerView = this.explorerService.getContext(false);
				if (explorerView) {
					// Force refresh by collapsing and expanding (hacky but works)
					this.explorerService.refresh();
					console.log('[Qwen] File tree refreshed via ExplorerService');
				}
			}
			
			// Method 2: Also trigger file watcher
			if (this.workspaceContextService.getWorkspace().folders.length > 0) {
				const workspaceUri = this.workspaceContextService.getWorkspace().folders[0].uri;
				this.fileService.resolve(workspaceUri, { resolveTo: [] }).then(() => {
					console.log('[Qwen] File watcher triggered');
				}).catch(err => {
					console.error('[Qwen] File watcher error:', err);
				});
			}
		} catch (error) {
			console.error('[Qwen] Failed to refresh file tree:', error);
		}
	}
	
	private async executeCommandInTerminal(command: string, toolName: string): Promise<string> {
		try {
			// Create or reuse terminal for Qwen
			let terminal = this.terminalService.instances.find(t => t.title === 'Qwen AI');
			
			if (!terminal) {
				terminal = await this.terminalService.createTerminal({
					cwd: this.workspaceContextService.getWorkspace().folders[0]?.uri
				});
				// Set title after creation
				terminal.rename('Qwen AI');
			}
			
			// Show terminal
			this.terminalService.setActiveInstance(terminal);
			await this.terminalService.revealActiveTerminal();
			
			// Send command to terminal
			terminal.sendText(command, true);
			
			console.log(`[Qwen] Executed command in terminal: ${command}`);
			
			// Return success message (actual output will be visible in terminal)
			return `Command executed in terminal: ${command}`;
		} catch (error) {
			console.error('[Qwen] Failed to execute command in terminal:', error);
			return `Failed to execute command: ${error}`;
		}
	}
	
	private createFileCard(container: HTMLElement, filePath: string): void {
		const card = append(container, $('.void-tool-file-card'));
		
		// Language icon
		const ext = filePath.split('.').pop() || '';
		const icon = append(card, $('.void-tool-file-icon.codicon'));
		icon.classList.add(this.getLanguageIcon(ext));
		
		// File name
		const fileName = append(card, $('.void-tool-file-name'));
		const name = filePath.split(/[/\\]/).pop() || filePath;
		fileName.textContent = name;
		
		// Click to open file
		card.addEventListener('click', async () => {
			try {
				const uri = URI.file(filePath);
				await this.openerService.open(uri, { openToSide: false });
				console.log('[Qwen] Opened file:', filePath);
			} catch (error) {
				console.error('[Qwen] Failed to open file:', error);
			}
		});
	}
	
	private createEditCard(container: HTMLElement, filePath: string, oldStr: string, newStr: string): void {
		const card = append(container, $('.void-tool-file-card.void-tool-edit-card'));
		
		// Language icon
		const ext = filePath.split('.').pop() || '';
		const icon = append(card, $('.void-tool-file-icon.codicon'));
		icon.classList.add(this.getLanguageIcon(ext));
		
		// File info container
		const fileInfo = append(card, $('.void-tool-file-info'));
		
		// File name
		const fileName = append(fileInfo, $('.void-tool-file-name'));
		const name = filePath.split(/[/\\]/).pop() || filePath;
		fileName.textContent = name;
		
		// Edit summary
		const editSummary = append(fileInfo, $('.void-tool-edit-summary'));
		const oldLines = oldStr.split('\n').length;
		const newLines = newStr.split('\n').length;
		const diff = newLines - oldLines;
		const diffText = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '~';
		editSummary.textContent = `${oldLines} → ${newLines} lines (${diffText})`;
		
		// Click to open file
		card.addEventListener('click', async () => {
			try {
				const uri = URI.file(filePath);
				await this.openerService.open(uri, { openToSide: false });
				console.log('[Qwen] Opened edited file:', filePath);
			} catch (error) {
				console.error('[Qwen] Failed to open file:', error);
			}
		});
	}
	
	private createQueryCard(container: HTMLElement, query: string): void {
		const card = append(container, $('.void-tool-file-card.void-tool-query-card'));
		
		// Search icon
		append(card, $('.void-tool-file-icon.codicon.codicon-search'));
		
		// Query text
		const queryText = append(card, $('.void-tool-file-name'));
		queryText.textContent = query;
	}
	
	private createCommandCard(container: HTMLElement, command: string): void {
		const card = append(container, $('.void-tool-file-card.void-tool-command-card'));
		
		// Terminal icon
		append(card, $('.void-tool-file-icon.codicon.codicon-terminal'));
		
		// Command text
		const commandText = append(card, $('.void-tool-file-name'));
		commandText.textContent = command;
	}
	
	private addToolResultMessage(data: any): void {
		// Show plan results as a special card
		if (data.metadata?.toolName?.includes('plan')) {
			const result = data.content;
			try {
				const parsed = typeof result === 'string' ? JSON.parse(result) : result;
				if (parsed.plan && Array.isArray(parsed.plan) && parsed.plan.length > 0) {
					this.addPlanCard(parsed.plan);
					return;
				}
			} catch (e) {
				// Not a plan result, skip
			}
		}
		
		// Tool results are now hidden - we don't show them separately
		// The success/error state is shown in the tool call card icon
	}
	
	private addPlanCard(tasks: any[]): void {
		if (!this.messagesContainer) {
			return;
		}
		
		const messageDiv = append(this.messagesContainer, $('.void-message.void-message-tool'));
		
		// Header with icon and title
		const header = append(messageDiv, $('.void-message-tool-header'));
		
		// Icon
		const iconDiv = append(header, $('.void-message-tool-icon'));
		iconDiv.classList.add('success');
		
		// Title
		const completedCount = tasks.filter(t => t.completed).length;
		const title = append(header, $('.void-message-tool-title'));
		title.textContent = `Plan (${completedCount}/${tasks.length} completed)`;
		
		// Info section (plan content)
		const info = append(messageDiv, $('.void-message-tool-info'));
		
		// Plan card
		const planCard = append(info, $('.void-plan-card'));
		
		tasks.forEach((task, index) => {
			const taskDiv = append(planCard, $('.void-plan-task'));
			if (task.completed) {
				taskDiv.classList.add('completed');
			}
			
			const num = append(taskDiv, $('.void-plan-num'));
			num.textContent = `${index + 1}.`;
			
			const text = append(taskDiv, $('.void-plan-text'));
			text.textContent = task.text;
		});
		
		this.scrollToBottom();
	}
	
	private addErrorMessage(text: string): void {
		if (!this.messagesContainer) {
			return;
		}
		
		const messageDiv = append(this.messagesContainer, $('.void-message.void-message-error'));
		const contentDiv = append(messageDiv, $('.void-message-content'));
		contentDiv.textContent = text;
	}
	
	private scrollToBottom(): void {
		if (this.messagesContainer) {
			this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
		}
	}
	
	private attachFile(uri: URI, container: HTMLElement): void {
		if (this.attachedFiles.some(f => f.toString() === uri.toString())) {
			return; // Already attached
		}
		
		this.attachedFiles.push(uri);
		
		// Create file card
		const card = append(container, $('.void-file-card'));
		
		// Language icon
		const ext = uri.path.split('.').pop() || '';
		const langIcon = append(card, $('.void-file-icon.codicon'));
		langIcon.classList.add(this.getLanguageIcon(ext));
		
		// File name
		const fileName = append(card, $('.void-file-name'));
		fileName.textContent = uri.path.split('/').pop() || uri.path;
		
		// Remove button
		const removeBtn = append(card, $('button.void-file-remove.codicon.codicon-close')) as HTMLButtonElement;
		removeBtn.setAttribute('aria-label', 'Открепить');
		removeBtn.title = 'Открепить';
		removeBtn.addEventListener('click', () => {
			this.attachedFiles = this.attachedFiles.filter(f => f.toString() !== uri.toString());
			card.remove();
		});
	}
	
	private getLanguageIcon(ext: string): string {
		const iconMap: Record<string, string> = {
			'ts': 'codicon-symbol-method',
			'js': 'codicon-symbol-method',
			'tsx': 'codicon-symbol-method',
			'jsx': 'codicon-symbol-method',
			'py': 'codicon-symbol-method',
			'java': 'codicon-symbol-method',
			'cpp': 'codicon-symbol-method',
			'c': 'codicon-symbol-method',
			'cs': 'codicon-symbol-method',
			'go': 'codicon-symbol-method',
			'rs': 'codicon-symbol-method',
			'json': 'codicon-json',
			'md': 'codicon-markdown',
			'html': 'codicon-symbol-color',
			'css': 'codicon-symbol-color',
			'scss': 'codicon-symbol-color',
			'xml': 'codicon-symbol-color',
		};
		return iconMap[ext.toLowerCase()] || 'codicon-file';
	}
	
	private async openImagePicker(): Promise<void> {
		try {
			// Create file input element
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'image/*'; // All image types
			input.multiple = false; // Single image for now
			
			input.onchange = async (e: Event) => {
				const target = e.target as HTMLInputElement;
				const files = target.files;
				
				if (files && files.length > 0) {
					const file = files[0];
					
					// Create data URL for preview
					const reader = new FileReader();
					reader.onload = (event) => {
						if (event.target && event.target.result) {
							const dataUrl = event.target.result as string;
							// Create URI from data URL
							const uri = URI.parse(dataUrl);
							this.attachImage(uri);
						}
					};
					reader.readAsDataURL(file);
				}
			};
			
			// Trigger file picker
			input.click();
		} catch (error) {
			console.error('[Qwen] Failed to open image picker:', error);
		}
	}
	
	private attachImage(uri: URI): void {
		if (this.attachedImages.some(img => img.toString() === uri.toString())) {
			return; // Already attached
		}
		
		this.attachedImages.push(uri);
		this.renderImagePreview();
	}
	
	private renderImagePreview(): void {
		if (!this.imagePreviewContainer) {
			return;
		}
		
		// Clear existing previews
		while (this.imagePreviewContainer.firstChild) {
			this.imagePreviewContainer.removeChild(this.imagePreviewContainer.firstChild);
		}
		
		// Render each image
		for (const imageUri of this.attachedImages) {
			const previewCard = append(this.imagePreviewContainer, $('.void-image-preview-card'));
			
			// Image thumbnail
			const img = append(previewCard, $('img.void-image-preview-thumb')) as HTMLImageElement;
			img.src = imageUri.toString();
			img.alt = 'Preview';
			
			// Remove button
			const removeBtn = append(previewCard, $('button.void-image-preview-remove.codicon.codicon-close')) as HTMLButtonElement;
			removeBtn.setAttribute('aria-label', 'Удалить');
			removeBtn.title = 'Удалить изображение';
			removeBtn.addEventListener('click', () => {
				this.attachedImages = this.attachedImages.filter(img => img.toString() !== imageUri.toString());
				this.renderImagePreview();
			});
		}
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		
		if (this.container) {
			this.container.style.height = height + 'px';
			this.container.style.width = width + 'px';
		}
	}

	// Stub methods for compatibility with other VSCode parts
	public get widget(): any {
		// Return a minimal widget stub with inputModel for chatMoveActions compatibility
		return {
			viewModel: undefined,
			location: undefined,
			inputModel: {
				state: {
					get: () => undefined
				},
				setState: (_state: any) => { /* stub */ }
			},
			getViewState: () => undefined,
			clear: () => Promise.resolve()
		};
	}

	public loadSession(_sessionId: string | URI): Promise<any> {
		// Return a stub model with inputModel for chatMoveActions compatibility
		return Promise.resolve({
			inputModel: {
				state: {
					get: () => undefined
				},
				setState: (_state: any) => { /* stub */ }
			}
		});
	}

	public focusInput(): void {
		// Stub - no input field
	}

	public getFocusedSessions(): any[] {
		return [];
	}

	public updateConfiguredSessionsViewerOrientation(_orientation?: any): void {
		// Stub
	}

	public getLastDimensions(_orientation?: any): { height: number; width: number } | undefined {
		return this.lastDimensions;
	}

	public getSessionsViewerOrientation(): any {
		return undefined;
	}

	public focusSessions(): void {
		// Stub
	}

	private lastDimensions: { height: number; width: number } | undefined;
}

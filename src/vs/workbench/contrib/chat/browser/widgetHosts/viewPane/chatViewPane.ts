/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// VOID ENGINE: Minimal Qwen Chat View

import './media/chatViewPane.css';
import { $, append } from '../../../../../../base/browser/dom.js';
import { VSBuffer } from '../../../../../../base/common/buffer.js';
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
import { IChatHistoryPanelState, IChatHistoryUiStore, LocalChatHistoryUiStore } from './chatHistoryUiStore.js';

interface AttachedFile {
	id: string;
	uri?: URI;
	name: string;
	ext: string;
	inlineContent?: string;
	byteLength?: number;
}

interface ToolCardRef {
	root: HTMLElement;
	marker: HTMLElement;
	body: HTMLElement;
	name: string;
	statusLine?: HTMLElement;
	startedAt?: number;
	commandMeta?: CommandCardMeta;
	inputPaths?: string[];
}

interface CommandCardMeta {
	command: string;
	runLine: HTMLButtonElement;
	details: HTMLElement;
	durationText: HTMLElement;
	outputText: HTMLElement;
}

interface RunFileSnapshot {
	exists: boolean;
	content: string;
}

interface RunChangeSummary {
	path: string;
	beforeExists: boolean;
	beforeContent: string;
	afterExists: boolean;
	afterContent: string;
	added: number;
	removed: number;
}

interface HistoryAttachmentPreview {
	name: string;
	preview: string;
}

interface HistoryMessageRecord {
	role: 'user' | 'assistant' | 'error';
	text: string;
	timestamp: number;
	attachments?: HistoryAttachmentPreview[];
}

interface HistorySessionRecord {
	id: string;
	title: string;
	pinned: boolean;
	createdAt: number;
	updatedAt: number;
	lastViewedAt: number;
	messages: HistoryMessageRecord[];
}

type ChatPaneLayoutMode = 'home' | 'conversation' | 'history';

export class ChatViewPane extends ViewPane {
	private container: HTMLElement | undefined;
	private messagesContainer: HTMLElement | undefined;
	private inputElement: HTMLTextAreaElement | undefined;
	private inputShell: HTMLElement | undefined;
	private attachedFilesContainer: HTMLElement | undefined;
	private attachmentLimitNotice: HTMLElement | undefined;
	private attachmentLimitNoticeHideHandle: number | undefined;
	private sendButton: HTMLButtonElement | undefined;
	private contextMeter: HTMLElement | undefined;
	private contextMeterBar: HTMLElement | undefined;
	private emptyState: HTMLElement | undefined;
	private qwenService: QwenChatService | undefined;
	private attachedFiles: AttachedFile[] = [];
	private fileRefreshHandle: any = undefined;
	private currentRunContainer: HTMLElement | undefined;
	private readonly toolCards = new Map<string, ToolCardRef>();
	private readonly seenToolCalls = new Set<string>();
	private readonly contextSegments: Array<{ role: 'user' | 'assistant'; text: string }> = [];
	private contextSummary = '';
	private readonly runTouchedFiles = new Set<string>();
	private readonly runFileSnapshots = new Map<string, RunFileSnapshot>();
	private runSummaryRendered = false;
	private historyButton: HTMLButtonElement | undefined;
	private historyPanel: HTMLElement | undefined;
	private historyList: HTMLElement | undefined;
	private historySessions: HistorySessionRecord[] = [];
	private readonly historyUiStore: IChatHistoryUiStore;
	private historyPanelState: IChatHistoryPanelState = { query: '', mode: 'list' };
	private activeSessionId: string | undefined;
	private layoutMode: ChatPaneLayoutMode = 'home';
	private scrollToBottomHandle: number | undefined;
	private devProfileEnabled = false;
	private longTaskObserver: PerformanceObserver | undefined;
	private tooltipOverlay: HTMLElement | undefined;
	private tooltipTarget: HTMLElement | undefined;
	private static readonly CONTEXT_WINDOW_TOKENS = 1048600;
	private static readonly CONTEXT_HARD_LIMIT = 0.92;
	private static readonly MAX_ATTACHED_FILES = 9;
	private static readonly CHAT_HISTORY_STORAGE_KEY = 'void.chat.history.v1';
	private static readonly CHAT_HISTORY_MAX_SESSIONS = 80;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService override readonly configurationService: IConfigurationService,
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

		this.historyUiStore = new LocalChatHistoryUiStore(
			ChatViewPane.CHAT_HISTORY_STORAGE_KEY,
			ChatViewPane.CHAT_HISTORY_MAX_SESSIONS
		);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.container = container;
		container.classList.add('void-chat-container');
		this.setupTooltipOverlay(container);

		const header = append(container, $('.void-chat-header'));
		const brand = append(header, $('.void-chat-brand'));
		brand.textContent = 'CODEX';
		const headerActions = append(header, $('.void-chat-header-actions'));
		const historyButton = append(headerActions, $('button.void-chat-header-btn.void-chat-header-btn-text')) as HTMLButtonElement;
		historyButton.textContent = 'Chat History';
		historyButton.setAttribute('data-tooltip', 'Open saved chats');
		historyButton.classList.add('codicon', 'codicon-history');
		this.historyButton = historyButton;
		const newChatButton = append(headerActions, $('button.void-chat-header-btn.void-chat-header-btn-icon.codicon.codicon-edit')) as HTMLButtonElement;
		newChatButton.textContent = '';
		newChatButton.setAttribute('aria-label', 'New Chat');
		newChatButton.setAttribute('data-tooltip', 'Start a new chat session');

		const messagesContainer = append(container, $('.void-chat-messages'));
		this.messagesContainer = messagesContainer;
		this.emptyState = append(messagesContainer, $('.void-chat-empty'));
		const emptyBadge = append(this.emptyState, $('.void-chat-empty-badge'));
		emptyBadge.textContent = 'Free plan · Upgrade';
		const emptyHeader = append(this.emptyState, $('.void-chat-empty-header'));
		this.renderWelcomeLogo(emptyHeader);
		const emptyTitle = append(emptyHeader, $('.void-chat-empty-title'));
		emptyTitle.textContent = this.buildWelcomeLine();
		const emptySub = append(this.emptyState, $('.void-chat-empty-subtitle'));
		emptySub.textContent = 'Describe the task and we will execute it step by step.';

		const historyPanel = append(container, $('.void-chat-history-panel'));
		this.historyPanel = historyPanel;
		const historyPanelHeader = append(historyPanel, $('.void-chat-history-header'));
		const historyPanelTitle = append(historyPanelHeader, $('.void-chat-history-title'));
		historyPanelTitle.textContent = 'Chat History';
		const closeHistoryButton = append(historyPanelHeader, $('button.void-chat-history-close.codicon.codicon-close')) as HTMLButtonElement;
		closeHistoryButton.setAttribute('aria-label', 'Close chat history');
		const historySearchInput = append(historyPanel, $('input.void-chat-history-search')) as HTMLInputElement;
		historySearchInput.type = 'text';
		historySearchInput.placeholder = 'Search chats';
		const historyList = append(historyPanel, $('.void-chat-history-list'));
		this.historyList = historyList;

		const inputBox = append(container, $('.void-input-shell'));
		this.inputShell = inputBox;

		const dragOverlay = append(inputBox, $('.void-drag-overlay'));
		const dragText = append(dragOverlay, $('.void-drag-text'));
		dragText.textContent = 'Drop text/pdf files';

		this.attachedFilesContainer = append(inputBox, $('.void-attached-files'));
		const attachmentLimitNotice = append(inputBox, $('.void-attachment-limit-notice'));
		attachmentLimitNotice.textContent = `Up to ${ChatViewPane.MAX_ATTACHED_FILES} files. Remove one before attaching more.`;
		this.attachmentLimitNotice = attachmentLimitNotice;

		const input = append(inputBox, $('textarea.void-input')) as HTMLTextAreaElement;
		this.inputElement = input;
		input.placeholder = 'Ask for follow-up changes';
		input.rows = 1;

		const footer = append(inputBox, $('.void-input-footer'));
		const leftControls = append(footer, $('.void-input-left'));

		const plusBtn = append(leftControls, $('button.void-toolbar-btn.void-plus-btn.codicon.codicon-add')) as HTMLButtonElement;
		plusBtn.setAttribute('aria-label', 'Attach files');
		plusBtn.setAttribute('data-tooltip', 'Actions');

		const plusMenu = append(inputBox, $('.void-plus-menu'));
		const createMenuItem = (
			label: string,
			iconClass: string,
			tooltip: string,
			onClick: () => void,
			tailCodicon?: string
		): HTMLButtonElement => {
			const item = append(plusMenu, $('button.void-plus-menu-item')) as HTMLButtonElement;
			item.type = 'button';
			item.setAttribute('data-tooltip', tooltip);
			const icon = append(item, $('span.void-plus-menu-icon.codicon'));
			icon.classList.add(iconClass);
			const text = append(item, $('span.void-plus-menu-text'));
			text.textContent = label;
			if (tailCodicon) {
				const tail = append(item, $('span.void-plus-menu-tail.codicon'));
				tail.classList.add(tailCodicon);
			}
			item.addEventListener('click', onClick);
			return item;
		};

		createMenuItem(
			'Add files or photos',
			'codicon-attach',
			'Attach text/PDF files',
			() => {
				this.toggleMenu(plusMenu, false);
				this.openFilePicker();
			}
		);

		append(plusMenu, $('.void-plus-menu-separator'));
		createMenuItem('Add to project', 'codicon-folder', 'Add context from project', () => this.toggleMenu(plusMenu, false), 'codicon-chevron-right');
		createMenuItem('Web search', 'codicon-globe', 'Use web search in this chat', () => this.toggleMenu(plusMenu, false), 'codicon-check');
		createMenuItem('Use style', 'codicon-symbol-color', 'Configure response style', () => this.toggleMenu(plusMenu, false), 'codicon-chevron-right');
		createMenuItem('Add connectors', 'codicon-plug', 'Connect external tools', () => this.toggleMenu(plusMenu, false));

		plusBtn.addEventListener('click', () => {
			this.toggleMenu(plusMenu, !plusMenu.classList.contains('visible'));
		});

		const modelLabel = append(footer, $('.void-model-label'));
		modelLabel.textContent = 'qwen-3.5:coder';
		const contextMeter = append(footer, $('.void-context-meter'));
		this.contextMeter = contextMeter;
		contextMeter.setAttribute('aria-label', 'Context usage');
		contextMeter.setAttribute('data-context', '0.0k / 1048.6k');
		this.contextMeterBar = append(contextMeter, $('.void-context-meter-bar'));

		const sendBtn = append(footer, $('button.void-send-btn.codicon.codicon-arrow-up')) as HTMLButtonElement;
		sendBtn.setAttribute('aria-label', 'Send');
		sendBtn.setAttribute('data-tooltip', 'Send');
		sendBtn.disabled = true;
		this.sendButton = sendBtn;

		input.addEventListener('input', () => {
			this.updateComposerState();
			input.style.height = 'auto';
			const lineHeight = 20;
			const maxLines = 8;
			const maxHeight = lineHeight * maxLines;
			const nextHeight = Math.min(input.scrollHeight, maxHeight);
			input.style.height = `${nextHeight}px`;
			input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
		});

		sendBtn.addEventListener('click', () => {
			void this.sendMessage();
		});

		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				if (input.value.trim().length > 0) {
					void this.sendMessage();
				}
			}
		});

		const onDocumentClick = (e: MouseEvent): void => {
			const target = e.target as Node | null;
			if (!target || !inputBox.contains(target)) {
				this.toggleMenu(plusMenu, false);
			}
			if (!target || (!historyPanel.contains(target) && !header.contains(target))) {
				this.toggleHistoryPanel(false);
			}
		};
		document.addEventListener('click', onDocumentClick, true);
		this._register({ dispose: () => document.removeEventListener('click', onDocumentClick, true) });
		this._register({
			dispose: () => {
				if (typeof this.scrollToBottomHandle === 'number') {
					window.cancelAnimationFrame(this.scrollToBottomHandle);
					this.scrollToBottomHandle = undefined;
				}
			}
		});

		historyButton.addEventListener('click', (e) => {
			e.stopPropagation();
			this.toggleHistoryPanel(!historyPanel.classList.contains('visible'));
		});
		newChatButton.addEventListener('click', () => {
			this.createSessionAndSwitch('New chat');
		});
		closeHistoryButton.addEventListener('click', () => {
			this.toggleHistoryPanel(false);
		});
		historySearchInput.addEventListener('input', () => {
			const query = historySearchInput.value.trim();
			this.historyPanelState.query = query;
			this.historyPanelState.mode = query.length > 0 ? 'search' : 'list';
			this.renderHistoryList();
		});

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

			const internal = e.dataTransfer?.getData(DataTransfers.INTERNAL_URI_LIST);
			if (internal) {
				const uriList = UriList.parse(internal);
				for (const uriStr of uriList) {
					this.attachFile(URI.parse(uriStr));
				}
				return;
			}

			const dropped = Array.from(e.dataTransfer?.files ?? []);
			for (const file of dropped) {
				void this.attachBrowserFile(file);
			}
		});

		this.updateComposerState();
		this.loadHistorySessions();
		this.renderHistoryList();
		this.setLayoutMode('home');
		this.devProfileEnabled = this.configurationService.getValue<boolean>('void.dev.profileChatUi') === true;
		if (this.devProfileEnabled) {
			this.installLongTaskObserver();
		}

		if (this.qwenService) {
			this._register(this.qwenService.onEvent((event) => {
				this.handleQwenEvent(event);
			}));
		}
	}
	
	private async sendMessage(): Promise<void> {
		if (!this.inputElement || !this.qwenService) {
			return;
		}

		const text = this.inputElement.value.trim();
		if (text.length === 0) {
			return;
		}

		const attachments = [...this.attachedFiles];
		this.addUserMessage(text, attachments);
		this.addLoadingIndicator();
		this.currentRunContainer = undefined;
		this.toolCards.clear();
		this.seenToolCalls.clear();
		this.runTouchedFiles.clear();
		this.runFileSnapshots.clear();
		this.runSummaryRendered = false;

		this.inputElement.value = '';
		this.inputElement.dispatchEvent(new Event('input'));
		this.attachedFiles = [];
		this.hideAttachmentLimitNotice();
		this.refreshAttachedFilesUI();
		this.updateComposerState();

		let payload = text;

		try {
			await this.maybeCompactContext();
			const rollingContext = this.buildRollingContextBlock();
			const attachmentContext = await this.buildAttachmentContext(attachments);
			if (rollingContext) {
				payload = `${rollingContext}\n\n[CURRENT USER REQUEST]\n${payload}`;
			}
			if (attachmentContext) {
				payload += `\n\n[ATTACHED FILE CONTEXT]\n${attachmentContext}`;
			}
			await this.qwenService.sendMessage(payload, attachments.map(file => file.uri?.toString() ?? `attachment:${file.name}`));
		} catch (error: any) {
			this.removeLoadingIndicator();
			this.addErrorMessage(error?.message ?? 'Failed to send message');
		}
	}
	
	private addLoadingIndicator(): void {
		if (!this.messagesContainer) {
			return;
		}

		const loadingDiv = append(this.messagesContainer, $('.void-thinking-row'));
		loadingDiv.setAttribute('data-loading', 'true');
		const bars = append(loadingDiv, $('.void-thinking-bars'));
		for (let i = 0; i < 4; i++) {
			append(bars, $('.void-thinking-bar'));
		}
		const label = append(loadingDiv, $('.void-thinking-label'));
		label.textContent = 'thinking';

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

	private renderUserMessageBubble(text: string, attachments: HistoryAttachmentPreview[]): void {
		if (!this.messagesContainer) {
			return;
		}

		const messageDiv = append(this.messagesContainer, $('.void-message.void-message-user'));
		const contentDiv = append(messageDiv, $('.void-message-content'));
		contentDiv.textContent = text;
		if (attachments.length > 0) {
			const attachmentsBlock = append(messageDiv, $('.void-user-attachments'));
			for (const file of attachments) {
				const item = append(attachmentsBlock, $('.void-user-attachment-item'));
				const title = append(item, $('.void-user-attachment-title'));
				title.textContent = `Attached file ${file.name}:`;
				const preview = append(item, $('.void-user-attachment-preview'));
				preview.textContent = file.preview || '[content will be read from path]';
			}
		}
	}
	
	private addUserMessage(text: string, attachments: AttachedFile[] = [], persistToHistory: boolean = true): void {
		if (!this.messagesContainer) {
			return;
		}
		const attachmentPreviews = attachments.map(file => ({
			name: file.name,
			preview: ((file.inlineContent ?? '').trim() || '[content will be read from path]').slice(0, 800)
		}));
		this.renderUserMessageBubble(text, attachmentPreviews);

		this.currentRunContainer = undefined;
		this.contextSegments.push({ role: 'user', text });
		for (const file of attachments) {
			const body = (file.inlineContent ?? '').trim();
			this.contextSegments.push({
				role: 'user',
				text: `Attached file ${file.name}: ${body ? body.slice(0, 4000) : '[content will be read from path]'}`
			});
		}
		if (persistToHistory) {
			this.appendHistoryMessage('user', text, attachmentPreviews);
		}
		this.updateContextMeter();
		this.updateEmptyStateVisibility();
		this.scrollToBottom();
	}
	
	private handleQwenEvent(event: any): void {
		if (!this.messagesContainer) {
			return;
		}
		
		const eventType = event.type;
		
		// Remove loading indicator if exists
		this.removeLoadingIndicator();
		
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
				this.scheduleFileTreeRefresh();
				break;
			case 'error':
				this.addErrorMessage(event.message?.content || 'An error occurred');
				this.addRunCompletionMarker();
				this.scheduleFileTreeRefresh();
				break;
			case 'result':
				this.addRunCompletionMarker();
				this.scheduleFileTreeRefresh();
				break;
		}
		
		this.updateEmptyStateVisibility();
		this.scrollToBottom();
	}

	private scheduleFileTreeRefresh(delayMs: number = 160): void {
		if (this.fileRefreshHandle) {
			clearTimeout(this.fileRefreshHandle);
		}
		this.fileRefreshHandle = setTimeout(() => {
			this.fileRefreshHandle = undefined;
			this.refreshFileTree();
		}, delayMs);
	}
	
	private addAssistantMessage(text: string, persistToHistory: boolean = true): void {
		if (!this.messagesContainer) {
			return;
		}

		const runContainer = this.ensureRunContainer();
		const eventRow = append(runContainer, $('.void-run-event.void-run-event-assistant'));
		append(eventRow, $('.void-run-marker.void-run-marker-assistant'));
		const messageDiv = append(eventRow, $('.void-assistant-message'));
		const contentDiv = append(messageDiv, $('.void-message-content.void-assistant-text'));
		this.renderMarkdownSafe(contentDiv, text);
		this.contextSegments.push({ role: 'assistant', text });
		if (persistToHistory) {
			this.appendHistoryMessage('assistant', text);
		}
		this.updateContextMeter();
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
				bullet.textContent = '*';
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
		wrapper.tabIndex = 0;
		wrapper.setAttribute('aria-label', 'Table');
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
		const toolCallId = data.metadata?.toolCallId || `${toolName}:${JSON.stringify(toolInput).slice(0, 128)}`;
		const startedAt = Date.now();
		if (this.seenToolCalls.has(toolCallId)) {
			return;
		}
		this.seenToolCalls.add(toolCallId);
		
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

		const resolvedPaths = this.extractToolPaths(toolInput);
		const runContainer = this.ensureRunContainer();
		const eventRow = append(runContainer, $('.void-run-event.void-run-event-tool'));
		const marker = append(eventRow, $('.void-run-marker.void-run-marker-tool.pending'));
		const card = append(eventRow, $('.void-tool-card'));
		const staticCard = this.isPlanTool(toolName);
		card.classList.toggle('collapsed', this.shouldCollapseToolCard(toolName));
		card.classList.toggle('void-tool-card-static', staticCard);

		const header = staticCard
			? append(card, $('div.void-tool-card-header.void-tool-card-header-static'))
			: append(card, $('button.void-tool-card-header')) as HTMLElement;
		if (!staticCard) {
			const headerButton = header as HTMLButtonElement;
			headerButton.type = 'button';
			headerButton.setAttribute('aria-label', 'Toggle tool card');
		}
		const iconDiv = append(header, $('.void-message-tool-icon'));
		this.setToolIcon(iconDiv, toolName, false);
		const title = append(header, $('.void-message-tool-title'));
		title.textContent = this.getToolTitle(toolName);
		if (!staticCard) {
			append(header, $('span.void-tool-card-chevron.codicon.codicon-chevron-down'));
		}
		const info = append(card, $('.void-tool-card-body'));
		const statusLine = append(info, $('.void-tool-status-line'));
		statusLine.style.display = 'none';

		const commandMeta = this.renderToolContent(info, toolName, toolInput, toolCallId, startedAt, resolvedPaths);
		if (!staticCard) {
			header.addEventListener('click', () => {
				card.classList.toggle('collapsed');
			});
		}

		this.toolCards.set(toolCallId, {
			root: card,
			marker,
			body: info,
			name: toolName,
			statusLine,
			startedAt,
			commandMeta,
			inputPaths: resolvedPaths
		});
		this.scrollToBottom();
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

	private isPlanTool(toolName: string): boolean {
		const name = toolName.toLowerCase();
		return name.includes('plan') || name.includes('task');
	}

	private isCommandTool(toolName: string): boolean {
		const name = toolName.toLowerCase();
		return name.includes('shell') || name.includes('execute') || name.includes('command') || name.includes('run');
	}

	private isReadTool(toolName: string): boolean {
		const name = toolName.toLowerCase();
		return name.includes('read') && !name.includes('thread') && !name.includes('spread');
	}
	
	private getToolTitle(toolName: string): string {
		const normalized = toolName.toLowerCase();
		if (normalized.includes('plan')) {
			return 'Plan';
		} else if (normalized.includes('task')) {
			return 'Task';
		} else if (normalized.includes('write') || normalized.includes('edit') || normalized.includes('str_replace')) {
			return 'Edit file(s)';
		} else if (normalized.includes('read')) {
			return 'Read file(s)';
		} else if (normalized.includes('grep') || normalized.includes('search')) {
			return 'Search';
		} else if (normalized.includes('web')) {
			return 'Web Search';
		} else if (normalized.includes('execute')) {
			return 'Command';
		} else if (normalized.includes('control') || normalized.includes('process')) {
			return 'Background Process';
		}
		return toolName;
	}

	private extractPlanTasks(toolInput: any): Array<{ text: string; completed: boolean }> {
		const result: Array<{ text: string; completed: boolean }> = [];
		if (!toolInput || typeof toolInput !== 'object') {
			return result;
		}

		const normalizeTask = (raw: any): { text: string; completed: boolean } | null => {
			if (typeof raw === 'string') {
				const text = raw.trim();
				return text ? { text, completed: false } : null;
			}
			if (!raw || typeof raw !== 'object') {
				return null;
			}
			const text = this.pickFirstString(raw, ['text', 'task', 'title', 'description', 'prompt', 'instruction']);
			if (!text) {
				return null;
			}
			const completed = Boolean(raw.completed ?? raw.done ?? raw.is_done ?? raw.finished);
			return { text, completed };
		};

		const list = toolInput.plan ?? toolInput.tasks ?? toolInput.todo ?? toolInput.items;
		if (Array.isArray(list)) {
			for (const item of list) {
				const normalized = normalizeTask(item);
				if (normalized) {
					result.push(normalized);
				}
			}
		}

		if (!result.length) {
			const single = normalizeTask({
				text: this.pickFirstString(toolInput, ['task', 'description', 'prompt', 'instruction']),
				completed: Boolean(toolInput.completed ?? toolInput.done ?? toolInput.is_done)
			});
			if (single) {
				result.push(single);
			}
		}

		return result;
	}

	private createInlinePlanCard(container: HTMLElement, tasks: Array<{ text: string; completed: boolean }>): void {
		if (!tasks.length) {
			return;
		}
		const planCard = append(container, $('.void-plan-card'));
		for (let index = 0; index < tasks.length; index++) {
			const task = tasks[index];
			const taskDiv = append(planCard, $('.void-plan-task'));
			if (task.completed) {
				taskDiv.classList.add('completed');
			}
			const num = append(taskDiv, $('.void-plan-num'));
			num.textContent = `${index + 1}.`;
			const text = append(taskDiv, $('.void-plan-text'));
			text.textContent = task.text;
		}
	}
	
	private renderToolContent(
		container: HTMLElement,
		toolName: string,
		toolInput: any,
		toolCallId: string,
		startedAt: number,
		resolvedPaths?: string[]
	): CommandCardMeta | undefined {
		console.log('[Tool Content] Rendering:', toolName, 'Full input:', JSON.stringify(toolInput));
		
		const filesContainer = append(container, $('.void-message-tool-files'));
		let commandMeta: CommandCardMeta | undefined;

		const normalizedName = toolName.toLowerCase();

		// Plan/Todo tools
		if (this.isPlanTool(toolName)) {
			const tasks = this.extractPlanTasks(toolInput);
			if (tasks.length > 0) {
				this.createInlinePlanCard(filesContainer, tasks);
			}
			const action = String(toolInput.action || '')
				.replace(/delegate:[a-z0-9_-]+/gi, 'planning')
				.replace(/\b(planner|researcher|implementer|verifier|critic|subagent|agent)\b/gi, '')
				.trim();
			const task = this.pickFirstString(toolInput, ['task', 'description', 'prompt', 'instruction']);
			const taskIndex = toolInput.taskIndex ?? toolInput.task_index;
			const label = [
				action,
				task ? ` ${task}` : '',
				taskIndex !== undefined ? ` #${taskIndex}` : ''
			].join('').trim();
			if (label) {
				this.createQueryCard(filesContainer, label);
			} else if (filesContainer.childElementCount === 0) {
				this.createQueryCard(filesContainer, 'Planning step');
			}
		}

		// File operations (read, write, edit, delete, append, move)
		if (
			normalizedName.includes('read') ||
			normalizedName.includes('write') ||
			normalizedName.includes('edit') ||
			normalizedName.includes('str_replace') ||
			normalizedName.includes('delete') ||
			normalizedName.includes('append') ||
			normalizedName.includes('rename') ||
			normalizedName.includes('move')
		) {
			const paths = resolvedPaths ?? this.extractToolPaths(toolInput);
			if (paths.length > 0) {
				for (const path of paths) {
					if (normalizedName.includes('edit') || normalizedName.includes('str_replace') || normalizedName.includes('write') || normalizedName.includes('append')) {
						const oldStr = this.pickFirstEditOldValue(toolInput);
						const newStr = this.pickFirstEditNewValue(toolInput);
						const diffPayload = this.pickFirstDiffPayload(toolInput);
						this.createEditCard(filesContainer, path, oldStr, newStr, diffPayload);
					} else {
						this.createFileCard(filesContainer, path);
					}
				}
			}
			if (normalizedName.includes('write') || normalizedName.includes('edit') || normalizedName.includes('str_replace') || normalizedName.includes('append') || normalizedName.includes('delete') || normalizedName.includes('rename') || normalizedName.includes('move')) {
				void this.captureRunFileSnapshots(paths);
			}
		}
		// Directory listing
		else if (normalizedName.includes('ls') || normalizedName.includes('list')) {
			const dirPath = this.pickFirstString(toolInput, ['absolute_path', 'path', 'directory', 'dir']);
			if (dirPath) {
				this.createQueryCard(filesContainer, dirPath);
			}
		}
		// Glob/File search operations
		else if (normalizedName.includes('glob')) {
			const pattern = this.pickFirstString(toolInput, ['pattern', 'glob', 'query']);
			if (pattern) {
				this.createQueryCard(filesContainer, pattern);
			}
		}
		// Grep/Content search operations
		else if (normalizedName.includes('grep') || normalizedName.includes('search')) {
			const query = this.pickFirstString(toolInput, ['pattern', 'query', 'search']);
			const glob = this.pickFirstString(toolInput, ['glob']);
			if (query) {
				this.createQueryCard(filesContainer, `"${query}"${glob ? ` in ${glob}` : ''}`);
			}
			const inlineSources = this.extractUrls(this.stringifyToolResult(toolInput)).slice(0, 4);
			if (inlineSources.length > 0) {
				this.createInlineSourcesCard(filesContainer, inlineSources);
			}
		}
		// Web search/fetch
		else if (normalizedName.includes('web')) {
			const query = this.pickFirstString(toolInput, ['query', 'url', 'search']);
			if (query) {
				this.createQueryCard(filesContainer, query);
			}
			const inlineSources = this.extractUrls(this.stringifyToolResult(toolInput)).slice(0, 4);
			if (inlineSources.length > 0) {
				this.createInlineSourcesCard(filesContainer, inlineSources);
			}
		}
		// Shell/Execute/Command operations
		else if (normalizedName.includes('shell') || normalizedName.includes('execute') || normalizedName.includes('command') || normalizedName.includes('run')) {
			const command = this.pickFirstString(toolInput, ['command', 'cmd', 'code']);
			if (command) {
				commandMeta = this.createCommandCard(filesContainer, command, toolCallId, startedAt);
			}
		}
		// Process control (start/stop background processes)
		else if (normalizedName.includes('control') || normalizedName.includes('process')) {
			const command = this.pickFirstString(toolInput, ['command', 'cmd']);
			const action = this.pickFirstString(toolInput, ['action']) || 'run';
			if (command) {
				commandMeta = this.createCommandCard(filesContainer, `${action}: ${command}`, toolCallId, startedAt);
			}
		}
		// Hook creation
		else if (normalizedName.includes('hook')) {
			const hookName = this.pickFirstString(toolInput, ['name', 'id']) || 'hook';
			this.createQueryCard(filesContainer, hookName);
		}
		// Diagnostics
		else if (normalizedName.includes('diagnostic')) {
			const paths = this.extractToolPaths(toolInput);
			if (paths.length > 0) {
				for (const path of paths) {
					this.createFileCard(filesContainer, path);
				}
			}
		}
		// Memory/Save operations
		else if (normalizedName.includes('memory') || normalizedName.includes('save')) {
			const fact = this.pickFirstString(toolInput, ['fact', 'content']);
			if (fact) {
				this.createQueryCard(filesContainer, fact.substring(0, 80));
			}
		}

		// Never leave tool cards visually empty.
		if (filesContainer.childElementCount === 0) {
			this.createQueryCard(filesContainer, this.summarizeToolInput(toolName, toolInput));
		}

		// Trigger a single debounced file-tree refresh after tool execution.
		this.scheduleFileTreeRefresh();
		return commandMeta;
	}

	private pickFirstString(toolInput: any, keys: string[]): string {
		for (const key of keys) {
			const value = toolInput?.[key];
			if (typeof value === 'string' && value.trim().length > 0) {
				return value.trim();
			}
		}
		return '';
	}

	private pickFirstEditOldValue(toolInput: any): string {
		return this.pickFirstString(toolInput, [
			'oldStr', 'old_str', 'oldText', 'old_text', 'oldContent', 'old_content',
			'before', 'search', 'find', 'from', 'source', 'current', 'text_to_replace'
		]);
	}

	private pickFirstEditNewValue(toolInput: any): string {
		return this.pickFirstString(toolInput, [
			'newStr', 'new_str', 'newText', 'new_text', 'newContent', 'new_content',
			'after', 'replacement', 'replace', 'content', 'replace_with', 'to', 'target'
		]);
	}

	private pickFirstDiffPayload(toolInput: any): string {
		return this.pickFirstString(toolInput, [
			'diff', 'patch', 'unified_diff', 'delta', 'changes'
		]);
	}

	private extractToolPaths(toolInput: any): string[] {
		const candidates: string[] = [];
		const listKeys = ['paths', 'files', 'file_paths', 'targets'];
		for (const key of listKeys) {
			const value = toolInput?.[key];
			if (Array.isArray(value)) {
				for (const item of value) {
					if (typeof item === 'string' && item.trim()) {
						candidates.push(item.trim());
					}
				}
			}
		}

		const singleKeys = [
			'absolute_path', 'absolutePath',
			'path', 'file', 'filepath', 'filePath', 'file_path',
			'targetFile', 'target_file', 'target_path',
			'source', 'source_path', 'oldPath', 'old_path',
			'destination', 'destination_path', 'dest', 'newPath', 'new_path',
			'to', 'from'
		];
		for (const key of singleKeys) {
			const value = toolInput?.[key];
			if (typeof value === 'string' && value.trim()) {
				candidates.push(value.trim());
			}
		}

		const uniq = new Set<string>();
		for (const value of candidates) {
			uniq.add(this.resolveWorkspaceFilePath(value));
		}
		return [...uniq].filter(Boolean);
	}

	private summarizeToolInput(toolName: string, toolInput: any): string {
		if (this.isPlanTool(toolName)) {
			return 'Planning step';
		}
		try {
			if (!toolInput || typeof toolInput !== 'object') {
				return `${toolName}: no details`;
			}
			const compact = JSON.stringify(toolInput);
			if (!compact || compact === '{}') {
				return `${toolName}: no details`;
			}
			return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
		} catch {
			return `${toolName}: details unavailable`;
		}
	}

	private resolveWorkspaceFilePath(filePath: string): string {
		if (!filePath) {
			return '';
		}
		const trimmed = filePath.trim();
		if (!trimmed) {
			return '';
		}
		if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('/')) {
			return trimmed;
		}
		if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
			try {
				return URI.parse(trimmed).fsPath || trimmed;
			} catch {
				return trimmed;
			}
		}
		const workspace = this.workspaceContextService.getWorkspace().folders[0]?.uri;
		if (!workspace) {
			return trimmed;
		}
		const segments = trimmed.replace(/\\/g, '/').split('/').filter(Boolean);
		return URI.joinPath(workspace, ...segments).fsPath;
	}

	private async captureRunFileSnapshots(paths: string[]): Promise<void> {
		for (const path of paths) {
			if (!path) {
				continue;
			}
			this.runTouchedFiles.add(path);
			if (this.runFileSnapshots.has(path)) {
				continue;
			}
			try {
				const content = await this.fileService.readFile(URI.file(path));
				this.runFileSnapshots.set(path, {
					exists: true,
					content: this.tryDecodeUtf8(content.value.buffer)
				});
			} catch {
				this.runFileSnapshots.set(path, {
					exists: false,
					content: ''
				});
			}
		}
	}
	
	private refreshFileTree(): void {
		try {
			this.explorerService.refresh();
		} catch {
			// Ignore refresh errors to keep chat flow stable.
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
		card.addEventListener('click', () => void this.openFileByPath(filePath));
	}
	
	private createEditCard(container: HTMLElement, filePath: string, oldStr: string, newStr: string, diffPayload: string = ''): void {
		const card = append(container, $('.void-tool-edit-card'));
		const ext = filePath.split('.').pop() || '';
		const name = filePath.split(/[/\\]/).pop() || filePath;
		let rows = this.buildEditPreviewRows(oldStr, newStr);
		if (!rows.length && diffPayload) {
			rows = this.buildRowsFromUnifiedDiff(diffPayload);
		}
		const added = rows.filter(row => row.kind === 'add').length;
		const removed = rows.filter(row => row.kind === 'remove').length;

		const header = append(card, $('.void-tool-edit-header'));
		const left = append(header, $('.void-tool-edit-header-left'));
		const icon = append(left, $('.void-tool-file-icon.codicon'));
		icon.classList.add(this.getLanguageIcon(ext));

		const fileName = append(left, $('.void-tool-file-name'));
		fileName.textContent = name;
		fileName.title = filePath;

		if (added > 0) {
			const plusStat = append(left, $('.void-tool-edit-stat.plus'));
			plusStat.textContent = `+${added}`;
		}
		if (removed > 0) {
			const minusStat = append(left, $('.void-tool-edit-stat.minus'));
			minusStat.textContent = `-${removed}`;
		}

		const copyBtn = append(header, $('button.void-tool-edit-copy.codicon.codicon-copy')) as HTMLButtonElement;
		copyBtn.type = 'button';
		copyBtn.setAttribute('aria-label', 'Copy patch preview');
		copyBtn.setAttribute('data-tooltip', 'Copy');
		copyBtn.addEventListener('click', () => {
			const text = rows.map(row => `${row.kind === 'add' ? '+' : row.kind === 'remove' ? '-' : ' '} ${row.text}`).join('\n');
			void this.copyTextToClipboard(text);
		});

		header.addEventListener('dblclick', () => {
			void this.openFileByPath(filePath);
		});

		const body = append(card, $('.void-tool-edit-body'));
		const scroll = append(body, $('.void-tool-edit-scroll'));
		const code = append(scroll, $('.void-tool-edit-code'));
		const dynamicHeight = Math.min(460, Math.max(130, rows.length * 18 + 22));
		scroll.style.maxHeight = `${dynamicHeight}px`;
		if (!rows.length) {
			const line = append(code, $('.void-tool-edit-line.context'));
			const ln = append(line, $('.void-tool-edit-ln'));
			ln.textContent = '.';
			const txt = append(line, $('.void-tool-edit-text'));
			txt.textContent = 'No diff preview available';
		} else {
			this.appendEditRows(code, rows, ext);
		}
	}

	private buildEditPreviewRows(oldStr: string, newStr: string, maxRows: number = 220): Array<{ kind: 'add' | 'remove' | 'context'; text: string; oldNo?: number; newNo?: number }> {
		const cleanOld = oldStr.replace(/\r/g, '');
		const cleanNew = newStr.replace(/\r/g, '');
		const oldLines = cleanOld.length ? cleanOld.split('\n') : [];
		const newLines = cleanNew.length ? cleanNew.split('\n') : [];

		if (!oldLines.length && !newLines.length) {
			return [];
		}

		// Use dynamic-programming line diff for stable edit previews.
		const n = Math.min(oldLines.length, 800);
		const m = Math.min(newLines.length, 800);
		const a = oldLines.slice(0, n);
		const b = newLines.slice(0, m);
		const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
		for (let i = 1; i <= n; i++) {
			for (let j = 1; j <= m; j++) {
				dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}

		const reversed: Array<{ kind: 'add' | 'remove' | 'context'; text: string }> = [];
		let i = n;
		let j = m;
		while (i > 0 || j > 0) {
			if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
				reversed.push({ kind: 'context', text: a[i - 1] });
				i--;
				j--;
			} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
				reversed.push({ kind: 'add', text: b[j - 1] });
				j--;
			} else {
				reversed.push({ kind: 'remove', text: a[i - 1] });
				i--;
			}
		}

		const ops = reversed.reverse();
		let oldNo = 1;
		let newNo = 1;
		const rows: Array<{ kind: 'add' | 'remove' | 'context'; text: string; oldNo?: number; newNo?: number }> = [];
		for (const op of ops) {
			if (op.kind === 'context') {
				rows.push({ kind: 'context', text: op.text, oldNo, newNo });
				oldNo++;
				newNo++;
			} else if (op.kind === 'remove') {
				rows.push({ kind: 'remove', text: op.text, oldNo });
				oldNo++;
			} else {
				rows.push({ kind: 'add', text: op.text, newNo });
				newNo++;
			}
		}

		const firstChange = rows.findIndex(row => row.kind !== 'context');
		if (firstChange === -1) {
			return rows.slice(0, Math.min(maxRows, 24));
		}
		let lastChange = firstChange;
		for (let idx = rows.length - 1; idx >= 0; idx--) {
			if (rows[idx].kind !== 'context') {
				lastChange = idx;
				break;
			}
		}

		const contextPadding = 3;
		const start = Math.max(0, firstChange - contextPadding);
		const end = Math.min(rows.length - 1, lastChange + contextPadding);
		const sliced = rows.slice(start, end + 1);
		return sliced.slice(0, maxRows);
	}

	private appendEditRows(
		code: HTMLElement,
		rows: Array<{ kind: 'add' | 'remove' | 'context'; text: string; oldNo?: number; newNo?: number }>,
		ext: string
	): void {
		for (const row of rows) {
			const line = append(code, $(`.void-tool-edit-line.${row.kind}`));
			const ln = append(line, $('.void-tool-edit-ln'));
			ln.textContent = row.newNo !== undefined ? `${row.newNo}` : row.oldNo !== undefined ? `${row.oldNo}` : '';
			const txt = append(line, $('.void-tool-edit-text'));
			const prefix = row.kind === 'add' ? '+' : row.kind === 'remove' ? '-' : ' ';
			const prefixEl = append(txt, $('.void-tool-edit-prefix'));
			prefixEl.textContent = `${prefix} `;
			this.renderHighlightedCode(txt, row.text, ext);
		}
	}

	private renderHighlightedCode(container: HTMLElement, line: string, ext: string): void {
		const language = ext.toLowerCase();
		const keywordSets: Record<string, string[]> = {
			ts: ['const', 'let', 'var', 'function', 'class', 'private', 'public', 'protected', 'return', 'if', 'else', 'for', 'while', 'new', 'import', 'from', 'export', 'async', 'await', 'interface', 'type'],
			js: ['const', 'let', 'var', 'function', 'class', 'return', 'if', 'else', 'for', 'while', 'new', 'import', 'from', 'export', 'async', 'await'],
			rs: ['fn', 'let', 'mut', 'pub', 'struct', 'impl', 'enum', 'match', 'if', 'else', 'for', 'while', 'loop', 'return', 'use', 'mod', 'trait'],
			py: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from', 'as', 'async', 'await', 'with', 'try', 'except'],
			css: ['color', 'background', 'display', 'position', 'width', 'height', 'padding', 'margin', 'border', 'font-size', 'line-height'],
			html: ['div', 'span', 'button', 'input', 'class', 'id', 'style']
		};
		const keywords = keywordSets[language] ?? keywordSets.ts;
		const keywordPattern = keywords.length ? `\\b(?:${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b` : '$^';
		const tokenRegex = new RegExp(`(\\/\\/.*$|#.*$|\"(?:\\\\.|[^\"])*\"|'(?:\\\\.|[^'])*'|\\b\\d+(?:\\.\\d+)?\\b|${keywordPattern})`, 'g');

		let cursor = 0;
		for (const match of line.matchAll(tokenRegex)) {
			const token = match[0];
			const index = match.index ?? 0;
			if (index > cursor) {
				container.appendChild(document.createTextNode(line.slice(cursor, index)));
			}
			const span = append(container, $('span'));
			span.textContent = token;
			if (token.startsWith('//') || token.startsWith('#')) {
				span.className = 'void-syn-comment';
			} else if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith('\'') && token.endsWith('\''))) {
				span.className = 'void-syn-string';
			} else if (/^\d/.test(token)) {
				span.className = 'void-syn-number';
			} else {
				span.className = 'void-syn-keyword';
			}
			cursor = index + token.length;
		}
		if (cursor < line.length) {
			container.appendChild(document.createTextNode(line.slice(cursor)));
		}
	}

	private buildRowsFromUnifiedDiff(diffText: string, maxRows: number = 140): Array<{ kind: 'add' | 'remove' | 'context'; text: string; oldNo?: number; newNo?: number }> {
		if (!diffText.trim()) {
			return [];
		}

		const rows: Array<{ kind: 'add' | 'remove' | 'context'; text: string; oldNo?: number; newNo?: number }> = [];
		const lines = diffText.replace(/\r/g, '').split('\n');
		let oldNo = 1;
		let newNo = 1;
		const hunkPattern = /^@@\s*-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s*@@/;

		for (const line of lines) {
			if (rows.length >= maxRows) {
				break;
			}

			const hunk = line.match(hunkPattern);
			if (hunk) {
				oldNo = Number(hunk[1]) || oldNo;
				newNo = Number(hunk[2]) || newNo;
				continue;
			}

			if (
				line.startsWith('diff ') ||
				line.startsWith('index ') ||
				line.startsWith('---') ||
				line.startsWith('+++') ||
				line.startsWith('@@')
			) {
				continue;
			}

			if (line.startsWith('+')) {
				rows.push({ kind: 'add', text: line.slice(1), newNo });
				newNo++;
				continue;
			}

			if (line.startsWith('-')) {
				rows.push({ kind: 'remove', text: line.slice(1), oldNo });
				oldNo++;
				continue;
			}

			if (line.startsWith(' ')) {
				rows.push({ kind: 'context', text: line.slice(1), oldNo, newNo });
				oldNo++;
				newNo++;
			}
		}

		return rows.slice(0, maxRows);
	}

	private async openFileByPath(filePath: string): Promise<void> {
		try {
			const uri = URI.file(filePath);
			await this.openerService.open(uri, { openToSide: false });
			console.log('[Qwen] Opened file:', filePath);
		} catch (error) {
			console.error('[Qwen] Failed to open file:', error);
		}
	}

	private async copyTextToClipboard(text: string): Promise<void> {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				return;
			}
		} catch {
			// fall through to legacy copy path
		}

		const ta = document.createElement('textarea');
		ta.value = text;
		ta.setAttribute('readonly', 'true');
		ta.style.position = 'fixed';
		ta.style.opacity = '0';
		ta.style.pointerEvents = 'none';
		document.body.appendChild(ta);
		ta.select();
		try {
			document.execCommand('copy');
		} finally {
			document.body.removeChild(ta);
		}
	}
	
	private createQueryCard(container: HTMLElement, query: string): void {
		const card = append(container, $('.void-tool-file-card.void-tool-query-card'));
		
		// Search icon
		append(card, $('.void-tool-file-icon.codicon.codicon-search'));
		
		// Query text
		const queryText = append(card, $('.void-tool-file-name'));
		queryText.textContent = query;
	}

	private createInlineSourcesCard(container: HTMLElement, urls: string[]): void {
		const sources = append(container, $('.void-tool-sources'));
		const title = append(sources, $('.void-tool-sources-title'));
		title.textContent = 'Sources';
		const list = append(sources, $('.void-tool-sources-list'));
		for (const url of urls) {
			const item = append(list, $('.void-tool-sources-item'));
			const link = append(item, $('a.void-tool-sources-link')) as HTMLAnchorElement;
			link.href = url;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			link.textContent = url;
			link.title = url;
		}
	}
	
	private createCommandCard(
		container: HTMLElement,
		command: string,
		toolCallId: string = '',
		startedAt: number = Date.now()
	): CommandCardMeta {
		const root = append(container, $('.void-tool-command'));
		const runLine = append(root, $('button.void-tool-command-run')) as HTMLButtonElement;
		runLine.type = 'button';
		const runPrefix = append(runLine, $('.void-tool-command-ran'));
		runPrefix.textContent = 'Ran';
		const commandText = append(runLine, $('.void-tool-command-name'));
		commandText.textContent = command;
		commandText.title = command;
		runLine.setAttribute('aria-label', `Ran ${command}`);
		if (toolCallId) {
			runLine.setAttribute('data-tool-call-id', toolCallId);
		}

		const details = append(root, $('.void-tool-command-details'));
		details.classList.add('collapsed');

		const header = append(details, $('.void-tool-command-header'));
		const headerCmd = append(header, $('.void-tool-command-header-cmd'));
		headerCmd.textContent = command;
		headerCmd.title = command;
		const durationText = append(header, $('.void-tool-command-duration'));
		durationText.textContent = `${this.formatDuration(Math.max(0, Date.now() - startedAt))} - running`;

		const body = append(details, $('.void-tool-command-body'));
		const outputText = append(body, $('.void-tool-command-output'));
		outputText.textContent = 'No output yet';

		runLine.addEventListener('click', () => {
			details.classList.toggle('collapsed');
		});

		return {
			command,
			runLine,
			details,
			durationText,
			outputText
		};
	}
	
	private addToolResultMessage(data: any): void {
		const toolUseId = data.metadata?.toolUseId;
		if (toolUseId && this.toolCards.has(toolUseId)) {
			const ref = this.toolCards.get(toolUseId)!;
			ref.marker.classList.remove('pending');
			ref.marker.classList.toggle('error', Boolean(data.metadata?.isError));
			ref.marker.classList.toggle('success', !Boolean(data.metadata?.isError));
			const readEntries = this.isReadTool(ref.name) ? this.extractReadResultEntries(data.content, ref.inputPaths ?? []) : [];
			if (!data.metadata?.isError && ref.statusLine) {
				if (this.isReadTool(ref.name) && readEntries.length > 0) {
					ref.statusLine.textContent = readEntries.length === 1 ? 'Read 1 file' : `Read ${readEntries.length} files`;
					ref.statusLine.style.display = 'block';
				} else {
					const summaryCount = this.tryExtractFileCount(data.content);
					if (summaryCount > 1) {
						ref.statusLine.textContent = `Read ${summaryCount} files`;
						ref.statusLine.style.display = 'block';
					}
				}
			}
			if (!data.metadata?.isError) {
				this.hydrateEditPreviewFromResult(ref, data.content);
				this.hydrateCommandCardFromResult(ref, data.content);
				this.hydrateWebSearchCardFromResult(ref, data.content);
				this.hydrateReadPreviewFromResult(ref, data.content, readEntries);
				this.hydrateGenericResultSummary(ref, data.content);
			}
			if (data.metadata?.isError) {
				this.hydrateCommandCardFromResult(ref, data.content, true);
				const errorText = this.stringifyToolResult(data.content).slice(0, 600);
				const errorLine = append(ref.body, $('.void-tool-error-line'));
				errorLine.textContent = errorText;
				ref.root.classList.remove('collapsed');
			}
			return;
		}

		// Fallback: keep plan output as structured card when it appears without matching tool_use_id.
		const result = data.content;
		try {
			const parsed = typeof result === 'string' ? JSON.parse(result) : result;
			if (parsed?.plan && Array.isArray(parsed.plan) && parsed.plan.length > 0) {
				this.addPlanCard(parsed.plan);
			}
		} catch {
			// Intentionally ignore raw output to avoid output-card spam.
		}
	}

	private hydrateCommandCardFromResult(ref: ToolCardRef, content: unknown, isError: boolean = false): void {
		if (!this.isCommandTool(ref.name) || !ref.commandMeta) {
			return;
		}
		const parsed = this.extractCommandResult(content);
		const durationMs = parsed.durationMs ?? Math.max(0, Date.now() - (ref.startedAt ?? Date.now()));
		const durationLabel = `${this.formatDuration(durationMs)}${parsed.exitCode !== undefined ? ` - exit ${parsed.exitCode}` : ''}`;
		ref.commandMeta.durationText.textContent = durationLabel;
		ref.commandMeta.outputText.textContent = parsed.output || (isError ? 'Command failed with no output' : 'No output');
		if (isError) {
			ref.commandMeta.details.classList.remove('collapsed');
			ref.commandMeta.runLine.classList.add('error');
		} else {
			ref.commandMeta.runLine.classList.add('done');
		}
	}

	private hydrateWebSearchCardFromResult(ref: ToolCardRef, content: unknown): void {
		const name = ref.name.toLowerCase();
		if (!name.includes('web') && !name.includes('search')) {
			return;
		}
		if (ref.body.querySelector('.void-tool-sources')) {
			return;
		}
		const text = this.stringifyToolResult(content);
		const urls = this.extractUrls(text).slice(0, 8);
		if (!urls.length) {
			return;
		}

		const sources = append(ref.body, $('.void-tool-sources'));
		const title = append(sources, $('.void-tool-sources-title'));
		title.textContent = 'Sources';

		const list = append(sources, $('.void-tool-sources-list'));
		for (const url of urls) {
			const item = append(list, $('.void-tool-sources-item'));
			const link = append(item, $('a.void-tool-sources-link')) as HTMLAnchorElement;
			link.href = url;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			link.textContent = url;
			link.title = url;
		}
	}

	private hydrateReadPreviewFromResult(ref: ToolCardRef, content: unknown, preParsedEntries?: Array<{ path: string; text: string }>): void {
		if (!this.isReadTool(ref.name)) {
			return;
		}
		if (ref.body.querySelector('.void-tool-edit-card')) {
			return;
		}

		const entries = preParsedEntries && preParsedEntries.length
			? preParsedEntries
			: this.extractReadResultEntries(content, ref.inputPaths ?? []);
		if (!entries.length) {
			return;
		}

		const filesContainer = ref.body.querySelector('.void-message-tool-files') as HTMLElement | null;
		if (filesContainer) {
			filesContainer.querySelectorAll('.void-tool-file-card').forEach(node => node.remove());
			const uniquePaths = [...new Set(entries.map(entry => entry.path).filter(path => path.length > 0))];
			for (const path of uniquePaths) {
				this.createFileCard(filesContainer, path);
			}
		}

		const oldPreview = ref.body.querySelector('.void-tool-read-preview');
		oldPreview?.remove();

		const previewEntry = entries.find(entry => entry.text.trim().length > 0);
		if (!previewEntry) {
			return;
		}

		const preview = previewEntry.text.trim();
		if (!preview) {
			return;
		}

		const maxChars = 2400;
		const clipped = preview.length > maxChars ? `${preview.slice(0, maxChars)}\n...` : preview;

		const card = append(ref.body, $('.void-tool-read-preview'));
		const title = append(card, $('.void-tool-read-title'));
		const baseName = previewEntry.path.split(/[/\\]/).pop() || 'Preview';
		title.textContent = entries.length > 1 ? `${baseName} (+${entries.length - 1} more)` : baseName;
		const body = append(card, $('pre.void-tool-read-body'));
		body.textContent = clipped;
	}

	private extractReadResultEntries(content: unknown, fallbackPaths: string[] = []): Array<{ path: string; text: string }> {
		let parsed: any = content;
		if (typeof content === 'string') {
			try {
				parsed = JSON.parse(content);
			} catch {
				parsed = content;
			}
		}

		const entries: Array<{ path: string; text: string }> = [];
		const visit = (value: any, pathHint: string = ''): void => {
			if (typeof value === 'string') {
				const text = value.trim();
				if (text.length > 0 && pathHint) {
					entries.push({ path: this.resolveWorkspaceFilePath(pathHint), text });
				}
				return;
			}

			if (!value || typeof value !== 'object') {
				return;
			}

			const path = this.pickFirstString(value, ['absolute_path', 'absolutePath', 'path', 'file_path', 'filePath', 'file', 'uri']) || pathHint;
			const text = this.pickFirstString(value, ['content', 'text', 'result', 'output', 'new_content', 'data']);
			if (text.trim().length > 0 || path.trim().length > 0) {
				entries.push({ path: this.resolveWorkspaceFilePath(path), text: text.trim() });
			}

			for (const key of ['files', 'results', 'items', 'entries', 'documents', 'reads']) {
				const nested = value[key];
				if (Array.isArray(nested)) {
					for (const item of nested) {
						visit(item, path);
					}
				}
			}
		};

		if (Array.isArray(parsed)) {
			for (const item of parsed) {
				visit(item);
			}
		} else {
			visit(parsed);
		}

		if (!entries.length) {
			const rawText = typeof parsed === 'string'
				? parsed.trim()
				: this.pickFirstString(parsed, ['content', 'text', 'result', 'output', 'new_content']);
			if (rawText) {
				const paths = fallbackPaths.length > 0 ? fallbackPaths : [''];
				for (const path of paths) {
					entries.push({ path: this.resolveWorkspaceFilePath(path), text: rawText });
				}
			}
		}

		const deduped = new Map<string, { path: string; text: string }>();
		for (const entry of entries) {
			const path = entry.path.trim();
			const text = entry.text ?? '';
			if (!path && !text.trim()) {
				continue;
			}
			const key = `${path}::${text}`;
			if (!deduped.has(key)) {
				deduped.set(key, { path, text });
			}
		}
		return [...deduped.values()];
	}

	private hydrateGenericResultSummary(ref: ToolCardRef, content: unknown): void {
		if (this.isCommandTool(ref.name) || this.isPlanTool(ref.name) || this.isReadTool(ref.name)) {
			return;
		}
		if (ref.body.querySelector('.void-tool-result-summary') || ref.body.querySelector('.void-tool-edit-card')) {
			return;
		}
		const text = this.stringifyToolResult(content).trim();
		if (!text) {
			return;
		}
		const summary = append(ref.body, $('.void-tool-result-summary'));
		const label = append(summary, $('.void-tool-result-title'));
		label.textContent = 'Result';
		const body = append(summary, $('.void-tool-result-text'));
		body.textContent = text.length > 900 ? `${text.slice(0, 900)}...` : text;
	}

	private extractUrls(text: string): string[] {
		const matches = text.match(/https?:\/\/[^\s)>"']+/g) ?? [];
		return [...new Set(matches.map(url => url.replace(/[.,;]+$/, '')))];
	}

	private extractCommandResult(content: unknown): { output: string; durationMs?: number; exitCode?: number } {
		let parsed: any = content;
		if (typeof content === 'string') {
			try {
				parsed = JSON.parse(content);
			} catch {
				return { output: content };
			}
		}
		if (!parsed || typeof parsed !== 'object') {
			return { output: this.stringifyToolResult(content) };
		}

		const stdout = typeof parsed.stdout === 'string' ? parsed.stdout : '';
		const stderr = typeof parsed.stderr === 'string' ? parsed.stderr : '';
		const output =
			this.pickFirstString(parsed, ['output', 'result', 'message', 'text']) ||
			(stdout || stderr
				? `${stdout ? `STDOUT:\n${stdout}` : ''}${stdout && stderr ? '\n\n' : ''}${stderr ? `STDERR:\n${stderr}` : ''}`
				: this.stringifyToolResult(parsed));

		const exitCodeRaw = parsed.exit_code ?? parsed.exitCode ?? parsed.code;
		const durationRaw = parsed.duration_ms ?? parsed.durationMs ?? parsed.elapsed_ms;
		const exitCode = Number.isFinite(Number(exitCodeRaw)) ? Number(exitCodeRaw) : undefined;
		const durationMs = Number.isFinite(Number(durationRaw)) ? Number(durationRaw) : undefined;

		return { output, durationMs, exitCode };
	}

	private formatDuration(ms: number): string {
		if (!Number.isFinite(ms) || ms < 1000) {
			return `${Math.max(0, Math.round(ms))}ms`;
		}
		const totalSec = Math.round(ms / 1000);
		const min = Math.floor(totalSec / 60);
		const sec = totalSec % 60;
		if (min <= 0) {
			return `${sec}s`;
		}
		return `${min}m ${sec}s`;
	}

	private stringifyToolResult(content: unknown): string {
		if (typeof content === 'string') {
			return content;
		}
		if (Array.isArray(content)) {
			return content.map(item => this.stringifyToolResult(item)).join('\n');
		}
		if (content && typeof content === 'object') {
			try {
				return JSON.stringify(content, null, 2);
			} catch {
				return String(content);
			}
		}
		return String(content ?? '');
	}

	private tryExtractFileCount(content: unknown): number {
		const text = this.stringifyToolResult(content);
		const match = text.match(/\b(\d+)\s+files?\b/i);
		if (!match) {
			return 0;
		}
		const count = Number(match[1]);
		return Number.isFinite(count) ? count : 0;
	}

	private hydrateEditPreviewFromResult(ref: ToolCardRef, content: unknown): void {
		const name = ref.name.toLowerCase();
		if (!name.includes('edit') && !name.includes('str_replace') && !name.includes('write') && !name.includes('append')) {
			return;
		}
		const code = ref.body.querySelector('.void-tool-edit-code');
		if (!code) {
			return;
		}
		if (code.querySelector('.void-tool-edit-line.add, .void-tool-edit-line.remove')) {
			return;
		}

		let parsed: any = content;
		if (typeof content === 'string') {
			try {
				parsed = JSON.parse(content);
			} catch {
				parsed = { new_content: content };
			}
		}
		if (!parsed || typeof parsed !== 'object') {
			return;
		}

		const oldStr = this.pickFirstEditOldValue(parsed);
		const newStr = this.pickFirstEditNewValue(parsed);
		const diffPayload = this.pickFirstDiffPayload(parsed);
		let rows = this.buildEditPreviewRows(oldStr, newStr);
		if (!rows.length && diffPayload) {
			rows = this.buildRowsFromUnifiedDiff(diffPayload);
		}
		if (!rows.length) {
			rows = this.buildRowsFromUnifiedDiff(this.stringifyToolResult(parsed));
		}
		if (!rows.length) {
			return;
		}
		const fileNameLabel = ref.body.querySelector('.void-tool-file-name')?.textContent ?? '';
		const ext = fileNameLabel.includes('.') ? fileNameLabel.split('.').pop() ?? '' : '';
		const scroll = ref.body.querySelector('.void-tool-edit-scroll') as HTMLElement | null;
		if (scroll) {
			const dynamicHeight = Math.min(460, Math.max(130, rows.length * 18 + 22));
			scroll.style.maxHeight = `${dynamicHeight}px`;
		}
		code.textContent = '';
		this.appendEditRows(code as HTMLElement, rows, ext);
	}
	
	private addPlanCard(tasks: any[]): void {
		if (!this.messagesContainer || !tasks.length) {
			return;
		}
		const normalizedTasks = this.extractPlanTasks({ plan: tasks });
		if (!normalizedTasks.length) {
			return;
		}

		const runContainer = this.ensureRunContainer();
		const row = append(runContainer, $('.void-run-event.void-run-event-tool'));
		const marker = append(row, $('.void-run-marker.void-run-marker-tool.success'));
		marker.classList.remove('pending');
		const card = append(row, $('.void-tool-card'));
		card.classList.add('void-plan-card-static');
		const header = append(card, $('.void-tool-card-header.void-tool-card-header-static'));
		const iconDiv = append(header, $('.void-message-tool-icon'));
		iconDiv.classList.add('success');
		const completedCount = normalizedTasks.filter(t => t.completed).length;
		const title = append(header, $('.void-message-tool-title'));
		title.textContent = `Plan (${completedCount}/${normalizedTasks.length} completed)`;
		const info = append(card, $('.void-tool-card-body'));
		
		const planCard = append(info, $('.void-plan-card'));
		
		normalizedTasks.forEach((task, index) => {
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
	
	private addErrorMessage(text: string, persistToHistory: boolean = true): void {
		if (!this.messagesContainer) {
			return;
		}
		
		const messageDiv = append(this.messagesContainer, $('.void-message.void-message-error'));
		const contentDiv = append(messageDiv, $('.void-message-content'));
		contentDiv.textContent = text;
		if (persistToHistory) {
			this.appendHistoryMessage('error', text);
		}
	}

	private addRunCompletionMarker(): void {
		if (!this.messagesContainer || !this.currentRunContainer) {
			return;
		}
		if (this.currentRunContainer.querySelector('.void-run-complete')) {
			return;
		}
		const row = append(this.currentRunContainer, $('.void-run-event.void-run-complete'));
		const marker = append(row, $('.void-run-marker.void-run-marker-complete'));
		marker.classList.add('success');
		append(marker, $('span.codicon.codicon-check'));
		const spacer = append(row, $('.void-run-complete-spacer'));
		spacer.textContent = '';
		void this.addRunSummaryCard();
	}

	private async addRunSummaryCard(): Promise<void> {
		if (!this.currentRunContainer || this.runSummaryRendered || this.runTouchedFiles.size === 0) {
			return;
		}

		const changes: RunChangeSummary[] = [];
		for (const path of this.runTouchedFiles) {
			const before = this.runFileSnapshots.get(path) ?? { exists: false, content: '' };
			let afterExists = false;
			let afterContent = '';
			try {
				const current = await this.fileService.readFile(URI.file(path));
				afterExists = true;
				afterContent = this.tryDecodeUtf8(current.value.buffer);
			} catch {
				afterExists = false;
				afterContent = '';
			}

			if (before.exists === afterExists && before.content === afterContent) {
				continue;
			}

			const { added, removed } = this.calculateLineDelta(before.exists, before.content, afterExists, afterContent);
			changes.push({
				path,
				beforeExists: before.exists,
				beforeContent: before.content,
				afterExists,
				afterContent,
				added,
				removed
			});
		}

		if (!changes.length) {
			this.runSummaryRendered = true;
			return;
		}

		this.runSummaryRendered = true;
		const totalAdded = changes.reduce((acc, entry) => acc + entry.added, 0);
		const totalRemoved = changes.reduce((acc, entry) => acc + entry.removed, 0);

		const row = append(this.currentRunContainer, $('.void-run-event.void-run-event-tool'));
		const marker = append(row, $('.void-run-marker.void-run-marker-tool.success'));
		marker.classList.remove('pending');

		const card = append(row, $('.void-run-summary-card'));
		const header = append(card, $('.void-run-summary-header'));
		const title = append(header, $('.void-run-summary-title'));
		title.textContent = `${changes.length} files`;
		const stat = append(header, $('.void-run-summary-total'));
		const statPlus = append(stat, $('.void-diff-plus'));
		statPlus.textContent = `${totalAdded > 0 ? `+${totalAdded}` : '+0'}`;
		append(stat, $('span')).textContent = ' ';
		const statMinus = append(stat, $('.void-diff-minus'));
		statMinus.textContent = `${totalRemoved > 0 ? `-${totalRemoved}` : '-0'}`;
		const undoBtn = append(header, $('button.void-run-summary-undo')) as HTMLButtonElement;
		undoBtn.type = 'button';
		undoBtn.textContent = 'Undo';
		undoBtn.addEventListener('click', () => void this.undoRunChanges(changes, undoBtn));

		const list = append(card, $('.void-run-summary-list'));
		for (const entry of changes) {
			const item = append(list, $('.void-run-summary-item'));
			const name = append(item, $('.void-run-summary-name'));
			name.textContent = entry.path.split(/[\\/]/).pop() || entry.path;
			name.title = entry.path;
			const fileStat = append(item, $('.void-run-summary-file-stat'));
			const plus = append(fileStat, $('.void-diff-plus'));
			plus.textContent = `${entry.added > 0 ? `+${entry.added}` : '+0'}`;
			append(fileStat, $('span')).textContent = ' ';
			const minus = append(fileStat, $('.void-diff-minus'));
			minus.textContent = `${entry.removed > 0 ? `-${entry.removed}` : '-0'}`;
		}
	}

	private calculateLineDelta(beforeExists: boolean, beforeContent: string, afterExists: boolean, afterContent: string): { added: number; removed: number } {
		const lineCount = (value: string): number => {
			if (!value.length) {
				return 0;
			}
			return value.split(/\r?\n/).length;
		};

		if (!beforeExists && afterExists) {
			return { added: lineCount(afterContent), removed: 0 };
		}
		if (beforeExists && !afterExists) {
			return { added: 0, removed: lineCount(beforeContent) };
		}

		const beforeLines = beforeContent.replace(/\r/g, '').split('\n');
		const afterLines = afterContent.replace(/\r/g, '').split('\n');
		const max = Math.max(beforeLines.length, afterLines.length);
		let added = 0;
		let removed = 0;
		for (let i = 0; i < max; i++) {
			const prev = beforeLines[i] ?? '';
			const next = afterLines[i] ?? '';
			if (prev === next) {
				continue;
			}
			if (prev) {
				removed++;
			}
			if (next) {
				added++;
			}
		}
		return { added, removed };
	}

	private async undoRunChanges(changes: RunChangeSummary[], button: HTMLButtonElement): Promise<void> {
		button.disabled = true;
		button.textContent = 'Undoing...';
		try {
			for (const change of changes) {
				const uri = URI.file(change.path);
				if (!change.beforeExists) {
					try {
						await this.fileService.del(uri);
					} catch {
						// Ignore delete failures for already removed files.
					}
					continue;
				}
				await this.fileService.writeFile(uri, VSBuffer.fromString(change.beforeContent));
			}
			button.textContent = 'Undone';
			this.scheduleFileTreeRefresh(20);
		} catch {
			button.disabled = false;
			button.textContent = 'Undo failed';
		}
	}

	private buildWelcomeLine(): string {
		const hour = new Date().getHours();
		const name = this.resolveDisplayName();
		if (hour < 12) {
			return `Good morning, ${name}`;
		}
		if (hour < 18) {
			return `Good afternoon, ${name}`;
		}
		return `Good evening, ${name}`;
	}

	private renderWelcomeLogo(container: HTMLElement): void {
		const ns = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(ns, 'svg');
		svg.setAttribute('class', 'void-chat-empty-logo');
		svg.setAttribute('viewBox', '0 0 32 32');
		svg.setAttribute('aria-hidden', 'true');

		const outer = document.createElementNS(ns, 'rect');
		outer.setAttribute('x', '2');
		outer.setAttribute('y', '2');
		outer.setAttribute('width', '28');
		outer.setAttribute('height', '28');
		outer.setAttribute('rx', '8');
		outer.setAttribute('fill', '#ffffff');
		svg.appendChild(outer);

		const longCut = document.createElementNS(ns, 'rect');
		longCut.setAttribute('x', '8');
		longCut.setAttribute('y', '12');
		longCut.setAttribute('width', '16');
		longCut.setAttribute('height', '3');
		longCut.setAttribute('rx', '1.5');
		longCut.setAttribute('fill', '#111111');
		svg.appendChild(longCut);

		const shortCut = document.createElementNS(ns, 'rect');
		shortCut.setAttribute('x', '8');
		shortCut.setAttribute('y', '18');
		shortCut.setAttribute('width', '9');
		shortCut.setAttribute('height', '3');
		shortCut.setAttribute('rx', '1.5');
		shortCut.setAttribute('fill', '#111111');
		svg.appendChild(shortCut);

		container.appendChild(svg);
	}

	private resolveDisplayName(): string {
		const fromEnv = (globalThis as any)?.process?.env?.USERNAME;
		if (typeof fromEnv === 'string' && fromEnv.trim()) {
			return fromEnv.trim();
		}
		return 'Creator';
	}

	private updateEmptyStateVisibility(): void {
		if (!this.emptyState || !this.messagesContainer) {
			return;
		}
		const hasMessages = this.messagesContainer.querySelectorAll('.void-message, .void-run-group, .void-context-summary-card').length > 0;
		this.emptyState.style.display = hasMessages ? 'none' : 'flex';
		if (this.historyPanel?.classList.contains('visible')) {
			this.setLayoutMode('history');
			return;
		}
		this.setLayoutMode(hasMessages ? 'conversation' : 'home');
	}

	private scrollToBottom(): void {
		if (!this.messagesContainer) {
			return;
		}
		if (typeof this.scrollToBottomHandle === 'number') {
			return;
		}
		this.scrollToBottomHandle = window.requestAnimationFrame(() => {
			this.scrollToBottomHandle = undefined;
			if (this.messagesContainer) {
				this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
			}
		});
	}

	private toggleMenu(menu: HTMLElement | undefined, visible: boolean): void {
		if (!menu) {
			return;
		}
		menu.classList.toggle('visible', visible);
	}

	private toggleHistoryPanel(visible: boolean): void {
		if (!this.historyPanel || !this.historyButton) {
			return;
		}
		this.historyPanel.classList.toggle('visible', visible);
		this.historyButton.classList.toggle('active', visible);
		if (visible) {
			this.setLayoutMode('history');
			return;
		}
		this.updateEmptyStateVisibility();
	}

	private setLayoutMode(mode: ChatPaneLayoutMode): void {
		if (!this.container) {
			return;
		}
		if (this.layoutMode === mode && this.container.classList.contains(`void-layout-${mode}`)) {
			return;
		}
		this.container.classList.remove('void-layout-home', 'void-layout-conversation', 'void-layout-history');
		this.container.classList.add(`void-layout-${mode}`);
		this.layoutMode = mode;
	}

	private installLongTaskObserver(): void {
		if (!('PerformanceObserver' in window) || this.longTaskObserver) {
			return;
		}
		try {
			this.longTaskObserver = new PerformanceObserver((entries) => {
				for (const entry of entries.getEntries()) {
					if (entry.duration >= 50) {
						console.warn(`[Qwen UI Perf] long task ${Math.round(entry.duration)}ms`);
					}
				}
			});
			this.longTaskObserver.observe({ entryTypes: ['longtask'] });
			this._register({
				dispose: () => {
					this.longTaskObserver?.disconnect();
					this.longTaskObserver = undefined;
				}
			});
		} catch {
			// Ignore unsupported observer environments.
		}
	}

	private setupTooltipOverlay(container: HTMLElement): void {
		const overlay = append(container, $('.void-chat-tooltip-overlay'));
		this.tooltipOverlay = overlay;

		const onPointerOver = (event: PointerEvent): void => {
			const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
			if (!target || !container.contains(target)) {
				return;
			}
			this.showTooltip(target);
		};

		const onPointerOut = (event: PointerEvent): void => {
			const relatedTarget = event.relatedTarget as HTMLElement | null;
			const nextTarget = relatedTarget?.closest<HTMLElement>('[data-tooltip]');
			if (nextTarget && container.contains(nextTarget)) {
				this.showTooltip(nextTarget);
				return;
			}
			this.hideTooltip();
		};

		const onFocusIn = (event: FocusEvent): void => {
			const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
			if (!target || !container.contains(target)) {
				return;
			}
			this.showTooltip(target);
		};

		const onFocusOut = (event: FocusEvent): void => {
			const relatedTarget = event.relatedTarget as HTMLElement | null;
			const nextTarget = relatedTarget?.closest<HTMLElement>('[data-tooltip]');
			if (nextTarget && container.contains(nextTarget)) {
				this.showTooltip(nextTarget);
				return;
			}
			this.hideTooltip();
		};

		const onResize = (): void => {
			if (this.tooltipTarget) {
				this.positionTooltip(this.tooltipTarget);
			}
		};

		const onContainerScroll = (): void => {
			if (this.tooltipTarget) {
				this.positionTooltip(this.tooltipTarget);
			}
		};

		container.addEventListener('pointerover', onPointerOver);
		container.addEventListener('pointerout', onPointerOut);
		container.addEventListener('focusin', onFocusIn);
		container.addEventListener('focusout', onFocusOut);
		container.addEventListener('scroll', onContainerScroll, true);
		window.addEventListener('resize', onResize);

		this._register({
			dispose: () => {
				container.removeEventListener('pointerover', onPointerOver);
				container.removeEventListener('pointerout', onPointerOut);
				container.removeEventListener('focusin', onFocusIn);
				container.removeEventListener('focusout', onFocusOut);
				container.removeEventListener('scroll', onContainerScroll, true);
				window.removeEventListener('resize', onResize);
				this.hideTooltip();
				this.tooltipOverlay?.remove();
				this.tooltipOverlay = undefined;
			}
		});
	}

	private showTooltip(target: HTMLElement): void {
		if (!this.tooltipOverlay) {
			return;
		}
		const tooltipText = target.getAttribute('data-tooltip')?.trim();
		if (!tooltipText) {
			this.hideTooltip();
			return;
		}

		this.tooltipTarget = target;
		this.tooltipOverlay.textContent = tooltipText;
		this.tooltipOverlay.classList.add('visible');
		this.positionTooltip(target);
	}

	private positionTooltip(target: HTMLElement): void {
		if (!this.tooltipOverlay) {
			return;
		}
		this.tooltipOverlay.style.left = '0px';
		this.tooltipOverlay.style.top = '0px';
		this.tooltipOverlay.style.visibility = 'hidden';

		const margin = 8;
		const targetRect = target.getBoundingClientRect();
		const tooltipRect = this.tooltipOverlay.getBoundingClientRect();
		let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
		let top = targetRect.top - tooltipRect.height - 8;

		if (top < margin) {
			top = targetRect.bottom + 8;
		}

		const maxLeft = Math.max(margin, window.innerWidth - tooltipRect.width - margin);
		left = Math.min(Math.max(left, margin), maxLeft);

		this.tooltipOverlay.style.left = `${Math.round(left)}px`;
		this.tooltipOverlay.style.top = `${Math.round(top)}px`;
		this.tooltipOverlay.style.visibility = 'visible';
	}

	private hideTooltip(): void {
		this.tooltipTarget = undefined;
		if (!this.tooltipOverlay) {
			return;
		}
		this.tooltipOverlay.classList.remove('visible');
		this.tooltipOverlay.style.visibility = 'hidden';
	}

	private loadHistorySessions(): void {
		const records = this.historyUiStore.loadItems();
		this.historySessions = records
			.map(record => this.normalizeHistorySession(record))
			.filter((record): record is HistorySessionRecord => !!record)
			.sort((a, b) => {
				if (a.pinned !== b.pinned) {
					return a.pinned ? -1 : 1;
				}
				return b.updatedAt - a.updatedAt;
			})
			.slice(0, ChatViewPane.CHAT_HISTORY_MAX_SESSIONS);

		if (this.historySessions.length > 0) {
			const preferred = [...this.historySessions].sort((a, b) => b.lastViewedAt - a.lastViewedAt)[0];
			this.openSessionFromHistory(preferred.id, false);
		}
	}

	private normalizeHistorySession(record: unknown): HistorySessionRecord | undefined {
		if (!record || typeof record !== 'object') {
			return undefined;
		}
		const candidate = record as Partial<HistorySessionRecord>;
		if (typeof candidate.id !== 'string' || !candidate.id.trim()) {
			return undefined;
		}
		if (typeof candidate.title !== 'string') {
			return undefined;
		}
		const messages = Array.isArray(candidate.messages) ? candidate.messages : [];
		const normalizedMessages: HistoryMessageRecord[] = [];
		for (const message of messages) {
			if (!message || typeof message !== 'object') {
				continue;
			}
			const entry = message as Partial<HistoryMessageRecord>;
			if (entry.role !== 'user' && entry.role !== 'assistant' && entry.role !== 'error') {
				continue;
			}
			if (typeof entry.text !== 'string') {
				continue;
			}
			const attachments = Array.isArray(entry.attachments)
				? entry.attachments
					.map(item => {
						if (!item || typeof item !== 'object') {
							return undefined;
						}
						const attachment = item as Partial<HistoryAttachmentPreview>;
						if (typeof attachment.name !== 'string' || typeof attachment.preview !== 'string') {
							return undefined;
						}
						return {
							name: attachment.name,
							preview: attachment.preview
						};
					})
					.filter((item): item is HistoryAttachmentPreview => !!item)
				: undefined;
			normalizedMessages.push({
				role: entry.role,
				text: entry.text,
				timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now(),
				attachments
			});
		}
		return {
			id: candidate.id.trim(),
			title: candidate.title.trim() || 'New chat',
			pinned: !!candidate.pinned,
			createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
			updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now(),
			lastViewedAt: typeof candidate.lastViewedAt === 'number' ? candidate.lastViewedAt : Date.now(),
			messages: normalizedMessages
		};
	}

	private saveHistorySessions(): void {
		this.historyUiStore.saveItems(this.historySessions);
	}

	private createSessionAndSwitch(baseTitle?: string): void {
		const now = Date.now();
		const session: HistorySessionRecord = {
			id: `session-${now}-${Math.random().toString(36).slice(2, 8)}`,
			title: (baseTitle ?? 'New chat').trim() || 'New chat',
			pinned: false,
			createdAt: now,
			updatedAt: now,
			lastViewedAt: now,
			messages: []
		};
		this.historySessions = [session, ...this.historySessions].slice(0, ChatViewPane.CHAT_HISTORY_MAX_SESSIONS);
		this.activeSessionId = session.id;
		this.historyPanelState.selectedSessionId = session.id;
		this.clearConversationSurface();
		this.saveHistorySessions();
		this.renderHistoryList();
		this.toggleHistoryPanel(false);
	}

	private ensureActiveSession(seedText?: string): HistorySessionRecord {
		const active = this.activeSessionId
			? this.historySessions.find(session => session.id === this.activeSessionId)
			: undefined;
		if (active) {
			return active;
		}

		const now = Date.now();
		const session: HistorySessionRecord = {
			id: `session-${now}-${Math.random().toString(36).slice(2, 8)}`,
			title: this.buildSessionTitleFromText(seedText ?? ''),
			pinned: false,
			createdAt: now,
			updatedAt: now,
			lastViewedAt: now,
			messages: []
		};
		this.historySessions = [session, ...this.historySessions].slice(0, ChatViewPane.CHAT_HISTORY_MAX_SESSIONS);
		this.activeSessionId = session.id;
		return session;
	}

	private appendHistoryMessage(
		role: 'user' | 'assistant' | 'error',
		text: string,
		attachments?: HistoryAttachmentPreview[]
	): void {
		const session = this.ensureActiveSession(role === 'user' ? text : undefined);
		const now = Date.now();
		session.messages.push({
			role,
			text,
			timestamp: now,
			attachments: attachments && attachments.length ? attachments : undefined
		});
		session.updatedAt = now;
		session.lastViewedAt = now;
		if (role === 'user' && (session.title === 'New chat' || session.messages.length <= 2)) {
			session.title = this.buildSessionTitleFromText(text);
		}
		this.historySessions = this.historySessions
			.slice()
			.sort((a, b) => {
				if (a.pinned !== b.pinned) {
					return a.pinned ? -1 : 1;
				}
				return b.updatedAt - a.updatedAt;
			})
			.slice(0, ChatViewPane.CHAT_HISTORY_MAX_SESSIONS);
		this.saveHistorySessions();
		this.renderHistoryList();
	}

	private openSessionFromHistory(sessionId: string, closePanel: boolean = true): void {
		const session = this.historySessions.find(item => item.id === sessionId);
		if (!session) {
			return;
		}
		this.activeSessionId = session.id;
		this.historyPanelState.selectedSessionId = session.id;
		session.lastViewedAt = Date.now();
		this.clearConversationSurface();
		for (const message of session.messages) {
			if (message.role === 'user') {
				this.renderUserMessageBubble(message.text, message.attachments ?? []);
				this.contextSegments.push({ role: 'user', text: message.text });
				for (const attachment of message.attachments ?? []) {
					this.contextSegments.push({ role: 'user', text: `Attached file ${attachment.name}: ${attachment.preview}` });
				}
				this.currentRunContainer = undefined;
				continue;
			}
			if (message.role === 'assistant') {
				this.addAssistantMessage(message.text, false);
				continue;
			}
			this.addErrorMessage(message.text, false);
		}
		this.updateContextMeter();
		this.updateEmptyStateVisibility();
		this.scrollToBottom();
		this.saveHistorySessions();
		this.renderHistoryList();
		if (closePanel) {
			this.toggleHistoryPanel(false);
		}
	}

	private renameSessionInHistory(sessionId: string): void {
		const session = this.historySessions.find(item => item.id === sessionId);
		if (!session) {
			return;
		}
		const renamed = window.prompt('Rename chat', session.title);
		if (typeof renamed !== 'string') {
			return;
		}
		const next = renamed.trim();
		if (!next) {
			return;
		}
		session.title = next.slice(0, 100);
		session.updatedAt = Date.now();
		this.saveHistorySessions();
		this.renderHistoryList();
	}

	private removeSessionFromHistory(sessionId: string): void {
		const session = this.historySessions.find(item => item.id === sessionId);
		if (!session) {
			return;
		}
		if (!window.confirm(`Delete chat "${session.title}"?`)) {
			return;
		}
		this.historySessions = this.historySessions.filter(item => item.id !== sessionId);
		if (this.activeSessionId === sessionId) {
			this.activeSessionId = undefined;
			this.clearConversationSurface();
			if (this.historySessions.length) {
				this.openSessionFromHistory(this.historySessions[0].id, false);
			}
		}
		this.saveHistorySessions();
		this.renderHistoryList();
	}

	private pinSession(sessionId: string, pinned: boolean): void {
		const session = this.historySessions.find(item => item.id === sessionId);
		if (!session) {
			return;
		}
		session.pinned = pinned;
		session.updatedAt = Date.now();
		this.historySessions = this.historySessions
			.slice()
			.sort((a, b) => {
				if (a.pinned !== b.pinned) {
					return a.pinned ? -1 : 1;
				}
				return b.updatedAt - a.updatedAt;
			});
		this.saveHistorySessions();
		this.renderHistoryList();
	}

	private clearConversationSurface(): void {
		if (!this.messagesContainer || !this.emptyState) {
			return;
		}
		for (const child of Array.from(this.messagesContainer.children)) {
			if (child !== this.emptyState) {
				child.remove();
			}
		}
		this.currentRunContainer = undefined;
		this.toolCards.clear();
		this.seenToolCalls.clear();
		this.runTouchedFiles.clear();
		this.runFileSnapshots.clear();
		this.runSummaryRendered = false;
		this.contextSummary = '';
		this.contextSegments.length = 0;
		this.removeLoadingIndicator();
		this.updateContextMeter();
		this.updateEmptyStateVisibility();
	}

	private renderHistoryList(): void {
		if (!this.historyList) {
			return;
		}
		const perfStart = this.devProfileEnabled ? performance.now() : 0;
		while (this.historyList.firstChild) {
			this.historyList.removeChild(this.historyList.firstChild);
		}

		const query = this.historyPanelState.query.trim().toLowerCase();
		const filtered = this.historySessions.filter(session => {
			if (!query) {
				return true;
			}
			return session.title.toLowerCase().includes(query) || session.messages.some(message => message.text.toLowerCase().includes(query));
		});
		if (!filtered.length) {
			const empty = append(this.historyList, $('.void-chat-history-empty'));
			empty.textContent = query ? 'No matching chats' : 'No saved chats yet';
			return;
		}

		const groups = new Map<string, HistorySessionRecord[]>();
		for (const session of filtered) {
			const key = this.getHistoryGroupKey(session.updatedAt);
			const entries = groups.get(key);
			if (entries) {
				entries.push(session);
			} else {
				groups.set(key, [session]);
			}
		}

		const orderedKeys: string[] = [];
		if (groups.has('Today')) {
			orderedKeys.push('Today');
		}
		if (groups.has('Yesterday')) {
			orderedKeys.push('Yesterday');
		}
		if (groups.has('Older')) {
			orderedKeys.push('Older');
		}

		for (const key of orderedKeys) {
			const section = append(this.historyList, $('.void-chat-history-section'));
			const sectionTitle = append(section, $('.void-chat-history-section-title'));
			sectionTitle.textContent = key;
			const groupList = append(section, $('.void-chat-history-section-list'));
			for (const session of groups.get(key) ?? []) {
				const item = append(groupList, $('.void-chat-history-item'));
				if (session.id === this.activeSessionId) {
					item.classList.add('active');
				}

				const openButton = append(item, $('button.void-chat-history-open')) as HTMLButtonElement;
				openButton.setAttribute('type', 'button');
				openButton.addEventListener('click', () => this.openSessionFromHistory(session.id));

				const title = append(openButton, $('.void-chat-history-item-title'));
				title.textContent = session.title;
				const subtitle = append(openButton, $('.void-chat-history-item-subtitle'));
				subtitle.textContent = `${this.formatHistoryTime(session.updatedAt)}  |  ${session.messages.length} messages`;

				const actions = append(item, $('.void-chat-history-item-actions'));
				const pinButton = append(actions, $('button.void-chat-history-icon-btn.codicon')) as HTMLButtonElement;
				pinButton.classList.add('codicon-pin');
				if (session.pinned) {
					pinButton.classList.add('pinned');
				}
				pinButton.setAttribute('aria-label', session.pinned ? 'Unpin' : 'Pin');
				pinButton.setAttribute('data-tooltip', session.pinned ? 'Unpin' : 'Pin');
				pinButton.addEventListener('click', (event) => {
					event.stopPropagation();
					this.pinSession(session.id, !session.pinned);
				});

				const renameButton = append(actions, $('button.void-chat-history-icon-btn.codicon.codicon-edit')) as HTMLButtonElement;
				renameButton.setAttribute('aria-label', 'Rename');
				renameButton.setAttribute('data-tooltip', 'Rename');
				renameButton.addEventListener('click', (event) => {
					event.stopPropagation();
					this.renameSessionInHistory(session.id);
				});

				const deleteButton = append(actions, $('button.void-chat-history-icon-btn.codicon.codicon-trash')) as HTMLButtonElement;
				deleteButton.setAttribute('aria-label', 'Delete');
				deleteButton.setAttribute('data-tooltip', 'Delete');
				deleteButton.addEventListener('click', (event) => {
					event.stopPropagation();
					this.removeSessionFromHistory(session.id);
				});
			}
		}
		if (this.devProfileEnabled) {
			const duration = performance.now() - perfStart;
			if (duration >= 8) {
				console.log(`[Qwen UI Perf] history render ${duration.toFixed(1)}ms (${filtered.length} sessions)`);
			}
		}
	}

	private getHistoryGroupKey(timestamp: number): 'Today' | 'Yesterday' | 'Older' {
		const target = new Date(timestamp);
		const now = new Date();
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const startOfYesterday = new Date(startOfToday);
		startOfYesterday.setDate(startOfYesterday.getDate() - 1);
		if (target >= startOfToday) {
			return 'Today';
		}
		if (target >= startOfYesterday) {
			return 'Yesterday';
		}
		return 'Older';
	}

	private formatHistoryTime(timestamp: number): string {
		try {
			return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} catch {
			return '--:--';
		}
	}

	private buildSessionTitleFromText(text: string): string {
		const normalized = text.replace(/\s+/g, ' ').trim();
		if (!normalized) {
			return 'New chat';
		}
		return normalized.slice(0, 60);
	}

	private updateComposerState(): void {
		if (!this.inputElement || !this.sendButton || !this.inputShell) {
			return;
		}
		const hasText = this.inputElement.value.trim().length > 0;
		const hasAttachments = this.attachedFiles.length > 0;
		this.sendButton.disabled = !hasText;
		this.inputShell.classList.toggle('has-attachments', hasAttachments);
		this.updateContextMeter();
	}

	private canAttachMoreFiles(): boolean {
		if (this.attachedFiles.length < ChatViewPane.MAX_ATTACHED_FILES) {
			return true;
		}
		this.showAttachmentLimitNotice();
		return false;
	}

	private showAttachmentLimitNotice(): void {
		if (!this.attachmentLimitNotice) {
			return;
		}
		this.attachmentLimitNotice.classList.add('visible');
		if (typeof this.attachmentLimitNoticeHideHandle === 'number') {
			window.clearTimeout(this.attachmentLimitNoticeHideHandle);
		}
		this.attachmentLimitNoticeHideHandle = window.setTimeout(() => {
			this.attachmentLimitNotice?.classList.remove('visible');
			this.attachmentLimitNoticeHideHandle = undefined;
		}, 2600);
	}

	private hideAttachmentLimitNotice(): void {
		if (!this.attachmentLimitNotice) {
			return;
		}
		this.attachmentLimitNotice.classList.remove('visible');
		if (typeof this.attachmentLimitNoticeHideHandle === 'number') {
			window.clearTimeout(this.attachmentLimitNoticeHideHandle);
			this.attachmentLimitNoticeHideHandle = undefined;
		}
	}

	private async openFilePicker(): Promise<void> {
		const input = document.createElement('input');
		input.type = 'file';
		input.multiple = true;
		input.accept = '.txt,.md,.json,.yaml,.yml,.toml,.ini,.cfg,.log,.xml,.csv,.ts,.tsx,.js,.jsx,.mjs,.cjs,.py,.rs,.go,.java,.c,.cc,.cpp,.h,.hpp,.cs,.php,.rb,.swift,.kt,.scala,.sh,.ps1,.bat,.cmd,.sql,.html,.css,.scss,.less,.vue,.svelte,.astro,.pdf';

		input.addEventListener('change', () => {
			const files = Array.from(input.files ?? []);
			for (const file of files) {
				void this.attachBrowserFile(file);
			}
		});
		input.click();
	}

	private isSupportedAttachment(ext: string): boolean {
		const supported = new Set([
			'txt', 'md', 'json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'log', 'xml', 'csv',
			'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rs', 'go', 'java', 'c', 'cc', 'cpp', 'h', 'hpp',
			'cs', 'php', 'rb', 'swift', 'kt', 'scala', 'sh', 'ps1', 'bat', 'cmd', 'sql',
			'html', 'css', 'scss', 'less', 'vue', 'svelte', 'astro', 'pdf'
		]);
		return supported.has(ext);
	}

	private attachFile(uri: URI): void {
		const fullName = uri.path.split('/').pop() || uri.fsPath.split(/[\\/]/).pop() || uri.path;
		const ext = (fullName.split('.').pop() || '').toLowerCase();
		if (!this.isSupportedAttachment(ext)) {
			return;
		}
		const id = uri.toString();
		if (this.attachedFiles.some(file => file.id === id)) {
			return;
		}
		if (!this.canAttachMoreFiles()) {
			return;
		}
		this.attachedFiles.push({ id, uri, name: fullName, ext });
		this.hideAttachmentLimitNotice();
		this.refreshAttachedFilesUI();
		this.updateComposerState();
	}

	private async attachBrowserFile(file: File): Promise<void> {
		const filePath = (file as File & { path?: string }).path;
		if (filePath) {
			this.attachFile(URI.file(filePath));
			return;
		}

		const fullName = file.name || `attachment-${Date.now()}`;
		const ext = (fullName.split('.').pop() || '').toLowerCase();
		if (!this.isSupportedAttachment(ext)) {
			return;
		}

		const bytes = new Uint8Array(await file.arrayBuffer());
		const inlineContent = ext === 'pdf' ? this.extractPdfText(bytes) : this.tryDecodeUtf8(bytes);
		const id = `inline:${fullName}:${bytes.byteLength}`;
		if (this.attachedFiles.some(attached => attached.id === id)) {
			return;
		}
		if (!this.canAttachMoreFiles()) {
			return;
		}

		this.attachedFiles.push({
			id,
			name: fullName,
			ext,
			inlineContent,
			byteLength: bytes.byteLength
		});
		this.hideAttachmentLimitNotice();
		this.refreshAttachedFilesUI();
		this.updateComposerState();
	}

	private removeAttachedFile(fileId: string): void {
		this.attachedFiles = this.attachedFiles.filter(file => file.id !== fileId);
		this.hideAttachmentLimitNotice();
		this.refreshAttachedFilesUI();
		this.updateComposerState();
	}

	private refreshAttachedFilesUI(): void {
		if (!this.attachedFilesContainer) {
			return;
		}
		while (this.attachedFilesContainer.firstChild) {
			this.attachedFilesContainer.removeChild(this.attachedFilesContainer.firstChild);
		}

		for (const file of this.attachedFiles) {
			const card = append(this.attachedFilesContainer, $('.void-file-card'));
			const icon = append(card, $('.void-file-icon.codicon'));
			icon.classList.add(this.getLanguageIcon(file.ext));
			const fileName = append(card, $('.void-file-name'));
			fileName.textContent = file.name;
			const removeBtn = append(card, $('button.void-file-remove.codicon.codicon-close')) as HTMLButtonElement;
			removeBtn.setAttribute('aria-label', 'Detach');
			removeBtn.setAttribute('data-tooltip', 'Detach');
			removeBtn.addEventListener('click', () => this.removeAttachedFile(file.id));
		}
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
			'pdf': 'codicon-file-pdf',
		};
		return iconMap[ext.toLowerCase()] || 'codicon-file';
	}

	private async buildAttachmentContext(files: AttachedFile[]): Promise<string> {
		if (!files.length) {
			return '';
		}
		const chunks: string[] = [];
		for (const file of files) {
			const content = await this.readAttachmentContent(file);
			if (!content) {
				continue;
			}
			const clipped = content.length > 12000 ? `${content.slice(0, 12000)}\n[...truncated...]` : content;
			chunks.push(`Attached file ${file.name}:\n${clipped}`);
		}
		return chunks.join('\n\n');
	}

	private async readAttachmentContent(file: AttachedFile): Promise<string> {
		if (typeof file.inlineContent === 'string') {
			return file.inlineContent;
		}
		if (!file.uri) {
			return '';
		}
		try {
			const result = await this.fileService.readFile(file.uri);
			if (file.ext === 'pdf') {
				return this.extractPdfText(result.value.buffer);
			}
			return this.tryDecodeUtf8(result.value.buffer);
		} catch {
			return '';
		}
	}

	private tryDecodeUtf8(bytes: Uint8Array): string {
		try {
			return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
		} catch {
			return '';
		}
	}

	private extractPdfText(bytes: Uint8Array): string {
		try {
			const raw = new TextDecoder('latin1').decode(bytes);
			const parts: string[] = [];
			const textOp = /\(([^()]*)\)\s*Tj/g;
			let match: RegExpExecArray | null;
			while ((match = textOp.exec(raw)) !== null) {
				parts.push(match[1].replace(/\\([()\\])/g, '$1'));
			}
			const arrayOp = /\[(.*?)\]\s*TJ/g;
			while ((match = arrayOp.exec(raw)) !== null) {
				const nested = match[1].match(/\(([^()]*)\)/g) ?? [];
				for (const item of nested) {
					parts.push(item.slice(1, -1).replace(/\\([()\\])/g, '$1'));
				}
			}
			return parts.join(' ').replace(/\s+/g, ' ').trim();
		} catch {
			return '';
		}
	}

	private ensureRunContainer(): HTMLElement {
		if (!this.messagesContainer) {
			throw new Error('Messages container is not initialized');
		}
		if (!this.currentRunContainer) {
			this.currentRunContainer = append(this.messagesContainer, $('.void-run-group'));
		}
		return this.currentRunContainer;
	}

	private shouldCollapseToolCard(toolName: string): boolean {
		const name = toolName.toLowerCase();
		if (name.includes('write') || name.includes('edit') || name.includes('str_replace') || this.isCommandTool(name)) {
			return false;
		}
		return false;
	}

	private estimateContextTokens(): number {
		const summaryChars = this.contextSummary.length;
		const historyChars = this.contextSegments.reduce((acc, part) => acc + part.text.length, 0);
		const attachmentChars = this.attachedFiles.reduce((acc, file) => acc + (file.inlineContent?.length ?? file.name.length), 0);
		return Math.ceil((summaryChars + historyChars + attachmentChars) / 4);
	}

	private updateContextMeter(): void {
		if (!this.contextMeter || !this.contextMeterBar) {
			return;
		}
		const used = this.estimateContextTokens();
		const ratio = Math.max(0, Math.min(1, used / ChatViewPane.CONTEXT_WINDOW_TOKENS));
		const displayRatio = used > 0 ? Math.max(0.02, ratio) : 0;
		const usedK = (used / 1000).toFixed(1);
		this.contextMeter.setAttribute('data-context', `${usedK}k / 1048.6k`);
		this.contextMeterBar.style.setProperty('--void-context-ratio', displayRatio.toFixed(4));
	}

	private buildRollingContextBlock(): string {
		const maxChars = 18000;
		const chunks: string[] = [];
		let used = 0;
		if (this.contextSummary) {
			const summary = `[CONTEXT SUMMARY]\n${this.contextSummary}`;
			chunks.push(summary);
			used += summary.length;
		}
		for (let i = this.contextSegments.length - 1; i >= 0; i--) {
			const part = this.contextSegments[i];
			const row = `[${part.role.toUpperCase()}]\n${part.text}`;
			if (used + row.length > maxChars) {
				break;
			}
			chunks.unshift(row);
			used += row.length;
		}
		return chunks.join('\n\n');
	}

	private async maybeCompactContext(): Promise<void> {
		const ratio = this.estimateContextTokens() / ChatViewPane.CONTEXT_WINDOW_TOKENS;
		if (ratio < ChatViewPane.CONTEXT_HARD_LIMIT || this.contextSegments.length < 10) {
			return;
		}

		const keepTail = 10;
		const toSummarize = this.contextSegments.slice(0, Math.max(0, this.contextSegments.length - keepTail));
		if (!toSummarize.length) {
			return;
		}
		const localSummary = toSummarize
			.slice(-20)
			.map(item => `- ${item.role}: ${item.text.replace(/\s+/g, ' ').slice(0, 180)}`)
			.join('\n');
		const merged = this.contextSummary
			? `${this.contextSummary}\n${localSummary}`
			: localSummary;
		this.contextSummary = merged.slice(-12000);
		this.contextSegments.splice(0, this.contextSegments.length - keepTail);
		this.addContextSummaryCard(this.contextSummary);
		this.updateContextMeter();
	}

	private addContextSummaryCard(summary: string): void {
		if (!this.messagesContainer) {
			return;
		}
		const card = append(this.messagesContainer, $('.void-context-summary-card'));
		const title = append(card, $('.void-context-summary-title'));
		title.textContent = 'Context compaction';
		const text = append(card, $('.void-context-summary-text'));
		text.textContent = `${summary.slice(-480)}${summary.length > 480 ? '...' : ''}`;
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
		this.inputElement?.focus();
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

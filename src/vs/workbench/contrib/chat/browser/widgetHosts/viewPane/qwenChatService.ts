/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { ipcRenderer } from '../../../../../../base/parts/sandbox/electron-browser/globals.js';

export enum QwenMessageType {
	SYSTEM = 'system',
	USER = 'user',
	ASSISTANT = 'assistant',
	TOOL_CALL = 'tool-call',
	TOOL_RESULT = 'tool-result',
	RESULT = 'result',
}

export interface IQwenMessage {
	id: string;
	type: QwenMessageType;
	content: string;
	timestamp: number;
	metadata?: any;
}

/**
 * Qwen Chat Service - integrates with void-ai-chat.js via IPC
 */
export class QwenChatService extends Disposable {
	private processing = false;
	private workspacePath: string | undefined;

	private readonly _onMessage = this._register(new Emitter<IQwenMessage>());
	readonly onMessage: Event<IQwenMessage> = this._onMessage.event;
	
	private readonly _onEvent = this._register(new Emitter<any>());
	readonly onEvent: Event<any> = this._onEvent.event;

	private readonly _onComplete = this._register(new Emitter<void>());
	readonly onComplete: Event<void> = this._onComplete.event;

	private readonly _onError = this._register(new Emitter<Error>());
	readonly onError: Event<Error> = this._onError.event;

	constructor() {
		super();
		
		// Слушаем streaming события от main process
		ipcRenderer.on('vscode:qwenStreamEvent', (_event: any, qwenEvent: any) => {
			const message = this.parseEvent(qwenEvent);
			if (message) {
				this._onMessage.fire(message);
				// Fire generic event for UI
				this._onEvent.fire({ type: message.type, message });
			}
		});
		
		// Слушаем запросы диагностики от main process
		ipcRenderer.on('vscode:qwenRequestDiagnostics', async (_event: any, ...args: unknown[]) => {
			try {
				const filePaths = args[0] as string[];
				const diagnostics = await this.getDiagnostics(filePaths);
				ipcRenderer.send('vscode:qwenDiagnosticsResponse', diagnostics);
			} catch (error: any) {
				ipcRenderer.send('vscode:qwenDiagnosticsResponse', { error: error.message });
			}
		});
	}
	
	// Получаем диагностику для файлов из MarkerService
	private async getDiagnostics(filePaths: string[]): Promise<any> {
		// TODO: Интеграция с IMarkerService через dependency injection
		// Пока возвращаем заглушку
		const diagnostics: any = {};
		
		for (const filePath of filePaths) {
			diagnostics[filePath] = [];
		}
		
		return { diagnostics };
	}

	// Устанавливаем путь к workspace для передачи в Qwen
	setWorkspacePath(path: string | undefined): void {
		this.workspacePath = path;
		console.log('[Qwen] Workspace path set:', path);
	}

	// Получаем текущее время по МСК
	private getMoscowTime(): string {
		const now = new Date();
		// Конвертируем в МСК (UTC+3)
		const moscowTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
		return moscowTime.toLocaleString('ru-RU', {
			timeZone: 'Europe/Moscow',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	async sendMessage(query: string, attachedFiles?: string[]): Promise<void> {
		if (this.processing) {
			throw new Error('Another message is already being processed');
		}

		this.processing = true;
		
		// Получаем текущее время по МСК
		const moscowTime = this.getMoscowTime();
		
		// Формируем расширенный запрос с контекстом
		let enhancedQuery = query;
		
		// Добавляем прикрепленные файлы если есть - ГОВОРИМ ИИ ЧТО ПОЛЬЗОВАТЕЛЬ ХОЧЕТ С НИМИ РАБОТАТЬ
		if (attachedFiles && attachedFiles.length > 0) {
			enhancedQuery = `${query}\n\n[ВАЖНО - ПРИКРЕПЛЕННЫЕ ФАЙЛЫ]\nПользователь прикрепил следующие файлы к своему сообщению:\n${attachedFiles.map(f => `- ${f}`).join('\n')}\n\nЭто значит что пользователь хочет чтобы ты обратил внимание на эти файлы и поработал с ними в контексте его вопроса. Прочитай их если нужно.`;
		}
		
		// Добавляем системный контекст с рабочей папкой
		if (this.workspacePath) {
			enhancedQuery = `[SYSTEM CONTEXT]
Текущее время (МСК): ${moscowTime}
Рабочая папка проекта: ${this.workspacePath}

КРИТИЧЕСКИ ВАЖНО - ЯЗЫК ОБЩЕНИЯ:
ТЫ ОБЯЗАН ОТВЕЧАТЬ ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ!
- Все твои ответы должны быть на русском
- Все объяснения на русском
- Все комментарии на русском
- Все описания действий на русском
- Технические термины переводи на русский
- НИКОГДА не используй английский язык в ответах

КРИТИЧЕСКИ ВАЖНО - ОПТИМИЗАЦИЯ ИСПОЛЬЗОВАНИЯ ИНСТРУМЕНТОВ (ЭКОНОМИЯ КВОТЫ):

⚡ ГЛАВНОЕ ПРАВИЛО: Используй МИНИМУМ инструментов для достижения цели!

📢 ОБЯЗАТЕЛЬНО КОММЕНТИРУЙ СВОИ ДЕЙСТВИЯ:
- Объясняй что делаешь и почему
- Комментируй результаты выполнения инструментов
- Делай выводы после завершения задачи
- Общайся с пользователем на русском языке
- НЕ молчи - пользователь должен понимать что происходит

1. ПЛАНИРОВАНИЕ ПЕРЕД ДЕЙСТВИЕМ:
   - Сначала ПОДУМАЙ какие инструменты нужны
   - Объедини несколько операций в один вызов где возможно
   - НЕ читай файл если только что его создал/изменил - ты знаешь его содержимое!
   - НЕ проверяй существование файла перед созданием - просто создай

2. ГРУППИРОВКА ОПЕРАЦИЙ:
   ✅ ПРАВИЛЬНО - Один вызов для нескольких файлов:
   - read_file с несколькими путями (если инструмент поддерживает)
   - delete_file с массивом paths для удаления нескольких файлов
   - Один grep вместо нескольких поисков
   
   ❌ НЕПРАВИЛЬНО - Множество отдельных вызовов:
   - read_file для каждого файла отдельно
   - delete_file для каждого файла отдельно
   - Повторные вызовы одного инструмента

3. ИЗБЕГАЙ ДУБЛИРОВАНИЯ:
   - НЕ читай файл дважды
   - НЕ ищи одно и то же дважды
   - НЕ проверяй результат сразу после операции
   - Доверяй результату инструмента

4. УМНОЕ ИСПОЛЬЗОВАНИЕ ПОИСКА:
   - Используй grep ОДИН раз с правильным паттерном
   - Используй glob ОДИН раз с правильной маской
   - НЕ делай поиск "на всякий случай"

5. РАБОТА С ФАЙЛАМИ:
   - Создал файл? НЕ читай его сразу - ты знаешь содержимое
   - Изменил файл? НЕ читай его для проверки - доверяй результату
   - Нужно изменить несколько мест? Используй edit ОДИН раз с несколькими изменениями

КРИТИЧЕСКИ ВАЖНО - ПРАВИЛА РАБОТЫ С ФАЙЛАМИ:
1. Все операции с файлами (чтение, запись, создание, редактирование) ТОЛЬКО в рабочей папке проекта: ${this.workspacePath}
2. СТРОГО ЗАПРЕЩЕНО изменять, создавать или удалять файлы вне рабочей папки проекта
3. СТРОГО ЗАПРЕЩЕНО трогать системные папки, папки с исходниками Qwen, VSCode, node_modules
4. Используй ТОЛЬКО абсолютные пути начиная с рабочей папки проекта: ${this.workspacePath}
5. Если пользователь просит создать файл без указания пути - создавай его в корне рабочей папки проекта

КРИТИЧЕСКИ ВАЖНО - ОРГАНИЗАЦИЯ КОДА И СТРУКТУРА ПРОЕКТА:

📁 СТРУКТУРА ПАПОК - ВСЕГДА создавай правильную структуру:
- /src - исходный код
- /assets - ресурсы (изображения, звуки, модели)
- /docs - документация
- /tests - тесты
- /config - конфигурация
- /scripts - скрипты автоматизации
- /public - публичные файлы (для веб-проектов)

Для UE5 проектов:
- /Content/Blueprints - все блюпринты
- /Content/Maps - уровни
- /Content/Materials - материалы
- /Content/Meshes - 3D модели
- /Content/Textures - текстуры
- /Content/Audio - звуки
- /Content/UI - интерфейс
- /Source - C++ код (если есть)

📝 КОММЕНТАРИИ - ОБЯЗАТЕЛЬНО добавляй:
- В начале каждого файла: описание назначения, автор, дата
- Перед каждой функцией: что делает, параметры, возвращаемое значение
- Сложные участки кода: пошаговое объяснение
- TODO комментарии для будущих улучшений
- Все комментарии на РУССКОМ языке

🎨 ЧИТАЕМОСТЬ КОДА:
- Используй понятные имена переменных и функций
- Одна функция = одна задача
- Максимум 50 строк на функцию
- Группируй связанный код
- Добавляй пустые строки между логическими блоками
- Используй константы вместо магических чисел

📋 ДОКУМЕНТАЦИЯ:
- Создавай README.md для каждого проекта
- Описывай как запустить проект
- Перечисляй зависимости
- Добавляй примеры использования
- Документируй API если есть

🔷 ДЛЯ UNREAL ENGINE 5:
- В блюпринтах ВСЕГДА добавляй Comment Boxes с описанием
- Группируй ноды по функциональности
- Используй Reroute ноды для чистоты связей
- Называй переменные понятно: PlayerHealth, EnemySpeed, MaxAmmo
- Создавай отдельные функции для повторяющейся логики
- Документируй каждый Blueprint в Description

📁 ПАПКА ДЛЯ UE5 ПРОЕКТОВ:
По умолчанию создавай UE5 проекты в: C:\\Users\\Starred\\Documents\\Unreal Projects
Если пользователь не указал путь - используй эту папку автоматически.

КРИТИЧЕСКИ ВАЖНО - МНОЖЕСТВЕННОЕ УДАЛЕНИЕ ФАЙЛОВ:
Инструмент delete_file поддерживает удаление нескольких файлов ОДНИМ вызовом!

✅ ПРАВИЛЬНО - Удаление нескольких файлов одним вызовом:
{
  "name": "delete_file",
  "input": {
    "paths": ["file1.txt", "file2.txt", "file3.txt"]
  }
}

❌ НЕПРАВИЛЬНО - Несколько отдельных вызовов (расходует квоту!):
delete_file({ "path": "file1.txt" })
delete_file({ "path": "file2.txt" })
delete_file({ "path": "file3.txt" })

ПРАВИЛА:
- Если нужно удалить 2+ файла - ВСЕГДА используй параметр "paths" (массив)
- Если нужно удалить 1 файл - используй параметр "path" (строка)
- Группируй связанные файлы в один вызов
- Это экономит API квоту и улучшает UI (карточка сворачивается)

[USER MESSAGE]
${query}`;
		} else {
			enhancedQuery = `[SYSTEM CONTEXT]
Текущее время (МСК): ${moscowTime}

КРИТИЧЕСКИ ВАЖНО - ЯЗЫК ОБЩЕНИЯ:
ТЫ ОБЯЗАН ОТВЕЧАТЬ ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ!
- Все твои ответы должны быть на русском
- Все объяснения на русском
- Все комментарии на русском
- НИКОГДА не используй английский язык

КРИТИЧЕСКИ ВАЖНО - МНОЖЕСТВЕННОЕ УДАЛЕНИЕ ФАЙЛОВ:
Инструмент delete_file поддерживает удаление нескольких файлов ОДНИМ вызовом!

✅ ПРАВИЛЬНО - Удаление нескольких файлов одним вызовом:
{
  "name": "delete_file",
  "input": {
    "paths": ["file1.txt", "file2.txt", "file3.txt"]
  }
}

❌ НЕПРАВИЛЬНО - Несколько отдельных вызовов (расходует квоту!):
delete_file({ "path": "file1.txt" })
delete_file({ "path": "file2.txt" })
delete_file({ "path": "file3.txt" })

ПРАВИЛА:
- Если нужно удалить 2+ файла - ВСЕГДА используй параметр "paths" (массив)
- Если нужно удалить 1 файл - используй параметр "path" (строка)
- Группируй связанные файлы в один вызов
- Это экономит API квоту и улучшает UI (карточка сворачивается)

ВНИМАНИЕ: Рабочая папка проекта не определена. Будь осторожен с файловыми операциями.

[USER MESSAGE]
${query}`;
		}
		
		console.log('[Qwen] Sending message via IPC with context:', enhancedQuery.substring(0, 150));

		try {
			// Отправляем в main process через IPC с workspace path
			// События будут приходить через streaming callback (vscode:qwenStreamEvent)
			const result: any = await ipcRenderer.invoke('vscode:qwenSendMessage', enhancedQuery, this.workspacePath);

			if (result.error) {
				throw new Error(result.error);
			}

			// После завершения - триггерим обновление файловой системы
			// Это заставит Explorer обновиться и показать новые файлы
			console.log('[Qwen] Triggering file system refresh');
			this.triggerFileSystemRefresh();

			this._onComplete.fire();
		} catch (error: any) {
			console.error('[Qwen] IPC Error:', error);
			this._onError.fire(error);
		} finally {
			this.processing = false;
		}
	}

	// Триггерим обновление файловой системы
	// VSCode автоматически обновит Explorer когда обнаружит изменения
	private triggerFileSystemRefresh(): void {
		// Используем setTimeout чтобы дать файловой системе время обновиться
		setTimeout(() => {
			// Отправляем событие что файлы могли измениться
			// Explorer подписан на эти события и обновится автоматически
			window.dispatchEvent(new CustomEvent('qwen-files-changed'));
			console.log('[Qwen] File system refresh event dispatched');
		}, 100);
	}

	private parseEvent(event: any): IQwenMessage | null {
		const id = event.uuid || `msg-${Date.now()}-${Math.random()}`;
		const timestamp = Date.now();

		switch (event.type) {
			case 'system':
				if (event.subtype === 'init') {
					return {
						id,
						type: QwenMessageType.SYSTEM,
						content: `Initialized with model: ${event.model}`,
						timestamp,
						metadata: {
							model: event.model,
							tools: event.tools,
							sessionId: event.session_id,
						},
					};
				}
				break;

			case 'assistant':
				const content = event.message?.content?.[0];
				if (!content) {
					return null;
				}

				// Tool call
				if (content.type === 'tool_use') {
					return {
						id,
						type: QwenMessageType.TOOL_CALL,
						content: JSON.stringify({ name: content.name, input: content.input }, null, 2),
						timestamp,
						metadata: {
							toolName: content.name,
							toolInput: content.input,
							toolCallId: content.id,
						},
					};
				}

				// Text response
				if (content.type === 'text') {
					return {
						id,
						type: QwenMessageType.ASSISTANT,
						content: content.text,
						timestamp,
						metadata: {
							usage: event.message.usage,
						},
					};
				}
				break;

			case 'user':
				const toolResult = event.message?.content?.[0];
				if (toolResult?.type === 'tool_result') {
					return {
						id,
						type: QwenMessageType.TOOL_RESULT,
						content: toolResult.content,
						timestamp,
						metadata: {
							isError: toolResult.is_error,
							toolUseId: toolResult.tool_use_id,
						},
					};
				}
				break;

			case 'result':
				return {
					id,
					type: QwenMessageType.RESULT,
					content: `Completed in ${event.duration}ms`,
					timestamp,
					metadata: {
						duration: event.duration,
						numTurns: event.num_turns,
					},
				};
		}

		return null;
	}

	isProcessing(): boolean {
		return this.processing;
	}

	abort(): void {
		this.processing = false;
	}
}

# Void Engine - Color Scheme

## 🎨 Цветовая схема

### Главный акцент: White (Белый)
**Основной:** `#FFFFFF` (RGB: 255, 255, 255)

### Подакцент: Void Purple (Фиолетовый)
**Вторичный:** `#8B5CF6` (RGB: 139, 92, 246)

## Концепция

**Белый** - чистота, минимализм, пустота (void)
- Основной цвет UI
- Границы, текст, иконки
- Hover состояния

**Фиолетовый** - глубина, энергия, акцент
- Только для активных иконок
- Тонкие акценты
- Не используется для glow/неона

## Палитра

```css
/* Белый (главный) */
--void-white: #FFFFFF;
--void-white-90: rgba(255, 255, 255, 0.9);
--void-white-70: rgba(255, 255, 255, 0.7);
--void-white-50: rgba(255, 255, 255, 0.5);
--void-white-40: rgba(255, 255, 255, 0.4);
--void-white-30: rgba(255, 255, 255, 0.3);
--void-white-15: rgba(255, 255, 255, 0.15);
--void-white-10: rgba(255, 255, 255, 0.1);
--void-white-08: rgba(255, 255, 255, 0.08);
--void-white-05: rgba(255, 255, 255, 0.05);

/* Фиолетовый (подакцент) */
--void-purple: #8B5CF6;
--void-purple-light: #A78BFA;
--void-purple-dark: #7C3AED;
```

## 📍 Применение

### Scene Editor Toolbar
```css
/* Кнопки */
border: 1px solid rgba(255, 255, 255, 0.15);  /* Белый */
color: rgba(255, 255, 255, 0.7);              /* Белый */

/* Hover */
background: rgba(255, 255, 255, 0.05);        /* Белый */
border-color: rgba(255, 255, 255, 0.3);       /* Белый */

/* Active */
background: rgba(255, 255, 255, 0.1);         /* Белый */
color: #FFFFFF;                                /* Белый */
icon-color: #8B5CF6;                          /* Фиолетовый! */
```

### Принципы

✅ **DO:**
- Белый для всех границ, текста, UI элементов
- Фиолетовый ТОЛЬКО для активных иконок
- Прозрачность для глубины
- Минимализм

❌ **DON'T:**
- Неоновые эффекты (glow, shadow)
- Фиолетовый для границ/фона
- Яркие цвета
- Градиенты (кроме subtle)

## 🎯 Иконки

### SVG иконки (не эмодзи!)
- **3D:** Куб (изометрия)
- **2D:** Сетка 2x2
- **Script:** Код-скобки `< >`

### Стиль иконок
- Stroke width: 1.5px
- Размер: 16x16px
- Цвет: currentColor
- Минималистичные, четкие линии

### Game Runner (TODO - обновить)
- Кнопка Play
- Прогресс-бар компиляции
- Индикаторы статуса

### Welcome Screen (TODO - обновить)
- Акценты на карточках проектов
- Кнопки действий
- Hover эффекты

### Compilation Window (TODO - обновить)
- Прогресс-бар: `#8B5CF6`
- Спиннер: `#8B5CF6`
- Успешная компиляция: зеленый остается

## 🔄 Миграция с оранжевого

### Старый цвет (оранжевый)
```css
--old-orange: #ff8c00;
--old-orange: #ff6b35;
```

### Замена
Все вхождения `#ff8c00`, `#ff6b35`, `orange` → `#8B5CF6`

### Файлы для обновления:
1. ✅ `voidSceneEditorToolbar.css` - обновлен
2. ⏳ `voidGameRunnerToolbar.css` - TODO
3. ⏳ `voidGameWindow.css` - TODO (прогресс-бар)
4. ⏳ `voidWelcome.css` - TODO
5. ⏳ `voidMenu.ts` - TODO (если есть цвета)

## 🎯 Принципы использования

### DO ✅
- Используй `#8B5CF6` для всех акцентов
- Используй прозрачность для hover/focus
- Добавляй glow эффекты для активных элементов
- Сохраняй консистентность

### DON'T ❌
- Не используй другие акцентные цвета
- Не делай слишком яркие эффекты
- Не забывай про accessibility (контраст)

## 🌈 Дополнительные цвета

### Статусы (не меняем)
- **Success:** `#10B981` (зеленый)
- **Error:** `#EF4444` (красный)
- **Warning:** `#F59E0B` (желтый)
- **Info:** `#3B82F6` (синий)

### Нейтральные
- **Background:** темный (из темы)
- **Foreground:** светлый (из темы)
- **Border:** `rgba(255, 255, 255, 0.1)`

## 📊 Примеры использования

### Кнопка
```css
.button {
	border: 1px solid rgba(139, 92, 246, 0.3);
	color: #8B5CF6;
}

.button:hover {
	background: rgba(139, 92, 246, 0.1);
	border-color: rgba(139, 92, 246, 0.6);
}

.button.active {
	background: rgba(139, 92, 246, 0.2);
	box-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
}
```

### Прогресс-бар
```css
.progress-bar {
	background: rgba(139, 92, 246, 0.2);
}

.progress-fill {
	background: linear-gradient(90deg, #8B5CF6, #A78BFA);
	box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
}
```

### Glow эффект
```css
.glow {
	box-shadow: 
		0 0 10px rgba(139, 92, 246, 0.3),
		0 0 20px rgba(139, 92, 246, 0.2),
		0 0 30px rgba(139, 92, 246, 0.1);
}
```

## 🚀 Roadmap

- [x] Phase 1: Scene Editor Toolbar
- [ ] Phase 2: Game Runner UI
- [ ] Phase 3: Welcome Screen
- [ ] Phase 4: Compilation Window
- [ ] Phase 5: Все остальные компоненты

---

**Void Purple** - единый акцентный цвет для всего Void Engine! 🌌

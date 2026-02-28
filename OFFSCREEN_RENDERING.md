# 🎨 Offscreen Rendering - Практическая реализация

## Идея
Bevy рендерит в offscreen buffer → передает кадры в VSCode → показываем в canvas

## Архитектура

```
┌─────────────────────────────────────────────────┐
│ Bevy Game Process                               │
│                                                 │
│  Render 
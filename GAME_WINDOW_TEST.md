# Game Window Test Instructions

## What Was Implemented

We've created a **separate frameless Electron window** for the Void Game Runner with:

### Features
1. **Custom Titlebar** with drag support
2. **Two Tabs**: Viewport and Terminal
3. **Window Controls**: Minimize, Maximize, Close buttons
4. **Compilation Progress Display** with progress bar
5. **Terminal Output** with auto-scroll and styled scrollbar
6. **IPC Communication** for progress forwarding

### Files Modified
- `vscode/src/vs/code/electron-main/gameRunner.ts` - Window creation with inline HTML
- `vscode/src/vs/code/electron-main/gameViewportPreload.ts` - IPC bridge
- `vscode/src/vs/workbench/contrib/voidGameRunner/browser/voidGameRunner.contribution.ts` - Calls window creation
- `vscode/src/vs/code/electron-main/app.ts` - Registers IPC handlers

## How to Test

### Step 1: Restart VSCode
Close and reopen VSCode to load the new compiled code.

### Step 2: Open a Rust/Bevy Project
Open any workspace with a Cargo.toml file.

### Step 3: Press F5
This will:
1. Create the game window (should appear immediately)
2. Start compilation
3. Show progress in the window
4. Display terminal output

### Expected Behavior

#### Window Appearance
- Frameless window with custom dark titlebar
- Title: "🎮 Void Game Runner"
- Two tabs: "Viewport" and "Terminal"
- Three window control buttons (minimize, maximize, close)

#### Viewport Tab (Default)
- Shows "Compiling..." text
- Progress bar animating during compilation
- Status message updating

#### Terminal Tab
- Shows compilation output
- Auto-scrolls to bottom
- Orange gradient scrollbar
- Text is selectable (Ctrl+A works)

#### Window Controls
- **Minimize**: Minimizes window
- **Maximize**: Toggles maximize/restore
- **Close**: Closes window and stops game process

## Current Limitations

1. **No Embedded Game Viewport Yet**
   - The Bevy game still opens in its own native window
   - Embedding requires offscreen rendering (complex, future work)

2. **Progress Forwarding**
   - IPC is set up but needs testing
   - Should show cargo build progress in real-time

## Next Steps

If the window appears and works:
1. ✅ Test tab switching (Viewport ↔ Terminal)
2. ✅ Test window controls (minimize, maximize, close)
3. ✅ Test compilation progress display
4. ✅ Test terminal output display
5. 🔄 Future: Embed actual Bevy game viewport (requires offscreen rendering)

## Troubleshooting

### Window Doesn't Appear
- Check DevTools console for errors (Help → Toggle Developer Tools)
- Check if IPC handlers are registered (look for "[Game Runner IPC]" logs)

### Window Appears But No UI
- Check if preload script is compiled (should be in out/vs/code/electron-main/)
- Check browser console in game window (Ctrl+Shift+I)

### Progress Not Updating
- Check if IPC forwarding is working
- Look for "[Game Runner] Game window created with ID:" in console

## Technical Details

### Why Inline HTML?
Electron blocks loading local HTML files via `file://` protocol for security. We use `data:` URL protocol with inline HTML instead.

### IPC Channels
All channels must start with `vscode:` prefix (VSCode security requirement):
- `vscode:void-create-game-window`
- `vscode:void-forward-progress`
- `vscode:void-launch-game`
- `vscode:void-stop-game`
- `vscode:void-close-game-window`
- `vscode:void-window-minimize`
- `vscode:void-window-maximize`
- `vscode:void-window-close`

### Preload Script
Exposes safe IPC methods to renderer:
- `window.electronAPI.minimizeWindow()`
- `window.electronAPI.maximizeWindow()`
- `window.electronAPI.closeWindow()`
- `window.electronAPI.onGameOutput(callback)`
- `window.electronAPI.onCompilationProgress(callback)`

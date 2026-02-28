# Real-Time Synchronization Debug Guide

## Fixes Applied

### 1. Inspector Real-Time Updates
**Problem**: Inspector coordinates didn't update when dragging gizmo
**Fix**: 
- Added immediate scene data update before calling `updateFromViewport()`
- Inspector now receives fresh entity data directly from model
- Added detailed logging to track update flow

**How to verify**:
1. Open DevTools Console (F12)
2. Select an entity in viewport
3. Drag gizmo arrows
4. Watch for these logs:
   ```
   [VoidSceneEditor] Transform edited: <entity-id>
   [VoidSceneEditor] Forcing inspector update
   [Inspector] updateFromViewport called for: <entity-id>
   [Inspector] Scene update received, source: editor-model
   [Inspector] Re-rendering for selected entity: <entity-id>
   ```
5. Inspector coordinates should update in real-time

### 2. Gizmo E/R Modes Visibility
**Problem**: Only translate arrows visible, rotate/scale modes not rendering
**Fix**:
- Increased rotate ring scale from 0.85 to 1.2 for better visibility
- Added extensive logging to track rendering
- Verified torus geometry creation

**How to verify**:
1. Select an entity
2. Press **E** key → Should see 3 colored rings (X=red, Y=green, Z=blue)
3. Press **R** key → Should see 3 colored arrows with cubes at tips
4. Press **W** key → Should see 3 colored arrows with cones at tips
5. Check Console for:
   ```
   [Viewport] Switching to ROTATE mode
   [Viewport] renderGizmoRotate START, torusGeo: true, flatProgram: true
   [Viewport] Rendering rotate rings, distance: X, scale: Y
   [Viewport] Drawing ring: x indexCount: Z
   [Viewport] renderGizmoRotate COMPLETE
   ```

### 3. Scene Hierarchy Initial Load
**Problem**: Scene Hierarchy empty on first load
**Fix**:
- Hierarchy now loads last scene state immediately on creation
- Always re-renders when scene updates (removed conditional)

**How to verify**:
1. Open a .vecn file
2. Switch to Scene3D mode
3. Check Explorer → Scene Hierarchy view
4. Should immediately show entities
5. Console logs:
   ```
   [SceneHierarchy] Loading last scene update: <uri>
   [SceneHierarchy] Parsed entities: X
   [SceneHierarchy] renderScene called, entities: X
   ```

### 4. Auto-Save
**Problem**: Changes not saving to disk
**Fix**:
- Added comprehensive logging throughout save chain
- Improved patchTRSById with detailed logging
- Verified VSBuffer write operation

**How to verify**:
1. Select entity and drag gizmo
2. Wait 500ms
3. Check Console for complete chain:
   ```
   [VoidSceneEditor] handleTransformEditTRS called: <id> T: [...] R: [...] S: [...]
   [VoidSceneEditor] Current model content length: X
   [VoidSceneEditor] patchTRSById: Searching for entity: <id>
   [VoidSceneEditor] patchTRSById: Found entity at position: X
   [VoidSceneEditor] patchTRSById: Found Transform at offset: Y
   [VoidSceneEditor] patchTRSById: Patching translation: ...
   [VoidSceneEditor] patchTRSById: Patching rotation: ...
   [VoidSceneEditor] patchTRSById: Patching scale: ...
   [VoidSceneEditor] patchTRSById: Patch complete, result length: Z
   [VoidSceneEditor] Patching model, changes detected, scheduling auto-save
   [VoidSceneEditor] Auto-save timer fired, saving to disk
   [VoidSceneEditor] Auto-save: Writing to disk: <uri>
   [VoidSceneEditor] Auto-saved successfully: <uri>
   ```
4. Check file on disk - should have updated coordinates

## Complete Sync Chain

When you drag a gizmo, this should happen:

```
1. Viewport detects drag → updates entity transform
2. Viewport fires onTransformEditedTRS event
3. Contribution receives event:
   a. Updates Inspector scene data
   b. Calls inspector.updateFromViewport()
   c. Patches model content
   d. Schedules auto-save (500ms debounce)
4. Model change triggers:
   a. Model listener fires (after 100ms debounce)
   b. Viewport updates (if content changed)
   c. Scene bus fires update event
5. Scene bus update received by:
   a. Inspector → re-renders if entity selected
   b. Scene Hierarchy → always re-renders
6. Auto-save timer fires:
   a. Writes to disk using VSBuffer
   b. File watcher detects change (but suppressed for 200ms)
```

## Troubleshooting

### Inspector not updating
- Check: `[Inspector] updateFromViewport called`
- Check: `[Inspector] Re-rendering for selected entity`
- If missing: Inspector not receiving event or entity not selected

### Gizmo E/R not visible
- Check: `[Viewport] Switching to ROTATE/SCALE mode`
- Check: `[Viewport] renderGizmoRotate/Scale START`
- Check: `torusGeo: true` or `cylinderGeo: true`
- If false: Geometry not created in initWebGL

### Auto-save not working
- Check complete chain from `handleTransformEditTRS` to `Auto-saved successfully`
- If stops at `patchTRSById`: Entity ID not found or Transform not found
- If stops at `Patching model`: No changes detected (values identical)
- If stops at `Auto-save timer`: Timer cleared or error in saveModelToDisk

### Scene Hierarchy empty
- Check: `[SceneHierarchy] Loading last scene update`
- Check: `[SceneHierarchy] Parsed entities: X` (X should be > 0)
- If 0: Scene not published to bus yet
- Solution: Switch to Script mode and back to Scene3D

## Performance Notes

- Model change debounce: 100ms (fast enough for real-time feel)
- Auto-save debounce: 500ms (prevents excessive disk writes)
- Anti-echo suppression: 200ms (prevents feedback loops)

## Next Steps

If issues persist:
1. Copy ALL console logs
2. Note which specific step fails
3. Check if error messages appear
4. Verify .vecn file syntax is valid

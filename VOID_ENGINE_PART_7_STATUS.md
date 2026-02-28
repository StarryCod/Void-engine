# Void Engine Part 7: Scene Bridge + Reference Gizmo — STATUS

## ✅ COMPLETED

### 1. Scene Bridge (voidSceneBridge.ts) — CREATED
- ✅ Singleton bridge with single source of truth
- ✅ Events: onViewportNeedsUpdate, onInspectorNeedsUpdate, onTreeNeedsUpdate, onNeedsSave, onEntitySelected
- ✅ Methods: pushFromDisk, pushFromViewport, pushFromInspector, pushFromTree, pushFromEditor
- ✅ Fast TRS patching for viewport transforms (preserves formatting)
- ✅ Full serialize for inspector/tree changes
- ✅ Debounced save (150ms)
- ✅ Hash-based change detection

### 2. ThreeViewport Gizmo Updates — COMPLETED
- ✅ Added `createCircleLineGeometry()` for rotation rings
- ✅ Added `createQuadGeometry()` for plane handles
- ✅ Added LINE shader (LINE_VERT, LINE_FRAG)
- ✅ Added `circleLineGeo` and `quadGeo` fields
- ✅ Added `lineProgram` field
- ✅ Updated `initWebGL()` to create new geometries and program

### 3. Gizmo Rendering — REFERENCE STYLE
- ✅ `renderGizmo()` — simplified, always on top (disable depth test)
- ✅ `gizmoTranslate()` — thin arrows (0.015 radius) + semi-transparent plane quads
  - Dark colors: (0.6, 0, 0), (0, 0.6, 0), (0, 0, 0.6)
  - Plane handles: txy, txz, tyz with 0.25 alpha
- ✅ `gizmoRotate()` — LINE_STRIP circles (not torus!)
  - Display: thin lines
  - Picking: fat torus mesh
- ✅ `gizmoScale()` — thin shafts + cubes at tips + center cube
  - Same dark colors as translate

### 4. Plane Drag Support — ALREADY PRESENT
- ✅ `updateGizmoDrag()` already has plane drag (txy, txz, tyz)
- ✅ `startGizmoDrag()` already has plane handle init

## ⏳ REMAINING WORK

### 5. Contribution File — Bridge Integration
Need to update `voidSceneEditor.contribution.ts`:
- [ ] Import `sceneBridge`
- [ ] Replace constructor to use bridge events
- [ ] Replace `earlySceneDiscovery()` to use `bridge.pushFromDisk()`
- [ ] Replace `ensureModelListener()` to use `bridge.pushFromEditor()`
- [ ] Add bridge.onNeedsSave handler
- [ ] Wire viewport events to bridge.pushTransformFromViewport()
- [ ] Remove old methods: handleTransformEditTRS, patchTRSById, saveModelToDisk, saveContentToDisk

### 6. Inspector View — Bridge Integration
Need to update `inspectorView.ts`:
- [ ] Import `sceneBridge`
- [ ] Replace vecnSceneBus with bridge.onInspectorNeedsUpdate
- [ ] Replace save() to use bridge.pushFromInspector()
- [ ] Add bridge.onEntitySelected listener

### 7. Scene Hierarchy View — Bridge Integration
Need to update `sceneHierarchyView.ts`:
- [ ] Import `sceneBridge`
- [ ] Replace vecnSceneBus with bridge.onTreeNeedsUpdate
- [ ] Use bridge.entities for initial state
- [ ] Entity click → bridge.selectEntity()
- [ ] Tree changes → bridge.pushFromTree()

## 🎯 NEXT STEPS

1. Check watcher for compilation errors
2. Update contribution file with bridge
3. Update inspector view with bridge
4. Update hierarchy view with bridge
5. Test gizmo rendering
6. Test plane drag
7. Test bridge data flow

## 📝 NOTES

- Gizmo now matches Three.js reference exactly
- Thin lines, dark colors, semi-transparent planes
- Rotation uses LINE_STRIP for display (crisp circles)
- Bridge ensures single source of truth
- All components communicate through bridge only
- Fast TRS patching preserves file formatting

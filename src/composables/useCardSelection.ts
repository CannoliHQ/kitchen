import { reactive, ref, computed } from 'vue'

/**
 * Multi-select + long-press-to-select behaviour shared by the platform game grid/table.
 * `openGame`/`openFolder` are invoked on a normal (non-select-mode) click.
 */
export function useCardSelection(opts: {
  openGame: (id: number) => void
  openFolder: (path: string) => void
}) {
  const selectMode = ref(false)
  const selectedGameIds = reactive(new Set<number>())
  const selectedFolderPaths = reactive(new Set<string>())
  const selectedCount = computed(() => selectedGameIds.size + selectedFolderPaths.size)

  function clearSelection() {
    selectedGameIds.clear()
    selectedFolderPaths.clear()
  }

  function toggleSelectMode() {
    selectMode.value = !selectMode.value
    if (!selectMode.value) clearSelection()
  }

  function toggleGame(id: number) {
    if (selectedGameIds.has(id)) selectedGameIds.delete(id)
    else selectedGameIds.add(id)
  }

  function toggleFolder(path: string) {
    if (selectedFolderPaths.has(path)) selectedFolderPaths.delete(path)
    else selectedFolderPaths.add(path)
  }

  const LONG_PRESS_MS = 450
  let pressTimer: number | null = null
  const pressFired = ref(false)
  let pressStartedAt = 0
  let autoEnteredSelectMode = false

  function cancelPress() {
    if (pressTimer !== null) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  function beginPress(ev: Event | undefined, onHold: () => void) {
    cancelPress()
    // Without this the flag survives a press whose pointer was released off the card, because no
    // click ever arrives to consume it, and the next tap anywhere is silently swallowed.
    pressFired.value = false
    autoEnteredSelectMode = false
    pressStartedAt = ev?.timeStamp ?? performance.now()
    pressTimer = window.setTimeout(() => {
      pressFired.value = true
      if (!selectMode.value) {
        selectMode.value = true
        autoEnteredSelectMode = true
      }
      onHold()
    }, LONG_PRESS_MS)
  }

  /** True for a genuine hold. Timers and pointer events queue behind a busy main thread, so a quick
   *  tap can be delivered after its own long-press timer has fired. Event timestamps record when
   *  the interaction actually happened, so they stay honest under load where ordering does not. */
  function wasRealHold(ev: Event | undefined): boolean {
    const releasedAt = ev?.timeStamp ?? performance.now()
    return releasedAt - pressStartedAt >= LONG_PRESS_MS
  }

  function undoAccidentalHold(revert: () => void) {
    pressFired.value = false
    revert()
    if (autoEnteredSelectMode && selectedCount.value === 0) selectMode.value = false
    autoEnteredSelectMode = false
  }

  function startPressGame(id: number, ev?: Event) {
    beginPress(ev, () => toggleGame(id))
  }

  function startPressFolder(path: string, ev?: Event) {
    beginPress(ev, () => toggleFolder(path))
  }

  function handleGameClick(id: number, ev?: Event) {
    cancelPress()
    if (pressFired.value) {
      if (wasRealHold(ev)) { pressFired.value = false; return }
      undoAccidentalHold(() => toggleGame(id))
    }
    if (selectMode.value) toggleGame(id)
    else opts.openGame(id)
  }

  function handleFolderClick(path: string, ev?: Event) {
    cancelPress()
    if (pressFired.value) {
      if (wasRealHold(ev)) { pressFired.value = false; return }
      undoAccidentalHold(() => toggleFolder(path))
    }
    if (selectMode.value) toggleFolder(path)
    else opts.openFolder(path)
  }

  return {
    selectMode,
    selectedGameIds,
    selectedFolderPaths,
    selectedCount,
    clearSelection,
    toggleSelectMode,
    toggleGame,
    toggleFolder,
    cancelPress,
    startPressGame,
    startPressFolder,
    handleGameClick,
    handleFolderClick,
  }
}

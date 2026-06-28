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

  function cancelPress() {
    if (pressTimer !== null) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  function startPressGame(id: number) {
    cancelPress()
    pressTimer = window.setTimeout(() => {
      pressFired.value = true
      if (!selectMode.value) selectMode.value = true
      toggleGame(id)
    }, LONG_PRESS_MS)
  }

  function startPressFolder(path: string) {
    cancelPress()
    pressTimer = window.setTimeout(() => {
      pressFired.value = true
      if (!selectMode.value) selectMode.value = true
      toggleFolder(path)
    }, LONG_PRESS_MS)
  }

  function handleGameClick(id: number) {
    cancelPress()
    if (pressFired.value) { pressFired.value = false; return }
    if (selectMode.value) toggleGame(id)
    else opts.openGame(id)
  }

  function handleFolderClick(path: string) {
    cancelPress()
    if (pressFired.value) { pressFired.value = false; return }
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

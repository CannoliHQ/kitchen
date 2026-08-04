<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getGames, uploadFiles, createFolder, moveGame, moveFile, renameGame, deleteGame, deleteFile, type GameRow } from '@/api/client'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Progress from '@/components/ui/Progress.vue'
import GameCover from '@/components/game/GameCover.vue'
import GameTable from '@/components/game/GameTable.vue'
import FolderTile from '@/components/game/FolderTile.vue'
import Modal from '@/components/ui/Modal.vue'
import NewFolderDialog from '@/components/file/NewFolderDialog.vue'
import MoveDialog from '@/components/file/MoveDialog.vue'
import RenameDialog from '@/components/file/RenameDialog.vue'
import { Check, CheckSquare, LayoutGrid, Table as TableIcon, Search, Upload } from 'lucide-vue-next'
import { folderLeaf } from '@/lib/folders'
import { useCardSelection } from '@/composables/useCardSelection'

const props = defineProps<{ tag: string; folder: string }>()
const router = useRouter()
const { t } = useI18n()

const games = ref<GameRow[]>([])
const allFolders = ref<string[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')

const currentFolder = computed(() => props.folder)

const currentGames = computed(() =>
  games.value.filter(g => g.folder === currentFolder.value),
)

const currentFolders = computed(() => {
  const cur = currentFolder.value
  return allFolders.value.filter(f => {
    if (cur === '') return !f.includes('/')
    if (!f.startsWith(cur + '/')) return false
    const remainder = f.slice(cur.length + 1)
    return !remainder.includes('/')
  })
})

const viewMode = ref<'cards' | 'table'>(
  localStorage.getItem('cannoli_view_mode') === 'table' ? 'table' : 'cards',
)
watch(viewMode, v => localStorage.setItem('cannoli_view_mode', v))

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return currentGames.value
  return currentGames.value.filter(g => g.displayName.toLowerCase().includes(q))
})

const gridRef = ref<HTMLElement | null>(null)
const pageSize = ref(24)
// Only the pager and the page's bottom padding sit below the grid, and both are fixed height.
// Everything above it (header, tabs, breadcrumb, folder tiles, heading) varies per platform and
// is measured instead, so pages fill the screen rather than assuming one worst-case layout.
const PAGER_RESERVED_PX = 56

function recomputePageSize() {
  const el = gridRef.value
  if (!el || el.children.length === 0) return
  const firstChild = el.children[0] as HTMLElement
  // offsetWidth/offsetHeight are rounded to whole pixels. auto-fill columns are fractional, so a
  // rounded-up card width makes the division land just under the true column count and floor()
  // drops a whole column, leaving the last row short. Fractional rects avoid that.
  const rect = firstChild.getBoundingClientRect()
  const cardWidth = rect.width
  const cardHeight = rect.height
  if (cardWidth <= 0 || cardHeight <= 0) return
  const style = getComputedStyle(el)
  const rowGap = parseFloat(style.rowGap) || 0
  const colGap = parseFloat(style.columnGap) || rowGap
  const gridWidth = el.clientWidth
  // The true column count is an integer, so round rather than floor to absorb residual error.
  const cols = Math.max(1, Math.round((gridWidth + colGap) / (cardWidth + colGap)))
  // Document-relative so the result does not change as the user scrolls.
  const gridTop = el.getBoundingClientRect().top + window.scrollY
  const availableHeight = window.innerHeight - gridTop - PAGER_RESERVED_PX
  // Half a pixel of slack so a fractional card height cannot cost a whole row.
  const rows = Math.max(1, Math.floor((availableHeight + rowGap + 0.5) / (cardHeight + rowGap)))
  pageSize.value = cols * rows
}

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  nextTick(recomputePageSize)
  resizeObserver = new ResizeObserver(() => recomputePageSize())
  window.addEventListener('resize', recomputePageSize)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', recomputePageSize)
})
watch(gridRef, el => {
  resizeObserver?.disconnect()
  if (el) resizeObserver?.observe(el)
  nextTick(recomputePageSize)
})

// Kept in the url so returning from a game lands on the page you left, and so a reload or a shared
// link does too. The component itself is unmounted on navigation, so local state cannot survive.
const route = useRoute()
const page = ref(Math.max(1, Number(route.query.page) || 1))

watch(page, p => {
  const query = { ...route.query }
  if (p > 1) query.page = String(p)
  else delete query.page
  router.replace({ query })
})
const sortKey = ref<string>('title')
const sortDir = ref<1 | -1>(1)

function setSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = (sortDir.value * -1) as 1 | -1
  } else {
    sortKey.value = key
    sortDir.value = 1
  }
}

const ordered = computed(() => {
  if (viewMode.value !== 'table') return filtered.value
  const arr = [...filtered.value]
  const d = sortDir.value
  arr.sort((a, b) => {
    let r: number
    switch (sortKey.value) {
      case 'saves': r = a.savesCount - b.savesCount; break
      case 'states': r = a.statesCount - b.statesCount; break
      case 'guides': r = a.guidesCount - b.guidesCount; break
      case 'played': r = (a.lastPlayedAt ?? 0) - (b.lastPlayedAt ?? 0); break
      default: r = a.displayName.localeCompare(b.displayName)
    }
    return r * d
  })
  return arr
})

const pageCount = computed(() => Math.max(1, Math.ceil(ordered.value.length / pageSize.value)))
const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return ordered.value.slice(start, start + pageSize.value)
})

watch([viewMode, () => filtered.value.length], () => nextTick(recomputePageSize))

watch(currentFolder, () => { search.value = ''; selectedGameIds.clear(); selectedFolderPaths.clear() })
watch([search, viewMode, sortKey, sortDir, currentFolder], () => { page.value = 1 })
watch(pageCount, pc => { if (page.value > pc) page.value = pc })

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await getGames(props.tag)
    games.value = res.games
    allFolders.value = res.folders
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : t('platform.loadFailed')
  } finally {
    loading.value = false
  }
}

function openFolder(path: string) {
  router.push({ name: 'platform-folder', params: { tag: props.tag, folder: path } })
}

const fileInput = ref<HTMLInputElement>()
const dragOver = ref(false)

const showNewFolder = ref(false)

const {
  selectMode,
  selectedGameIds,
  selectedFolderPaths,
  selectedCount,
  toggleSelectMode,
  cancelPress,
  startPressGame,
  startPressFolder,
  handleGameClick,
  handleFolderClick,
} = useCardSelection({ openGame, openFolder })

const movePromptOpen = ref(false)
const renamePromptOpen = ref(false)
const deletePromptOpen = ref(false)

const renameTarget = computed(() => {
  if (selectedGameIds.size === 1 && selectedFolderPaths.size === 0) {
    const id = [...selectedGameIds][0]!
    const game = games.value.find(g => g.id === id)
    if (!game) return null
    return { kind: 'game' as const, name: game.displayName, gameId: id }
  }
  if (selectedFolderPaths.size === 1 && selectedGameIds.size === 0) {
    const path = [...selectedFolderPaths][0]!
    return { kind: 'folder' as const, name: folderLeaf(path), folderPath: path }
  }
  return null
})

async function onRename(newName: string) {
  const target = renameTarget.value
  if (!target) return
  try {
    if (target.kind === 'game') {
      await renameGame(props.tag, target.gameId, newName)
    } else {
      const parentPath = target.folderPath.split('/').slice(0, -1).join('/')
      await moveFile('roms', [props.tag, ...target.folderPath.split('/')], [props.tag, parentPath, newName].filter(Boolean).join('/'))
    }
    await load()
  } catch {
    error.value = t('platform.renameFailed')
  } finally {
    renamePromptOpen.value = false
    if (selectMode.value) toggleSelectMode()
  }
}

async function onMove(target: string) {
  try {
    for (const id of selectedGameIds) {
      await moveGame(props.tag, id, target)
    }
    for (const folderPath of selectedFolderPaths) {
      await moveFile('roms', [props.tag, ...folderPath.split('/')], [props.tag, target, folderLeaf(folderPath)].filter(Boolean).join('/'))
    }
    await load()
  } catch {
    error.value = t('platform.moveFailed')
  } finally {
    movePromptOpen.value = false
    if (selectMode.value) toggleSelectMode()
  }
}

async function onDelete() {
  try {
    for (const id of selectedGameIds) {
      await deleteGame(props.tag, id, false)
    }
    for (const folderPath of selectedFolderPaths) {
      await deleteFile('roms', props.tag, ...folderPath.split('/'))
    }
    await load()
  } catch {
    error.value = t('platform.deleteFailed')
  } finally {
    deletePromptOpen.value = false
    if (selectMode.value) toggleSelectMode()
  }
}

const uploading = ref(false)
const uploadProgress = ref(0)
const uploadName = ref('')
const uploadCurrent = ref(0)
const uploadTotal = ref(0)

async function doUpload(files: File[]) {
  if (!files.length || uploading.value) return
  uploading.value = true
  error.value = null
  uploadTotal.value = files.length
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      uploadCurrent.value = i + 1
      uploadName.value = file.name
      uploadProgress.value = 0
      const { promise } = uploadFiles('roms', [props.tag], [file], pct => { uploadProgress.value = pct })
      await promise
    }
    await load()
  } catch {
    error.value = t('platform.romUploadFailed')
  } finally {
    uploading.value = false
  }
}

async function onCreateFolder(name: string) {
  try {
    const segments = currentFolder.value.split('/').filter(Boolean)
    await createFolder('roms', props.tag, ...segments, name)
    await load()
  } catch {
    error.value = t('platform.createFolderFailed')
  } finally {
    showNewFolder.value = false
  }
}

let dragDepth = 0
function onWindowDragEnter(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return
  e.preventDefault()
  dragDepth++
  dragOver.value = true
}
function onWindowDragOver(e: DragEvent) {
  e.preventDefault()
}
function onWindowDragLeave(e: DragEvent) {
  e.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragOver.value = false
}
function onWindowDrop(e: DragEvent) {
  e.preventDefault()
  dragDepth = 0
  dragOver.value = false
  doUpload(Array.from(e.dataTransfer?.files ?? []))
}

function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  doUpload(files)
}

function openGame(id: number) {
  // Carried through so the detail view can send you back to the page you came from.
  const query = page.value > 1 ? { page: String(page.value) } : undefined
  router.push({ path: `/platform/${encodeURIComponent(props.tag)}/game/${id}`, query })
}

function triggerNewFolder() {
  showNewFolder.value = true
}

function triggerRomUpload() {
  fileInput.value?.click()
}

defineExpose({ triggerNewFolder, triggerRomUpload })

onMounted(() => {
  load()
  window.addEventListener('dragenter', onWindowDragEnter)
  window.addEventListener('dragover', onWindowDragOver)
  window.addEventListener('dragleave', onWindowDragLeave)
  window.addEventListener('drop', onWindowDrop)
})
onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onWindowDragEnter)
  window.removeEventListener('dragover', onWindowDragOver)
  window.removeEventListener('dragleave', onWindowDragLeave)
  window.removeEventListener('drop', onWindowDrop)
})
</script>

<template>
  <div class="space-y-6">
    <input ref="fileInput" type="file" multiple class="hidden" @change="handleFiles" />
    <NewFolderDialog v-if="showNewFolder" @close="showNewFolder = false" @create="onCreateFolder" />
    <MoveDialog v-if="movePromptOpen" :tag="props.tag" :folders="allFolders" :count="selectedCount" :moving-folders="[...selectedFolderPaths]" @close="movePromptOpen = false" @move="onMove" />
    <RenameDialog v-if="renamePromptOpen && renameTarget" :current-name="renameTarget.name" @close="renamePromptOpen = false" @rename="onRename" />
    <Modal v-if="deletePromptOpen" :title="$t('platform.deleteTitle', { n: selectedCount }, selectedCount)" @close="deletePromptOpen = false">
      <p class="text-sm text-foreground/80">{{ $t('platform.deleteBody') }}</p>
      <template #footer>
        <Button variant="ghost" @click="deletePromptOpen = false">{{ $t('common.cancel') }}</Button>
        <Button variant="destructive" @click="onDelete">{{ $t('common.delete') }}</Button>
      </template>
    </Modal>

    <div v-if="uploading" class="rounded-lg border border-border bg-card p-3 space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-foreground font-medium truncate">
          {{ uploadName }}<span v-if="uploadTotal > 1" class="text-foreground/60 font-normal"> {{ $t('platform.uploadCount', { current: uploadCurrent, total: uploadTotal }) }}</span>
        </span>
        <span class="font-mono text-foreground/60 ml-2 shrink-0">{{ uploadProgress }}%</span>
      </div>
      <Progress :value="uploadProgress" />
    </div>

    <div
      v-if="selectMode && selectedCount > 0"
      class="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
    >
      <span class="text-sm font-medium text-foreground">{{ $t('platform.selectedCount', { n: selectedCount }) }}</span>
      <div class="flex items-center gap-2 sm:ml-auto flex-wrap">
        <button
          class="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          @click="movePromptOpen = true"
        >{{ $t('common.move') }}</button>
        <button
          class="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="!renameTarget"
          @click="renamePromptOpen = true"
        >{{ $t('common.rename') }}</button>
        <button
          class="rounded-md border border-destructive/60 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          @click="deletePromptOpen = true"
        >{{ $t('common.delete') }}</button>
        <button
          class="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:text-foreground hover:bg-muted"
          @click="toggleSelectMode"
        >{{ $t('platform.done') }}</button>
      </div>
    </div>

    <div class="flex items-center justify-between gap-3">
      <div class="relative w-64">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/70 pointer-events-none" />
        <Input v-model="search" :placeholder="$t('platform.searchPlaceholder')" class="!pl-9 !h-10 !text-base !rounded-lg" />
      </div>
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
          :class="selectMode ? 'border-accent bg-accent/10 text-foreground' : 'border-border text-foreground/70 hover:text-foreground'"
          :aria-pressed="selectMode"
          :title="$t('platform.selectItems')"
          @click="toggleSelectMode"
        >
          <CheckSquare class="h-4 w-4" />
          {{ $t('platform.select') }}
        </button>
        <div class="flex rounded-lg border border-border overflow-hidden">
          <button
            class="p-2 transition-colors"
            :class="viewMode === 'cards' ? 'bg-accent/10 text-accent' : 'text-foreground/70 hover:text-foreground'"
            :aria-pressed="viewMode === 'cards'"
            :title="$t('platform.cardView')"
            @click="viewMode = 'cards'"
          >
            <LayoutGrid class="h-4 w-4" />
          </button>
          <button
            class="p-2 transition-colors border-l border-border"
            :class="viewMode === 'table' ? 'bg-accent/10 text-accent' : 'text-foreground/70 hover:text-foreground'"
            :aria-pressed="viewMode === 'table'"
            :title="$t('platform.tableView')"
            @click="viewMode = 'table'"
          >
            <TableIcon class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <p v-if="loading" class="text-base text-foreground/75 py-8 text-center">{{ $t('platform.loadingGames') }}</p>
    <div v-else-if="error" class="text-base py-8 text-center space-y-2">
      <p class="text-destructive">{{ error }}</p>
      <Button variant="outline" size="sm" @click="load">{{ $t('common.retry') }}</Button>
    </div>
    <p v-else-if="!filtered.length && !currentFolders.length" class="text-base text-foreground/75 py-8 text-center">
      {{ search ? $t('platform.noGamesMatch', { query: search }) : $t('platform.noGamesYet') }}
    </p>
    <template v-else-if="viewMode === 'cards'">
      <section v-if="currentFolders.length">
        <h2 class="text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-3">{{ $t('platform.foldersHeading') }}</h2>
        <div
          class="grid gap-2 sm:gap-3"
          style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));"
        >
          <button
            v-for="folderPath in currentFolders"
            :key="'folder:' + folderPath"
            class="relative text-left transition-transform select-none"
            :class="!selectMode ? 'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40' : selectedFolderPaths.has(folderPath) ? 'ring-2 ring-accent rounded-lg' : ''"
            @click="handleFolderClick(folderPath, $event)"
            @pointerdown="startPressFolder(folderPath, $event)"
            @pointerup="cancelPress"
            @pointerleave="cancelPress"
            @pointercancel="cancelPress"
            @contextmenu.prevent
          >
            <span
              v-if="selectMode"
              class="absolute top-1.5 left-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded border-2 border-white/60 bg-black/60"
              :class="selectedFolderPaths.has(folderPath) ? 'bg-accent border-accent' : ''"
            >
              <Check v-if="selectedFolderPaths.has(folderPath)" class="h-3 w-3 text-white" />
            </span>
            <FolderTile :name="folderLeaf(folderPath)" />
          </button>
        </div>
      </section>
      <section v-if="paged.length">
        <h2 class="text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-3">{{ $t('platform.gamesHeading') }}</h2>
        <div
          ref="gridRef"
          class="grid gap-3 sm:gap-4"
          style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));"
        >
          <button
            v-for="game in paged"
            :key="game.id"
            class="relative text-left transition-transform select-none"
            :class="!selectMode ? 'hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40' : selectedGameIds.has(game.id) ? 'ring-2 ring-accent rounded-sm' : ''"
            @click="handleGameClick(game.id, $event)"
            @pointerdown="startPressGame(game.id, $event)"
            @pointerup="cancelPress"
            @pointerleave="cancelPress"
            @pointercancel="cancelPress"
            @contextmenu.prevent
          >
            <span
              v-if="selectMode"
              class="absolute top-1.5 left-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded border-2 border-white/60 bg-black/60"
              :class="selectedGameIds.has(game.id) ? 'bg-accent border-accent' : ''"
            >
              <Check v-if="selectedGameIds.has(game.id)" class="h-3 w-3 text-white" />
            </span>
            <GameCover :tag="props.tag" :game="game" />
          </button>
        </div>
      </section>
    </template>
    <GameTable
      v-else
      :games="paged"
      :folders="currentFolders"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      :select-mode="selectMode"
      :selected-game-ids="selectedGameIds"
      :selected-folder-paths="selectedFolderPaths"
      @sort="setSort"
      @click-game="handleGameClick"
      @press-game="startPressGame"
      @click-folder="handleFolderClick"
      @press-folder="startPressFolder"
      @cancel-press="cancelPress"
    />

    <div v-if="!loading && !error && pageCount > 1" class="flex items-center justify-center gap-3 pt-1">
      <Button variant="outline" size="sm" :disabled="page <= 1" @click="page--">{{ $t('platform.prev') }}</Button>
      <span class="text-sm text-foreground/70">{{ $t('platform.pageOf', { page, total: pageCount }) }}</span>
      <Button variant="outline" size="sm" :disabled="page >= pageCount" @click="page++">{{ $t('platform.next') }}</Button>
    </div>

    <div
      v-if="dragOver"
      class="fixed inset-0 z-50 border-4 border-dashed border-accent bg-background/90 flex flex-col items-center justify-center gap-3 pointer-events-none"
    >
      <Upload class="h-12 w-12 text-accent" />
      <p class="text-xl font-semibold text-foreground">{{ $t('platform.dropRomsToUpload') }}</p>
    </div>
  </div>
</template>

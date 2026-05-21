<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getGames, uploadFiles, rescanPlatform, type GameRow } from '@/api/client'
import { platformName } from '@/api/platforms'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Progress from '@/components/ui/Progress.vue'
import GameCover from '@/components/game/GameCover.vue'
import GameTable from '@/components/game/GameTable.vue'
import { ArrowLeft, Cpu, Gamepad2, LayoutGrid, Layers, Table as TableIcon, Search, Upload } from 'lucide-vue-next'

const props = defineProps<{ tag: string }>()
const router = useRouter()

const games = ref<GameRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')

const viewMode = ref<'cards' | 'table'>(
  localStorage.getItem('cannoli_view_mode') === 'table' ? 'table' : 'cards',
)
watch(viewMode, v => localStorage.setItem('cannoli_view_mode', v))

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return games.value
  return games.value.filter(g => g.displayName.toLowerCase().includes(q))
})

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await getGames(props.tag)
    games.value = res.games
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load games'
  } finally {
    loading.value = false
  }
}

const fileInput = ref<HTMLInputElement>()
const dragOver = ref(false)
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
    await rescanPlatform(props.tag)
    await load()
  } catch {
    error.value = 'ROM upload failed'
  } finally {
    uploading.value = false
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
  router.push(`/platform/${encodeURIComponent(props.tag)}/game/${id}`)
}

function openBios() {
  router.push({ name: 'browse', params: { resource: 'bios', tag: props.tag } })
}

function openOverlays() {
  router.push({ name: 'browse', params: { resource: 'overlays', tag: props.tag } })
}

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
  <div class="mx-auto max-w-6xl p-6 space-y-6">
    <input ref="fileInput" type="file" multiple class="hidden" @change="handleFiles" />

    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" @click="router.push({ name: 'dashboard' })">
          <ArrowLeft class="h-5 w-5" />
        </Button>
        <h1 class="text-3xl font-bold tracking-tight">{{ platformName(props.tag) }}</h1>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          class="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2 cursor-pointer hover:border-accent/50 transition-colors disabled:opacity-50"
          :disabled="uploading"
          @click="fileInput?.click()"
        >
          <div class="flex items-center justify-center h-7 w-7 rounded-md bg-accent/15">
            <Gamepad2 class="h-4 w-4 text-accent" />
          </div>
          <div class="font-semibold text-sm text-foreground">ROMs</div>
        </button>
        <button
          class="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2 cursor-pointer hover:border-accent/50 transition-colors"
          @click="openBios"
        >
          <div class="flex items-center justify-center h-7 w-7 rounded-md bg-accent/15">
            <Cpu class="h-4 w-4 text-accent" />
          </div>
          <div class="font-semibold text-sm text-foreground">BIOS</div>
        </button>
        <button
          class="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2 cursor-pointer hover:border-accent/50 transition-colors"
          @click="openOverlays"
        >
          <div class="flex items-center justify-center h-7 w-7 rounded-md bg-accent/15">
            <Layers class="h-4 w-4 text-accent" />
          </div>
          <div class="font-semibold text-sm text-foreground">Overlays</div>
        </button>
      </div>
    </div>

    <div v-if="uploading" class="rounded-lg border border-border bg-card p-3 space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-foreground font-medium truncate">
          {{ uploadName }}<span v-if="uploadTotal > 1" class="text-foreground/60 font-normal"> ({{ uploadCurrent }} of {{ uploadTotal }})</span>
        </span>
        <span class="font-mono text-foreground/60 ml-2 shrink-0">{{ uploadProgress }}%</span>
      </div>
      <Progress :value="uploadProgress" class="!h-2.5" />
    </div>

    <div class="flex items-center justify-between gap-3">
      <h2 class="text-base font-semibold text-foreground/85">Games ({{ filtered.length }})</h2>
      <div class="flex items-center gap-2">
        <div class="flex rounded-lg border border-border overflow-hidden">
          <button
            class="p-2 transition-colors"
            :class="viewMode === 'cards' ? 'bg-accent/10 text-accent' : 'text-foreground/70 hover:text-foreground'"
            :aria-pressed="viewMode === 'cards'"
            title="Card view"
            @click="viewMode = 'cards'"
          >
            <LayoutGrid class="h-4 w-4" />
          </button>
          <button
            class="p-2 transition-colors border-l border-border"
            :class="viewMode === 'table' ? 'bg-accent/10 text-accent' : 'text-foreground/70 hover:text-foreground'"
            :aria-pressed="viewMode === 'table'"
            title="Table view"
            @click="viewMode = 'table'"
          >
            <TableIcon class="h-4 w-4" />
          </button>
        </div>
        <div class="relative w-64">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/70 pointer-events-none" />
          <Input v-model="search" placeholder="Search games..." class="!pl-9 !h-10 !text-base !rounded-lg" />
        </div>
      </div>
    </div>

    <p v-if="loading" class="text-base text-foreground/75 py-8 text-center">Loading games...</p>
    <div v-else-if="error" class="text-base py-8 text-center space-y-2">
      <p class="text-destructive">{{ error }}</p>
      <Button variant="outline" size="sm" @click="load">Retry</Button>
    </div>
    <p v-else-if="!filtered.length" class="text-base text-foreground/75 py-8 text-center">
      {{ search ? `No games match "${search}".` : 'No games yet.' }}
    </p>
    <div
      v-else-if="viewMode === 'cards'"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
    >
      <button
        v-for="game in filtered"
        :key="game.id"
        class="text-left transition-transform hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40 rounded-lg"
        @click="openGame(game.id)"
      >
        <GameCover :tag="props.tag" :game="game" />
      </button>
    </div>
    <GameTable v-else :games="filtered" @open="openGame" />

    <div
      v-if="dragOver"
      class="fixed inset-0 z-50 border-4 border-dashed border-accent bg-background/90 flex flex-col items-center justify-center gap-3 pointer-events-none"
    >
      <Upload class="h-12 w-12 text-accent" />
      <p class="text-xl font-semibold text-foreground">Drop ROM files to upload</p>
    </div>
  </div>
</template>

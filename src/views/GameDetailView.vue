<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { gameArtBlob, uploadGameArt, deleteGameArt, getGame, type GameDetail } from '@/api/client'
import { platformLabel } from '@/api/platforms'
import { coverColor, coverColorDark } from '@/lib/coverColor'
import Button from '@/components/ui/Button.vue'
import { ArrowLeft, ImagePlus, Upload, Trash2 } from 'lucide-vue-next'
import RomTab from '@/components/game/RomTab.vue'
import SavesTab from '@/components/game/SavesTab.vue'
import StatesTab from '@/components/game/StatesTab.vue'
import GuidesTab from '@/components/game/GuidesTab.vue'

type TabKey = 'rom' | 'saves' | 'states' | 'guides'
const TAB_KEYS: readonly TabKey[] = ['rom', 'saves', 'states', 'guides']

const props = defineProps<{ tag: string; id: string; tab?: string }>()
const romId = computed(() => Number(props.id))
const router = useRouter()

const game = ref<GameDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const artSrc = ref<string | null>(null)
const artBusy = ref(false)

const activeTab = computed<TabKey>(() =>
  TAB_KEYS.includes(props.tab as TabKey) ? (props.tab as TabKey) : 'rom',
)

function selectTab(tab: TabKey) {
  router.replace(`/platform/${encodeURIComponent(props.tag)}/game/${props.id}/${tab}`)
}

const heroStyle = computed(() => {
  const name = game.value?.displayName ?? ''
  return { background: `linear-gradient(150deg, ${coverColor(name)}, ${coverColorDark(name)})` }
})

const lastPlayed = computed(() => {
  const ms = game.value?.lastPlayedAt
  if (!ms) return 'Never played'
  const diff = Date.now() - ms
  const day = 86400000
  if (diff < day) return 'Last played today'
  if (diff < 2 * day) return 'Last played yesterday'
  const days = Math.floor(diff / day)
  if (days < 30) return `Last played ${days}d ago`
  return `Last played ${new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
})

const tabs = computed(() => {
  const g = game.value
  return [
    { key: 'rom' as TabKey, label: 'ROM', count: null as number | null },
    { key: 'saves' as TabKey, label: 'Saves', count: g?.savesCount ?? 0 },
    { key: 'states' as TabKey, label: 'Save States', count: g?.statesCount ?? 0 },
    { key: 'guides' as TabKey, label: 'Guides', count: g?.guidesCount ?? 0 },
  ]
})

function setArt(url: string | null) {
  if (artSrc.value) URL.revokeObjectURL(artSrc.value)
  artSrc.value = url
}

async function loadArt() {
  if (!game.value?.hasArt) {
    setArt(null)
    return
  }
  try {
    setArt(await gameArtBlob(props.tag, romId.value))
  } catch {
    setArt(null)
  }
}

async function loadGame() {
  loading.value = true
  error.value = null
  try {
    game.value = await getGame(props.tag, romId.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load game'
  } finally {
    loading.value = false
  }
  await loadArt()
}

function pickImage(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

async function onUploadArt() {
  const file = await pickImage()
  if (!file) return
  artBusy.value = true
  try {
    await uploadGameArt(props.tag, romId.value, file)
    setArt(await gameArtBlob(props.tag, romId.value))
  } catch {
    error.value = 'Box art upload failed'
  } finally {
    artBusy.value = false
  }
}

async function onDeleteArt() {
  if (!confirm('Delete box art?')) return
  artBusy.value = true
  try {
    await deleteGameArt(props.tag, romId.value)
    setArt(null)
  } catch {
    error.value = 'Box art delete failed'
  } finally {
    artBusy.value = false
  }
}

onMounted(loadGame)
onBeforeUnmount(() => {
  if (artSrc.value) URL.revokeObjectURL(artSrc.value)
})
</script>

<template>
  <div class="mx-auto max-w-6xl p-6">
    <p v-if="loading" class="text-base text-foreground/75 py-8 text-center">Loading...</p>
    <div v-else-if="error" class="text-base py-8 text-center space-y-2">
      <p class="text-destructive">{{ error }}</p>
      <Button variant="outline" size="sm" @click="loadGame">Retry</Button>
    </div>
    <template v-else-if="game">
      <button
        class="flex items-center gap-1.5 -ml-1 mb-4 text-foreground/70 hover:text-foreground transition-colors"
        @click="router.push({ name: 'platform', params: { tag: props.tag } })"
      >
        <ArrowLeft class="h-5 w-5" />
        <span class="text-base font-medium">{{ platformLabel(props.tag) }}</span>
      </button>

      <div class="relative rounded-xl overflow-hidden" :style="artSrc ? undefined : heroStyle">
        <template v-if="artSrc">
          <img
            :src="artSrc"
            aria-hidden="true"
            class="absolute inset-0 h-full w-full object-cover"
            style="filter: blur(28px) brightness(0.5); transform: scale(1.25)"
          />
          <div class="absolute inset-0 bg-black/40"></div>
        </template>
        <div class="relative p-5">
          <div class="flex items-end gap-5">
            <div v-if="artSrc" class="relative group shrink-0">
              <img
                :src="artSrc"
                :alt="game.displayName"
                class="h-40 w-auto rounded-lg shadow-xl shadow-black/40"
              />
              <div
                class="absolute inset-0 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2"
              >
                <button
                  class="flex items-center gap-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  :disabled="artBusy"
                  @click="onUploadArt"
                >
                  <Upload class="h-4 w-4" /> Replace
                </button>
                <button
                  class="flex items-center gap-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  :disabled="artBusy"
                  @click="onDeleteArt"
                >
                  <Trash2 class="h-4 w-4" /> Delete
                </button>
              </div>
            </div>
            <button
              v-else
              class="shrink-0 h-40 w-32 rounded-lg border-2 border-dashed border-white/30 text-white/70 hover:border-white/60 hover:text-white transition-colors flex flex-col items-center justify-center gap-1.5 disabled:opacity-50"
              :disabled="artBusy"
              @click="onUploadArt"
            >
              <ImagePlus class="h-7 w-7" />
              <span class="text-xs font-semibold">Add box art</span>
            </button>
            <div class="min-w-0 pb-1">
              <h1 class="text-3xl font-extrabold tracking-tight text-white break-words">{{ game.displayName }}</h1>
              <div class="text-sm text-white/75 mt-1.5">{{ lastPlayed }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="sm:hidden mt-6">
        <select
          :value="activeTab"
          class="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-medium"
          @change="selectTab(($event.target as HTMLSelectElement).value as TabKey)"
        >
          <option v-for="t in tabs" :key="t.key" :value="t.key">
            {{ t.label }}{{ t.count !== null ? ` (${t.count})` : '' }}
          </option>
        </select>
      </div>

      <div class="hidden sm:flex items-center gap-1 border-b border-border overflow-x-auto mt-6">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="px-4 py-2.5 text-base font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap"
          :class="activeTab === t.key ? 'border-accent text-accent' : 'border-transparent text-foreground/75 hover:text-foreground'"
          @click="selectTab(t.key)"
        >
          {{ t.label }}<span v-if="t.count !== null"> ({{ t.count }})</span>
        </button>
      </div>

      <div class="mt-6">
        <keep-alive>
          <RomTab v-if="activeTab === 'rom'" :tag="tag" :id="romId" />
          <SavesTab v-else-if="activeTab === 'saves'" :tag="tag" :id="romId" />
          <StatesTab v-else-if="activeTab === 'states'" :tag="tag" :id="romId" :rom-name="game.rom" />
          <GuidesTab v-else-if="activeTab === 'guides'" :tag="tag" :id="romId" />
        </keep-alive>
      </div>
    </template>
  </div>
</template>

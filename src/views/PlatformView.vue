<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getGames, type GameRow } from '@/api/client'
import { platformLabel } from '@/api/platforms'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import GameCover from '@/components/game/GameCover.vue'
import GameTable from '@/components/game/GameTable.vue'
import { ArrowLeft, Cpu, LayoutGrid, Layers, Table as TableIcon, Search } from 'lucide-vue-next'

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

function openGame(id: number) {
  router.push(`/platform/${encodeURIComponent(props.tag)}/game/${id}`)
}

function openBios() {
  router.push({ name: 'browse', params: { resource: 'bios', tag: props.tag } })
}

function openOverlays() {
  router.push({ name: 'browse', params: { resource: 'overlays', tag: props.tag } })
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-6xl p-6 space-y-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="router.push({ name: 'dashboard' })">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <h1 class="text-3xl font-bold tracking-tight">{{ platformLabel(props.tag) }}</h1>
      <div class="ml-auto flex gap-3">
        <button
          class="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-accent/50 transition-colors"
          @click="openBios"
        >
          <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-accent/15">
            <Cpu class="h-5 w-5 text-accent" />
          </div>
          <div class="font-bold text-base text-foreground">BIOS</div>
        </button>
        <button
          class="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-accent/50 transition-colors"
          @click="openOverlays"
        >
          <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-accent/15">
            <Layers class="h-5 w-5 text-accent" />
          </div>
          <div class="font-bold text-base text-foreground">Overlays</div>
        </button>
      </div>
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
  </div>
</template>

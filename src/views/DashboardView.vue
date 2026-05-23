<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getTags, clearCredentials } from '@/api/client'
import { platformName, platformLabel, platformIcon, groupPlatforms, type PlatformGroup } from '@/api/platforms'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { Wallpaper, LogOut, Search, Gamepad2, ArrowDownAZ, CalendarDays, Palette, Layers } from 'lucide-vue-next'

const props = defineProps<{ tab?: string }>()
const router = useRouter()
const tags = ref<string[]>([])
const loading = ref(true)
const search = ref('')
const sortMode = ref<'era' | 'alpha'>(
  localStorage.getItem('cannoli_sort_mode') === 'alpha' ? 'alpha' : 'era',
)
watch(sortMode, v => localStorage.setItem('cannoli_sort_mode', v))
const activeTab = computed<'content' | 'customization'>(() =>
  props.tab === 'customization' ? 'customization' : 'content',
)

function selectTab(tab: 'content' | 'customization') {
  router.replace(`/dashboard/${tab === 'content' ? 'games' : 'customization'}`)
}

const filteredTags = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return tags.value
  return tags.value.filter(tag =>
    tag.toLowerCase().includes(q) || platformLabel(tag).toLowerCase().includes(q),
  )
})

const groups = computed<PlatformGroup[]>(() => groupPlatforms(filteredTags.value, false))

const alphabeticalGroups = computed<PlatformGroup[]>(() => groupPlatforms(filteredTags.value, true))

onMounted(async () => {
  try {
    tags.value = await getTags()
  } finally {
    loading.value = false
  }
})

function openPlatform(tag: string) {
  router.push({ name: 'platform', params: { tag } })
}

function browseFlat(resource: string) {
  router.push({ name: 'browse-flat', params: { resource } })
}

function disconnect() {
  clearCredentials()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="mx-auto max-w-7xl p-6 pb-0 space-y-8 min-h-screen flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <img src="/logo.png" alt="Cannoli" class="h-9 w-auto" />
        <h1 class="text-2xl font-bold tracking-tight">Nonna's Kitchen</h1>
      </div>
      <Button variant="ghost" size="sm" @click="disconnect">
        <LogOut class="h-4 w-4" />
        Disconnect
      </Button>
    </div>

    <!-- Nav tabs -->
    <div class="flex items-center gap-1 border-b border-border">
      <button
        class="px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px"
        :class="activeTab === 'content' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="selectTab('content')"
      >
        Games
      </button>
      <button
        class="px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px"
        :class="activeTab === 'customization' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="selectTab('customization')"
      >
        Customization
      </button>
    </div>

    <!-- Content tab -->
    <template v-if="activeTab === 'content'">
      <div class="space-y-6 flex-1">
        <div class="flex items-center justify-between">
          <div class="relative w-60">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input v-model="search" placeholder="Search platforms..." class="!pl-9 !h-9 !rounded-lg" />
          </div>
          <div class="flex items-center gap-2">
            <button
              class="p-2 rounded-lg transition-colors"
              :class="sortMode === 'era' ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
              title="Sort by era"
              @click="sortMode = 'era'"
            >
              <CalendarDays class="h-4 w-4" />
            </button>
            <button
              class="p-2 rounded-lg transition-colors"
              :class="sortMode === 'alpha' ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
              title="Sort alphabetically"
              @click="sortMode = 'alpha'"
            >
              <ArrowDownAZ class="h-4 w-4" />
            </button>
          </div>
        </div>

        <p v-if="loading" class="text-sm text-muted-foreground py-8 text-center">Loading platforms...</p>
        <p v-else-if="!tags.length" class="text-sm text-muted-foreground py-8 text-center">
          No platforms found. Add ROMs to get started.
        </p>
        <p v-else-if="!filteredTags.length" class="text-sm text-muted-foreground py-8 text-center">
          No platforms match "{{ search }}".
        </p>

        <!-- Grouped by era -->
        <div v-else-if="sortMode === 'era'" class="space-y-6">
          <div v-for="group in groups" :key="group.name">
            <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{{ group.name }}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div
                v-for="tag in group.tags"
                :key="tag"
                class="group cursor-pointer rounded-xl border border-border bg-card px-5 py-5 flex items-center gap-4 hover:border-accent/50 hover:shadow-md hover:shadow-accent/5"
                @click="openPlatform(tag)"
              >
                <img
                  v-if="platformIcon(tag)"
                  :src="platformIcon(tag)"
                  :alt="tag"
                  class="h-12 w-12 shrink-0 object-contain"
                />
                <Gamepad2 v-else class="h-12 w-12 shrink-0 text-muted-foreground" />
                <span class="font-semibold group-hover:text-accent">{{ platformName(tag) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Alphabetical within groups -->
        <div v-else class="space-y-6">
          <div v-for="group in alphabeticalGroups" :key="group.name">
            <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{{ group.name }}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div
                v-for="tag in group.tags"
                :key="tag"
                class="group cursor-pointer rounded-xl border border-border bg-card px-5 py-5 flex items-center gap-4 hover:border-accent/50 hover:shadow-md hover:shadow-accent/5"
                @click="openPlatform(tag)"
              >
                <img
                  v-if="platformIcon(tag)"
                  :src="platformIcon(tag)"
                  :alt="tag"
                  class="h-12 w-12 shrink-0 object-contain"
                />
                <Gamepad2 v-else class="h-12 w-12 shrink-0 text-muted-foreground" />
                <span class="font-semibold group-hover:text-accent">{{ platformName(tag) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Customization tab -->
    <template v-if="activeTab === 'customization'">
      <div class="space-y-4 flex-1">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card
            class="cursor-pointer hover:border-accent/50 hover:shadow-md hover:shadow-accent/5 !p-5"
            @click="browseFlat('wallpapers')"
          >
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-muted">
                <Wallpaper class="h-5 w-5 text-accent" />
              </div>
              <span class="font-semibold">Wallpapers</span>
            </div>
          </Card>
          <Card
            class="cursor-pointer hover:border-accent/50 hover:shadow-md hover:shadow-accent/5 !p-5"
            @click="browseFlat('shaders')"
          >
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-muted">
                <Palette class="h-5 w-5 text-accent" />
              </div>
              <span class="font-semibold">Shaders</span>
            </div>
          </Card>
          <Card
            class="cursor-pointer hover:border-accent/50 hover:shadow-md hover:shadow-accent/5 !p-5"
            @click="browseFlat('overlays')"
          >
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-muted">
                <Layers class="h-5 w-5 text-accent" />
              </div>
              <span class="font-semibold">Overlays</span>
            </div>
          </Card>
        </div>
      </div>
    </template>

    <!-- Footer -->
    <footer class="pt-8 pb-6 text-center text-xs text-muted-foreground/60 border-t border-border/50">
      Platform icons courtesy of <a href="https://git.libretro.com/libretro-assets/retroarch-assets" class="underline hover:text-muted-foreground" target="_blank" rel="noopener">Libretro</a> (CC BY 4.0).<br />
      All trademarks are property of their respective owners.
    </footer>
  </div>
</template>

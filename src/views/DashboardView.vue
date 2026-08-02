<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getTags, getApps } from '@/api/client'
import { platformName, platformIcon, isAppTag, groupPlatforms, type PlatformGroup } from '@/api/platforms'
import Input from '@/components/ui/Input.vue'
import { Wallpaper, Search, Gamepad2, ArrowDownAZ, CalendarDays, Layers, StarsIcon } from 'lucide-vue-next'
import ToolsTab from '@/components/tools/ToolsTab.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useLauncherSettings } from '@/composables/useLauncherSettings'

const props = defineProps<{ tab?: string }>()
const router = useRouter()
const tags = ref<string[]>([])
const appTags = ref<string[]>([])
const loading = ref(true)
const search = ref('')
const sortMode = ref<'era' | 'alpha'>(
  localStorage.getItem('cannoli_sort_mode') === 'alpha' ? 'alpha' : 'era',
)
watch(sortMode, v => localStorage.setItem('cannoli_sort_mode', v))
const { settings: launcherSettings, load: loadLauncherSettings } = useLauncherSettings()
const activeTab = computed<'content' | 'customization' | 'tools'>(() => {
  if (props.tab === 'customization') return 'customization'
  if (props.tab === 'tools') return 'tools'
  return 'content'
})

function selectTab(tab: 'content' | 'customization' | 'tools') {
  router.replace('/dashboard/' + (tab === 'content' ? 'games' : tab))
}

// Normalize unknown tab segments (e.g. /dashboard/banana) to the canonical URL
const VALID_TABS = ['games', 'customization', 'tools']
watch(() => props.tab, t => {
  if (t && !VALID_TABS.includes(t)) router.replace('/dashboard/games')
}, { immediate: true })

/** Tools and Ports carry the row names the user chose in the launcher, so they cannot come from PLATFORM_NAMES. */
function displayNameFor(tag: string): string {
  if (tag === 'TOOLS') return launcherSettings.value.toolsName
  if (tag === 'PORTS') return launcherSettings.value.portsName
  return platformName(tag)
}

const allTags = computed(() => [...tags.value, ...appTags.value])

const filteredTags = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return allTags.value
  return allTags.value.filter(tag =>
    tag.toLowerCase().includes(q) || displayNameFor(tag).toLowerCase().includes(q),
  )
})

const groups = computed<PlatformGroup[]>(() => groupPlatforms(filteredTags.value, false))

const alphabeticalGroups = computed<PlatformGroup[]>(() => groupPlatforms(filteredTags.value, true))

onMounted(async () => {
  loadLauncherSettings()
  try {
    const [tagList, apps] = await Promise.all([getTags(), getApps()])
    tags.value = tagList
    appTags.value = [
      ...(apps.tools.length ? ['TOOLS'] : []),
      ...(apps.ports.length ? ['PORTS'] : []),
    ]
  } finally {
    loading.value = false
  }
})

function openPlatform(tag: string) {
  if (isAppTag(tag)) {
    browseArt(tag)
    return
  }
  router.push({ name: 'platform', params: { tag } })
}

function browseFlat(resource: string) {
  router.push({ name: 'browse-flat', params: { resource } })
}

function browseArt(tag: string) {
  router.push({ name: 'browse', params: { resource: 'art', tag } })
}
</script>

<template>
  <div class="mx-auto max-w-[1600px] p-6 pb-0 space-y-6 min-h-screen flex flex-col">
    <!-- Header -->
    <AppHeader />

    <!-- Nav tabs -->
    <div class="sm:hidden">
      <select
        :value="activeTab"
        class="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-medium"
        @change="selectTab(($event.target as HTMLSelectElement).value as 'content' | 'customization' | 'tools')"
      >
        <option value="content">{{ $t('dashboard.tabPlatforms') }}</option>
        <option value="customization">{{ $t('dashboard.tabCustomization') }}</option>
        <option value="tools">{{ $t('dashboard.tabTools') }}</option>
      </select>
    </div>

    <div class="hidden sm:flex items-center gap-1 border-b border-border">
      <button
        class="pl-0 pr-4 py-1.5 text-lg transition-colors border-b-2 -mb-px"
        :class="activeTab === 'content' ? 'border-accent text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'"
        :aria-current="activeTab === 'content' ? 'page' : undefined"
        @click="selectTab('content')"
      >
        {{ $t('dashboard.tabPlatforms') }}
      </button>
      <button
        class="px-4 py-1.5 text-lg transition-colors border-b-2 -mb-px"
        :class="activeTab === 'customization' ? 'border-accent text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'"
        :aria-current="activeTab === 'customization' ? 'page' : undefined"
        @click="selectTab('customization')"
      >
        {{ $t('dashboard.tabCustomization') }}
      </button>
      <button
        class="px-4 py-1.5 text-lg transition-colors border-b-2 -mb-px"
        :class="activeTab === 'tools' ? 'border-accent text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'"
        :aria-current="activeTab === 'tools' ? 'page' : undefined"
        @click="selectTab('tools')"
      >
        {{ $t('dashboard.tabTools') }}
      </button>
    </div>

    <!-- Content tab -->
    <template v-if="activeTab === 'content'">
      <div class="space-y-6 flex-1">
        <div class="flex items-center justify-between">
          <div class="relative w-60">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input v-model="search" :placeholder="$t('dashboard.searchPlaceholder')" class="!pl-9 !h-9 !rounded-lg" />
          </div>
          <div class="flex items-center gap-2">
            <button
              class="p-2 rounded-lg transition-colors"
              :class="sortMode === 'era' ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
              :title="$t('dashboard.sortByEra')"
              @click="sortMode = 'era'"
            >
              <CalendarDays class="h-4 w-4" />
            </button>
            <button
              class="p-2 rounded-lg transition-colors"
              :class="sortMode === 'alpha' ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
              :title="$t('dashboard.sortAlphabetically')"
              @click="sortMode = 'alpha'"
            >
              <ArrowDownAZ class="h-4 w-4" />
            </button>
          </div>
        </div>

        <p v-if="loading" class="text-sm text-muted-foreground py-8 text-center">{{ $t('dashboard.loadingPlatforms') }}</p>
        <p v-else-if="!tags.length" class="text-sm text-muted-foreground py-8 text-center">
          {{ $t('dashboard.noPlatforms') }}
        </p>
        <p v-else-if="!filteredTags.length" class="text-sm text-muted-foreground py-8 text-center">
          {{ $t('dashboard.noMatch', { query: search }) }}
        </p>

        <!-- Grouped by era -->
        <div v-else-if="sortMode === 'era'" class="space-y-6">
          <div v-for="group in groups" :key="group.name">
            <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{{ group.name }}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                v-for="tag in group.tags"
                :key="tag"
                type="button"
                class="group text-left cursor-pointer rounded-xl border border-border bg-card px-5 py-5 flex items-center gap-4 hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background hover:shadow-md hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                @click="openPlatform(tag)"
              >
                <img
                  v-if="platformIcon(tag)"
                  :src="platformIcon(tag)"
                  :alt="tag"
                  class="h-12 w-12 shrink-0 object-contain"
                />
                <Gamepad2 v-else class="h-12 w-12 shrink-0 text-muted-foreground" />
                <span class="font-semibold">{{ displayNameFor(tag) }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Alphabetical within groups -->
        <div v-else class="space-y-6">
          <div v-for="group in alphabeticalGroups" :key="group.name">
            <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{{ group.name }}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                v-for="tag in group.tags"
                :key="tag"
                type="button"
                class="group text-left cursor-pointer rounded-xl border border-border bg-card px-5 py-5 flex items-center gap-4 hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background hover:shadow-md hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                @click="openPlatform(tag)"
              >
                <img
                  v-if="platformIcon(tag)"
                  :src="platformIcon(tag)"
                  :alt="tag"
                  class="h-12 w-12 shrink-0 object-contain"
                />
                <Gamepad2 v-else class="h-12 w-12 shrink-0 text-muted-foreground" />
                <span class="font-semibold">{{ displayNameFor(tag) }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Tools tab -->
    <template v-if="activeTab === 'tools'">
      <ToolsTab class="flex-1" />
    </template>

    <!-- Customization tab -->
    <template v-if="activeTab === 'customization'">
      <div class="space-y-4 flex-1">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <button
              type="button"
              class="text-left rounded-xl border border-border bg-card p-5 transition-all duration-150 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background hover:shadow-md hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              @click="browseFlat('overlays')"
          >
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-muted">
                <Layers class="h-5 w-5 text-accent" />
              </div>
              <span class="font-semibold">{{ $t('dashboard.overlays') }}</span>
            </div>
          </button>
          <button
              type="button"
              class="text-left rounded-xl border border-border bg-card p-5 transition-all duration-150 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background hover:shadow-md hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              @click="browseFlat('shaders')"
          >
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-muted">
                <StarsIcon class="h-5 w-5 text-accent" />
              </div>
              <span class="font-semibold">{{ $t('dashboard.shaders') }}</span>
            </div>
          </button>
          <button
            type="button"
            class="text-left rounded-xl border border-border bg-card p-5 transition-all duration-150 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background hover:shadow-md hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            @click="browseFlat('wallpapers')"
          >
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-muted">
                <Wallpaper class="h-5 w-5 text-accent" />
              </div>
              <span class="font-semibold">{{ $t('dashboard.wallpapers') }}</span>
            </div>
          </button>
        </div>
      </div>
    </template>

    <!-- Footer -->
    <footer class="pt-8 pb-6 text-center text-xs text-muted-foreground/60 border-t border-border/50">
      <span>{{ $t('dashboard.footerIconsPrefix') }} </span><a href="https://git.libretro.com/libretro-assets/retroarch-assets" class="underline hover:text-muted-foreground" target="_blank" rel="noopener">Libretro</a><span> {{ $t('dashboard.footerIconsSuffix') }}</span><br />
      <span>{{ $t('dashboard.footerPico8Prefix') }} </span><a href="https://www.lexaloffle.com/pico-8.php" class="underline hover:text-muted-foreground" target="_blank" rel="noopener">Lexaloffle</a><span>{{ $t('dashboard.footerPico8Suffix') }}</span><br />
      {{ $t('dashboard.footerTrademarks') }}
    </footer>
  </div>
</template>

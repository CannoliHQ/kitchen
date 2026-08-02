<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { uploadFiles } from '@/api/client'
import { platformName, supportsFbneoSamples, isAppTag, isGamesOnlyTag } from '@/api/platforms'
import { useLauncherSettings } from '@/composables/useLauncherSettings'
import AppsTab from '@/components/platform/AppsTab.vue'
import Dropdown from '@/components/ui/Dropdown.vue'
import type { DropdownItem } from '@/components/ui/Dropdown.vue'
import Progress from '@/components/ui/Progress.vue'
import GamesTab from '@/components/platform/GamesTab.vue'
import ResourceTab from '@/components/platform/ResourceTab.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import Breadcrumbs, { type Crumb } from '@/components/layout/Breadcrumbs.vue'
import { Cpu, FolderPlus, Gamepad2, Image, Layers, Music, Upload } from 'lucide-vue-next'

type TabKey = 'games' | 'overlays' | 'bios' | 'samples' | 'apps'
const TAB_KEYS: readonly TabKey[] = ['games', 'overlays', 'bios', 'samples', 'apps']
const SAMPLES_SUBPATH = ['fbneo', 'samples']

const props = defineProps<{ tag: string; tab?: string; folder?: string }>()
const router = useRouter()
const { t } = useI18n()

const isApps = computed(() => isAppTag(props.tag))
const { settings: launcherSettings, load: loadLauncherSettings } = useLauncherSettings()
loadLauncherSettings()

/** Tools and Ports show the row name the user chose in the launcher, not a PLATFORM_NAMES entry. */
const displayName = computed(() => {
  if (props.tag === 'TOOLS') return launcherSettings.value.toolsName
  if (props.tag === 'PORTS') return launcherSettings.value.portsName
  return platformName(props.tag)
})

const isGamesOnly = computed(() => isGamesOnlyTag(props.tag))
const showTabs = computed(() => !isGamesOnly.value)

const activeTab = computed<TabKey>(() => {
  if (isApps.value) return 'apps'
  if (isGamesOnly.value) return 'games'
  const t = TAB_KEYS.includes(props.tab as TabKey) ? (props.tab as TabKey) : 'games'
  return t === 'samples' && !supportsFbneoSamples(props.tag) ? 'games' : t
})

const crumbs = computed<Crumb[]>(() => {
  const items: Crumb[] = [{ label: t('platform.crumbPlatforms'), to: { name: 'dashboard' } }]
  const folder = props.folder
  if (folder) {
    items.push({ label: displayName.value, to: { name: 'platform', params: { tag: props.tag } } })
    const parts = folder.split('/').filter(Boolean)
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/')
      items.push({
        label: part,
        to: i < parts.length - 1 ? { name: 'platform-folder', params: { tag: props.tag, folder: path } } : undefined,
      })
    })
  } else {
    items.push({ label: displayName.value })
  }
  return items
})

const tabs = computed(() => {
  if (isApps.value) return [{ key: 'apps' as TabKey, label: displayName.value }]
  const list: { key: TabKey; label: string }[] = [
    { key: 'games', label: t('platform.tabGames') },
    { key: 'overlays', label: t('platform.tabOverlays') },
    { key: 'bios', label: t('platform.tabBios') },
  ]
  if (supportsFbneoSamples(props.tag)) list.push({ key: 'samples', label: t('platform.tabSamples') })
  return list
})

function selectTab(tab: TabKey) {
  if (isApps.value || isGamesOnly.value) return
  if (tab === 'games') {
    router.replace({ name: 'platform', params: { tag: props.tag } })
  } else if (tab === 'overlays') {
    router.replace({ name: 'platform-overlays', params: { tag: props.tag } })
  } else if (tab === 'samples') {
    router.replace({ name: 'platform-samples', params: { tag: props.tag } })
  } else {
    router.replace({ name: 'platform-bios', params: { tag: props.tag } })
  }
}

const gamesTabRef = ref<InstanceType<typeof GamesTab> | null>(null)
const overlaysTabRef = ref<InstanceType<typeof ResourceTab> | null>(null)
const biosTabRef = ref<InstanceType<typeof ResourceTab> | null>(null)
const samplesTabRef = ref<InstanceType<typeof ResourceTab> | null>(null)

const bulkArtInput = ref<HTMLInputElement>()
const bulkArtUploading = ref(false)
const bulkArtProgress = ref(0)
const bulkArtName = ref('')
const bulkArtCurrent = ref(0)
const bulkArtTotal = ref(0)
const bulkArtError = ref<string | null>(null)

async function doBulkArtUpload(files: File[]) {
  if (!files.length || bulkArtUploading.value) return
  bulkArtUploading.value = true
  bulkArtError.value = null
  bulkArtTotal.value = files.length
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      bulkArtCurrent.value = i + 1
      bulkArtName.value = file.name
      bulkArtProgress.value = 0
      const { promise } = uploadFiles('art', [props.tag], [file], pct => { bulkArtProgress.value = pct })
      await promise
    }
  } catch {
    bulkArtError.value = t('platform.bulkArtUploadFailed')
  } finally {
    bulkArtUploading.value = false
  }
}

function handleBulkArtFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  doBulkArtUpload(files)
}

const actionItems = computed<DropdownItem[]>(() => {
  if (activeTab.value === 'apps') {
    return [
      { label: t('platform.bulkArtUpload'), icon: Image, onSelect: () => bulkArtInput.value?.click() },
    ]
  }
  if (activeTab.value === 'games') {
    return [
      { label: t('platform.newFolder'), icon: FolderPlus, onSelect: () => gamesTabRef.value?.triggerNewFolder() },
      { label: t('platform.uploadRoms'), icon: Gamepad2, onSelect: () => gamesTabRef.value?.triggerRomUpload() },
      { label: t('platform.bulkArtUpload'), icon: Image, onSelect: () => bulkArtInput.value?.click() },
    ]
  }
  if (activeTab.value === 'overlays') {
    return [
      { label: t('platform.uploadOverlay'), icon: Layers, onSelect: () => overlaysTabRef.value?.triggerUpload() },
    ]
  }
  if (activeTab.value === 'samples') {
    return [
      { label: t('platform.uploadSample'), icon: Music, onSelect: () => samplesTabRef.value?.triggerUpload() },
    ]
  }
  return [
    { label: t('platform.uploadBios'), icon: Cpu, onSelect: () => biosTabRef.value?.triggerUpload() },
  ]
})
</script>

<template>
  <div class="mx-auto max-w-[1600px] p-6 space-y-6">
    <input ref="bulkArtInput" type="file" accept="image/*" multiple class="hidden" @change="handleBulkArtFiles" />

    <AppHeader />

    <div class="flex flex-wrap items-center gap-3">
      <Breadcrumbs :items="crumbs" />
      <div class="sm:ml-auto">
        <Dropdown :items="actionItems" />
      </div>
    </div>

    <div v-if="bulkArtUploading" class="rounded-lg border border-border bg-card p-3 space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-foreground font-medium truncate">
          <Upload class="inline h-3.5 w-3.5 mr-1 -mt-0.5" />{{ bulkArtName }}<span v-if="bulkArtTotal > 1" class="text-foreground/60 font-normal"> {{ $t('platform.uploadCount', { current: bulkArtCurrent, total: bulkArtTotal }) }}</span>
        </span>
        <span class="font-mono text-foreground/60 ml-2 shrink-0">{{ bulkArtProgress }}%</span>
      </div>
      <Progress :value="bulkArtProgress" />
    </div>
    <p v-if="bulkArtError" class="text-sm text-destructive">{{ bulkArtError }}</p>

    <div v-if="showTabs" class="sm:hidden">
      <select
        :value="activeTab"
        class="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-medium"
        @change="selectTab(($event.target as HTMLSelectElement).value as TabKey)"
      >
        <option v-for="t in tabs" :key="t.key" :value="t.key">{{ t.label }}</option>
      </select>
    </div>

    <div v-if="showTabs" class="hidden sm:flex items-center gap-1 border-b border-border">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="first:pl-0 px-4 py-1.5 text-lg transition-colors border-b-2 -mb-px whitespace-nowrap"
        :class="activeTab === t.key ? 'border-accent text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'"
        :aria-current="activeTab === t.key ? 'page' : undefined"
        @click="selectTab(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <div>
      <AppsTab
        v-if="activeTab === 'apps'"
        :tag="props.tag"
      />
      <GamesTab
        v-else-if="activeTab === 'games'"
        ref="gamesTabRef"
        :tag="props.tag"
        :folder="props.folder ?? ''"
      />
      <ResourceTab
        v-else-if="activeTab === 'overlays'"
        key="overlays"
        ref="overlaysTabRef"
        :tag="props.tag"
        resource="overlays"
        display="images"
      />
      <ResourceTab
        v-else-if="activeTab === 'samples'"
        key="samples"
        ref="samplesTabRef"
        :tag="props.tag"
        resource="bios"
        :sub-path="SAMPLES_SUBPATH"
        :empty-label="$t('platform.noSamplesYet')"
        display="list"
      />
      <ResourceTab
        v-else
        key="bios"
        ref="biosTabRef"
        :tag="props.tag"
        resource="bios"
        display="list"
      />
    </div>
  </div>
</template>

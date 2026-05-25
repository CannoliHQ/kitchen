<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { uploadFiles } from '@/api/client'
import { platformName } from '@/api/platforms'
import Button from '@/components/ui/Button.vue'
import Dropdown from '@/components/ui/Dropdown.vue'
import type { DropdownItem } from '@/components/ui/Dropdown.vue'
import Progress from '@/components/ui/Progress.vue'
import GamesTab from '@/components/platform/GamesTab.vue'
import ResourceTab from '@/components/platform/ResourceTab.vue'
import { ArrowLeft, Cpu, FolderPlus, Gamepad2, Image, Layers, Upload } from 'lucide-vue-next'

type TabKey = 'games' | 'overlays' | 'bios'
const TAB_KEYS: readonly TabKey[] = ['games', 'overlays', 'bios']

const props = defineProps<{ tag: string; tab?: string; folder?: string }>()
const router = useRouter()

const activeTab = computed<TabKey>(() =>
  TAB_KEYS.includes(props.tab as TabKey) ? (props.tab as TabKey) : 'games',
)

const tabs: { key: TabKey; label: string }[] = [
  { key: 'games', label: 'Games' },
  { key: 'overlays', label: 'Overlays' },
  { key: 'bios', label: 'BIOS' },
]

function selectTab(tab: TabKey) {
  if (tab === 'games') {
    router.replace({ name: 'platform', params: { tag: props.tag } })
  } else if (tab === 'overlays') {
    router.replace({ name: 'platform-overlays', params: { tag: props.tag } })
  } else {
    router.replace({ name: 'platform-bios', params: { tag: props.tag } })
  }
}

const gamesTabRef = ref<InstanceType<typeof GamesTab> | null>(null)
const overlaysTabRef = ref<InstanceType<typeof ResourceTab> | null>(null)
const biosTabRef = ref<InstanceType<typeof ResourceTab> | null>(null)

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
    bulkArtError.value = 'Bulk art upload failed'
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
  if (activeTab.value === 'games') {
    return [
      { label: 'New Folder', icon: FolderPlus, onSelect: () => gamesTabRef.value?.triggerNewFolder() },
      { label: 'Upload ROMs', icon: Gamepad2, onSelect: () => gamesTabRef.value?.triggerRomUpload() },
      { label: 'Bulk Art Upload', icon: Image, onSelect: () => bulkArtInput.value?.click() },
    ]
  }
  if (activeTab.value === 'overlays') {
    return [
      { label: 'Upload Overlay', icon: Layers, onSelect: () => overlaysTabRef.value?.triggerUpload() },
    ]
  }
  return [
    { label: 'Upload BIOS', icon: Cpu, onSelect: () => biosTabRef.value?.triggerUpload() },
  ]
})
</script>

<template>
  <div class="mx-auto max-w-[1600px] p-6 space-y-6">
    <input ref="bulkArtInput" type="file" accept="image/*" multiple class="hidden" @change="handleBulkArtFiles" />

    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" @click="router.push({ name: 'dashboard' })">
          <ArrowLeft class="h-5 w-5" />
        </Button>
        <h1 class="text-3xl font-bold tracking-tight">{{ platformName(props.tag) }}</h1>
      </div>
      <div class="sm:ml-auto">
        <Dropdown :items="actionItems" />
      </div>
    </div>

    <div v-if="bulkArtUploading" class="rounded-lg border border-border bg-card p-3 space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-foreground font-medium truncate">
          <Upload class="inline h-3.5 w-3.5 mr-1 -mt-0.5" />{{ bulkArtName }}<span v-if="bulkArtTotal > 1" class="text-foreground/60 font-normal"> ({{ bulkArtCurrent }} of {{ bulkArtTotal }})</span>
        </span>
        <span class="font-mono text-foreground/60 ml-2 shrink-0">{{ bulkArtProgress }}%</span>
      </div>
      <Progress :value="bulkArtProgress" class="!h-2.5" />
    </div>
    <p v-if="bulkArtError" class="text-sm text-destructive">{{ bulkArtError }}</p>

    <div class="sm:hidden">
      <select
        :value="activeTab"
        class="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-medium"
        @change="selectTab(($event.target as HTMLSelectElement).value as TabKey)"
      >
        <option v-for="t in tabs" :key="t.key" :value="t.key">{{ t.label }}</option>
      </select>
    </div>

    <div class="hidden sm:flex items-center gap-1 border-b border-border">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="px-4 py-2.5 text-base font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap"
        :class="activeTab === t.key ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="selectTab(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <div>
      <GamesTab
        v-if="activeTab === 'games'"
        ref="gamesTabRef"
        :tag="props.tag"
        :folder="props.folder ?? ''"
      />
      <ResourceTab
        v-else-if="activeTab === 'overlays'"
        ref="overlaysTabRef"
        :tag="props.tag"
        resource="overlays"
        display="images"
      />
      <ResourceTab
        v-else
        ref="biosTabRef"
        :tag="props.tag"
        resource="bios"
        display="list"
      />
    </div>
  </div>
</template>

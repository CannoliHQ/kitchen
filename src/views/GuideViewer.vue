<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { gameGuideBlob, getGame, downloadGameGuide, type GameDetail } from '@/api/client'
import { platformName } from '@/api/platforms'
import AppHeader from '@/components/layout/AppHeader.vue'
import Breadcrumbs, { type Crumb } from '@/components/layout/Breadcrumbs.vue'
import FilePreview from '@/components/FilePreview.vue'
import Button from '@/components/ui/Button.vue'
import { Download, Loader2 } from 'lucide-vue-next'

const props = defineProps<{ tag: string; id: string; file: string }>()

const gameId = computed(() => Number(props.id))
const game = ref<GameDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const blobUrl = ref<string | null>(null)
const contentType = ref('')
const downloadError = ref('')

const crumbs = computed<Crumb[]>(() => [
  { label: 'Platforms', to: { name: 'dashboard' } },
  { label: platformName(props.tag), to: { name: 'platform', params: { tag: props.tag } } },
  { label: game.value?.displayName ?? 'Game', to: { name: 'game', params: { tag: props.tag, id: props.id, tab: 'guides' } } },
  { label: props.file },
])

async function load() {
  loading.value = true
  error.value = null
  if (blobUrl.value) { URL.revokeObjectURL(blobUrl.value); blobUrl.value = null }
  // Best-effort game name for the breadcrumb; never blocks the viewer.
  getGame(props.tag, gameId.value).then(g => { game.value = g }).catch(() => {})
  try {
    const { url, type } = await gameGuideBlob(props.tag, gameId.value, props.file)
    blobUrl.value = url
    contentType.value = type
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load guide'
  } finally {
    loading.value = false
  }
}

async function onDownload() {
  downloadError.value = ''
  try {
    await downloadGameGuide(props.tag, gameId.value, props.file)
  } catch {
    downloadError.value = 'Download failed.'
  }
}

onMounted(load)
watch(() => props.file, load)
onBeforeUnmount(() => { if (blobUrl.value) URL.revokeObjectURL(blobUrl.value) })
</script>

<template>
  <div class="mx-auto max-w-[1600px] p-6 space-y-4">
    <AppHeader />

    <div class="flex items-center justify-between gap-3">
      <Breadcrumbs :items="crumbs" />
      <div class="flex items-center gap-2 shrink-0">
        <span v-if="downloadError" class="text-xs text-destructive">{{ downloadError }}</span>
        <Button variant="outline" size="sm" @click="onDownload">
          <Download class="h-4 w-4 mr-1.5" /> Download
        </Button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-muted-foreground">
      <Loader2 class="h-5 w-5 animate-spin" /> Loading guide...
    </div>

    <div v-else-if="error" class="py-16 text-center space-y-3">
      <p class="text-destructive">{{ error }}</p>
      <div class="flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" @click="load">Retry</Button>
        <Button variant="outline" size="sm" @click="onDownload">Download instead</Button>
      </div>
    </div>

    <FilePreview v-else-if="blobUrl" :url="blobUrl" :type="contentType" :name="props.file" />
  </div>
</template>

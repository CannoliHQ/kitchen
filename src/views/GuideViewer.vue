<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { gameGuideBlob, getGame, downloadGameGuide, type GameDetail } from '@/api/client'
import { platformName } from '@/api/platforms'
import AppHeader from '@/components/layout/AppHeader.vue'
import Breadcrumbs, { type Crumb } from '@/components/layout/Breadcrumbs.vue'
import Button from '@/components/ui/Button.vue'
import { Download, Loader2 } from 'lucide-vue-next'

const props = defineProps<{ tag: string; id: string; file: string }>()

const gameId = computed(() => Number(props.id))
const game = ref<GameDetail | null>(null)
const loading = ref(true)
const rendering = ref(false)
const error = ref<string | null>(null)
const blobUrl = ref<string | null>(null)
const kind = ref<'pdf' | 'image' | 'text' | 'other'>('other')
const textContent = ref('')
const pdfPages = ref(0)
const pdfContainer = ref<HTMLElement | null>(null)

const ext = computed(() => props.file.slice(props.file.lastIndexOf('.') + 1).toLowerCase())

const crumbs = computed<Crumb[]>(() => [
  { label: 'Platforms', to: { name: 'dashboard' } },
  { label: platformName(props.tag), to: { name: 'platform', params: { tag: props.tag } } },
  { label: game.value?.displayName ?? 'Game', to: { name: 'game', params: { tag: props.tag, id: props.id, tab: 'guides' } } },
  { label: props.file },
])

function detectKind(type: string): 'pdf' | 'image' | 'text' | 'other' {
  const e = ext.value
  if (e === 'pdf' || type === 'application/pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(e) || type.startsWith('image/')) return 'image'
  if (['txt', 'md', 'markdown', 'log', 'nfo', 'json', 'csv'].includes(e) || type.startsWith('text/')) return 'text'
  return 'other'
}

async function renderPdf(url: string) {
  rendering.value = true
  try {
    const pdfjs = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    const doc = await pdfjs.getDocument({ url }).promise
    pdfPages.value = doc.numPages
    const container = pdfContainer.value
    if (!container) return
    const targetWidth = Math.min(container.clientWidth, 1000)
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: targetWidth / base.width })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.className = 'mx-auto mb-4 rounded shadow-lg shadow-black/40 max-w-full h-auto'
      container.appendChild(canvas)
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
    }
  } finally {
    rendering.value = false
  }
}

async function load() {
  loading.value = true
  error.value = null
  pdfPages.value = 0
  if (blobUrl.value) { URL.revokeObjectURL(blobUrl.value); blobUrl.value = null }
  // Best-effort game name for the breadcrumb; never blocks the viewer.
  getGame(props.tag, gameId.value).then(g => { game.value = g }).catch(() => {})
  try {
    const { url, type } = await gameGuideBlob(props.tag, gameId.value, props.file)
    blobUrl.value = url
    kind.value = detectKind(type)
    if (kind.value === 'text') {
      textContent.value = await (await fetch(url)).text()
    }
    loading.value = false
    if (kind.value === 'pdf') {
      await nextTick()
      await renderPdf(url)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load guide'
    loading.value = false
  }
}

function onDownload() {
  downloadGameGuide(props.tag, gameId.value, props.file).catch(() => {})
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
      <Button variant="outline" size="sm" class="shrink-0" @click="onDownload">
        <Download class="h-4 w-4 mr-1.5" /> Download
      </Button>
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

    <template v-else>
      <!-- PDF -->
      <div v-if="kind === 'pdf'">
        <p v-if="rendering" class="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 class="h-4 w-4 animate-spin" /> Rendering...
        </p>
        <div ref="pdfContainer" class="rounded-xl bg-[#0e0e10] border border-border p-4" />
      </div>

      <!-- Image -->
      <div v-else-if="kind === 'image'" class="rounded-xl bg-[#0e0e10] border border-border p-4">
        <img :src="blobUrl!" :alt="props.file" class="mx-auto max-w-full h-auto rounded" />
      </div>

      <!-- Text / markdown -->
      <pre
        v-else-if="kind === 'text'"
        class="rounded-xl bg-card border border-border p-5 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words font-mono overflow-x-auto"
      >{{ textContent }}</pre>

      <!-- Unsupported -->
      <div v-else class="py-16 text-center space-y-3">
        <p class="text-muted-foreground">Preview isn't available for this file type.</p>
        <Button variant="outline" size="sm" @click="onDownload">
          <Download class="h-4 w-4 mr-1.5" /> Download
        </Button>
      </div>
    </template>
  </div>
</template>

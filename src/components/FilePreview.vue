<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Loader2, ZoomIn, ZoomOut } from 'lucide-vue-next'

const props = defineProps<{ url: string; type: string; name: string }>()

const rendering = ref(false)
const textContent = ref('')
const htmlContent = ref('')
const pdfContainer = ref<HTMLElement | null>(null)
const pdfPages = ref(0)
const zoom = ref(1)
let pdfDoc: PDFDocumentProxy | null = null

const ext = computed(() => props.name.slice(props.name.lastIndexOf('.') + 1).toLowerCase())

const kind = computed<'pdf' | 'image' | 'markdown' | 'text' | 'other'>(() => {
  const e = ext.value
  const t = props.type
  if (e === 'pdf' || t === 'application/pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(e) || t.startsWith('image/')) return 'image'
  if (['md', 'markdown'].includes(e) || t === 'text/markdown') return 'markdown'
  if (['txt', 'log', 'nfo', 'json', 'csv', 'cfg', 'ini'].includes(e) || t.startsWith('text/')) return 'text'
  return 'other'
})

async function renderPdf() {
  const container = pdfContainer.value
  if (!pdfDoc || !container) return
  rendering.value = true
  try {
    container.innerHTML = ''
    const targetWidth = Math.min(container.clientWidth, 1000) * zoom.value
    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const page = await pdfDoc.getPage(n)
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

function zoomBy(delta: number) {
  zoom.value = Math.min(3, Math.max(0.5, +(zoom.value + delta).toFixed(2)))
  renderPdf()
}

async function loadPdf(url: string) {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  pdfDoc = await pdfjs.getDocument({ url }).promise
  pdfPages.value = pdfDoc.numPages
  await renderPdf()
}

async function prepare() {
  textContent.value = ''
  htmlContent.value = ''
  zoom.value = 1
  pdfDoc = null
  pdfPages.value = 0
  if (kind.value === 'text') {
    textContent.value = await (await fetch(props.url)).text()
  } else if (kind.value === 'markdown') {
    const md = await (await fetch(props.url)).text()
    const { marked } = await import('marked')
    // Guides are the user's own uploaded files on their own device.
    htmlContent.value = await marked.parse(md)
  } else if (kind.value === 'pdf') {
    await nextTick()
    await loadPdf(props.url)
  }
}

onMounted(prepare)
watch(() => props.url, prepare)
</script>

<template>
  <div v-if="kind === 'pdf'">
    <div class="flex items-center justify-end gap-3 mb-2 text-sm text-muted-foreground">
      <span v-if="pdfPages">{{ $t('browse.preview.pages', pdfPages) }}</span>
      <div class="flex items-center gap-1">
        <button class="p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors" :title="$t('browse.preview.zoomOut')" @click="zoomBy(-0.25)">
          <ZoomOut class="h-4 w-4" />
        </button>
        <span class="tabular-nums w-12 text-center">{{ Math.round(zoom * 100) }}%</span>
        <button class="p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors" :title="$t('browse.preview.zoomIn')" @click="zoomBy(0.25)">
          <ZoomIn class="h-4 w-4" />
        </button>
      </div>
    </div>
    <p v-if="rendering" class="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
      <Loader2 class="h-4 w-4 animate-spin" /> {{ $t('browse.preview.rendering') }}
    </p>
    <div ref="pdfContainer" class="rounded-xl bg-surface-sunken border border-border p-4" />
  </div>

  <div v-else-if="kind === 'image'" class="rounded-xl bg-surface-sunken border border-border p-4">
    <img :src="url" :alt="name" class="mx-auto max-w-full h-auto rounded" />
  </div>

  <div
    v-else-if="kind === 'markdown'"
    class="md-body rounded-xl bg-card border border-border p-6 text-sm leading-relaxed text-foreground/90 max-w-3xl mx-auto"
    v-html="htmlContent"
  />

  <pre
    v-else-if="kind === 'text'"
    class="rounded-xl bg-card border border-border p-5 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words font-mono overflow-x-auto"
  >{{ textContent }}</pre>

  <div v-else class="py-16 text-center">
    <p class="text-muted-foreground">{{ $t('browse.preview.notAvailable') }}</p>
  </div>
</template>

<style scoped>
.md-body :deep(h1) { font-size: 1.5rem; font-weight: 700; margin: 1rem 0 0.5rem; }
.md-body :deep(h2) { font-size: 1.25rem; font-weight: 700; margin: 1rem 0 0.5rem; }
.md-body :deep(h3) { font-size: 1.1rem; font-weight: 600; margin: 0.75rem 0 0.4rem; }
.md-body :deep(p) { margin: 0.6rem 0; }
.md-body :deep(ul) { list-style: disc; padding-left: 1.4rem; margin: 0.6rem 0; }
.md-body :deep(ol) { list-style: decimal; padding-left: 1.4rem; margin: 0.6rem 0; }
.md-body :deep(li) { margin: 0.2rem 0; }
.md-body :deep(a) { color: var(--color-accent); text-decoration: underline; }
.md-body :deep(code) { background: var(--color-muted); padding: 0.1rem 0.3rem; border-radius: 0.25rem; font-size: 0.85em; }
.md-body :deep(pre) { background: var(--color-surface-sunken); padding: 0.9rem; border-radius: 0.5rem; overflow-x: auto; margin: 0.6rem 0; }
.md-body :deep(pre code) { background: none; padding: 0; }
.md-body :deep(blockquote) { border-left: 3px solid var(--color-border); padding-left: 0.9rem; color: var(--color-muted-foreground); margin: 0.6rem 0; }
.md-body :deep(strong) { font-weight: 700; color: var(--color-foreground); }
.md-body :deep(hr) { border: 0; border-top: 1px solid var(--color-border); margin: 1rem 0; }
.md-body :deep(img) { max-width: 100%; border-radius: 0.5rem; }
.md-body :deep(table) { border-collapse: collapse; margin: 0.6rem 0; }
.md-body :deep(th), .md-body :deep(td) { border: 1px solid var(--color-border); padding: 0.3rem 0.6rem; }
</style>

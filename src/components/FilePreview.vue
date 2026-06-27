<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'

const props = defineProps<{ url: string; type: string; name: string }>()

const rendering = ref(false)
const textContent = ref('')
const pdfContainer = ref<HTMLElement | null>(null)

const ext = computed(() => props.name.slice(props.name.lastIndexOf('.') + 1).toLowerCase())

const kind = computed<'pdf' | 'image' | 'text' | 'other'>(() => {
  const e = ext.value
  const t = props.type
  if (e === 'pdf' || t === 'application/pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(e) || t.startsWith('image/')) return 'image'
  if (['txt', 'md', 'markdown', 'log', 'nfo', 'json', 'csv', 'cfg', 'ini'].includes(e) || t.startsWith('text/')) return 'text'
  return 'other'
})

async function renderPdf(url: string) {
  rendering.value = true
  try {
    const pdfjs = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    const doc = await pdfjs.getDocument({ url }).promise
    const container = pdfContainer.value
    if (!container) return
    container.innerHTML = ''
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

async function prepare() {
  textContent.value = ''
  if (kind.value === 'text') {
    textContent.value = await (await fetch(props.url)).text()
  } else if (kind.value === 'pdf') {
    await nextTick()
    await renderPdf(props.url)
  }
}

onMounted(prepare)
watch(() => props.url, prepare)
</script>

<template>
  <div v-if="kind === 'pdf'">
    <p v-if="rendering" class="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
      <Loader2 class="h-4 w-4 animate-spin" /> Rendering...
    </p>
    <div ref="pdfContainer" class="rounded-xl bg-surface-sunken border border-border p-4" />
  </div>

  <div v-else-if="kind === 'image'" class="rounded-xl bg-surface-sunken border border-border p-4">
    <img :src="url" :alt="name" class="mx-auto max-w-full h-auto rounded" />
  </div>

  <pre
    v-else-if="kind === 'text'"
    class="rounded-xl bg-card border border-border p-5 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words font-mono overflow-x-auto"
  >{{ textContent }}</pre>

  <div v-else class="py-16 text-center">
    <p class="text-muted-foreground">Preview isn't available for this file type.</p>
  </div>
</template>

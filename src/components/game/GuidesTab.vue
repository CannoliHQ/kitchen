<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listGameGuides, downloadGameGuide, uploadGameGuide, deleteGameGuide, type GameFile } from '@/api/client'
import { confirm } from '@/lib/confirm'
import Button from '@/components/ui/Button.vue'
import { BookOpen, Upload, Download, Trash2 } from 'lucide-vue-next'

const props = defineProps<{ tag: string; id: number }>()

const entries = ref<GameFile[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const busy = ref(false)

function formatSize(n: number) {
  if (n <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let u = 0
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++ }
  return `${v.toFixed(v >= 10 || u === 0 ? 0 : 1)} ${units[u]}`
}

function formatWhen(ms: number) {
  if (ms <= 0) return ''
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

async function load() {
  loading.value = true
  error.value = null
  try {
    entries.value = await listGameGuides(props.tag, props.id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load guides'
  } finally {
    loading.value = false
  }
}

function pickFile(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

async function onUpload() {
  const file = await pickFile()
  if (!file) return
  busy.value = true
  error.value = null
  try {
    await uploadGameGuide(props.tag, props.id, file)
    await load()
  } catch {
    error.value = 'Upload failed'
  } finally {
    busy.value = false
  }
}

async function onDownload(f: GameFile) {
  try {
    await downloadGameGuide(props.tag, props.id, f.name)
  } catch { error.value = 'Download failed' }
}

async function onDelete(f: GameFile) {
  if (!await confirm({ title: `Delete ${f.name}?`, confirmLabel: 'Delete', destructive: true })) return
  busy.value = true
  error.value = null
  try {
    await deleteGameGuide(props.tag, props.id, f.name)
    await load()
  } catch {
    error.value = 'Delete failed'
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-base font-semibold text-foreground/85">Guides ({{ entries.length }})</div>
      <Button variant="outline" :disabled="busy" @click="onUpload">
        <Upload class="h-4 w-4 mr-1.5" /> Upload
      </Button>
    </div>

    <p v-if="loading" class="text-base text-foreground/75">Loading...</p>
    <div v-else-if="error" class="text-base text-destructive">
      {{ error }} <button class="underline" @click="load">retry</button>
    </div>
    <p v-else-if="!entries.length" class="text-base text-foreground/75">No guides yet.</p>

    <div v-else class="space-y-2">
      <div
        v-for="f in entries"
        :key="f.name"
        class="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card"
      >
        <div class="flex items-center justify-center h-9 w-9 rounded-lg bg-accent/15 shrink-0">
          <BookOpen class="h-4 w-4 text-accent" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-base font-semibold text-foreground truncate">{{ f.name }}</div>
          <div class="text-sm text-foreground/60">
            {{ formatSize(f.size) }}<template v-if="formatWhen(f.modified)"> &middot; {{ formatWhen(f.modified) }}</template>
          </div>
        </div>
        <div class="flex gap-1.5 shrink-0">
          <button
            class="p-2 rounded text-foreground/70 hover:bg-muted hover:text-foreground disabled:opacity-40"
            :disabled="busy"
            title="Download"
            @click="onDownload(f)"
          >
            <Download class="h-4 w-4" />
          </button>
          <button
            class="p-2 rounded text-foreground/70 hover:bg-destructive/15 hover:text-destructive disabled:opacity-40"
            :disabled="busy"
            title="Delete"
            @click="onDelete(f)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

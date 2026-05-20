<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listGameRoms, downloadGameRomFile, type GameRomFile } from '@/api/client'
import { Gamepad2, Download } from 'lucide-vue-next'

const props = defineProps<{ tag: string; id: number }>()

const files = ref<GameRomFile[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

function formatSize(n: number) {
  if (n <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let u = 0
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++ }
  return `${v.toFixed(v >= 10 || u === 0 ? 0 : 1)} ${units[u]}`
}

async function load() {
  loading.value = true
  error.value = null
  try {
    files.value = await listGameRoms(props.tag, props.id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load ROM files'
  } finally {
    loading.value = false
  }
}

async function onDownload(f: GameRomFile) {
  try {
    await downloadGameRomFile(props.tag, props.id, f.path, f.name)
  } catch { error.value = 'Download failed' }
}

onMounted(load)
</script>

<template>
  <div class="space-y-3">
    <div class="text-base font-semibold text-foreground/85">
      ROM file{{ files.length === 1 ? '' : 's' }} ({{ files.length }})
    </div>

    <p v-if="loading" class="text-base text-foreground/75">Loading...</p>
    <div v-else-if="error" class="text-base text-destructive">
      {{ error }} <button class="underline" @click="load">retry</button>
    </div>
    <p v-else-if="!files.length" class="text-base text-foreground/75">No ROM files.</p>

    <div v-else class="space-y-2">
      <div
        v-for="f in files"
        :key="f.path"
        class="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card"
      >
        <div class="flex items-center justify-center h-9 w-9 rounded-lg bg-accent/15 shrink-0">
          <Gamepad2 class="h-4 w-4 text-accent" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-base font-semibold text-foreground truncate">{{ f.name }}</div>
          <div class="text-sm text-foreground/60">{{ formatSize(f.size) }}</div>
        </div>
        <button
          class="p-2 rounded text-foreground/70 hover:bg-muted hover:text-foreground shrink-0"
          title="Download"
          @click="onDownload(f)"
        >
          <Download class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>

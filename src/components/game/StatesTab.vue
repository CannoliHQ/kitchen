<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  listGameStates, deleteGameState, uploadGameState, downloadGameState, downloadGameStatesZip, gameStateThumbnailBlob,
  type SlotInfo,
} from '@/api/client'
import { confirm } from '@/lib/confirm'
import { formatSize, formatRelativeTime as formatWhen, stripExtension } from '@/lib/format'
import Button from '@/components/ui/Button.vue'
import { Download, Upload, Trash2, Archive, Check } from 'lucide-vue-next'

const props = defineProps<{ tag: string; id: number; romName: string }>()

const slots = ref<SlotInfo[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const busy = ref(false)
const selected = ref<Set<number>>(new Set())
const thumbs = ref<Map<number, string>>(new Map())
const rowError = ref<Map<number, string>>(new Map())

const romBase = computed(() => stripExtension(props.romName))

const occupiedCount = computed(() => slots.value.filter(s => s.exists).length)

function stateFileName(slot: number): string {
  if (slot === 0) return `${romBase.value}.state.auto`
  if (slot === 1) return `${romBase.value}.state`
  return `${romBase.value}.state${slot - 1}`
}

function clearThumbs() {
  for (const url of thumbs.value.values()) URL.revokeObjectURL(url)
  thumbs.value = new Map()
}

async function load(silent = false) {
  if (!silent) loading.value = true
  error.value = null
  rowError.value = new Map()
  try {
    const res = await listGameStates(props.tag, props.id)
    slots.value = res.slots
    selected.value = new Set()
    const next = new Map<number, string>()
    for (const s of res.slots) {
      if (s.exists && s.thumbnail) {
        const url = await gameStateThumbnailBlob(props.tag, props.id, s.slot)
        if (url) next.set(s.slot, url)
      }
    }
    const previous = thumbs.value
    thumbs.value = next
    for (const url of previous.values()) URL.revokeObjectURL(url)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load save states'
  } finally {
    if (!silent) loading.value = false
  }
}

function toggleSelect(slot: number) {
  const next = new Set(selected.value)
  if (next.has(slot)) next.delete(slot)
  else next.add(slot)
  selected.value = next
}

async function onDownload(s: SlotInfo) {
  rowError.value.delete(s.slot)
  try {
    await downloadGameState(props.tag, props.id, s.slot, stateFileName(s.slot))
  } catch {
    rowError.value.set(s.slot, 'Download failed')
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

async function onUpload(s: SlotInfo) {
  if (s.exists && !await confirm({ title: `Replace ${s.label}?`, confirmLabel: 'Replace' })) return
  const file = await pickFile()
  if (!file) return
  busy.value = true
  rowError.value.delete(s.slot)
  try {
    await uploadGameState(props.tag, props.id, s.slot, file)
    await load(true)
  } catch {
    rowError.value.set(s.slot, 'Upload failed')
  } finally {
    busy.value = false
  }
}

async function onDelete(s: SlotInfo) {
  if (!await confirm({ title: `Delete ${s.label}?`, confirmLabel: 'Delete', destructive: true })) return
  busy.value = true
  rowError.value.delete(s.slot)
  try {
    await deleteGameState(props.tag, props.id, s.slot)
    await load(true)
  } catch {
    rowError.value.set(s.slot, 'Delete failed')
  } finally {
    busy.value = false
  }
}

async function onDeleteSelected() {
  const count = selected.value.size
  if (!count) return
  if (!await confirm({ title: `Delete ${count} save state${count === 1 ? '' : 's'}?`, confirmLabel: 'Delete', destructive: true })) return
  busy.value = true
  error.value = null
  try {
    await Promise.all([...selected.value].map(slot => deleteGameState(props.tag, props.id, slot)))
  } catch {
    error.value = 'One or more deletes failed'
  } finally {
    busy.value = false
    await load(true)
  }
}

async function onDownloadZip() {
  error.value = null
  try {
    await downloadGameStatesZip(props.tag, props.id, `${romBase.value} save states.zip`)
  } catch {
    error.value = 'ZIP download failed'
  }
}

onMounted(load)
onBeforeUnmount(clearThumbs)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div class="text-base font-semibold text-foreground/85">
        Save States ({{ occupiedCount }} of {{ slots.length }})
      </div>
      <div class="flex gap-2">
        <Button
          v-if="selected.size"
          variant="outline"
          :disabled="busy"
          @click="onDeleteSelected"
        >
          <Trash2 class="h-4 w-4 mr-1.5" /> Delete selected ({{ selected.size }})
        </Button>
        <Button variant="outline" :disabled="busy || !occupiedCount" @click="onDownloadZip">
          <Archive class="h-4 w-4 mr-1.5" /> Download all (ZIP)
        </Button>
      </div>
    </div>

    <p v-if="loading" class="text-base text-foreground/75 py-8 text-center">Loading...</p>
    <div v-else-if="error" class="py-8 text-center space-y-2">
      <p class="text-destructive">{{ error }}</p>
      <Button variant="outline" size="sm" @click="load">Retry</Button>
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-4">
      <div
        v-for="s in slots"
        :key="s.slot"
        class="bg-card border border-border rounded-lg p-2.5 pb-2.5"
        :class="selected.has(s.slot) ? 'ring-2 ring-accent border-accent' : ''"
      >
        <div
          class="relative bg-surface-sunken rounded-md overflow-hidden flex items-center justify-center"
          style="aspect-ratio: 10 / 9"
          :class="s.exists ? 'cursor-pointer' : ''"
          @click="s.exists && toggleSelect(s.slot)"
        >
          <img
            v-if="thumbs.get(s.slot)"
            :src="thumbs.get(s.slot)"
            :alt="s.label"
            class="h-full w-full object-cover"
          />
          <span v-else class="text-sm text-muted-foreground">{{ s.exists ? 'No preview' : 'Empty' }}</span>
          <div
            v-if="selected.has(s.slot)"
            class="absolute top-2 left-2 h-6 w-6 rounded bg-accent flex items-center justify-center"
          >
            <Check class="h-4 w-4 text-accent-foreground" />
          </div>
        </div>
        <div class="text-center pt-2.5">
          <div class="text-lg font-bold text-foreground">{{ s.label }}</div>
          <div v-if="s.exists" class="text-sm text-muted-foreground mt-0.5">
            {{ formatSize(s.size) }}<template v-if="formatWhen(s.modified)"> &middot; {{ formatWhen(s.modified) }}</template>
          </div>
        </div>

        <div class="flex justify-center gap-1.5 pt-2.5">
          <template v-if="s.exists">
            <button
              class="p-2 rounded text-foreground/70 hover:bg-muted hover:text-foreground disabled:opacity-40"
              :disabled="busy"
              title="Download"
              @click="onDownload(s)"
            >
              <Download class="h-5 w-5" />
            </button>
            <button
              class="p-2 rounded text-foreground/70 hover:bg-muted hover:text-foreground disabled:opacity-40"
              :disabled="busy"
              title="Replace"
              @click="onUpload(s)"
            >
              <Upload class="h-5 w-5" />
            </button>
            <button
              class="p-2 rounded text-foreground/70 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              :disabled="busy"
              title="Delete"
              @click="onDelete(s)"
            >
              <Trash2 class="h-5 w-5" />
            </button>
          </template>
          <button
            v-else
            class="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-semibold text-foreground/70 hover:bg-muted hover:text-foreground disabled:opacity-40"
            :disabled="busy"
            @click="onUpload(s)"
          >
            <Upload class="h-5 w-5" /> Upload
          </button>
        </div>
        <p v-if="rowError.get(s.slot)" class="text-sm text-destructive text-center pt-1">{{ rowError.get(s.slot) }}</p>
      </div>
    </div>
  </div>
</template>

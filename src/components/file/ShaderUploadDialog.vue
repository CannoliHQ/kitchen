<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { createFolder, uploadFiles } from '@/api/client'
import { parseShaderFolder, groupBySubdir, type ShaderFile, type ParsedShader } from '@/lib/shaderUpload'
import Button from '@/components/ui/Button.vue'
import Progress from '@/components/ui/Progress.vue'
import { FolderUp, CheckCircle, AlertTriangle } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  baseSegments: string[]
  existingNames: string[]
}>()

const emit = defineEmits<{ close: []; uploaded: [] }>()

const folderInput = ref<HTMLInputElement>()
const dragOver = ref(false)
const parsed = ref<ParsedShader | null>(null)
const uploading = ref(false)
const progress = ref(0)
const errors = ref<string[]>([])

watch(() => props.open, open => {
  if (open) {
    parsed.value = null
    dragOver.value = false
    uploading.value = false
    progress.value = 0
    errors.value = []
  }
})

const exists = computed(() => !!parsed.value && props.existingNames.includes(parsed.value.shaderName))
const hasPreset = computed(() => !!parsed.value && parsed.value.presets.length > 0)

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const files: ShaderFile[] = Array.from(input.files ?? []).map(f => ({
    path: f.webkitRelativePath || f.name,
    file: f,
  }))
  parsed.value = parseShaderFolder(files)
  input.value = ''
}

async function readEntry(entry: FileSystemEntry, prefix: string, out: ShaderFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej))
    out.push({ path: prefix + entry.name, file })
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    const readBatch = () => new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
    let batch: FileSystemEntry[]
    do {
      batch = await readBatch()
      for (const e of batch) await readEntry(e, prefix + entry.name + '/', out)
    } while (batch.length)
  }
}

async function onDrop(event: DragEvent) {
  dragOver.value = false
  const items = Array.from(event.dataTransfer?.items ?? [])
    .map(i => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e)
  if (!items.length) return
  const out: ShaderFile[] = []
  for (const e of items) await readEntry(e, '', out)
  parsed.value = parseShaderFolder(out)
}

async function upload() {
  const p = parsed.value
  if (!p || !hasPreset.value) return
  uploading.value = true
  errors.value = []
  progress.value = 0
  const groups = groupBySubdir(p.entries)
  const total = p.entries.length
  let done = 0
  try {
    await createFolder('shaders', ...props.baseSegments, p.shaderName)
    for (const [sub, files] of groups) {
      const subSegs = sub ? sub.split('/') : []
      try {
        if (subSegs.length) await createFolder('shaders', ...props.baseSegments, p.shaderName, ...subSegs)
        await uploadFiles('shaders', [...props.baseSegments, p.shaderName, ...subSegs], files).promise
      } catch {
        errors.value.push(sub || p.shaderName)
      }
      done += files.length
      progress.value = Math.round((done / total) * 100)
    }
    if (!errors.value.length) emit('uploaded')
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
      <div class="bg-card border border-border rounded-xl w-full max-w-xl mx-4 p-5 space-y-4 shadow-xl">
        <h2 class="text-lg font-semibold">{{ $t('dialogs.shaderUpload.title') }}</h2>

        <!-- Drop / pick zone -->
        <div
          v-if="!parsed"
          class="rounded-xl border-2 border-dashed px-8 py-12 text-center transition-colors cursor-pointer"
          :class="dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="onDrop"
          @click="folderInput?.click()"
        >
          <FolderUp class="h-9 w-9 mx-auto text-muted-foreground" />
          <p class="mt-3 text-sm font-medium">{{ $t('dialogs.shaderUpload.dropHint') }}</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ $t('dialogs.shaderUpload.layoutHint') }}</p>
          <p class="mt-3 text-xs font-bold text-muted-foreground">{{ $t('dialogs.shaderUpload.supportedHint') }}</p>
          <input ref="folderInput" type="file" webkitdirectory multiple class="hidden" @change="onPick" />
        </div>

        <!-- Preview -->
        <template v-else>
          <div class="rounded-lg border border-border bg-surface-sunken p-4 space-y-2">
            <div class="text-sm">
              {{ $t('dialogs.shaderUpload.willAdd') }}
              <span class="font-mono font-semibold text-foreground">Shaders/{{ parsed.shaderName }}/</span>
            </div>
            <div class="text-xs text-muted-foreground">
              {{ $t('dialogs.shaderUpload.fileCount', parsed.entries.length) }}
              <template v-if="parsed.presets.length"> · {{ $t('dialogs.shaderUpload.presetCount', parsed.presets.length) }}</template>
            </div>
            <p v-if="!hasPreset" class="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle class="h-3.5 w-3.5 shrink-0" /> {{ $t('dialogs.shaderUpload.noPreset') }}
            </p>
            <p v-else-if="exists" class="flex items-center gap-1.5 text-xs text-accent">
              <AlertTriangle class="h-3.5 w-3.5 shrink-0" /> {{ $t('dialogs.shaderUpload.existsWarning', { name: parsed.shaderName }) }}
            </p>
            <p v-else class="flex items-center gap-1.5 text-xs text-primary">
              <CheckCircle class="h-3.5 w-3.5 shrink-0" /> {{ $t('dialogs.shaderUpload.ready') }}
            </p>
          </div>

          <Progress v-if="uploading" :value="progress" />
          <p v-if="errors.length" class="text-xs text-destructive">{{ $t('dialogs.shaderUpload.partialFail', errors.length) }}</p>

          <div class="flex items-center justify-between">
            <button class="text-sm text-muted-foreground hover:text-foreground" :disabled="uploading" @click="parsed = null">
              &larr; {{ $t('dialogs.shaderUpload.chooseAnother') }}
            </button>
            <div class="flex items-center gap-2">
              <Button variant="ghost" size="sm" :disabled="uploading" @click="emit('close')">{{ $t('common.cancel') }}</Button>
              <Button size="sm" :disabled="!hasPreset || uploading" @click="upload">{{ $t('common.upload') }}</Button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

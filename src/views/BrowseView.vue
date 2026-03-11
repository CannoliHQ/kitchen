<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { listFiles, uploadFiles, type FileEntry } from '@/api/client'
import { platformLabel } from '@/api/platforms'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Progress from '@/components/ui/Progress.vue'
import { ArrowLeft, Upload, File, Folder } from 'lucide-vue-next'

const props = defineProps<{
  resource: string
  tag?: string
}>()

const router = useRouter()
const entries = ref<FileEntry[]>([])
const loading = ref(true)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadResult = ref<string[]>([])
const fileInput = ref<HTMLInputElement>()

const title = computed(() => {
  const labels: Record<string, string> = {
    roms: 'ROMs', art: 'Box Art', saves: 'Saves',
    states: 'Save States', bios: 'BIOS', wallpapers: 'Wallpapers',
  }
  const label = labels[props.resource] ?? props.resource
  return props.tag ? `${platformLabel(props.tag)} - ${label}` : label
})

function formatSize(bytes: number): string {
  if (bytes === 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

async function load() {
  loading.value = true
  try {
    const data = await listFiles(props.resource, props.tag)
    entries.value = data.entries
  } finally {
    loading.value = false
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return

  uploading.value = true
  uploadProgress.value = 0
  uploadResult.value = []
  try {
    const result = await uploadFiles(
      props.resource,
      props.tag,
      files,
      (pct) => { uploadProgress.value = pct },
    )
    uploadResult.value = result.files
    await load()
  } finally {
    uploading.value = false
    input.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-3xl p-4 space-y-4">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="router.push(props.tag ? { name: 'platform', params: { tag: props.tag } } : { name: 'dashboard' })">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <h1 class="text-xl font-bold tracking-tight">{{ title }}</h1>
    </div>

    <!-- Upload area -->
    <Card class="space-y-3 !p-4">
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">Upload files</span>
        <Button size="sm" :disabled="uploading" @click="triggerUpload">
          <Upload class="h-4 w-4" />
          Choose files
        </Button>
        <input ref="fileInput" type="file" multiple class="hidden" @change="handleFiles" />
      </div>
      <Progress v-if="uploading" :value="uploadProgress" />
      <p v-if="uploadResult.length" class="text-sm text-muted-foreground">
        Uploaded: {{ uploadResult.join(', ') }}
      </p>
    </Card>

    <!-- File list -->
    <div v-if="loading" class="text-sm text-muted-foreground">Loading...</div>
    <div v-else-if="!entries.length" class="text-sm text-muted-foreground">No files yet.</div>
    <div v-else class="space-y-1">
      <div
        v-for="entry in entries"
        :key="entry.name"
        class="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent transition-colors"
      >
        <Folder v-if="entry.type === 'dir'" class="h-4 w-4 text-muted-foreground shrink-0" />
        <File v-else class="h-4 w-4 text-muted-foreground shrink-0" />
        <span class="flex-1 truncate text-sm">{{ entry.name }}</span>
        <span class="text-xs text-muted-foreground">{{ formatSize(entry.size) }}</span>
      </div>
    </div>
  </div>
</template>

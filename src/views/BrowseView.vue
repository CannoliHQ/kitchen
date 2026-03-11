<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { listFiles, uploadFiles, createFolder, type FileEntry } from '@/api/client'
import { platformLabel } from '@/api/platforms'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Progress from '@/components/ui/Progress.vue'
import { ArrowLeft, Upload, File, Folder, FolderPlus, CheckCircle } from 'lucide-vue-next'

const props = defineProps<{
  resource: string
  tag?: string
}>()

const router = useRouter()
const route = useRoute()

const entries = ref<FileEntry[]>([])
const loading = ref(true)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadResult = ref<string[]>([])
const fileInput = ref<HTMLInputElement>()
const dragOver = ref(false)
const showNewFolder = ref(false)
const newFolderName = ref('')
const creatingFolder = ref(false)

/** Current subpath segments parsed from route query */
const subpath = computed<string[]>(() => {
  const p = route.query.path as string | undefined
  if (!p) return []
  return p.split('/').filter(Boolean)
})

/** All path segments for API calls: [tag, ...subpath] */
const apiSegments = computed(() => [props.tag, ...subpath.value].filter(Boolean) as string[])

const resourceLabel = computed(() => {
  const labels: Record<string, string> = {
    roms: 'ROMs', art: 'Box Art', saves: 'Saves',
    states: 'Save States', bios: 'BIOS', wallpapers: 'Wallpapers',
  }
  return labels[props.resource] ?? props.resource
})

const title = computed(() => {
  return props.tag ? `${platformLabel(props.tag)} - ${resourceLabel.value}` : resourceLabel.value
})

/** Breadcrumb segments for navigation */
const breadcrumbs = computed(() => {
  const crumbs: { label: string; path: string[] }[] = []
  subpath.value.forEach((seg, i) => {
    crumbs.push({ label: seg, path: subpath.value.slice(0, i + 1) })
  })
  return crumbs
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
    const data = await listFiles(props.resource, ...apiSegments.value)
    entries.value = data.entries
  } finally {
    loading.value = false
  }
}

function navigateTo(pathSegments: string[]) {
  const query = pathSegments.length ? { path: pathSegments.join('/') } : undefined
  router.push({
    name: props.tag ? 'browse' : 'browse-flat',
    params: props.tag ? { resource: props.resource, tag: props.tag } : { resource: props.resource },
    query,
  })
}

function openFolder(name: string) {
  navigateTo([...subpath.value, name])
}

function goBack() {
  if (subpath.value.length > 0) {
    navigateTo(subpath.value.slice(0, -1))
  } else {
    router.push(props.tag ? { name: 'platform', params: { tag: props.tag } } : { name: 'dashboard' })
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

async function doUpload(files: globalThis.File[]) {
  if (!files.length) return

  uploading.value = true
  uploadProgress.value = 0
  uploadResult.value = []
  try {
    const result = await uploadFiles(
      props.resource,
      apiSegments.value,
      files,
      (pct) => { uploadProgress.value = pct },
    )
    uploadResult.value = result.files
    await load()
  } finally {
    uploading.value = false
  }
}

async function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  await doUpload(Array.from(input.files ?? []))
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  doUpload(files)
}

async function handleCreateFolder() {
  const name = newFolderName.value.trim()
  if (!name) return

  creatingFolder.value = true
  try {
    await createFolder(props.resource, ...apiSegments.value, name)
    newFolderName.value = ''
    showNewFolder.value = false
    await load()
  } finally {
    creatingFolder.value = false
  }
}

// Reload when subpath changes via route
watch(() => route.query.path, () => load())

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-3xl p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="goBack">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div class="flex-1 min-w-0">
        <h1 class="text-2xl font-bold tracking-tight truncate">{{ title }}</h1>
        <!-- Breadcrumbs -->
        <div v-if="breadcrumbs.length" class="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <button class="hover:text-foreground" @click="navigateTo([])">root</button>
          <template v-for="(crumb, i) in breadcrumbs" :key="i">
            <span>/</span>
            <button
              class="hover:text-foreground truncate max-w-32"
              :class="i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : ''"
              @click="navigateTo(crumb.path)"
            >
              {{ crumb.label }}
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Actions bar -->
    <div class="flex items-center gap-2">
      <Button variant="outline" size="sm" @click="showNewFolder = !showNewFolder">
        <FolderPlus class="h-4 w-4" />
        New folder
      </Button>
    </div>

    <!-- New folder input -->
    <div v-if="showNewFolder" class="flex items-center gap-2">
      <Input
        v-model="newFolderName"
        placeholder="Folder name"
        class="flex-1"
        @keydown.enter="handleCreateFolder"
      />
      <Button size="sm" :disabled="creatingFolder || !newFolderName.trim()" @click="handleCreateFolder">
        Create
      </Button>
      <Button variant="ghost" size="sm" @click="showNewFolder = false; newFolderName = ''">
        Cancel
      </Button>
    </div>

    <!-- Upload area -->
    <div
      class="rounded-xl border-2 border-dashed p-6 text-center transition-all duration-150"
      :class="dragOver ? 'border-accent bg-accent/5' : 'border-border'"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
    >
      <div class="space-y-3">
        <Upload class="h-8 w-8 mx-auto text-muted-foreground" />
        <div>
          <p class="text-sm text-muted-foreground">Drag files here or</p>
          <button
            class="mt-1 text-sm font-medium text-accent hover:text-tan-light cursor-pointer"
            :disabled="uploading"
            @click="triggerUpload"
          >
            browse to upload
          </button>
          <input ref="fileInput" type="file" multiple class="hidden" @change="handleFiles" />
        </div>
      </div>
      <Progress v-if="uploading" :value="uploadProgress" class="mt-4" />
      <div v-if="uploadResult.length" class="mt-3 flex items-center justify-center gap-2 text-sm text-accent">
        <CheckCircle class="h-4 w-4" />
        <span>Uploaded {{ uploadResult.length }} file{{ uploadResult.length > 1 ? 's' : '' }}</span>
      </div>
    </div>

    <!-- File list -->
    <div v-if="loading" class="text-sm text-muted-foreground py-8 text-center">Loading...</div>
    <div v-else-if="!entries.length" class="text-sm text-muted-foreground py-8 text-center">No files yet.</div>
    <div v-else class="rounded-xl border border-border overflow-hidden">
      <div
        v-for="(entry, idx) in entries"
        :key="entry.name"
        class="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
        :class="[
          idx > 0 ? 'border-t border-border' : '',
          entry.type === 'dir' ? 'cursor-pointer' : '',
        ]"
        @click="entry.type === 'dir' ? openFolder(entry.name) : undefined"
      >
        <Folder v-if="entry.type === 'dir'" class="h-4 w-4 text-accent shrink-0" />
        <File v-else class="h-4 w-4 text-muted-foreground shrink-0" />
        <span class="flex-1 truncate text-sm">{{ entry.name }}</span>
        <span class="text-xs text-muted-foreground tabular-nums">{{ formatSize(entry.size) }}</span>
      </div>
    </div>
  </div>
</template>

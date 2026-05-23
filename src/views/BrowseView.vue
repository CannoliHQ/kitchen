<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { listFiles, listFilesRecursive, uploadFiles, createFolder, deleteFile, moveFile, type FileEntry } from '@/api/client'
import { platformName } from '@/api/platforms'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Progress from '@/components/ui/Progress.vue'
import { ArrowLeft, Upload, File as FileIcon, Folder, FolderPlus, CheckCircle, Trash2, MoveRight, Pencil, ChevronRight, ImagePlus, Image, Search, Gamepad2, XCircle, Ban, Loader2 } from 'lucide-vue-next'

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
const abortUpload = ref<(() => void) | null>(null)
const fileInput = ref<HTMLInputElement>()
const dragOver = ref(false)
const uploadFileNames = ref('')
const uploadCurrentIndex = ref(0)
const uploadTotal = ref(0)
const uploadCancelled = ref(false)
type UploadStatus = 'pending' | 'uploading' | 'done' | 'failed' | 'cancelled'
const uploadQueue = ref<{ name: string; status: UploadStatus }[]>([])
const showNewFolder = ref(false)
const newFolderName = ref('')
const creatingFolder = ref(false)
const deleting = ref<string | null>(null)
const movingEntry = ref<string | null>(null)
const moveBrowsePath = ref<string[]>([])
const moveFolders = ref<string[]>([])
const moveLoading = ref(false)
const moveError = ref('')
const renamingEntry = ref<string | null>(null)
const renameValue = ref('')
const renameError = ref('')
const showGamePicker = ref(false)
const gamePickerRoms = ref<string[]>([])
const gamePickerLoading = ref(false)
const gamePickerSearch = ref('')
const gamePickerMode = ref<'folder' | 'upload' | 'art'>('folder')
const pendingUploadFiles = ref<globalThis.File[]>([])
const artPickerGame = ref<string | null>(null)
const artPickerFile = ref<globalThis.File | null>(null)
const artPickerInput = ref<HTMLInputElement>()
const artPickerDragOver = ref(false)
const bulkArtInput = ref<HTMLInputElement>()

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
    guides: 'Guides', overlays: 'Overlays', shaders: 'Shaders',
  }
  return labels[props.resource] ?? props.resource
})

const title = computed(() => {
  if ((props.resource === 'guides' || props.resource === 'states') && subpath.value.length) {
    return `${resourceLabel.value} - ${subpath.value[subpath.value.length - 1]}`
  }
  return props.tag ? `${resourceLabel.value} - ${platformName(props.tag)}` : resourceLabel.value
})

/** Breadcrumb segments for navigation */
const breadcrumbs = computed(() => {
  const crumbs: { label: string; path: string[] }[] = []
  subpath.value.forEach((seg, i) => {
    crumbs.push({ label: seg, path: subpath.value.slice(0, i + 1) })
  })
  return crumbs
})

/** True when uploads should prompt for a game name to rename the file */
const needsGameRename = computed(() => ['saves', 'art'].includes(props.resource) && !!props.tag)

function stripExtension(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.substring(0, i) : name
}

function formatSize(bytes: number): string {
  if (bytes === 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

const filteredGamePickerRoms = computed(() => {
  const q = gamePickerSearch.value.toLowerCase()
  if (!q) return gamePickerRoms.value
  return gamePickerRoms.value.filter(name => name.toLowerCase().includes(q))
})

async function openGamePicker(mode: 'folder' | 'upload' | 'art' = 'folder') {
  gamePickerMode.value = mode
  showGamePicker.value = true
  gamePickerSearch.value = ''
  gamePickerLoading.value = true
  try {
    const data = await listFilesRecursive('roms', props.tag!)
    gamePickerRoms.value = data.entries
      .filter(e => e.type === 'file')
      .map(e => {
        const name = e.name.includes('/') ? e.name.substring(e.name.lastIndexOf('/') + 1) : e.name
        return stripExtension(name)
      })
  } catch {
    gamePickerRoms.value = []
  } finally {
    gamePickerLoading.value = false
  }
}

function cancelGamePicker() {
  showGamePicker.value = false
  pendingUploadFiles.value = []
  artPickerGame.value = null
  artPickerFile.value = null
}

function openArtPicker() {
  openGamePicker('art')
}

function selectArtGame(name: string) {
  artPickerGame.value = name
  artPickerFile.value = null
}

function handleArtPickerFile(event: Event) {
  const input = event.target as HTMLInputElement
  artPickerFile.value = input.files?.[0] ?? null
}

function artPickerDrop(event: DragEvent) {
  artPickerDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) artPickerFile.value = file
}

async function handleBulkArtUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length) await doUpload(files)
}

async function confirmArtUpload() {
  if (!artPickerGame.value || !artPickerFile.value) return
  const name = artPickerGame.value
  const file = artPickerFile.value
  showGamePicker.value = false

  const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.png'
  const renamed = new File([file], `${name}${ext}`, { type: file.type })
  await doUpload([renamed])
  artPickerGame.value = null
  artPickerFile.value = null
}

async function pickGame(name: string) {
  showGamePicker.value = false

  if (gamePickerMode.value === 'upload') {
    const files = pendingUploadFiles.value
    pendingUploadFiles.value = []
    const renamed = files.map(f => {
      const ext = f.name.includes('.') ? f.name.substring(f.name.lastIndexOf('.')) : ''
      return new File([f], `${name}${ext}`, { type: f.type })
    })
    await doUpload(renamed)
    return
  }

  creatingFolder.value = true
  try {
    await createFolder(props.resource, ...apiSegments.value, name)
    openFolder(name)
  } finally {
    creatingFolder.value = false
  }
}

async function load(showLoading = true) {
  if (showLoading) loading.value = true
  try {
    const data = await listFiles(props.resource, ...apiSegments.value)
    entries.value = data.entries
  } catch {
    entries.value = []
  } finally {
    loading.value = false
  }
}

/** Reload list without flashing the loading state */
async function reload() {
  return load(false)
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
    router.push(props.tag ? { name: 'platform', params: { tag: props.tag } } : { name: 'dashboard', params: { tab: 'customization' } })
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

async function doUpload(files: globalThis.File[]) {
  if (!files.length) return

  uploading.value = true
  uploadCancelled.value = false
  uploadProgress.value = 0
  uploadResult.value = []
  uploadTotal.value = files.length
  uploadCurrentIndex.value = 0
  uploadQueue.value = files.map((f) => ({ name: f.name, status: 'pending' as UploadStatus }))

  const uploaded: string[] = []
  try {
    for (let i = 0; i < files.length; i++) {
      if (uploadCancelled.value) {
        for (let j = i; j < uploadQueue.value.length; j++) {
          uploadQueue.value[j]!.status = 'cancelled'
        }
        break
      }
      const file = files[i]!
      uploadCurrentIndex.value = i + 1
      uploadFileNames.value = file.name
      uploadProgress.value = 0
      uploadQueue.value[i]!.status = 'uploading'

      const { promise, abort } = uploadFiles(
        props.resource,
        apiSegments.value,
        [file],
        (pct) => { uploadProgress.value = pct },
      )
      abortUpload.value = abort
      try {
        const result = await promise
        uploaded.push(...result.files)
        uploadQueue.value[i]!.status = 'done'
      } catch {
        if (uploadCancelled.value) {
          uploadQueue.value[i]!.status = 'cancelled'
          for (let j = i + 1; j < uploadQueue.value.length; j++) {
            uploadQueue.value[j]!.status = 'cancelled'
          }
        } else {
          uploadQueue.value[i]!.status = 'failed'
        }
        break
      } finally {
        abortUpload.value = null
      }
    }
    uploadResult.value = uploaded
    await reload()
  } finally {
    uploading.value = false
    abortUpload.value = null
  }
}

function cancelUpload() {
  uploadCancelled.value = true
  abortUpload.value?.()
}

async function handleDelete(name: string) {
  deleting.value = name
  try {
    await deleteFile(props.resource, ...apiSegments.value, name)
    await reload()
  } finally {
    deleting.value = null
  }
}

async function loadMoveFolders() {
  moveLoading.value = true
  try {
    const segments = [props.tag, ...moveBrowsePath.value].filter(Boolean) as string[]
    const data = await listFiles(props.resource, ...segments)
    moveFolders.value = data.entries.filter(e => e.type === 'dir').map(e => e.name)
  } catch {
    moveFolders.value = []
  } finally {
    moveLoading.value = false
  }
}

async function startMove(name: string) {
  renamingEntry.value = null
  movingEntry.value = name
  moveBrowsePath.value = [...subpath.value]
  moveError.value = ''
  await loadMoveFolders()
}

function cancelMove() {
  movingEntry.value = null
  moveBrowsePath.value = []
  moveFolders.value = []
  moveError.value = ''
}

async function moveBrowseInto(folder: string) {
  moveBrowsePath.value = [...moveBrowsePath.value, folder]
  await loadMoveFolders()
}

async function moveBrowseUp() {
  moveBrowsePath.value = moveBrowsePath.value.slice(0, -1)
  await loadMoveFolders()
}

async function moveBrowseToRoot() {
  moveBrowsePath.value = []
  await loadMoveFolders()
}

async function confirmMove() {
  if (!movingEntry.value) return
  const fromSegments = [...apiSegments.value, movingEntry.value]
  const destPath = [props.tag, ...moveBrowsePath.value, movingEntry.value].filter(Boolean).join('/')
  try {
    await moveFile(props.resource, fromSegments, destPath)
    cancelMove()
    await reload()
  } catch {
    moveError.value = 'Move failed. Destination may already exist.'
  }
}

function startRename(name: string) {
  movingEntry.value = null
  renamingEntry.value = name
  renameValue.value = name
  renameError.value = ''
}

function cancelRename() {
  renamingEntry.value = null
  renameValue.value = ''
  renameError.value = ''
}

async function confirmRename() {
  if (!renamingEntry.value || !renameValue.value.trim()) return
  if (renameValue.value.trim() === renamingEntry.value) { cancelRename(); return }
  const fromSegments = [...apiSegments.value, renamingEntry.value]
  const destPath = [props.tag, ...subpath.value, renameValue.value.trim()].filter(Boolean).join('/')
  try {
    await moveFile(props.resource, fromSegments, destPath)
    cancelRename()
    await reload()
  } catch {
    renameError.value = 'Rename failed. Name may already be taken.'
  }
}

async function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (needsGameRename.value && files.length) {
    pendingUploadFiles.value = files
    openGamePicker('upload')
    return
  }
  await doUpload(files)
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (needsGameRename.value && files.length) {
    pendingUploadFiles.value = files
    openGamePicker('upload')
    return
  }
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
    openFolder(name)
  } finally {
    creatingFolder.value = false
  }
}

// Reload when subpath changes via route
watch(() => route.query.path, () => load())

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-7xl p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="goBack">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div class="flex-1 min-w-0">
        <h1 class="text-2xl font-bold tracking-tight truncate">{{ title }}</h1>
        <!-- Breadcrumbs -->
        <div v-if="breadcrumbs.length" class="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <button class="hover:text-foreground" @click="navigateTo([])">/{{ resourceLabel }}{{ props.tag ? `/${props.tag}` : '' }}</button>
          <template v-for="(crumb, i) in breadcrumbs" :key="i">
            <span>/</span>
            <button
              class="hover:text-foreground"
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
    <div
      v-if="['guides', 'states'].includes(props.resource) && props.tag && !subpath.length"
      class="rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-150 border-border hover:border-accent/50 hover:bg-accent/5"
      @click="openGamePicker('folder')"
    >
      <FolderPlus class="h-8 w-8 mx-auto text-muted-foreground" />
      <p class="mt-3 text-sm font-medium text-muted-foreground">{{ props.resource === 'guides' ? 'Add guides for a game' : 'Add save states for a game' }}</p>
    </div>
    <div v-else-if="props.resource === 'art' && props.tag" class="flex flex-wrap justify-center gap-2">
      <Button variant="outline" size="sm" @click="openArtPicker">
        <ImagePlus class="h-4 w-4" />
        Add box art for a game
      </Button>
      <Button variant="outline" size="sm" @click="bulkArtInput?.click()">
        <Upload class="h-4 w-4" />
        Bulk Upload Pre-Named Files
      </Button>
      <input ref="bulkArtInput" type="file" accept="image/*" multiple class="hidden" @change="handleBulkArtUpload" />
    </div>
    <div v-else-if="!['guides', 'states', 'art', 'bios', 'saves'].includes(props.resource)" class="flex items-center gap-2">
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
      v-if="!(['guides', 'states'].includes(props.resource) && props.tag && !subpath.length) && !(props.resource === 'art' && props.tag)"
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
      <div v-if="uploading" class="mt-4 space-y-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-foreground font-medium truncate">
            {{ uploadFileNames }}<span v-if="uploadTotal > 1" class="text-muted-foreground font-normal"> ({{ uploadCurrentIndex }} of {{ uploadTotal }})</span>
          </span>
          <span class="font-mono text-muted-foreground ml-2 shrink-0">{{ uploadProgress }}%</span>
        </div>
        <div class="flex items-center gap-3">
          <Progress :value="uploadProgress" class="flex-1 !h-3" />
          <button
            class="shrink-0 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
            @click="cancelUpload"
          >
            Cancel
          </button>
        </div>
        <div
          v-if="uploadQueue.length > 1"
          class="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border"
        >
          <div
            v-for="item in uploadQueue"
            :key="item.name"
            class="flex items-center gap-2 px-3 py-2 text-xs"
          >
            <CheckCircle v-if="item.status === 'done'" class="h-3.5 w-3.5 shrink-0 text-accent" />
            <Loader2 v-else-if="item.status === 'uploading'" class="h-3.5 w-3.5 shrink-0 text-accent animate-spin" />
            <XCircle v-else-if="item.status === 'failed'" class="h-3.5 w-3.5 shrink-0 text-destructive" />
            <Ban v-else-if="item.status === 'cancelled'" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <FileIcon v-else class="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <span
              class="flex-1 truncate"
              :class="{
                'text-foreground font-medium': item.status === 'uploading' || item.status === 'done',
                'text-muted-foreground': item.status === 'pending' || item.status === 'cancelled',
                'text-destructive': item.status === 'failed',
              }"
            >{{ item.name }}</span>
          </div>
        </div>
      </div>
      <div v-if="uploadResult.length" class="mt-3 flex items-center justify-center gap-2 text-sm text-accent">
        <CheckCircle class="h-4 w-4" />
        <span>Uploaded {{ uploadResult.length }} file{{ uploadResult.length > 1 ? 's' : '' }}</span>
      </div>
    </div>

    <!-- File list -->
    <div v-if="loading" class="text-sm text-muted-foreground py-8 text-center">Loading...</div>
    <div v-else-if="!entries.length && !(['guides', 'states'].includes(props.resource) && props.tag && !subpath.length)" class="text-sm text-muted-foreground py-8 text-center">No files yet.</div>

    <!-- Standard file list -->
    <div v-else class="rounded-xl border border-border overflow-hidden">
      <div
        v-for="(entry, idx) in entries"
        :key="entry.name"
        class="group flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
        :class="[
          idx > 0 ? 'border-t border-border' : '',
          entry.type === 'dir' ? 'cursor-pointer' : '',
        ]"
        @click="entry.type === 'dir' ? openFolder(entry.name) : undefined"
      >
        <Folder v-if="entry.type === 'dir'" class="h-4 w-4 text-accent shrink-0" />
        <FileIcon v-else class="h-4 w-4 text-muted-foreground shrink-0" />
        <span class="flex-1 truncate text-sm">{{ entry.name }}</span>
        <span class="text-xs text-muted-foreground tabular-nums">{{ formatSize(entry.size) }}</span>
        <button
          class="shrink-0 p-1 rounded text-muted-foreground/50 hover:text-accent hover:bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="startRename(entry.name)"
        >
          <Pencil class="h-3.5 w-3.5" />
        </button>
        <button
          class="shrink-0 p-1 rounded text-muted-foreground/50 hover:text-accent hover:bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="startMove(entry.name)"
        >
          <MoveRight class="h-3.5 w-3.5" />
        </button>
        <button
          class="shrink-0 p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
          :disabled="deleting === entry.name"
          @click.stop="handleDelete(entry.name)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <!-- Rename dialog -->
    <div v-if="renamingEntry" class="rounded-xl border border-accent/50 bg-card p-4 space-y-3">
      <p class="text-sm">
        Rename <span class="font-semibold text-accent">{{ renamingEntry }}</span>
      </p>
      <Input
        v-model="renameValue"
        placeholder="New name"
        @keydown.enter="confirmRename"
        @keydown.escape="cancelRename"
      />
      <p v-if="renameError" class="text-xs text-destructive">{{ renameError }}</p>
      <div class="flex items-center gap-2">
        <Button size="sm" :disabled="!renameValue.trim() || renameValue === renamingEntry" @click="confirmRename">Rename</Button>
        <Button variant="ghost" size="sm" @click="cancelRename">Cancel</Button>
      </div>
    </div>

    <!-- Move dialog with directory browser -->
    <div v-if="movingEntry" class="rounded-xl border border-accent/50 bg-card p-4 space-y-3">
      <p class="text-sm">
        Move <span class="font-semibold text-accent">{{ movingEntry }}</span> to:
      </p>

      <!-- Current path display -->
      <div class="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
        <button class="hover:text-foreground font-medium" @click="moveBrowseToRoot">/{{ resourceLabel }}{{ props.tag ? `/${props.tag}` : '' }}</button>
        <template v-for="(seg, i) in moveBrowsePath" :key="i">
          <ChevronRight class="h-3.5 w-3.5 shrink-0" />
          <button
            class="hover:text-foreground"
            :class="i === moveBrowsePath.length - 1 ? 'text-foreground font-medium' : ''"
            @click="moveBrowsePath = moveBrowsePath.slice(0, i + 1); loadMoveFolders()"
          >
            {{ seg }}
          </button>
        </template>
      </div>

      <!-- Folder list -->
      <div class="rounded-lg border border-border max-h-48 overflow-y-auto">
        <div v-if="moveLoading" class="p-3 text-sm text-muted-foreground text-center">Loading...</div>
        <template v-else>
          <button
            v-if="moveBrowsePath.length > 0"
            class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 border-b border-border"
            @click="moveBrowseUp"
          >
            <ArrowLeft class="h-3.5 w-3.5 text-muted-foreground" />
            <span class="text-muted-foreground">..</span>
          </button>
          <div v-if="!moveFolders.length && moveBrowsePath.length === 0" class="p-3 text-sm text-muted-foreground text-center">
            No subfolders
          </div>
          <button
            v-for="folder in moveFolders"
            :key="folder"
            class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 border-t border-border first:border-t-0"
            @click="moveBrowseInto(folder)"
          >
            <Folder class="h-3.5 w-3.5 text-accent shrink-0" />
            <span class="truncate">{{ folder }}</span>
            <ChevronRight class="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
          </button>
        </template>
      </div>

      <p v-if="moveError" class="text-xs text-destructive">{{ moveError }}</p>
      <div class="flex items-center gap-2">
        <Button size="sm" @click="confirmMove">
          Move here
        </Button>
        <Button variant="ghost" size="sm" @click="cancelMove">Cancel</Button>
      </div>
    </div>

    <!-- Game picker modal -->
    <Teleport to="body">
      <div v-if="showGamePicker" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="cancelGamePicker">
        <div class="bg-card border border-border rounded-xl w-full max-w-md mx-4 p-5 space-y-4 shadow-xl">
          <!-- Art mode: two-step (pick game, then pick file) -->
          <template v-if="gamePickerMode === 'art'">
            <h2 class="text-lg font-semibold">{{ artPickerGame ? 'Add box art' : 'Pick a game' }}</h2>

            <!-- Step 1: pick game -->
            <template v-if="!artPickerGame">
              <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input v-model="gamePickerSearch" placeholder="Search games..." class="!pl-9" />
              </div>
              <div class="rounded-lg border border-border max-h-64 overflow-y-auto">
                <div v-if="gamePickerLoading" class="p-4 text-sm text-muted-foreground text-center">Loading...</div>
                <div v-else-if="!filteredGamePickerRoms.length" class="p-4 text-sm text-muted-foreground text-center">No games found.</div>
                <button
                  v-for="name in filteredGamePickerRoms"
                  :key="name"
                  class="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left hover:bg-muted/50 border-t border-border first:border-t-0"
                  @click="selectArtGame(name)"
                >
                  <Gamepad2 class="h-4 w-4 text-muted-foreground shrink-0" />
                  <span class="truncate">{{ name }}</span>
                </button>
              </div>
            </template>

            <!-- Step 2: pick file -->
            <template v-else>
              <p class="text-sm text-muted-foreground">
                Uploading art for <span class="font-medium text-foreground">{{ artPickerGame }}</span>
              </p>
              <div
                class="rounded-xl border-2 border-dashed p-6 text-center transition-all duration-150 cursor-pointer"
                :class="artPickerDragOver ? 'border-accent bg-accent/5' : artPickerFile ? 'border-accent/50 bg-accent/5' : 'border-border'"
                @dragover.prevent="artPickerDragOver = true"
                @dragleave="artPickerDragOver = false"
                @drop.prevent="artPickerDrop"
                @click="artPickerInput?.click()"
              >
                <template v-if="artPickerFile">
                  <Image class="h-8 w-8 mx-auto text-accent" />
                  <p class="mt-2 text-sm font-medium text-accent">{{ artPickerFile.name }}</p>
                </template>
                <template v-else>
                  <ImagePlus class="h-8 w-8 mx-auto text-muted-foreground" />
                  <p class="mt-2 text-sm text-muted-foreground">Drag an image here or click to browse</p>
                </template>
                <input ref="artPickerInput" type="file" accept="image/*" class="hidden" @change="handleArtPickerFile" />
              </div>
              <div class="flex items-center justify-between">
                <button class="text-sm text-muted-foreground hover:text-foreground" @click="artPickerGame = null; artPickerFile = null">
                  &larr; Pick a different game
                </button>
                <div class="flex items-center gap-2">
                  <Button variant="ghost" size="sm" @click="cancelGamePicker">Cancel</Button>
                  <Button size="sm" :disabled="!artPickerFile" @click="confirmArtUpload">Upload</Button>
                </div>
              </div>
            </template>

            <div v-if="!artPickerGame" class="flex justify-end">
              <Button variant="ghost" size="sm" @click="cancelGamePicker">Cancel</Button>
            </div>
          </template>

          <!-- Folder / upload mode: single-step game picker -->
          <template v-else>
            <h2 class="text-lg font-semibold">Pick a game</h2>
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input v-model="gamePickerSearch" placeholder="Search games..." class="!pl-9" />
            </div>
            <div class="rounded-lg border border-border max-h-64 overflow-y-auto">
              <div v-if="gamePickerLoading" class="p-4 text-sm text-muted-foreground text-center">Loading...</div>
              <div v-else-if="!filteredGamePickerRoms.length" class="p-4 text-sm text-muted-foreground text-center">No games found.</div>
              <button
                v-for="name in filteredGamePickerRoms"
                :key="name"
                class="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left hover:bg-muted/50 border-t border-border first:border-t-0"
                @click="pickGame(name)"
              >
                <Gamepad2 class="h-4 w-4 text-muted-foreground shrink-0" />
                <span class="truncate">{{ name }}</span>
              </button>
            </div>
            <div class="flex justify-end">
              <Button variant="ghost" size="sm" @click="cancelGamePicker">Cancel</Button>
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

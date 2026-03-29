<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { listFiles, uploadFiles, createFolder, deleteFile, moveFile, getArtworkIndex, getArtworkBlob, type FileEntry } from '@/api/client'
import { platformLabel } from '@/api/platforms'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Progress from '@/components/ui/Progress.vue'
import { ArrowLeft, Upload, File as FileIcon, Folder, FolderPlus, CheckCircle, Trash2, MoveRight, Pencil, ChevronRight, ImagePlus, BookOpen } from 'lucide-vue-next'

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
const artInputRefs = ref<Map<string, HTMLInputElement>>(new Map())
const artBlobUrls = ref<Map<string, string>>(new Map())
const guideInputRefs = ref<Map<string, HTMLInputElement>>(new Map())

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
    guides: 'Guides',
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

/** True when browsing ROMs for a platform (any depth) */
const isRomsBrowse = computed(() => props.resource === 'roms' && !!props.tag)

const romEntries = computed(() => entries.value.filter(e => e.type === 'file'))

function stripExtension(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.substring(0, i) : name
}

function normalizeKey(s: string): string {
  return s.normalize('NFC').toLowerCase()
}

function getArtUrl(name: string): string | undefined {
  return artBlobUrls.value.get(normalizeKey(stripExtension(name)))
}

async function loadArtwork() {
  if (!props.tag) return
  const tag = props.tag

  // Revoke old blob URLs
  for (const url of artBlobUrls.value.values()) URL.revokeObjectURL(url)
  artBlobUrls.value = new Map()

  try {
    const artEntries = await getArtworkIndex(tag)
    if (!artEntries.length) return

    const artLookup = new Map(artEntries.map(a => [normalizeKey(a.name), a.name]))

    const newUrls = new Map<string, string>()
    for (const entry of romEntries.value) {
      const baseName = stripExtension(entry.name)
      const artName = artLookup.get(normalizeKey(baseName))
      if (!artName) continue
      try {
        const blobUrl = await getArtworkBlob(tag, artName)
        if (blobUrl) {
          newUrls.set(normalizeKey(baseName), blobUrl)
          artBlobUrls.value = new Map(newUrls)
        }
      } catch {
        // skip failed art
      }
    }
  } catch {
    // artwork not available
  }
}

function triggerArtUpload(romName: string) {
  const input = artInputRefs.value.get(romName)
  input?.click()
}

function setArtInputRef(el: unknown, romName: string) {
  if (el instanceof HTMLInputElement) artInputRefs.value.set(romName, el)
}

async function handleArtUpload(romName: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !props.tag) return

  const baseName = stripExtension(romName)
  const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.png'
  const renamedFile = new File([file], `${baseName}${ext}`, { type: file.type })

  const { promise } = uploadFiles('art', [props.tag], [renamedFile])
  try {
    await promise
    // Reload the art for this ROM
    const blobUrl = await getArtworkBlob(props.tag, baseName)
    if (blobUrl) {
      const newUrls = new Map(artBlobUrls.value)
      newUrls.set(normalizeKey(baseName), blobUrl)
      artBlobUrls.value = newUrls
    }
  } catch {
    // upload failed
  }
  input.value = ''
}

function triggerGuideUpload(romName: string) {
  const input = guideInputRefs.value.get(romName)
  input?.click()
}

function setGuideInputRef(el: unknown, romName: string) {
  if (el instanceof HTMLInputElement) guideInputRefs.value.set(romName, el)
}

async function handleGuideUpload(romName: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !props.tag) return

  const gameName = stripExtension(romName)
  const { promise } = uploadFiles('guides', [props.tag, gameName], [file])
  try {
    await promise
  } catch {
    // upload failed
  }
  input.value = ''
}

function formatSize(bytes: number): string {
  if (bytes === 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
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
  if (isRomsBrowse.value) loadArtwork()
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
  uploadFileNames.value = files.length === 1
    ? files[0]!.name
    : `${files.length} files`
  const { promise, abort } = uploadFiles(
    props.resource,
    apiSegments.value,
    files,
    (pct) => { uploadProgress.value = pct },
  )
  abortUpload.value = abort
  try {
    const result = await promise
    uploadResult.value = result.files
    await reload()
  } catch {
    // cancelled or failed
  } finally {
    uploading.value = false
    abortUpload.value = null
  }
}

function cancelUpload() {
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
    await reload()
  } finally {
    creatingFolder.value = false
  }
}

// Reload when subpath changes via route
watch(() => route.query.path, () => load())

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-6xl p-6 space-y-6">
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
      <div v-if="uploading" class="mt-4 space-y-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-foreground font-medium truncate">{{ uploadFileNames }}</span>
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
      </div>
      <div v-if="uploadResult.length" class="mt-3 flex items-center justify-center gap-2 text-sm text-accent">
        <CheckCircle class="h-4 w-4" />
        <span>Uploaded {{ uploadResult.length }} file{{ uploadResult.length > 1 ? 's' : '' }}</span>
      </div>
    </div>

    <!-- File list -->
    <div v-if="loading" class="text-sm text-muted-foreground py-8 text-center">Loading...</div>
    <div v-else-if="!entries.length" class="text-sm text-muted-foreground py-8 text-center">No files yet.</div>

    <!-- ROM grid with box art -->
    <template v-else-if="isRomsBrowse">
      <!-- Folders first as list -->
      <div v-if="entries.some(e => e.type === 'dir')" class="rounded-xl border border-border overflow-hidden">
        <div
          v-for="(entry, idx) in entries.filter(e => e.type === 'dir')"
          :key="entry.name"
          class="group flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer"
          :class="idx > 0 ? 'border-t border-border' : ''"
          @click="openFolder(entry.name)"
        >
          <Folder class="h-4 w-4 text-accent shrink-0" />
          <span class="flex-1 truncate text-sm">{{ entry.name }}</span>
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

      <!-- ROM cards with art -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div
          v-for="entry in romEntries"
          :key="entry.name"
          class="rounded-xl border border-border bg-card overflow-hidden hover:border-accent/50 hover:shadow-md hover:shadow-accent/5"
        >
          <!-- Art image -->
          <div class="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
            <img
              v-if="getArtUrl(entry.name)"
              :src="getArtUrl(entry.name)"
              :alt="entry.name"
              class="h-full w-full object-contain"
            />
            <button
              v-if="!getArtUrl(entry.name)"
              class="flex flex-col items-center gap-1.5 text-muted-foreground/40 hover:text-accent/60 cursor-pointer"
              @click.stop="triggerArtUpload(entry.name)"
            >
              <ImagePlus class="h-10 w-10" />
              <span class="text-xs font-medium">Add art</span>
            </button>
            <input
              :ref="(el) => setArtInputRef(el, entry.name)"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleArtUpload(entry.name, $event)"
            />
            <input
              :ref="(el) => setGuideInputRef(el, entry.name)"
              type="file"
              class="hidden"
              @change="handleGuideUpload(entry.name, $event)"
            />
          </div>
          <!-- Info -->
          <div class="px-3 pt-3 pb-2 space-y-1">
            <p class="text-base font-semibold leading-snug break-words">{{ stripExtension(entry.name) }}</p>
            <p class="text-xs text-muted-foreground">{{ formatSize(entry.size) }}</p>
          </div>
          <!-- Action bar -->
          <div class="flex items-center border-t border-border">
            <button
              v-if="getArtUrl(entry.name)"
              class="flex-1 flex items-center justify-center py-2 text-muted-foreground hover:text-accent hover:bg-muted/50"
              @click.stop="triggerArtUpload(entry.name)"
            >
              <ImagePlus class="h-4 w-4" />
            </button>
            <button
              v-else
              class="flex-1 flex items-center justify-center py-2 text-muted-foreground hover:text-accent hover:bg-muted/50"
              @click.stop="triggerArtUpload(entry.name)"
            >
              <ImagePlus class="h-4 w-4" />
            </button>
            <button
              class="flex-1 flex items-center justify-center py-2 text-muted-foreground hover:text-accent hover:bg-muted/50 border-l border-border"
              @click.stop="triggerGuideUpload(entry.name)"
            >
              <BookOpen class="h-4 w-4" />
            </button>
            <button
              class="flex-1 flex items-center justify-center py-2 text-muted-foreground hover:text-accent hover:bg-muted/50 border-l border-border"
              @click.stop="startRename(entry.name)"
            >
              <Pencil class="h-4 w-4" />
            </button>
            <button
              class="flex-1 flex items-center justify-center py-2 text-muted-foreground hover:text-accent hover:bg-muted/50 border-l border-border"
              @click.stop="startMove(entry.name)"
            >
              <MoveRight class="h-4 w-4" />
            </button>
            <button
              class="flex-1 flex items-center justify-center py-2 text-muted-foreground hover:text-destructive hover:bg-muted/50 border-l border-border"
              :disabled="deleting === entry.name"
              @click.stop="handleDelete(entry.name)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </template>

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
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getApps, listFiles, deleteFile, uploadFiles, resourceFileBlob } from '@/api/client'
import { confirm } from '@/lib/confirm'
import Button from '@/components/ui/Button.vue'
import Progress from '@/components/ui/Progress.vue'
import { Image as ImageIcon, Trash2, Upload } from 'lucide-vue-next'

const props = defineProps<{ tag: string }>()
const { t } = useI18n()

const names = ref<string[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const busy = ref<string | null>(null)

/** Art basename -> the actual filename on disk, which carries the extension we do not otherwise know. */
const artFiles = reactive(new Map<string, string>())
const thumbnails = reactive(new Map<string, string>())

const fileInput = ref<HTMLInputElement>()
const pendingName = ref<string | null>(null)
const uploading = ref(false)
const uploadProgress = ref(0)

function clearThumbnails() {
  for (const url of thumbnails.values()) URL.revokeObjectURL(url)
  thumbnails.clear()
}

async function load() {
  loading.value = true
  error.value = null
  clearThumbnails()
  artFiles.clear()
  try {
    const apps = await getApps()
    names.value = props.tag === 'TOOLS' ? apps.tools : apps.ports

    const listed = await listFiles('art', props.tag)
    for (const entry of listed.entries ?? []) {
      if (entry.type !== 'file') continue
      const base = entry.name.includes('.') ? entry.name.slice(0, entry.name.lastIndexOf('.')) : entry.name
      artFiles.set(base, entry.name)
    }

    for (const name of names.value) {
      const file = artFiles.get(name)
      if (!file || thumbnails.has(name)) continue
      const url = await resourceFileBlob('art', props.tag, file)
      if (url) thumbnails.set(name, url)
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : t('platform.loadFilesFailed')
    names.value = []
  } finally {
    loading.value = false
  }
}

function pickArtFor(name: string) {
  pendingName.value = name
  fileInput.value?.click()
}

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const name = pendingName.value
  pendingName.value = null
  if (!file || !name) return

  uploading.value = true
  uploadProgress.value = 0
  error.value = null
  busy.value = name
  try {
    // Replacing art keeps the old extension's file around otherwise, and both would collide on basename.
    const existing = artFiles.get(name)
    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.png'
    if (existing && existing !== `${name}${ext}`) {
      await deleteFile('art', props.tag, existing)
    }
    const renamed = new File([file], `${name}${ext}`, { type: file.type })
    const { promise } = uploadFiles('art', [props.tag], [renamed], pct => { uploadProgress.value = pct })
    await promise
    await load()
  } catch {
    error.value = t('platform.uploadFailed')
  } finally {
    uploading.value = false
    busy.value = null
  }
}

async function removeArt(name: string) {
  const file = artFiles.get(name)
  if (!file) return
  const ok = await confirm({
    title: t('platform.appsRemoveArt'),
    body: t('platform.appsRemoveArtConfirm', { name }),
    confirmLabel: t('platform.appsRemoveArt'),
    destructive: true,
  })
  if (!ok) return
  busy.value = name
  error.value = null
  try {
    await deleteFile('art', props.tag, file)
    await load()
  } catch {
    error.value = t('platform.deleteFailed')
  } finally {
    busy.value = null
  }
}

watch(() => props.tag, load)
onMounted(load)
onBeforeUnmount(clearThumbnails)
</script>

<template>
  <div class="space-y-4">
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChosen" />

    <div v-if="uploading" class="rounded-lg border border-border bg-card p-3 space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-foreground font-medium truncate">
          <Upload class="inline h-3.5 w-3.5 mr-1 -mt-0.5" />{{ busy }}
        </span>
        <span class="font-mono text-foreground/60 ml-2 shrink-0">{{ uploadProgress }}%</span>
      </div>
      <Progress :value="uploadProgress" />
    </div>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <p v-if="loading" class="text-sm text-muted-foreground">{{ $t('platform.appsLoading') }}</p>
    <p v-else-if="!names.length" class="text-sm text-muted-foreground">{{ $t('platform.appsEmpty') }}</p>

    <ul v-else class="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
      <li
        v-for="name in names"
        :key="name"
        class="flex items-center gap-4 px-4 py-3"
        :class="busy === name ? 'opacity-60 pointer-events-none' : ''"
      >
        <img
          v-if="thumbnails.get(name)"
          :src="thumbnails.get(name)"
          :alt="name"
          class="h-14 w-14 shrink-0 rounded-md object-contain bg-muted"
        />
        <div v-else class="h-14 w-14 shrink-0 rounded-md bg-muted flex items-center justify-center">
          <ImageIcon class="h-5 w-5 text-muted-foreground" />
        </div>

        <div class="flex-1 min-w-0">
          <p class="font-medium truncate">{{ name }}</p>
          <p v-if="!artFiles.has(name)" class="text-xs text-muted-foreground">{{ $t('platform.appsNoArt') }}</p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" @click="pickArtFor(name)">
            {{ artFiles.has(name) ? $t('platform.appsReplaceArt') : $t('platform.appsSetArt') }}
          </Button>
          <Button
            v-if="artFiles.has(name)"
            variant="ghost"
            size="icon"
            :aria-label="$t('platform.appsRemoveArt')"
            @click="removeArt(name)"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
      </li>
    </ul>
  </div>
</template>

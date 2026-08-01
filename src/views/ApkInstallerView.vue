<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { uploadApk, getApkStatus } from '@/api/client'
import Button from '@/components/ui/Button.vue'
import Progress from '@/components/ui/Progress.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { ArrowLeft, PackagePlus, CheckCircle2, XCircle, Smartphone } from 'lucide-vue-next'

type Phase = 'idle' | 'uploading' | 'waiting' | 'success' | 'failure'

const router = useRouter()
const { t } = useI18n()
const phase = ref<Phase>('idle')
const progress = ref(0)
const error = ref('')
const fileName = ref('')
const dragOver = ref(false)
const fileInput = ref<HTMLInputElement>()
let pollTimer: ReturnType<typeof setInterval> | undefined
let abortUpload: (() => void) | null = null
let uploadCancelled = false

onUnmounted(() => {
  clearInterval(pollTimer)
  uploadCancelled = true
  abortUpload?.()
})

function onDrop(e: DragEvent) {
  dragOver.value = false
  const file = e.dataTransfer?.files[0]
  if (file) install(file)
}

function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) install(file)
}

async function install(file: File) {
  if (!file.name.toLowerCase().endsWith('.apk')) {
    error.value = t('tools.onlyApkFiles')
    phase.value = 'failure'
    return
  }
  fileName.value = file.name
  phase.value = 'uploading'
  progress.value = 0
  error.value = ''
  uploadCancelled = false
  try {
    const { promise, abort } = uploadApk(file, pct => (progress.value = pct))
    abortUpload = abort
    const { installId } = await promise
    abortUpload = null
    phase.value = 'waiting'
    poll(installId)
  } catch {
    abortUpload = null
    if (!uploadCancelled) {
      error.value = t('tools.uploadFailed')
      phase.value = 'failure'
    }
  }
}

function cancelUpload() {
  uploadCancelled = true
  abortUpload?.()
  reset()
}

function poll(installId: string) {
  pollTimer = setInterval(async () => {
    try {
      const s = await getApkStatus(installId)
      if (s.status === 'success') {
        clearInterval(pollTimer)
        phase.value = 'success'
      } else if (s.status === 'failure') {
        clearInterval(pollTimer)
        error.value = s.message ?? t('tools.installFailed')
        phase.value = 'failure'
      }
    } catch {
    }
  }, 1500)
}

function reset() {
  clearInterval(pollTimer)
  phase.value = 'idle'
  progress.value = 0
  error.value = ''
  fileName.value = ''
}
</script>

<template>
  <div class="mx-auto max-w-[1600px] p-6 space-y-6">
    <AppHeader />
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="router.push({ name: 'dashboard', params: { tab: 'tools' } })">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('tools.apkInstaller') }}</h1>
    </div>

    <div
      v-if="phase === 'idle'"
      class="rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer"
      :class="dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <PackagePlus class="mx-auto h-10 w-10 text-muted-foreground" />
      <p class="mt-4 text-sm font-medium">{{ $t('tools.dropApk') }}</p>
      <p class="mt-1 text-sm text-muted-foreground">{{ $t('tools.confirmOnDevice') }}</p>
      <input ref="fileInput" type="file" accept=".apk" class="hidden" @change="onPick" />
    </div>

    <div v-else class="rounded-xl border border-border bg-card p-8 space-y-4 text-center">
      <template v-if="phase === 'uploading'">
        <p class="text-sm font-medium">{{ $t('tools.uploadingFile', { file: fileName }) }}</p>
        <Progress :value="progress" />
        <Button variant="outline" @click="cancelUpload">{{ $t('common.cancel') }}</Button>
      </template>

      <template v-else-if="phase === 'waiting'">
        <Smartphone class="mx-auto h-10 w-10 text-accent animate-pulse" />
        <p class="text-sm font-medium">{{ $t('tools.waitingForConfirmation') }}</p>
        <p class="text-sm text-muted-foreground">{{ $t('tools.confirmInstallPrompt') }}</p>
      </template>

      <template v-else-if="phase === 'success'">
        <CheckCircle2 class="mx-auto h-10 w-10 text-green-500" />
        <p class="text-sm font-medium">{{ $t('tools.fileInstalled', { file: fileName }) }}</p>
        <Button variant="outline" @click="reset">{{ $t('tools.installAnother') }}</Button>
      </template>

      <template v-else>
        <XCircle class="mx-auto h-10 w-10 text-destructive" />
        <p class="text-sm font-medium">{{ $t('tools.installFailed') }}</p>
        <p class="text-sm text-muted-foreground">{{ error }}</p>
        <Button variant="outline" @click="reset">{{ $t('tools.tryAgain') }}</Button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { platformName } from '@/api/platforms'
import { createFolder } from '@/api/client'

const props = defineProps<{
  tag: string
  folders: string[]
  count: number
  movingFolders?: string[]
}>()

const emit = defineEmits<{
  move: [target: string]
  close: []
}>()

const moving = props.movingFolders ?? []
const localFolders = ref<string[]>(
  props.folders.filter(f => !moving.some(m => f === m || f.startsWith(m + '/')))
)
const selectedTarget = ref('')

const showNewFolder = ref(false)
const newFolderName = ref('')
const newFolderError = ref<string | null>(null)

function depthOf(path: string): number {
  return path.split('/').length - 1
}

async function confirmNewFolder() {
  const name = newFolderName.value.trim()
  if (!name) return
  newFolderError.value = null
  try {
    await createFolder('roms', props.tag, ...selectedTarget.value.split('/').filter(Boolean), name)
    const newPath = [selectedTarget.value, name].filter(Boolean).join('/')
    localFolders.value.push(newPath)
    localFolders.value.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    selectedTarget.value = newPath
    showNewFolder.value = false
    newFolderName.value = ''
  } catch {
    newFolderError.value = 'Failed to create folder'
  }
}

function cancelNewFolder() {
  showNewFolder.value = false
  newFolderName.value = ''
  newFolderError.value = null
}
</script>

<template>
  <Modal :title="`Move ${count} ${count === 1 ? 'item' : 'items'}`" @close="$emit('close')">
    <div class="space-y-1 max-h-64 overflow-y-auto -mx-1 px-1">
      <button
        class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors"
        :class="selectedTarget === '' ? 'bg-accent/15 text-accent' : 'text-foreground hover:bg-muted'"
        @click="selectedTarget = ''"
      >
        <span
          class="inline-flex h-4 w-4 shrink-0 rounded-full border-2 transition-colors"
          :class="selectedTarget === '' ? 'border-accent bg-accent' : 'border-muted-foreground/50'"
        />
        <span class="font-medium">{{ platformName(props.tag) }}</span>
      </button>

      <button
        v-for="folder in localFolders"
        :key="folder"
        class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors"
        :class="selectedTarget === folder ? 'bg-accent/15 text-accent' : 'text-foreground hover:bg-muted'"
        :style="{ paddingLeft: `${(depthOf(folder) + 1) * 16 + 8}px` }"
        @click="selectedTarget = folder"
      >
        <span
          class="inline-flex h-4 w-4 shrink-0 rounded-full border-2 transition-colors"
          :class="selectedTarget === folder ? 'border-accent bg-accent' : 'border-muted-foreground/50'"
        />
        {{ folder.slice(folder.lastIndexOf('/') + 1) }}
      </button>
    </div>

    <div class="mt-3">
      <button
        v-if="!showNewFolder"
        class="text-xs text-foreground/60 hover:text-foreground transition-colors"
        @click="showNewFolder = true"
      >+ New folder</button>
      <div v-else class="space-y-1.5">
        <Input
          v-model="newFolderName"
          placeholder="Folder name"
          class="!h-8 !text-sm"
          @keydown.enter="confirmNewFolder"
          @keydown.escape="cancelNewFolder"
        />
        <p v-if="newFolderError" class="text-xs text-destructive">{{ newFolderError }}</p>
        <div class="flex gap-2">
          <Button size="sm" variant="ghost" @click="cancelNewFolder">Cancel</Button>
          <Button size="sm" :disabled="!newFolderName.trim()" @click="confirmNewFolder">Create</Button>
        </div>
      </div>
    </div>

    <template #footer>
      <Button variant="ghost" @click="$emit('close')">Cancel</Button>
      <Button @click="$emit('move', selectedTarget)">Move here</Button>
    </template>
  </Modal>
</template>

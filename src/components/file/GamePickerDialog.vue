<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { Search, Gamepad2, Image, ImagePlus } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  mode: 'folder' | 'upload' | 'art'
  roms: string[]
  loading: boolean
  apps?: boolean
}>()

const emit = defineEmits<{
  cancel: []
  pick: [name: string]
  confirmArt: [payload: { game: string; file: File }]
}>()

const pickTitleKey = computed(() => props.apps ? 'dialogs.pickAnItem' : 'dialogs.pickAGame')
const searchKey = computed(() => props.apps ? 'dialogs.searchItems' : 'dialogs.searchGames')
const emptyKey = computed(() => props.apps ? 'dialogs.noItemsFound' : 'dialogs.noGamesFound')
const pickAnotherKey = computed(() => props.apps ? 'dialogs.pickADifferentItem' : 'dialogs.pickADifferentGame')

const search = ref('')
const artGame = ref<string | null>(null)
const artFile = ref<globalThis.File | null>(null)
const artDragOver = ref(false)
const artInput = ref<HTMLInputElement>()

// Reset internal state whenever the dialog (re)opens.
watch(() => props.open, open => {
  if (open) {
    search.value = ''
    artGame.value = null
    artFile.value = null
    artDragOver.value = false
  }
})

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return props.roms
  return props.roms.filter(name => name.toLowerCase().includes(q))
})

function selectArtGame(name: string) {
  artGame.value = name
  artFile.value = null
}

function handleArtFile(event: Event) {
  const input = event.target as HTMLInputElement
  artFile.value = input.files?.[0] ?? null
}

function artDrop(event: DragEvent) {
  artDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) artFile.value = file
}

function confirmArt() {
  if (artGame.value && artFile.value) emit('confirmArt', { game: artGame.value, file: artFile.value })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('cancel')">
      <div class="bg-card border border-border rounded-xl w-full max-w-md mx-4 p-5 space-y-4 shadow-xl">
        <!-- Art mode: two-step (pick game, then pick file) -->
        <template v-if="mode === 'art'">
          <h2 class="text-lg font-semibold">{{ artGame ? $t('dialogs.addBoxArt') : $t(pickTitleKey) }}</h2>

          <template v-if="!artGame">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input v-model="search" :placeholder="$t(searchKey)" class="!pl-9" />
            </div>
            <div class="rounded-lg border border-border max-h-64 overflow-y-auto">
              <div v-if="loading" class="p-4 text-sm text-muted-foreground text-center">{{ $t('common.loading') }}</div>
              <div v-else-if="!filtered.length" class="p-4 text-sm text-muted-foreground text-center">{{ $t(emptyKey) }}</div>
              <button
                v-for="name in filtered"
                :key="name"
                class="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left hover:bg-muted/50 border-t border-border first:border-t-0"
                @click="selectArtGame(name)"
              >
                <Gamepad2 class="h-4 w-4 text-muted-foreground shrink-0" />
                <span class="truncate">{{ name }}</span>
              </button>
            </div>
            <div class="flex justify-end">
              <Button variant="ghost" size="sm" @click="emit('cancel')">{{ $t('common.cancel') }}</Button>
            </div>
          </template>

          <template v-else>
            <p class="text-sm text-muted-foreground">
              {{ $t('dialogs.uploadingArtFor') }} <span class="font-medium text-foreground">{{ artGame }}</span>
            </p>
            <div
              class="rounded-xl border-2 border-dashed p-6 text-center transition-all duration-150 cursor-pointer"
              :class="artDragOver ? 'border-accent bg-accent/5' : artFile ? 'border-accent/50 bg-accent/5' : 'border-border'"
              @dragover.prevent="artDragOver = true"
              @dragleave="artDragOver = false"
              @drop.prevent="artDrop"
              @click="artInput?.click()"
            >
              <template v-if="artFile">
                <Image class="h-8 w-8 mx-auto text-accent" />
                <p class="mt-2 text-sm font-medium text-foreground">{{ artFile.name }}</p>
              </template>
              <template v-else>
                <ImagePlus class="h-8 w-8 mx-auto text-muted-foreground" />
                <p class="mt-2 text-sm text-muted-foreground">{{ $t('dialogs.dragImageHint') }}</p>
              </template>
              <input ref="artInput" type="file" accept="image/*" class="hidden" @change="handleArtFile" />
            </div>
            <div class="flex items-center justify-between">
              <button class="text-sm text-muted-foreground hover:text-foreground" @click="artGame = null; artFile = null">
                &larr; {{ $t(pickAnotherKey) }}
              </button>
              <div class="flex items-center gap-2">
                <Button variant="ghost" size="sm" @click="emit('cancel')">{{ $t('common.cancel') }}</Button>
                <Button size="sm" :disabled="!artFile" @click="confirmArt">{{ $t('common.upload') }}</Button>
              </div>
            </div>
          </template>
        </template>

        <!-- Folder / upload mode: single-step game picker -->
        <template v-else>
          <h2 class="text-lg font-semibold">{{ $t('dialogs.pickAGame') }}</h2>
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input v-model="search" :placeholder="$t('dialogs.searchGames')" class="!pl-9" />
          </div>
          <div class="rounded-lg border border-border max-h-64 overflow-y-auto">
            <div v-if="loading" class="p-4 text-sm text-muted-foreground text-center">Loading...</div>
            <div v-else-if="!filtered.length" class="p-4 text-sm text-muted-foreground text-center">No games found.</div>
            <button
              v-for="name in filtered"
              :key="name"
              class="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left hover:bg-muted/50 border-t border-border first:border-t-0"
              @click="emit('pick', name)"
            >
              <Gamepad2 class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="truncate">{{ name }}</span>
            </button>
          </div>
          <div class="flex justify-end">
            <Button variant="ghost" size="sm" @click="emit('cancel')">{{ $t('common.cancel') }}</Button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

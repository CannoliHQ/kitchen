<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gameArtBlob, type GameRow } from '@/api/client'
import { coverColor } from '@/lib/coverColor'

const props = defineProps<{ tag: string; game: GameRow }>()

const artSrc = ref<string | null>(null)
const bg = computed(() => coverColor(props.game.displayName))

async function loadArt() {
  if (!props.game.hasArt) {
    artSrc.value = null
    return
  }
  try {
    const url = await gameArtBlob(props.tag, props.game.id)
    if (url) artSrc.value = url
  } catch {
    artSrc.value = null
  }
}

onMounted(loadArt)
watch(() => [props.game.id, props.game.hasArt], loadArt)
onBeforeUnmount(() => {
  if (artSrc.value) URL.revokeObjectURL(artSrc.value)
})
</script>

<template>
  <div
    class="relative rounded-lg overflow-hidden"
    style="aspect-ratio: 3 / 4"
    :style="artSrc ? undefined : { background: bg }"
  >
    <img
      v-if="artSrc"
      :src="artSrc"
      :alt="game.displayName"
      class="h-full w-full object-cover"
    />
    <div v-else class="absolute inset-0 flex items-end p-3">
      <span
        class="text-base font-extrabold text-white leading-tight break-words"
        style="text-shadow: 0 1px 4px rgba(0,0,0,0.45)"
      >{{ game.displayName }}</span>
    </div>
  </div>
</template>

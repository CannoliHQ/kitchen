<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gameArtBlob, type GameRow } from '@/api/client'
import { coverColor } from '@/lib/coverColor'

const props = defineProps<{ tag: string; game: GameRow }>()

const artSrc = ref<string | null>(null)
const bg = computed(() => coverColor(props.game.displayName))

function setArt(url: string | null) {
  if (artSrc.value) URL.revokeObjectURL(artSrc.value)
  artSrc.value = url
}

async function loadArt() {
  if (!props.game.hasArt) {
    setArt(null)
    return
  }
  try {
    setArt(await gameArtBlob(props.tag, props.game.id))
  } catch {
    setArt(null)
  }
}

onMounted(loadArt)
watch(() => [props.game.id, props.game.hasArt], loadArt)
onBeforeUnmount(() => {
  if (artSrc.value) URL.revokeObjectURL(artSrc.value)
})
</script>

<template>
  <div>
    <div
      style="aspect-ratio: 3 / 4"
      :style="artSrc ? undefined : { background: bg }"
    >
      <img
        v-if="artSrc"
        :src="artSrc"
        :alt="game.displayName"
        class="h-full w-full object-cover"
      />
    </div>
    <div class="flex h-[2.625rem] items-center justify-center px-2 text-center bg-card border-t border-white/5">
      <span class="line-clamp-2 text-xs font-bold leading-tight text-foreground">{{ game.displayName }}</span>
    </div>
  </div>
</template>

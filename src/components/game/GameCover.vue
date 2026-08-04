<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { apiPathBlob, type GameRow } from '@/api/client'
import { coverColor } from '@/lib/coverColor'

const props = defineProps<{ tag: string; game: GameRow }>()

const artSrc = ref<string | null>(null)
const bg = computed(() => coverColor(props.game.displayName))

function setArt(url: string | null) {
  if (artSrc.value) URL.revokeObjectURL(artSrc.value)
  artSrc.value = url
}

// Covers a ~200px card at 2x. Full-size art is a couple of MB each, which saturates the connection
// and stalls the main thread decoding it; the server serves a cached downscale at this width.
const THUMB_WIDTH = 400

async function loadArt() {
  const url = props.game.artUrl
  if (!props.game.hasArt || !url) {
    setArt(null)
    return
  }
  try {
    // artUrl already carries the cache-busting ?v= token, so this has to append rather than assume.
    const sep = url.includes('?') ? '&' : '?'
    setArt(await apiPathBlob(`${url}${sep}w=${THUMB_WIDTH}`))
  } catch {
    setArt(null)
  }
}

onMounted(loadArt)
watch(() => [props.game.id, props.game.hasArt, props.game.artUrl], loadArt)
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

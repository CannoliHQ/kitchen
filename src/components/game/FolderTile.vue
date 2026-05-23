<script setup lang="ts">
import { Folder } from 'lucide-vue-next'

defineProps<{ name: string }>()
</script>

<template>
  <div>
    <div
      style="aspect-ratio: 3 / 4"
      class="flex items-center justify-center border-2 border-dashed border-amber-500/50 bg-amber-950/30"
    >
      <Folder class="h-10 w-10 text-amber-500/70" />
    </div>
    <div class="flex h-[2.625rem] items-center justify-center px-2 text-center bg-card border-t border-white/5">
      <span class="line-clamp-2 text-xs font-bold leading-tight text-foreground">{{ name }}</span>
    </div>
  </div>
</template>

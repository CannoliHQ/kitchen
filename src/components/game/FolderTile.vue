<script setup lang="ts">
import { Folder } from 'lucide-vue-next'

defineProps<{ name: string }>()
</script>

<template>
  <div
    class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border bg-card"
  >
    <Folder class="h-5 w-5 text-accent shrink-0" />
    <span class="truncate text-sm font-semibold text-foreground" :title="name">{{ name }}</span>
  </div>
</template>

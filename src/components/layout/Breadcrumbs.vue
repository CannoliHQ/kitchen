<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { ChevronRight } from 'lucide-vue-next'

export interface Crumb {
  label: string
  to?: RouteLocationRaw
}

defineProps<{ items: Crumb[] }>()
</script>

<template>
  <nav class="flex items-center gap-2 text-lg min-w-0" aria-label="Breadcrumb">
    <template v-for="(item, i) in items" :key="i">
      <ChevronRight v-if="i > 0" class="h-4 w-4 shrink-0 text-muted-foreground/40" />
      <RouterLink
        v-if="item.to && i < items.length - 1"
        :to="item.to"
        class="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0"
      >{{ item.label }}</RouterLink>
      <span
        v-else
        class="text-foreground font-semibold truncate min-w-0"
        :aria-current="i === items.length - 1 ? 'page' : undefined"
      >{{ item.label }}</span>
    </template>
  </nav>
</template>

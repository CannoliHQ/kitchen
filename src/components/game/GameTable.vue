<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GameRow } from '@/api/client'

const props = defineProps<{ games: GameRow[] }>()
defineEmits<{ open: [id: number] }>()

type SortKey = 'title' | 'size' | 'saves' | 'states' | 'guides' | 'played'

const sortKey = ref<SortKey>('title')
const sortDir = ref<1 | -1>(1)

function setSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = (sortDir.value * -1) as 1 | -1
  } else {
    sortKey.value = key
    sortDir.value = 1
  }
}

const sorted = computed(() => {
  const arr = [...props.games]
  const d = sortDir.value
  arr.sort((a, b) => {
    let r = 0
    switch (sortKey.value) {
      case 'title': r = a.displayName.localeCompare(b.displayName); break
      case 'size': r = a.size - b.size; break
      case 'saves': r = a.savesCount - b.savesCount; break
      case 'states': r = a.statesCount - b.statesCount; break
      case 'guides': r = a.guidesCount - b.guidesCount; break
      case 'played': r = (a.lastPlayedAt ?? 0) - (b.lastPlayedAt ?? 0); break
    }
    return r * d
  })
  return arr
})

function formatSize(n: number) {
  if (n <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let u = 0
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++ }
  return `${v.toFixed(v >= 10 || u === 0 ? 0 : 1)} ${units[u]}`
}

function formatPlayed(ms: number | null) {
  if (!ms) return 'Never'
  const diff = Date.now() - ms
  const day = 86400000
  if (diff < day) return 'Today'
  if (diff < 2 * day) return 'Yesterday'
  const days = Math.floor(diff / day)
  if (days < 30) return `${days}d ago`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const columns: { key: SortKey; label: string; align: string }[] = [
  { key: 'title', label: 'Title', align: 'text-left' },
  { key: 'size', label: 'Size', align: 'text-right' },
  { key: 'saves', label: 'Saves', align: 'text-center' },
  { key: 'states', label: 'States', align: 'text-center' },
  { key: 'guides', label: 'Guides', align: 'text-center' },
  { key: 'played', label: 'Last Played', align: 'text-right' },
]
</script>

<template>
  <div class="rounded-xl border border-border overflow-hidden">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground/60 border-b border-border cursor-pointer select-none hover:text-foreground"
            :class="[col.align, col.key === 'size' || col.key === 'played' ? '' : '', col.key === 'saves' || col.key === 'states' || col.key === 'guides' ? 'w-20' : '']"
            @click="setSort(col.key)"
          >
            {{ col.label }}<span v-if="sortKey === col.key"> {{ sortDir === 1 ? '▴' : '▾' }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(g, idx) in sorted"
          :key="g.id"
          class="cursor-pointer hover:bg-muted/50"
          :class="idx % 2 === 1 ? 'bg-muted/20' : ''"
          @click="$emit('open', g.id)"
        >
          <td class="px-3 py-2.5 font-semibold text-foreground">{{ g.displayName }}</td>
          <td class="px-3 py-2.5 text-right text-foreground/80">{{ formatSize(g.size) }}</td>
          <td class="px-3 py-2.5 text-center" :class="g.savesCount ? 'text-foreground/80' : 'text-foreground/30'">{{ g.savesCount || '—' }}</td>
          <td class="px-3 py-2.5 text-center" :class="g.statesCount ? 'text-foreground/80' : 'text-foreground/30'">{{ g.statesCount || '—' }}</td>
          <td class="px-3 py-2.5 text-center" :class="g.guidesCount ? 'text-foreground/80' : 'text-foreground/30'">{{ g.guidesCount || '—' }}</td>
          <td class="px-3 py-2.5 text-right text-foreground/60">{{ formatPlayed(g.lastPlayedAt) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

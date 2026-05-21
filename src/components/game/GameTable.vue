<script setup lang="ts">
import type { GameRow } from '@/api/client'

defineProps<{
  games: GameRow[]
  sortKey: string
  sortDir: 1 | -1
}>()
defineEmits<{ open: [id: number]; sort: [key: string] }>()

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

const columns: { key: string; label: string; align: string }[] = [
  { key: 'title', label: 'Title', align: 'text-left' },
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
            :class="[col.align, col.key === 'saves' || col.key === 'states' || col.key === 'guides' ? 'w-20' : '']"
            @click="$emit('sort', col.key)"
          >
            {{ col.label }}<span v-if="sortKey === col.key"> {{ sortDir === 1 ? '▴' : '▾' }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(g, idx) in games"
          :key="g.id"
          class="cursor-pointer hover:bg-muted/50"
          :class="idx % 2 === 1 ? 'bg-muted/20' : ''"
          @click="$emit('open', g.id)"
        >
          <td class="px-3 py-2.5 font-semibold text-foreground">{{ g.displayName }}</td>
          <td class="px-3 py-2.5 text-center" :class="g.savesCount ? 'text-foreground/80' : 'text-foreground/30'">{{ g.savesCount || '—' }}</td>
          <td class="px-3 py-2.5 text-center" :class="g.statesCount ? 'text-foreground/80' : 'text-foreground/30'">{{ g.statesCount || '—' }}</td>
          <td class="px-3 py-2.5 text-center" :class="g.guidesCount ? 'text-foreground/80' : 'text-foreground/30'">{{ g.guidesCount || '—' }}</td>
          <td class="px-3 py-2.5 text-right text-foreground/60">{{ formatPlayed(g.lastPlayedAt) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Folder } from 'lucide-vue-next'
import type { GameRow } from '@/api/client'
import { folderLeaf } from '@/lib/folders'

defineProps<{
  games: GameRow[]
  sortKey: string
  sortDir: 1 | -1
  folders?: string[]
  selectMode?: boolean
  selectedGameIds?: Set<number>
  selectedFolderPaths?: Set<string>
}>()
const emit = defineEmits<{
  open: [id: number]
  sort: [key: string]
  'open-folder': [path: string]
  'toggle-game': [id: number]
  'toggle-folder': [path: string]
  'long-press-game': [id: number]
  'long-press-folder': [path: string]
}>()

const { t } = useI18n()

const LONG_PRESS_MS = 450
let pressTimer: number | null = null
let pressFired = false

function cancelPress() {
  if (pressTimer !== null) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}
function startPressGame(id: number) {
  cancelPress()
  pressTimer = window.setTimeout(() => {
    pressFired = true
    emit('long-press-game', id)
  }, LONG_PRESS_MS)
}
function startPressFolder(path: string) {
  cancelPress()
  pressTimer = window.setTimeout(() => {
    pressFired = true
    emit('long-press-folder', path)
  }, LONG_PRESS_MS)
}
function consumeFired(): boolean {
  if (pressFired) { pressFired = false; return true }
  return false
}

function formatPlayed(ms: number | null | undefined) {
  if (!ms) return t('platform.playedNever')
  const diff = Date.now() - ms
  const day = 86400000
  if (diff < day) return t('platform.playedToday')
  if (diff < 2 * day) return t('platform.playedYesterday')
  const days = Math.floor(diff / day)
  if (days < 30) return t('platform.playedDaysAgo', { days })
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const columns = computed<{ key: string; label: string; align: string }[]>(() => [
  { key: 'title', label: t('platform.colTitle'), align: 'text-left' },
  { key: 'saves', label: t('platform.colSaves'), align: 'text-center' },
  { key: 'states', label: t('platform.colStates'), align: 'text-center' },
  { key: 'guides', label: t('platform.colGuides'), align: 'text-center' },
  { key: 'played', label: t('platform.colLastPlayed'), align: 'text-right' },
])
</script>

<template>
  <div class="rounded-xl border border-border overflow-hidden">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th v-if="selectMode" class="w-10 px-3 py-2.5 border-b border-border" />
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
          v-for="folder in folders"
          :key="'folder:' + folder"
          class="cursor-pointer select-none"
          :class="selectMode && selectedFolderPaths?.has(folder) ? 'bg-accent/15' : 'hover:bg-muted/50'"
          @click="consumeFired() ? null : (selectMode ? emit('toggle-folder', folder) : emit('open-folder', folder))"
          @pointerdown="startPressFolder(folder)"
          @pointerup="cancelPress"
          @pointerleave="cancelPress"
          @pointercancel="cancelPress"
          @contextmenu.prevent
        >
          <td v-if="selectMode" class="px-3 py-2.5 text-center">
            <span class="inline-flex h-4 w-4 items-center justify-center rounded border-2 border-foreground/40" :class="selectedFolderPaths?.has(folder) ? 'bg-accent border-accent' : ''">
              <Check v-if="selectedFolderPaths?.has(folder)" class="h-3 w-3 text-accent-foreground" />
            </span>
          </td>
          <td class="px-3 py-2.5 font-semibold text-foreground">
            <span class="inline-flex items-center gap-2">
              <Folder class="h-4 w-4 text-accent/70 shrink-0" />
              {{ folderLeaf(folder) }}
            </span>
          </td>
          <td class="px-3 py-2.5 text-center text-foreground/30">-</td>
          <td class="px-3 py-2.5 text-center text-foreground/30">-</td>
          <td class="px-3 py-2.5 text-center text-foreground/30">-</td>
          <td class="px-3 py-2.5 text-right text-foreground/30">-</td>
        </tr>
        <tr
          v-for="(g, idx) in games"
          :key="g.id"
          class="cursor-pointer select-none"
          :class="selectMode && selectedGameIds?.has(g.id) ? 'bg-accent/15' : [idx % 2 === 1 ? 'bg-muted/20' : '', 'hover:bg-muted/50']"
          @click="consumeFired() ? null : (selectMode ? emit('toggle-game', g.id) : emit('open', g.id))"
          @pointerdown="startPressGame(g.id)"
          @pointerup="cancelPress"
          @pointerleave="cancelPress"
          @pointercancel="cancelPress"
          @contextmenu.prevent
        >
          <td v-if="selectMode" class="px-3 py-2.5 text-center">
            <span class="inline-flex h-4 w-4 items-center justify-center rounded border-2 border-foreground/40" :class="selectedGameIds?.has(g.id) ? 'bg-accent border-accent' : ''">
              <Check v-if="selectedGameIds?.has(g.id)" class="h-3 w-3 text-accent-foreground" />
            </span>
          </td>
          <td class="px-3 py-2.5 font-semibold text-foreground">{{ g.displayName }}</td>
          <td class="px-3 py-2.5 text-center" :class="g.savesCount ? 'text-foreground/80' : 'text-foreground/30'">{{ g.savesCount || '-' }}</td>
          <td class="px-3 py-2.5 text-center" :class="g.statesCount ? 'text-foreground/80' : 'text-foreground/30'">{{ g.statesCount || '-' }}</td>
          <td class="px-3 py-2.5 text-center" :class="g.guidesCount ? 'text-foreground/80' : 'text-foreground/30'">{{ g.guidesCount || '-' }}</td>
          <td class="px-3 py-2.5 text-right text-foreground/60">{{ formatPlayed(g.lastPlayedAt) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

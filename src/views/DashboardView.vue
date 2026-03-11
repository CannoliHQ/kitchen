<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getTags, clearCredentials } from '@/api/client'
import { platformName, platformLabel } from '@/api/platforms'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { Wallpaper, LogOut, Cpu, Search } from 'lucide-vue-next'

const router = useRouter()
const tags = ref<string[]>([])
const loading = ref(true)
const search = ref('')

const filteredTags = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return tags.value
  return tags.value.filter(tag =>
    tag.toLowerCase().includes(q) || platformLabel(tag).toLowerCase().includes(q),
  )
})

const FLAT_RESOURCES = [
  { key: 'bios', label: 'BIOS', icon: Cpu },
  { key: 'wallpapers', label: 'Wallpapers', icon: Wallpaper },
]

onMounted(async () => {
  try {
    tags.value = await getTags()
  } finally {
    loading.value = false
  }
})

function openPlatform(tag: string) {
  router.push({ name: 'platform', params: { tag } })
}

function browseFlat(resource: string) {
  router.push({ name: 'browse-flat', params: { resource } })
}

function disconnect() {
  clearCredentials()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="mx-auto w-[75%] p-4 space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <img src="/logo.png" alt="Cannoli" class="h-8 w-auto" />
        <h1 class="text-2xl font-bold tracking-tight">Nonna's Kitchen</h1>
      </div>
      <Button variant="ghost" size="sm" @click="disconnect">
        <LogOut class="h-4 w-4" />
        Disconnect
      </Button>
    </div>

    <!-- Flat resources -->
    <div class="grid grid-cols-2 gap-3">
      <Card
        v-for="res in FLAT_RESOURCES"
        :key="res.key"
        class="cursor-pointer hover:border-accent/60 transition-colors !p-4"
        @click="browseFlat(res.key)"
      >
        <div class="flex items-center gap-3">
          <component :is="res.icon" class="h-5 w-5 text-muted-foreground" />
          <span class="font-medium">{{ res.label }}</span>
        </div>
      </Card>
    </div>

    <!-- Platforms -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-muted-foreground">Platforms</h2>
        <div class="relative w-56">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input v-model="search" placeholder="Search platforms..." class="!pl-9 !h-9" />
        </div>
      </div>
      <p v-if="loading" class="text-sm text-muted-foreground">Loading...</p>
      <p v-else-if="!tags.length" class="text-sm text-muted-foreground">
        No platforms found. Add ROMs to get started.
      </p>
      <p v-else-if="!filteredTags.length" class="text-sm text-muted-foreground">
        No platforms match "{{ search }}".
      </p>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card
          v-for="tag in filteredTags"
          :key="tag"
          class="cursor-pointer hover:border-accent/60 transition-colors !p-6 flex items-center justify-center text-center"
          @click="openPlatform(tag)"
        >
          <span class="font-semibold text-lg">{{ platformName(tag) }}</span>
        </Card>
      </div>
    </div>
  </div>
</template>

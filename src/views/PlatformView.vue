<script setup lang="ts">
import { useRouter } from 'vue-router'
import { platformLabel } from '@/api/platforms'
import Button from '@/components/ui/Button.vue'
import { ArrowLeft, Gamepad2, Image, Save, Clock, BookOpen } from 'lucide-vue-next'

const props = defineProps<{ tag: string }>()
const router = useRouter()

const resources = [
  { key: 'roms', label: 'ROMs', icon: Gamepad2 },
  { key: 'art', label: 'Box Art', icon: Image },
  { key: 'saves', label: 'Saves', icon: Save },
  { key: 'states', label: 'Save States', icon: Clock },
  { key: 'guides', label: 'Guides', icon: BookOpen },
]
</script>

<template>
  <div class="mx-auto max-w-6xl p-6 space-y-8">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="router.push({ name: 'dashboard' })">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <h1 class="text-2xl font-bold tracking-tight">{{ platformLabel(props.tag) }}</h1>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <div
        v-for="res in resources"
        :key="res.key"
        class="group cursor-pointer rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-4 hover:border-accent/50 hover:shadow-md hover:shadow-accent/5"
        @click="router.push({ name: 'browse', params: { resource: res.key, tag: props.tag } })"
      >
        <div class="flex items-center justify-center h-14 w-14 rounded-xl bg-muted group-hover:bg-accent/10">
          <component :is="res.icon" class="h-7 w-7 text-muted-foreground group-hover:text-accent" />
        </div>
        <span class="font-semibold text-lg group-hover:text-accent">{{ res.label }}</span>
      </div>
    </div>
  </div>
</template>

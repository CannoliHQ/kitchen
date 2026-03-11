<script setup lang="ts">
import { useRouter } from 'vue-router'
import { platformLabel } from '@/api/platforms'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import { ArrowLeft, Gamepad2, Image, Save, HardDrive } from 'lucide-vue-next'

const props = defineProps<{ tag: string }>()
const router = useRouter()

const resources = [
  { key: 'roms', label: 'ROMs', icon: Gamepad2 },
  { key: 'art', label: 'Box Art', icon: Image },
  { key: 'saves', label: 'Saves', icon: Save },
  { key: 'states', label: 'Save States', icon: HardDrive },
]
</script>

<template>
  <div class="mx-auto max-w-3xl p-4 space-y-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="router.push({ name: 'dashboard' })">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <h1 class="text-xl font-bold tracking-tight">{{ platformLabel(props.tag) }}</h1>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <Card
        v-for="res in resources"
        :key="res.key"
        class="cursor-pointer hover:border-accent/60 transition-colors !p-6 flex items-center justify-center"
        @click="router.push({ name: 'browse', params: { resource: res.key, tag: props.tag } })"
      >
        <div class="flex flex-col items-center gap-3">
          <component :is="res.icon" class="h-8 w-8 text-muted-foreground" />
          <span class="font-semibold text-lg">{{ res.label }}</span>
        </div>
      </Card>
    </div>
  </div>
</template>

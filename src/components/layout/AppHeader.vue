<script setup lang="ts">
import { useRouter } from 'vue-router'
import { clearCredentials } from '@/api/client'
import Button from '@/components/ui/Button.vue'
import { LogOut } from 'lucide-vue-next'

const router = useRouter()

function disconnect() {
  clearCredentials()
  router.replace({ name: 'login' })
}

function goHome() {
  router.push({ name: 'dashboard' })
}
</script>

<template>
  <div class="flex items-center justify-between">
    <button
      type="button"
      class="flex items-center gap-3 rounded-lg cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      @click="goHome"
    >
      <img src="/logo.png" alt="Cannoli" class="h-9 w-auto" />
      <h1 class="text-2xl font-bold tracking-tight">Nonna's Kitchen</h1>
    </button>
    <Button variant="ghost" size="sm" @click="disconnect">
      <LogOut class="h-4 w-4" />
      Disconnect
    </Button>
  </div>
</template>

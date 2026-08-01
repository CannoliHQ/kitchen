<script setup lang="ts">
import { RouterView } from 'vue-router'
import ConfirmHost from '@/components/ui/ConfirmHost.vue'
</script>

<template>
  <div class="min-h-screen bg-background">
    <RouterView />
    <ConfirmHost />
  </div>
</template>

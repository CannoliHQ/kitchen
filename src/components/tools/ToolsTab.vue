<script setup lang="ts">
import { useRouter } from 'vue-router'
import { FolderOpen, PackagePlus } from 'lucide-vue-next'

const router = useRouter()

const tools = [
  { nameKey: 'tools.apkInstaller', icon: PackagePlus, route: { name: 'tools-apk' } },
  { nameKey: 'tools.fileManager', icon: FolderOpen, route: { name: 'tools-files' } },
]
</script>

<template>
  <div class="space-y-4 flex-1">
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
      <button
        v-for="tool in tools"
        :key="tool.nameKey"
        type="button"
        class="text-left rounded-xl border border-border bg-card p-5 transition-all duration-150 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background hover:shadow-md hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        @click="router.push(tool.route)"
      >
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-muted">
            <component :is="tool.icon" class="h-5 w-5 text-accent" />
          </div>
          <span class="font-semibold">{{ $t(tool.nameKey) }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/lib/utils'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  disabled?: boolean
}>(), {
  variant: 'default',
  size: 'default',
})

const classes = computed(() =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
    {
      'bg-primary text-primary-foreground hover:bg-primary/90': props.variant === 'default',
      'border border-border bg-transparent hover:bg-accent': props.variant === 'outline',
      'hover:bg-accent': props.variant === 'ghost',
      'bg-destructive text-foreground hover:bg-destructive/90': props.variant === 'destructive',
    },
    {
      'h-10 px-4 py-2': props.size === 'default',
      'h-8 px-3 text-xs': props.size === 'sm',
      'h-12 px-6': props.size === 'lg',
      'h-10 w-10': props.size === 'icon',
    },
  ),
)
</script>

<template>
  <button :class="classes" :disabled="disabled">
    <slot />
  </button>
</template>

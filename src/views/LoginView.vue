<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { setCredentials, getInfo } from '@/api/client'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'

const router = useRouter()
const route = useRoute()

const DEFAULT_PORT = '1091'

// Only auto-fill host when served from the device itself (port 1091)
const servedFromDevice = window.location.port === DEFAULT_PORT
const host = ref(servedFromDevice ? `${window.location.hostname}:${DEFAULT_PORT}` : '')
const digits = ref<string[]>(Array(6).fill(''))
const inputRefs = ref<HTMLInputElement[]>([])
const error = ref('')
const loading = ref(false)
const showHost = ref(!servedFromDevice)

function getHostParam(): string | null {
  // Check vue-router query (hash-based: /#/?host=...)
  const fromRoute = route.query.host as string | undefined
  if (fromRoute) return fromRoute
  // Also check top-level search params (?host=...#/)
  const fromSearch = new URLSearchParams(window.location.search).get('host')
  return fromSearch
}

onMounted(() => {
  const hostParam = getHostParam()
  if (hostParam) {
    host.value = hostParam.replace(/^https?:\/\//, '')
    showHost.value = false
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
  }

  nextTick(() => inputRefs.value[0]?.focus())
})

function setInputRef(el: unknown, i: number) {
  if (el instanceof HTMLInputElement) inputRefs.value[i] = el
}

async function connect() {
  const pin = digits.value.join('')
  if (pin.length < 6) return

  error.value = ''
  loading.value = true
  try {
    setCredentials(host.value, pin)
    await getInfo()
    router.push({ name: 'dashboard' })
  } catch {
    error.value = 'Could not connect. Check the address and PIN.'
    digits.value = Array(6).fill('')
    loading.value = false
    nextTick(() => inputRefs.value[0]?.focus())
  }
}

function onDigitInput(i: number, event: Event) {
  const input = event.target as HTMLInputElement
  const val = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()

  if (val.length > 1) {
    // Handle paste into a single cell
    const chars = val.slice(0, 6 - i).split('')
    chars.forEach((ch, offset) => {
      digits.value[i + offset] = ch
    })
    const next = Math.min(i + chars.length, 5)
    inputRefs.value[next]?.focus()
  } else {
    digits.value[i] = val
    if (val && i < 5) inputRefs.value[i + 1]?.focus()
  }

  if (digits.value.every(d => d)) connect()
}

function onDigitKeydown(i: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !digits.value[i] && i > 0) {
    digits.value[i - 1] = ''
    inputRefs.value[i - 1]?.focus()
  }
}

function onPaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = (event.clipboardData?.getData('text') ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const chars = text.slice(0, 6).split('')
  chars.forEach((ch, i) => { digits.value[i] = ch })
  const next = Math.min(chars.length, 5)
  inputRefs.value[next]?.focus()
  if (digits.value.every(d => d)) connect()
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <Card class="w-full max-w-sm space-y-6">
      <div class="space-y-3 text-center">
        <img src="/logo.png" alt="Cannoli" class="mx-auto h-16 w-auto" />
        <h1 class="text-2xl font-bold tracking-tight">Nonna's Kitchen</h1>
      </div>

      <div class="space-y-3">
        <div v-if="showHost" class="space-y-2">
          <label class="text-sm font-medium" for="host">Device address</label>
          <Input id="host" v-model="host" placeholder="IP:1091" />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-center block">Enter PIN shown on device</label>
          <div class="flex justify-center gap-2" @paste="onPaste">
            <input
                v-for="(_, i) in 6"
                :key="i"
                :ref="(el) => setInputRef(el, i)"
                type="text"
                inputmode="text"
                maxlength="2"
                :value="digits[i]"
                :disabled="loading"
                class="h-12 w-10 rounded-md border border-input bg-background text-center text-lg font-mono font-bold text-foreground uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                @input="onDigitInput(i, $event)"
                @keydown="onDigitKeydown(i, $event)"
            />
          </div>
        </div>

        <p v-if="error" class="text-sm text-destructive text-center">{{ error }}</p>
        <p v-if="loading" class="text-sm text-muted-foreground text-center">Connecting...</p>
      </div>
    </Card>
  </div>
</template>

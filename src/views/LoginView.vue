<script setup lang="ts">
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { setCredentials, setBaseUrlOnly, getInfo, clearCredentials, getAuthStatus } from '@/api/client'
import Card from '@/components/ui/Card.vue'

const router = useRouter()
const route = useRoute()

const DEFAULT_PORT = '1091'

const redirectTarget = (() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && r !== '/' ? r : null
})()

function proceed() {
  router.push(redirectTarget ?? { name: 'dashboard' })
}

const servedFromDevice = window.location.port === DEFAULT_PORT
const octets = ref<string[]>(servedFromDevice
  ? window.location.hostname.split('.')
  : ['', '', '', ''],
)
const digits = ref<string[]>(Array(6).fill(''))
const octetRefs = ref<HTMLInputElement[]>([])
const digitRefs = ref<HTMLInputElement[]>([])
const pinError = ref(false)
const connectionError = ref(false)
const loading = ref(false)
const checking = ref(true)
const showHost = ref(!servedFromDevice)
const pinRequired = ref(true)

const host = computed(() => {
  const ip = octets.value.join('.')
  return `${ip}:${DEFAULT_PORT}`
})

function getHostParam(): string | null {
  const fromRoute = route.query.host as string | undefined
  if (fromRoute) return fromRoute
  return new URLSearchParams(window.location.search).get('host')
}

function parseHostParam(raw: string) {
  const clean = raw.replace(/^https?:\/\//, '').replace(/:\d+$/, '')
  const parts = clean.split('.')
  if (parts.length === 4) {
    octets.value = parts
    showHost.value = false
  }
}

function getPinParam(): string | null {
  const fromRoute = route.query.pin as string | undefined
  if (fromRoute) return fromRoute
  return new URLSearchParams(window.location.search).get('pin')
}

onMounted(async () => {
  if (route.query.error === 'connection') {
    connectionError.value = true
    window.history.replaceState({}, '', window.location.pathname)
  }

  const hostParam = getHostParam()
  if (hostParam) {
    parseHostParam(hostParam)
  }

  const pinParam = getPinParam()
  if (pinParam) {
    const chars = pinParam.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6).split('')
    digits.value = [...chars, ...Array(6 - chars.length).fill('')]
  }

  // Clean query params from URL
  if (hostParam || pinParam) {
    window.history.replaceState({}, '', window.location.pathname)
  }

  const savedHost = localStorage.getItem('cannoli_host')
  const savedPin = localStorage.getItem('cannoli_pin')
  if (savedHost && !hostParam) {
    parseHostParam(savedHost)
  }

  if (await tryPinlessConnect()) return

  if (hostParam && pinParam && digits.value.join('').length === 6) {
    nextTick(() => connect(true))
    return
  }

  if (savedHost && savedPin && !hostParam && !pinParam) {
    const chars = savedPin.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6).split('')
    digits.value = [...chars, ...Array(6 - chars.length).fill('')]
    if (digits.value.join('').length === 6) {
      nextTick(() => connect(true))
      return
    }
  }

  checking.value = false
  nextTick(() => {
    if (showHost.value) {
      octetRefs.value[0]?.focus()
    } else {
      digitRefs.value[0]?.focus()
    }
  })
})

// --- Octet input handlers ---
function setOctetRef(el: unknown, i: number) {
  if (el instanceof HTMLInputElement) octetRefs.value[i] = el
}

function onOctetInput(i: number, event: Event) {
  const input = event.target as HTMLInputElement
  const val = input.value.replace(/[^0-9.]/g, '')

  // If user typed a dot, advance to next octet
  if (val.includes('.')) {
    const clean = val.replace(/\./g, '')
    octets.value[i] = clean
    if (i < 3) {
      nextTick(() => octetRefs.value[i + 1]?.focus())
    }
    return
  }

  octets.value[i] = val.slice(0, 3)

  // Auto-advance after 3 digits
  if (val.length >= 3 && i < 3) {
    nextTick(() => octetRefs.value[i + 1]?.focus())
  }

  // If last octet hits 3 digits, advance to PIN
  if (i === 3 && val.length >= 3 && octets.value.every(o => o)) {
    nextTick(() => digitRefs.value[0]?.focus())
  }
}

function onOctetKeydown(i: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !octets.value[i] && i > 0) {
    octetRefs.value[i - 1]?.focus()
  }
  if (event.key === '.' && i < 3) {
    event.preventDefault()
    nextTick(() => octetRefs.value[i + 1]?.focus())
  }
}

function onOctetPaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = (event.clipboardData?.getData('text') ?? '').replace(/^https?:\/\//, '').replace(/:\d+$/, '').trim()
  const parts = text.split('.')
  if (parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p))) {
    octets.value = parts
    nextTick(() => digitRefs.value[0]?.focus())
  }
}

// --- PIN digit handlers ---
function setDigitRef(el: unknown, i: number) {
  if (el instanceof HTMLInputElement) digitRefs.value[i] = el
}

async function connect(silent = false) {
  const pin = digits.value.join('')
  if (pin.length < 6) return

  connectionError.value = false
  loading.value = true
  try {
    setCredentials(host.value, pin)
    await getInfo()
    proceed()
  } catch (err) {
    clearCredentials()
    digits.value = Array(6).fill('')
    loading.value = false
    checking.value = false
    nextTick(() => digitRefs.value[0]?.focus())
    if (!silent && err instanceof Error) {
      if (err.message === 'Unauthorized') {
        pinError.value = true
        setTimeout(() => { pinError.value = false }, 600)
      } else if (err.message === 'ConnectionError') {
        connectionError.value = true
      }
    }
  }
}

async function tryPinlessConnect(): Promise<boolean> {
  if (!octets.value.every(o => o)) return false
  try {
    const status = await getAuthStatus(host.value)
    if (status.required) {
      pinRequired.value = true
      return false
    }
    pinRequired.value = false
    setBaseUrlOnly(host.value)
    proceed()
    return true
  } catch {
    return false
  }
}

watch(
  () => octets.value.join('.'),
  async (joined) => {
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(joined)) return
    if (await tryPinlessConnect()) return
    if (pinRequired.value) nextTick(() => digitRefs.value[0]?.focus())
  },
)

function onDigitInput(i: number, event: Event) {
  const input = event.target as HTMLInputElement
  const val = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()

  if (val.length > 1) {
    const chars = val.slice(0, 6 - i).split('')
    chars.forEach((ch, offset) => {
      digits.value[i + offset] = ch
    })
    const next = Math.min(i + chars.length, 5)
    digitRefs.value[next]?.focus()
  } else {
    digits.value[i] = val
    if (val && i < 5) digitRefs.value[i + 1]?.focus()
  }

  if (digits.value.every(d => d)) connect()
}

function onDigitKeydown(i: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !digits.value[i] && i > 0) {
    digits.value[i - 1] = ''
    digitRefs.value[i - 1]?.focus()
  }
}

function onDigitPaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = (event.clipboardData?.getData('text') ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const chars = text.slice(0, 6).split('')
  chars.forEach((ch, i) => { digits.value[i] = ch })
  const next = Math.min(chars.length, 5)
  digitRefs.value[next]?.focus()
  if (digits.value.every(d => d)) connect()
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <Card class="w-full max-w-sm space-y-6">
      <div class="space-y-3 text-center">
        <img src="/logo.png" alt="Cannoli" class="mx-auto h-16 w-auto" />
        <h1 class="text-2xl font-bold tracking-tight">Nonna's Kitchen</h1>
        <template v-if="!checking">
          <p v-if="showHost" class="text-lg font-semibold text-foreground">Enter your device IP.</p>
          <p v-else-if="pinRequired" class="text-lg font-semibold text-foreground">Please enter the PIN shown.</p>
          <p v-if="connectionError" class="text-sm font-medium text-destructive">Cannot connect to server.<br>Ensure Nonna's Kitchen is running.</p>
        </template>
      </div>

      <div v-if="!checking" class="space-y-5">
        <!-- IP Address -->
        <div v-if="showHost" class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center block">Device IP Address</label>
          <div class="flex items-center justify-center gap-1.5" @paste="onOctetPaste">
            <template v-for="(_, i) in 4" :key="i">
              <input
                :ref="(el) => setOctetRef(el, i)"
                type="text"
                inputmode="numeric"
                maxlength="3"
                :value="octets[i]"
                :disabled="loading"
                class="h-12 w-12 border border-input bg-background text-center text-lg font-mono font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                @input="onOctetInput(i, $event)"
                @keydown="onOctetKeydown(i, $event)"
              />
              <span v-if="i < 3" class="text-muted-foreground font-bold leading-none mb-1 select-none">.</span>
            </template>
          </div>
        </div>

        <!-- PIN -->
        <div v-if="pinRequired" class="space-y-2">
          <div class="flex justify-center gap-2" :class="{ 'animate-shake': pinError }" @paste="onDigitPaste">
            <input
              v-for="(_, i) in 6"
              :key="i"
              :ref="(el) => setDigitRef(el, i)"
              type="text"
              inputmode="text"
              maxlength="2"
              :value="digits[i]"
              :disabled="loading"
              class="h-12 w-12 border bg-background text-center text-lg font-mono font-bold text-foreground uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 transition-colors"
              :class="pinError ? 'border-destructive' : 'border-input'"
              @input="onDigitInput(i, $event)"
              @keydown="onDigitKeydown(i, $event)"
            />
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.animate-shake {
  animation: shake 0.4s ease-in-out;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
</style>

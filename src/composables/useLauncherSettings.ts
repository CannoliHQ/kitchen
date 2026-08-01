import { ref } from 'vue'
import { getSettings, DEFAULT_LAUNCHER_SETTINGS, type LauncherSettings } from '@/api/client'

const settings = ref<LauncherSettings>({ ...DEFAULT_LAUNCHER_SETTINGS })
let loaded = false

export function useLauncherSettings() {
  async function load() {
    if (loaded) return
    loaded = true
    try {
      settings.value = await getSettings()
    } catch {
      loaded = false
    }
  }
  return { settings, load }
}

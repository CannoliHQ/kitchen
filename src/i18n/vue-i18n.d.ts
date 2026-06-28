import 'vue'

// Global vue-i18n translator ($t) injected via globalInjection. Loosely typed for template use.
declare module 'vue' {
  interface ComponentCustomProperties {
    $t: (key: string, ...args: unknown[]) => string
  }
}

export {}

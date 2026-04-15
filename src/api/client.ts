import { ref } from 'vue'

export interface FileEntry {
  name: string
  type: 'file' | 'dir'
  size: number
}

export interface ListResponse {
  path: string
  entries: FileEntry[]
}

const token = ref('')
const baseUrl = ref('')
const authRequired = ref<boolean | null>(null)

let onUnauthorized: (() => void) | null = null
let onConnectionError: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

export function setConnectionErrorHandler(handler: () => void) {
  onConnectionError = handler
}

export function setCredentials(host: string, pin: string) {
  const bare = host.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const withPort = bare.includes(':') ? bare : `${bare}:1091`
  baseUrl.value = `http://${withPort}`
  token.value = pin ? btoa(`nonna:${pin}`) : ''
  localStorage.setItem('cannoli_host', host)
  if (pin) localStorage.setItem('cannoli_pin', pin)
  else localStorage.removeItem('cannoli_pin')
}

export function setBaseUrlOnly(host: string) {
  const bare = host.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const withPort = bare.includes(':') ? bare : `${bare}:1091`
  baseUrl.value = `http://${withPort}`
  token.value = ''
  localStorage.setItem('cannoli_host', host)
  localStorage.removeItem('cannoli_pin')
}

export function restoreCredentials(): boolean {
  const host = localStorage.getItem('cannoli_host')
  const pin = localStorage.getItem('cannoli_pin')
  if (host && pin) {
    setCredentials(host, pin)
    return true
  }
  return false
}

export interface AuthStatus {
  required: boolean
}

export async function getAuthStatus(host?: string): Promise<AuthStatus> {
  const target = host
    ? `http://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
    : baseUrl.value
  if (!target) throw new Error('ConnectionError')
  const res = await fetch(`${target}/api/auth`, { method: 'GET' })
  if (!res.ok) throw new Error('ConnectionError')
  const status = (await res.json()) as AuthStatus
  authRequired.value = status.required
  return status
}

export function getBaseUrl() {
  return baseUrl.value
}

export function isAuthenticated() {
  if (authRequired.value === false) return true
  return token.value !== ''
}

export function clearCredentials() {
  token.value = ''
  baseUrl.value = ''
  authRequired.value = null
  localStorage.removeItem('cannoli_pin')
}

function buildPath(resource: string, ...segments: (string | undefined)[]): string {
  const encoded = [resource, ...segments.filter(Boolean)].map(p => encodeURIComponent(p!))
  return `/api/${encoded.join('/')}`
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) }
    if (token.value) headers.Authorization = `Basic ${token.value}`
    res = await fetch(`${baseUrl.value}${path}`, {
      ...init,
      headers,
    })
  } catch {
    clearCredentials()
    onConnectionError?.()
    throw new Error('ConnectionError')
  }
  if (res.status === 401) {
    clearCredentials()
    onUnauthorized?.()
    throw new Error('Unauthorized')
  }
  return res
}

export async function getInfo() {
  const res = await request('/api/info')
  return res.json()
}

export async function getTags(): Promise<string[]> {
  const res = await request('/api/tags')
  const data = await res.json()
  return data.tags
}

export async function listFiles(resource: string, ...subpath: (string | undefined)[]): Promise<ListResponse> {
  const path = buildPath(resource, ...subpath)
  const res = await request(path)
  return res.json()
}

export async function listFilesRecursive(resource: string, ...subpath: (string | undefined)[]): Promise<ListResponse> {
  const path = buildPath(resource, ...subpath) + '?recursive=true'
  const res = await request(path)
  return res.json()
}

export async function createFolder(resource: string, ...subpath: (string | undefined)[]): Promise<{ ok: boolean }> {
  const path = buildPath(resource, ...subpath)
  const res = await request(path, { method: 'PUT' })
  return res.json()
}

export async function moveFile(resource: string, fromSegments: string[], to: string): Promise<{ ok: boolean }> {
  const path = buildPath(resource, ...fromSegments)
  const res = await request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to }),
  })
  return res.json()
}

export interface ArtEntry {
  name: string
  file: string
  size: number
}

export async function getArtworkIndex(tag: string): Promise<ArtEntry[]> {
  const path = `/api/artwork/${encodeURIComponent(tag)}`
  const res = await request(path)
  if (!res.ok) return []
  const data = await res.json()
  return data.art ?? []
}

export async function getArtworkBlob(tag: string, name: string): Promise<string | null> {
  const path = `/api/artwork/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`
  const res = await request(path)
  if (!res.ok) return null
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function deleteFile(resource: string, ...subpath: (string | undefined)[]): Promise<{ ok: boolean }> {
  const path = buildPath(resource, ...subpath)
  const res = await request(path, { method: 'DELETE' })
  return res.json()
}

export function uploadFiles(
  resource: string,
  subpath: string[],
  files: File[],
  onProgress?: (pct: number) => void,
): { promise: Promise<{ ok: boolean; files: string[] }>; abort: () => void } {
  const path = buildPath(resource, ...subpath)

  const formData = new FormData()
  for (const file of files) {
    formData.append('file', file, file.name)
  }

  const xhr = new XMLHttpRequest()

  const promise = new Promise<{ ok: boolean; files: string[] }>((resolve, reject) => {
    xhr.open('POST', `${baseUrl.value}${path}`)
    if (token.value) xhr.setRequestHeader('Authorization', `Basic ${token.value}`)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Upload failed')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))
    xhr.send(formData)
  })

  return { promise, abort: () => xhr.abort() }
}

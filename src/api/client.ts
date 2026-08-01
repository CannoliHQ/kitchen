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

export const DEFAULT_PORT = '1091'

/** Strip any scheme/trailing slash, ensure a port, and return an http base URL. */
function normalizeBaseUrl(host: string): string {
  const bare = host.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const withPort = bare.includes(':') ? bare : `${bare}:${DEFAULT_PORT}`
  return `http://${withPort}`
}

export function setCredentials(host: string, pin: string) {
  baseUrl.value = normalizeBaseUrl(host)
  token.value = pin ? btoa(`nonna:${pin}`) : ''
  localStorage.setItem('cannoli_host', host)
  localStorage.removeItem('cannoli_pinless')
  if (pin) localStorage.setItem('cannoli_pin', pin)
  else localStorage.removeItem('cannoli_pin')
}

export function setBaseUrlOnly(host: string) {
  baseUrl.value = normalizeBaseUrl(host)
  token.value = ''
  authRequired.value = false
  localStorage.setItem('cannoli_host', host)
  localStorage.setItem('cannoli_pinless', '1')
  localStorage.removeItem('cannoli_pin')
}

export function restoreCredentials(): boolean {
  const host = localStorage.getItem('cannoli_host')
  const pin = localStorage.getItem('cannoli_pin')
  if (host && pin) {
    setCredentials(host, pin)
    return true
  }
  if (host && localStorage.getItem('cannoli_pinless')) {
    setBaseUrlOnly(host)
    return true
  }
  return false
}

export interface AuthStatus {
  required: boolean
}

export async function getAuthStatus(host?: string): Promise<AuthStatus> {
  const target = host ? normalizeBaseUrl(host) : baseUrl.value
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
  localStorage.removeItem('cannoli_pinless')
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

export interface GameRow {
  id: number
  rom: string
  displayName: string
  sortKey: string
  path: string
  folder: string
  size: number
  modified: number
  hasArt: boolean
  artUrl?: string
  savesCount: number
  statesCount: number
  guidesCount: number
  cheatsCount: number
  raGameId?: number
  lastPlayedAt?: number
  multiDisc: boolean
}

export interface PlatformGames {
  platform: string
  displayName: string
  folders: string[]
  games: GameRow[]
}

export interface GameDetail extends GameRow {
  platform: string
  platformDisplayName: string
}

export async function getGames(tag: string): Promise<PlatformGames> {
  const res = await request(`/api/games/${encodeURIComponent(tag)}`)
  if (!res.ok) throw new Error(`getGames ${res.status}`)
  return res.json()
}

export async function getGame(tag: string, id: number): Promise<GameDetail> {
  const res = await request(`/api/games/${encodeURIComponent(tag)}/${id}`)
  if (!res.ok) throw new Error(`getGame ${res.status}`)
  return res.json()
}

function gameBase(tag: string, id: number): string {
  return `/api/games/${encodeURIComponent(tag)}/${id}`
}

export interface GameFile {
  name: string
  size: number
  modified: number
}

export interface GameRomFile {
  name: string
  path: string
  size: number
  modified: number
}

export async function gameArtBlob(tag: string, id: number): Promise<string | null> {
  const res = await request(`${gameBase(tag, id)}/art`)
  if (!res.ok) return null
  return URL.createObjectURL(await res.blob())
}

export async function resourceFileBlob(resource: string, tag: string, name: string): Promise<string | null> {
  const res = await request(buildPath(resource, tag, name))
  if (!res.ok) return null
  return URL.createObjectURL(await res.blob())
}

/** Fetch any browse-resource file as an authenticated blob. Caller must revoke the url. */
export async function fileBlob(resource: string, ...segments: string[]): Promise<{ url: string; type: string }> {
  const res = await request(buildPath(resource, ...segments))
  if (!res.ok) throw new Error(`fileBlob ${res.status}`)
  const blob = await res.blob()
  return { url: URL.createObjectURL(blob), type: blob.type }
}

export async function uploadGameArt(tag: string, id: number, file: File): Promise<void> {
  const res = await request(`${gameBase(tag, id)}/art?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    body: file,
  })
  if (!res.ok) throw new Error(`uploadGameArt ${res.status}`)
}

export async function deleteGameArt(tag: string, id: number): Promise<void> {
  const res = await request(`${gameBase(tag, id)}/art`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteGameArt ${res.status}`)
}

export async function listGameRoms(tag: string, id: number): Promise<GameRomFile[]> {
  const res = await request(`${gameBase(tag, id)}/roms`)
  if (!res.ok) throw new Error(`listGameRoms ${res.status}`)
  return (await res.json()).files
}

export async function downloadGameRomFile(tag: string, id: number, path: string, filename: string): Promise<void> {
  await downloadFile(`${gameBase(tag, id)}/rom?file=${encodeURIComponent(path)}`, filename)
}

export async function deleteGame(tag: string, id: number, purge: boolean): Promise<void> {
  const res = await request(`${gameBase(tag, id)}${purge ? '?purge=true' : ''}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteGame ${res.status}`)
}

export async function moveGame(tag: string, id: number, folder: string): Promise<void> {
  const res = await request(`${gameBase(tag, id)}/move?folder=${encodeURIComponent(folder)}`, { method: 'POST' })
  if (!res.ok) throw new Error(`moveGame ${res.status}`)
}

export async function renameGame(tag: string, id: number, name: string): Promise<void> {
  const res = await request(`${gameBase(tag, id)}/rename?name=${encodeURIComponent(name)}`, { method: 'POST' })
  if (!res.ok) throw new Error(`renameGame ${res.status}`)
}

export async function listGameSaves(tag: string, id: number): Promise<GameFile[]> {
  const res = await request(`${gameBase(tag, id)}/saves`)
  if (!res.ok) throw new Error(`listGameSaves ${res.status}`)
  return (await res.json()).files
}

export async function downloadGameSave(tag: string, id: number, name: string): Promise<void> {
  await downloadFile(`${gameBase(tag, id)}/saves?file=${encodeURIComponent(name)}`, name)
}

export async function uploadGameSave(tag: string, id: number, file: File): Promise<void> {
  const res = await request(`${gameBase(tag, id)}/saves?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    body: file,
  })
  if (!res.ok) throw new Error(`uploadGameSave ${res.status}`)
}

export async function deleteGameSave(tag: string, id: number, name: string): Promise<void> {
  const res = await request(`${gameBase(tag, id)}/saves?file=${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteGameSave ${res.status}`)
}

export async function listGameGuides(tag: string, id: number): Promise<GameFile[]> {
  const res = await request(`${gameBase(tag, id)}/guides`)
  if (!res.ok) throw new Error(`listGameGuides ${res.status}`)
  return (await res.json()).files
}

export async function downloadGameGuide(tag: string, id: number, name: string): Promise<void> {
  await downloadFile(`${gameBase(tag, id)}/guides?file=${encodeURIComponent(name)}`, name)
}

/** Fetch a guide as an authenticated blob. Caller must revoke the returned url. */
export async function gameGuideBlob(tag: string, id: number, name: string): Promise<{ url: string; type: string }> {
  const res = await request(`${gameBase(tag, id)}/guides?file=${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`gameGuideBlob ${res.status}`)
  const blob = await res.blob()
  return { url: URL.createObjectURL(blob), type: blob.type }
}

export async function uploadGameGuide(tag: string, id: number, file: File): Promise<void> {
  const res = await request(`${gameBase(tag, id)}/guides?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    body: file,
  })
  if (!res.ok) throw new Error(`uploadGameGuide ${res.status}`)
}

export async function deleteGameGuide(tag: string, id: number, name: string): Promise<void> {
  const res = await request(`${gameBase(tag, id)}/guides?file=${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteGameGuide ${res.status}`)
}

export async function listGameCheats(tag: string, id: number): Promise<GameFile[]> {
  const res = await request(`${gameBase(tag, id)}/cheats`)
  if (!res.ok) throw new Error(`listGameCheats ${res.status}`)
  return (await res.json()).files
}

export async function downloadGameCheat(tag: string, id: number, name: string): Promise<void> {
  await downloadFile(`${gameBase(tag, id)}/cheats?file=${encodeURIComponent(name)}`, name)
}

export async function uploadGameCheat(tag: string, id: number, file: File): Promise<void> {
  const res = await request(`${gameBase(tag, id)}/cheats?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    body: file,
  })
  if (!res.ok) throw new Error(`uploadGameCheat ${res.status}`)
}

export async function deleteGameCheat(tag: string, id: number, name: string): Promise<void> {
  const res = await request(`${gameBase(tag, id)}/cheats?file=${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteGameCheat ${res.status}`)
}

export async function listGameStates(tag: string, id: number): Promise<SlotList> {
  const res = await request(`${gameBase(tag, id)}/states`)
  if (!res.ok) throw new Error(`listGameStates ${res.status}`)
  return res.json()
}

export async function gameStateThumbnailBlob(tag: string, id: number, slot: number): Promise<string | null> {
  const res = await request(`${gameBase(tag, id)}/states/${slot}/thumbnail`)
  if (!res.ok) return null
  return URL.createObjectURL(await res.blob())
}

export async function uploadGameState(tag: string, id: number, slot: number, file: File): Promise<{ ok: boolean }> {
  const form = new FormData()
  form.append('file', file)
  const res = await request(`${gameBase(tag, id)}/states/${slot}`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`uploadGameState ${res.status}`)
  return res.json()
}

export async function deleteGameState(tag: string, id: number, slot: number): Promise<{ ok: boolean }> {
  const res = await request(`${gameBase(tag, id)}/states/${slot}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteGameState ${res.status}`)
  return res.json()
}

export async function downloadGameState(tag: string, id: number, slot: number, filename: string): Promise<void> {
  await downloadFile(`${gameBase(tag, id)}/states/${slot}`, filename)
}

export async function downloadGameStatesZip(tag: string, id: number, filename: string): Promise<void> {
  await downloadFile(`${gameBase(tag, id)}/states/zip`, filename)
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

export async function downloadToDisk(resource: string, segments: string[], filename: string): Promise<void> {
  await downloadFile(buildPath(resource, ...segments), filename)
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await request(path)
  if (!res.ok) throw new Error(`download ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export interface SlotInfo {
  slot: number
  label: string
  exists: boolean
  size: number
  modified: number
  thumbnail: boolean
}

export interface SlotList {
  game: string
  slots: SlotInfo[]
}

export async function deleteFile(resource: string, ...subpath: (string | undefined)[]): Promise<{ ok: boolean }> {
  const path = buildPath(resource, ...subpath)
  const res = await request(path, { method: 'DELETE' })
  return res.json()
}

export interface Volume {
  id: string
  label: string
  totalBytes: number
  freeBytes: number
}

export async function listVolumes(): Promise<Volume[]> {
  const res = await request('/api/fs')
  const data = await res.json()
  return data.volumes
}

export interface ApkStatus {
  status: 'pending_user' | 'success' | 'failure'
  message?: string
}

export function uploadApk(
  file: File,
  onProgress?: (pct: number) => void,
): { promise: Promise<{ ok: boolean; installId: string }>; abort: () => void } {
  return uploadFiles<{ ok: boolean; installId: string }>('apk', [], [file], onProgress)
}

export async function getApkStatus(installId: string): Promise<ApkStatus> {
  const res = await request(`/api/apk/${encodeURIComponent(installId)}`)
  return res.json()
}

export function uploadFiles<T = { ok: boolean; files: string[] }>(
  resource: string,
  subpath: string[],
  files: File[],
  onProgress?: (pct: number) => void,
): { promise: Promise<T>; abort: () => void } {
  const path = buildPath(resource, ...subpath)

  const formData = new FormData()
  for (const file of files) {
    formData.append('file', file, file.name)
  }

  const xhr = new XMLHttpRequest()

  const promise = new Promise<T>((resolve, reject) => {
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

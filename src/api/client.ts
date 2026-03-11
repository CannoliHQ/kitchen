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

export function setCredentials(host: string, pin: string) {
  const bare = host.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const withPort = bare.includes(':') ? bare : `${bare}:1091`
  baseUrl.value = `http://${withPort}`
  token.value = btoa(`nonna:${pin}`)
}

export function getBaseUrl() {
  return baseUrl.value
}

export function isAuthenticated() {
  return token.value !== ''
}

export function clearCredentials() {
  token.value = ''
  baseUrl.value = ''
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${baseUrl.value}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${token.value}`,
      ...init?.headers,
    },
  })
  if (res.status === 401) {
    clearCredentials()
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

export async function listFiles(resource: string, tag?: string): Promise<ListResponse> {
  const path = tag ? `/api/${resource}/${encodeURIComponent(tag)}` : `/api/${resource}`
  const res = await request(path)
  return res.json()
}

export async function uploadFiles(
  resource: string,
  tag: string | undefined,
  files: File[],
  onProgress?: (pct: number) => void,
): Promise<{ ok: boolean; files: string[] }> {
  const path = tag ? `/api/${resource}/${encodeURIComponent(tag)}` : `/api/${resource}`

  const formData = new FormData()
  for (const file of files) {
    formData.append('file', file, file.name)
  }

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${baseUrl.value}${path}`)
    xhr.setRequestHeader('Authorization', `Basic ${token.value}`)

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
    xhr.send(formData)
  })
}

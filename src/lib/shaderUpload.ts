import { fileExt } from './format'

export interface ShaderFile {
  /** Path relative to the picked folder's parent, e.g. "crt-cannoli/shaders/x.glsl". */
  path: string
  file: File
}

export interface ParsedShader {
  /** Top-level folder name — becomes the shader's directory under Shaders/. */
  shaderName: string
  /** Files with paths relative to the shader root (top folder stripped). */
  entries: ShaderFile[]
  /** Entry paths that are shader presets. */
  presets: string[]
}

const PRESET_EXTS = ['glslp']

function isHidden(path: string): boolean {
  return path.split('/').some(seg => seg.startsWith('.'))
}

/**
 * Parse a picked/dropped shader folder into a placeable structure.
 * Returns null if there are no usable files. `presets` is empty when no preset
 * file is present (the caller should block the upload in that case).
 */
export function parseShaderFolder(files: ShaderFile[]): ParsedShader | null {
  const clean = files.filter(f => !isHidden(f.path))
  if (!clean.length) return null

  const shaderName = clean[0]!.path.split('/')[0]!
  const entries: ShaderFile[] = clean.map(f => {
    const segs = f.path.split('/')
    return { path: segs.length > 1 ? segs.slice(1).join('/') : segs[0]!, file: f.file }
  })
  const presets = entries.filter(e => PRESET_EXTS.includes(fileExt(e.path))).map(e => e.path)
  return { shaderName, entries, presets }
}

/** Group entry paths by their containing subdirectory (relative to the shader root). */
export function groupBySubdir(entries: ShaderFile[]): Map<string, File[]> {
  const groups = new Map<string, File[]>()
  for (const e of entries) {
    const slash = e.path.lastIndexOf('/')
    const dir = slash >= 0 ? e.path.slice(0, slash) : ''
    if (!groups.has(dir)) groups.set(dir, [])
    groups.get(dir)!.push(e.file)
  }
  return groups
}

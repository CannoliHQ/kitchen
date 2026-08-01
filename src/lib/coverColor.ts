function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function coverHue(title: string): number {
  return hashString(title) % 360
}

export function coverColor(title: string): string {
  return `hsl(${coverHue(title)}, 44%, 42%)`
}

export function coverColorDark(title: string): string {
  return `hsl(${coverHue(title)}, 44%, 20%)`
}

/** Platform name lookup from Scorza's platforms.json */
export const PLATFORM_NAMES: Record<string, string> = {
  GB: 'Game Boy',
  GBC: 'Game Boy Color',
  GBA: 'Game Boy Advance',
  NES: 'Nintendo Entertainment System',
  FDS: 'Famicom Disk System',
  SNES: 'Super Nintendo Entertainment System',
  N64: 'Nintendo 64',
  NDS: 'Nintendo DS',
  GG: 'Game Gear',
  SMS: 'Master System',
  MD: 'Sega Genesis',
  SG1000: 'Sega SG-1000',
  '32X': 'Sega 32X',
  SEGACD: 'Sega CD',
  SATURN: 'Sega Saturn',
  PS: 'PlayStation',
  PSP: 'PSP',
  DC: 'Dreamcast',
  LYNX: 'Atari Lynx',
  JAGUAR: 'Atari Jaguar',
  ATARI2600: 'Atari 2600',
  ATARI5200: 'Atari 5200',
  ATARI7800: 'Atari 7800',
  PCE: 'PC Engine',
  PCFX: 'PC-FX',
  NGP: 'Neo Geo Pocket',
  NGPC: 'Neo Geo Pocket Color',
  WS: 'WonderSwan',
  WSC: 'WonderSwan Color',
  NEOGEO: 'Neo Geo',
  MAME: 'Arcade (MAME)',
  FBN: 'Arcade (FBNeo)',
  VIRTUALBOY: 'Virtual Boy',
  POKEMINI: 'Pokemon Mini',
  COLECOVISION: 'ColecoVision',
  VECTREX: 'Vectrex',
  INTELLIVISION: 'Intellivision',
  SUPERGRAFX: 'PC Engine SuperGrafx',
  DOS: 'DOS',
  SCUMMVM: 'ScummVM',
  AMIGA: 'Amiga',
  PS2: 'PlayStation 2',
  GC: 'GameCube',
  WII: 'Wii',
  '3DS': 'Nintendo 3DS',
  WIIU: 'Wii U',
  PSVITA: 'PS Vita',
  PS3: 'PlayStation 3',
  NSW: 'Nintendo Switch',
}

const PLATFORM_GROUPS: Record<string, string[]> = {
  Nintendo: ['NES', 'FDS', 'SNES', 'N64', 'GB', 'GBC', 'GBA', 'NDS', '3DS', 'VIRTUALBOY', 'POKEMINI', 'GC', 'WII', 'WIIU', 'NSW'],
  Sega: ['SMS', 'GG', 'MD', 'SG1000', '32X', 'SEGACD', 'SATURN', 'DC'],
  Sony: ['PS', 'PS2', 'PS3', 'PSP', 'PSVITA'],
  Atari: ['ATARI2600', 'ATARI5200', 'ATARI7800', 'LYNX', 'JAGUAR'],
  NEC: ['PCE', 'PCFX', 'SUPERGRAFX'],
  SNK: ['NEOGEO', 'NGP', 'NGPC'],
  Bandai: ['WS', 'WSC'],
  Arcade: ['MAME', 'FBN'],
  Computer: ['DOS', 'SCUMMVM', 'AMIGA'],
  Other: ['COLECOVISION', 'VECTREX', 'INTELLIVISION'],
}

/** All tags that belong to a known group */
const GROUPED_TAGS = new Set(Object.values(PLATFORM_GROUPS).flat())

export interface PlatformGroup {
  name: string
  tags: string[]
}

/** Group a list of active tags by manufacturer. Unknown tags go into "Other". Alphabetized within each group. */
export function groupPlatforms(tags: string[]): PlatformGroup[] {
  const groups: PlatformGroup[] = []
  const byName = (a: string, b: string) => platformName(a).localeCompare(platformName(b))

  for (const [name, groupTags] of Object.entries(PLATFORM_GROUPS)) {
    const matched = groupTags.filter(t => tags.includes(t)).sort(byName)
    if (matched.length) groups.push({ name, tags: matched })
  }

  // Any tags not in a known group
  const ungrouped = tags.filter(t => !GROUPED_TAGS.has(t)).sort(byName)
  if (ungrouped.length) groups.push({ name: 'Other', tags: ungrouped })

  return groups
}

/** Returns the path to a platform icon SVG, or undefined if unknown. */
export function platformIcon(tag: string): string | undefined {
  if (PLATFORM_NAMES[tag]) return `/platforms/${tag}.svg`
  return undefined
}

export function platformName(tag: string): string {
  return PLATFORM_NAMES[tag] ?? tag
}

export function platformLabel(tag: string): string {
  const name = PLATFORM_NAMES[tag]
  return name ? `${name} (${tag})` : tag
}

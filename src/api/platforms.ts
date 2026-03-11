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
  AMIGA500: 'Amiga 500',
  AMIGA1200: 'Amiga 1200',
  PS2: 'PlayStation 2',
  GC: 'GameCube',
  WII: 'Wii',
  '3DS': 'Nintendo 3DS',
  WIIU: 'Wii U',
  PSVITA: 'PS Vita',
  PS3: 'PlayStation 3',
  NSW: 'Nintendo Switch',
}

export function platformName(tag: string): string {
  return PLATFORM_NAMES[tag] ?? tag
}

export function platformLabel(tag: string): string {
  const name = PLATFORM_NAMES[tag]
  return name ? `${name} (${tag})` : tag
}

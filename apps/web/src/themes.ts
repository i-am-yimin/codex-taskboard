import {
  builtinThemeIds,
  canonicalTheme,
  themeColors,
  type Appearance,
  type ThemeManifestV1,
  type ThemePackage,
  type ThemeTokens,
} from '@taskboard/core';

export const themeInfo = {
  glass: { name: '玻璃', subtitle: '通透 · 轻盈 · 熟悉', layout: 'top', color: '#4267c8' },
  paper: { name: '极简', subtitle: '留白 · 秩序 · 专注', layout: 'top', color: '#3e5367' },
  studio: { name: '开发者', subtitle: '紧凑 · 精确 · 高效', layout: 'rail', color: '#7162cc' },
  island: { name: '自然岛屿', subtitle: '草木 · 温暖 · 松弛', layout: 'rail', color: '#3e7152' },
} as const;
type Builtin = (typeof builtinThemeIds)[number];
function colors(values: string): ThemeTokens {
  return Object.fromEntries(themeColors.map((key, i) => [key, values.split(' ')[i]]));
}
export const palettes: Record<Builtin, { light: ThemeTokens; dark: ThemeTokens }> = {
  glass: { light: {}, dark: {} },
  paper: {
    light: colors(
      '#f4f5f7 #202b36 #536170 #345775 #ffffff #ffffff #ffffff #f4f5f7 #dce1e7 #dce1e7 #e9edf2 #e7eef5 #ffffff',
    ),
    dark: colors(
      '#171a1f #edf0f4 #a7b1bd #b0cce5 #21252b #21252b #242a31 #191e24 #3b444f #3b444f #303a45 #2b3846 #172737',
    ),
  },
  studio: {
    light: colors(
      '#edf0f5 #252a3b #586075 #5645a6 #f7f8fc #f7f8fc #ffffff #eef0f7 #d5d9e4 #d5d9e4 #e7e4f4 #ebe7fa #ffffff',
    ),
    dark: colors(
      '#15151c #eeeef7 #afadc3 #c3b5ff #202028 #202028 #25252f #191920 #41414e #41414e #32303f #343047 #201936',
    ),
  },
  island: {
    light: colors(
      '#e5ecdb #3e4435 #5e6452 #386447 #fbf8ed #fbf8ed #fffdf5 #f2eedf #d8d7bf #d8d7bf #eeeeda #e2ecd8 #ffffff',
    ),
    dark: colors(
      '#1c2923 #f4edda #b9c5b3 #b8d8a5 #27372e #27372e #304035 #213027 #52624e #52624e #3c5040 #3a513e #203622',
    ),
  },
};
export async function identifyTheme(manifest: ThemeManifestV1): Promise<ThemePackage> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalTheme(manifest)),
  );
  return {
    id: Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, '0')).join(''),
    manifest,
  };
}
export function exportedBuiltin(id: Builtin): ThemeManifestV1 {
  return {
    formatVersion: 1,
    name: themeInfo[id].name,
    author: 'Taskboard',
    version: '1.0.0',
    base: id,
    layout: themeInfo[id].layout,
    ...palettes[id],
  };
}
export function applyAppearance(
  appearance: Appearance,
  packages: ThemePackage[],
  darkSystem: boolean,
) {
  const root = document.documentElement;
  const custom = packages.find((p) => p.id === appearance.themeId)?.manifest;
  const base: Builtin =
    custom?.base ??
    (builtinThemeIds.includes(appearance.themeId as Builtin)
      ? (appearance.themeId as Builtin)
      : 'glass');
  const mode = appearance.mode === 'system' ? (darkSystem ? 'dark' : 'light') : appearance.mode;
  root.dataset.theme = mode;
  root.dataset.style = base;
  root.dataset.layout =
    appearance.layout === 'auto' ? (custom?.layout ?? themeInfo[base].layout) : appearance.layout;
  const tokens = { ...palettes[base][mode], ...custom?.[mode] };
  for (const key of themeColors) {
    root.style.removeProperty(`--${key}`);
    const value = tokens[key];
    if (typeof value === 'string') root.style.setProperty(`--${key}`, value);
  }
  const radius = tokens.radius ?? { glass: 22, paper: 10, studio: 8, island: 24 }[base];
  root.style.setProperty('--radius', `${radius}px`);
  root.dataset.spacing = tokens.spacing ?? (base === 'studio' ? 'compact' : 'comfortable');
  root.dataset.shadow = tokens.shadow ?? (base === 'paper' || base === 'studio' ? 'none' : 'soft');
  root.dataset.font =
    tokens.font ?? (base === 'island' ? 'humanist' : base === 'studio' ? 'technical' : 'system');
}

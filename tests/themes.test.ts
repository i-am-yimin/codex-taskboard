import { describe, expect, it } from 'vitest';
import {
  canonicalTheme,
  parseThemeFile,
  appearanceSchema,
  type ThemeManifestV1,
} from '../packages/core/src/themes';
import { createHash } from 'node:crypto';
import { exportedBuiltin, identifyTheme } from '../apps/web/src/themes';

const sample: ThemeManifestV1 = {
  formatVersion: 1,
  name: '林间',
  author: 'Example',
  version: '1.0.0',
  base: 'island',
  layout: 'rail',
  light: { accent: '#386447', radius: 24 },
  dark: { accent: '#b8d8a5' },
};
describe('declarative theme packages', () => {
  it('roundtrips exports and produces the same browser/server digest regardless of key order', async () => {
    for (const id of ['glass', 'paper', 'studio', 'island'] as const) {
      const manifest = parseThemeFile(JSON.stringify(exportedBuiltin(id)));
      const browser = await identifyTheme(manifest);
      expect(browser.id).toBe(createHash('sha256').update(canonicalTheme(manifest)).digest('hex'));
    }
    const reversed = Object.fromEntries(Object.entries(sample).reverse());
    expect(canonicalTheme(parseThemeFile(JSON.stringify(reversed)))).toBe(canonicalTheme(sample));
  });
  it('rejects executable content, arbitrary CSS, invalid tokens, newer formats and oversized UTF-8 files', () => {
    for (const invalid of [
      { ...sample, script: 'alert(1)' },
      { ...sample, formatVersion: 2 },
      { ...sample, light: { accent: 'url(https://example.com)' } },
      { ...sample, light: { radius: 1000 } },
      { ...sample, dark: { position: 'fixed' } },
      { ...sample, light: { font: 'https://example.com/font.woff' } },
    ])
      expect(() => parseThemeFile(JSON.stringify(invalid))).toThrow();
    expect(() => parseThemeFile(' '.repeat(65537))).toThrow('64 KiB');
    expect(() => parseThemeFile('中'.repeat(23000))).toThrow('64 KiB');
  });
  it('does not accept arbitrary references or extra appearance keys', () => {
    expect(
      appearanceSchema.safeParse({ themeId: '../escape', mode: 'dark', layout: 'top' }).success,
    ).toBe(false);
    expect(
      appearanceSchema.safeParse({ themeId: 'island', mode: 'dark', layout: 'top', admin: true })
        .success,
    ).toBe(false);
  });
});

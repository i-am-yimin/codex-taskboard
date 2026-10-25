import { z } from 'zod';

export const builtinThemeIds = ['glass', 'paper', 'studio', 'island'] as const;
export const themeColors = [
  'canvas',
  'ink',
  'muted',
  'accent',
  'glass',
  'glass-solid',
  'card',
  'field',
  'edge',
  'divider',
  'hover',
  'tint',
  'on-accent',
] as const;
const color = z.string().regex(/^#[\da-fA-F]{6}$/);
export const themeTokensSchema = z
  .object({
    ...(Object.fromEntries(themeColors.map((key) => [key, color.optional()])) as Record<
      (typeof themeColors)[number],
      z.ZodOptional<typeof color>
    >),
    radius: z.number().int().min(4).max(28).optional(),
    spacing: z.enum(['comfortable', 'compact']).optional(),
    shadow: z.enum(['none', 'soft', 'lifted']).optional(),
    font: z.enum(['system', 'humanist', 'technical']).optional(),
  })
  .strict();
export const themeManifestSchema = z
  .object({
    formatVersion: z.literal(1),
    name: z.string().trim().min(1).max(60),
    author: z.string().trim().min(1).max(80),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .max(30),
    base: z.enum(builtinThemeIds),
    layout: z.enum(['top', 'rail']),
    light: themeTokensSchema,
    dark: themeTokensSchema,
  })
  .strict();
export type ThemeManifestV1 = z.infer<typeof themeManifestSchema>;
export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export const appearanceSchema = z
  .object({
    themeId: z.string().regex(/^(glass|paper|studio|island|[a-f0-9]{64})$/),
    mode: z.enum(['system', 'light', 'dark']),
    layout: z.enum(['auto', 'top', 'rail']),
  })
  .strict();
export type Appearance = z.infer<typeof appearanceSchema>;
export type AppearanceRecord = Appearance & { version: number };
export const appearanceRecordSchema = appearanceSchema.extend({
  version: z.number().int().positive(),
});
export const themePackageSchema = z
  .object({ id: z.string().regex(/^[a-f0-9]{64}$/), manifest: themeManifestSchema })
  .strict();
export type ThemePackage = { id: string; manifest: ThemeManifestV1 };
export const defaultAppearance: AppearanceRecord = {
  themeId: 'glass',
  mode: 'system',
  layout: 'auto',
  version: 1,
};
export const MAX_THEME_BYTES = 65536;

/** Fixed key ordering gives browser and server the same content identity. */
export function canonicalTheme(manifest: ThemeManifestV1): string {
  const sort = (value: unknown): unknown => {
    if (value && typeof value === 'object' && !Array.isArray(value))
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, item]) => [key, sort(item)]),
      );
    return value;
  };
  return JSON.stringify(sort(themeManifestSchema.parse(manifest)));
}
export function parseThemeFile(source: string): ThemeManifestV1 {
  if (new TextEncoder().encode(source).byteLength > MAX_THEME_BYTES)
    throw new Error('主题文件不能超过 64 KiB');
  return themeManifestSchema.parse(JSON.parse(source));
}

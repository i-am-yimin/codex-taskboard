import { z } from 'zod';

export const ACCOUNT_CENTER_PROTOCOL = 1;
export const ACCOUNT_CENTER_MIGRATION = '0010_account_center';
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const contactSchema = z
  .object({
    value: z.string().trim().max(100),
    visibility: z.enum(['private', 'members']).default('private'),
  })
  .strict();
export const contactsSchema = z
  .object({
    phone: contactSchema,
    wechat: contactSchema,
    qq: contactSchema,
  })
  .strict();
export const emptyContacts = () => ({
  phone: { value: '', visibility: 'private' as const },
  wechat: { value: '', visibility: 'private' as const },
  qq: { value: '', visibility: 'private' as const },
});
export const profileInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    contacts: contactsSchema,
  })
  .strict();
export type Contacts = z.infer<typeof contactsSchema>;
export interface AccountProfile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  avatarVersion: number;
  hasAvatar: boolean;
  version: number;
  contacts: Contacts;
}
export interface PublicProfile {
  id: string;
  name: string;
  avatarVersion: number;
  hasAvatar: boolean;
  contacts: Partial<Record<keyof Contacts, string>>;
}
export const accountPasswordSchema = z.string().min(12).max(256);
export const accountEmailSchema = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
export const smtpInputSchema = z
  .object({
    host: z.string().trim().min(1).max(253),
    port: z.number().int().min(1).max(65535),
    security: z.enum(['tls', 'starttls']),
    username: z.string().max(254),
    password: z.string().max(1024).optional(),
    clearPassword: z.boolean().optional(),
    fromAddress: accountEmailSchema,
    fromName: z.string().trim().max(80),
  })
  .strict();
export type SmtpInput = z.infer<typeof smtpInputSchema>;
export interface TakeoverGrant {
  id: string;
  spaceId: string;
  expiresAt: string;
}

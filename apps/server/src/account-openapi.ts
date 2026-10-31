import { z } from 'zod';
import {
  profileInputSchema,
  accountPasswordSchema,
  accountEmailSchema,
  smtpInputSchema,
} from '@taskboard/core';
const object = { type: 'object' };
const json = (schema: unknown) => ({ content: { 'application/json': { schema } } });
const securityPassword = z.object({ currentPassword: accountPasswordSchema }).strict();
function operation(
  path: string,
  method: string,
  description: string,
  schema?: z.ZodType,
  publicRoute = false,
  version = false,
) {
  const parameters: unknown[] = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    in: 'path',
    name: match[1],
    required: true,
    schema: { type: 'string', format: 'uuid' },
  }));
  if (method !== 'get' && !publicRoute)
    parameters.push({
      in: 'header',
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', maxLength: 200 },
    });
  if (version)
    parameters.push({
      in: 'header',
      name: 'If-Match',
      required: true,
      schema: { type: 'integer', minimum: 1 },
    });
  return {
    summary: description,
    description,
    security: publicRoute ? [] : [{ session: [] }],
    parameters,
    ...(schema
      ? { requestBody: { required: true, ...json(z.toJSONSchema(schema, { io: 'input' })) } }
      : {}),
    responses: {
      '200': json(object),
      '400': json(object),
      '403': json(object),
      '409': json(object),
      '422': json(object),
    },
  };
}
const routes: [string, string, string, z.ZodType?, boolean?, boolean?][] = [
  [
    '/me/profile',
    'get',
    'Read the current browser user private profile; never persist in offline caches.',
  ],
  [
    '/me/profile',
    'patch',
    'Update own name and contact visibility; returns saved/version only.',
    profileInputSchema,
    false,
    true,
  ],
  [
    '/me/avatar',
    'delete',
    'Remove own avatar with optimistic concurrency.',
    undefined,
    false,
    true,
  ],
  [
    '/users/{userId}/profile',
    'get',
    'Read only contacts visible to a current common-space member.',
  ],
  [
    '/me/password',
    'post',
    'Change own password; revoke other sessions and all Agent credentials.',
    securityPassword.extend({ newPassword: accountPasswordSchema }),
  ],
  [
    '/me/email/request',
    'post',
    'Queue single-use verification of current or new email. Expires in 30 minutes.',
    securityPassword.extend({ email: accountEmailSchema.optional() }),
  ],
  [
    '/auth/email/complete',
    'post',
    'Explicitly consume a single-use email verification token.',
    z.object({ token: z.string().min(20).max(200) }),
    true,
  ],
  [
    '/auth/recovery/request',
    'post',
    'Request password recovery; identical response for unknown and existing accounts.',
    z.object({ email: accountEmailSchema }),
    true,
  ],
  ['/devices/revoke-others', 'post', 'Revoke all other devices and sessions.'],
  [
    '/admin/users',
    'get',
    'Instance browser administrator: users, state and space memberships; excludes contacts.',
  ],
  [
    '/admin/users/{userId}',
    'patch',
    'Reauthenticate to govern an account. Preserve last administrator and transfer owned spaces before disabling.',
    securityPassword.extend({
      disabled: z.boolean().optional(),
      instanceAdmin: z.boolean().optional(),
      reason: z.string().min(1).max(500),
    }),
  ],
  [
    '/admin/users/{userId}/recovery',
    'post',
    'Reauthenticate and queue a recovery email.',
    securityPassword,
  ],
  ['/admin/invitations', 'get', 'List recent invitations without their tokens.'],
  [
    '/admin/invitations',
    'post',
    'Queue an email-bound invitation; space is optional.',
    z.object({
      email: accountEmailSchema,
      spaceId: z.uuid().nullable().optional(),
      role: z.enum(['admin', 'editor', 'viewer']).optional(),
    }),
  ],
  ['/admin/invitations/{invitationId}', 'delete', 'Revoke an unused invitation.'],
  [
    '/admin/invitations/{invitationId}/resend',
    'post',
    'Replace an unused invitation and queue a new email.',
  ],
  [
    '/admin/smtp',
    'get',
    'Read redacted SMTP configuration; environment configuration takes precedence.',
  ],
  [
    '/admin/smtp',
    'put',
    'Reauthenticate and save encrypted SMTP credentials.',
    smtpInputSchema.extend({ currentPassword: accountPasswordSchema }),
  ],
  [
    '/admin/smtp/test',
    'post',
    'Queue a test email to the current administrator.',
    securityPassword,
  ],
  [
    '/admin/mail',
    'get',
    'Read bounded mail status list; accepted means accepted by SMTP, not delivered.',
  ],
  [
    '/admin/mail/{mailId}/retry',
    'post',
    'Retry a failed encrypted mail. Expired links require a fresh application.',
  ],
  ['/admin/audit', 'get', 'Read persistent redacted governance audit entries.'],
  ['/admin/spaces', 'get', 'Read instance space governance metadata; content requires takeover.'],
  [
    '/admin/spaces/{spaceId}/takeover',
    'post',
    'Reauthenticate and grant this browser session 30 minutes of space administration without changing memberships.',
    securityPassword.extend({ reason: z.string().min(1).max(500) }),
  ],
  [
    '/admin/spaces/{spaceId}/takeover',
    'delete',
    'End this session space takeover and invalidate subscriptions.',
  ],
  [
    '/admin/spaces/{spaceId}/transfer-owner',
    'post',
    'Transfer to an active real member under an active takeover.',
    securityPassword.extend({ userId: z.uuid(), reason: z.string().min(1).max(500) }),
  ],
];
export const accountPaths: Record<string, Record<string, unknown>> = {};
for (const [path, method, description, schema, isPublic, version] of routes) {
  accountPaths[path] ??= {};
  accountPaths[path][method] = operation(path, method, description, schema, isPublic, version);
}
accountPaths['/admin/recovery'] = {
  post: {
    ...operation(
      '/admin/recovery',
      'post',
      'Retired: always returns EMAIL_RECOVERY_REQUIRED (409) for administrators. Use user recovery email or trusted server CLI; never returns a recovery link.',
    ),
    deprecated: true,
    responses: { '403': json(object), '409': json(object) },
  },
};
accountPaths['/me/avatar'].post = {
  ...operation(
    '/me/avatar',
    'post',
    'Upload static JPG/PNG/WebP <= 2 MiB, <= 16 million pixels. Server strips metadata and stores 256x256 WebP.',
    undefined,
    false,
    true,
  ),
  requestBody: {
    required: true,
    content: Object.fromEntries(
      ['image/jpeg', 'image/png', 'image/webp'].map((type) => [
        type,
        { schema: { type: 'string', format: 'binary' } },
      ]),
    ),
  },
};
accountPaths['/users/{userId}/avatar'] = {
  get: {
    ...operation(
      '/users/{userId}/avatar',
      'get',
      'Authenticated common-space avatar; no-store, image/webp binary.',
    ),
    responses: {
      '200': { content: { 'image/webp': { schema: { type: 'string', format: 'binary' } } } },
      '404': json(object),
    },
  },
};

/** Static OpenAPI supplement for clients; handlers remain the authorization authority. */
const error = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
      },
    },
  },
};
const writeHeaders = [
  {
    in: 'header',
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', maxLength: 200 },
  },
  {
    in: 'header',
    name: 'If-Match',
    required: false,
    schema: { type: 'integer', minimum: 1 },
  },
];
const json = (schema: object) => ({
  content: { 'application/json': { schema } },
});
export const openapiDocument = {
  openapi: '3.1.0',
  info: { title: 'Codex Taskboard API', version: 'v1' },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      session: { type: 'apiKey', in: 'cookie', name: 'tb_session' },
      deviceToken: { type: 'http', scheme: 'bearer' },
    },
    schemas: {
      Error: error,
      TaskInput: {
        type: 'object',
        required: ['title', 'statusId'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 240 },
          description: { type: 'string' },
          statusId: { type: 'string', format: 'uuid' },
          priority: { type: 'integer', minimum: 0, maximum: 3 },
          assigneeId: { type: ['string', 'null'], format: 'uuid' },
          labels: { type: 'array', items: { type: 'string' } },
          checklist: { type: 'array' },
          repository: { type: ['string', 'null'] },
          blocked: { type: 'boolean' },
          blockedReason: { type: 'string' },
          position: { type: 'number' },
        },
      },
    },
  },
  paths: {
    '/setup': {
      get: {
        description:
          'Reports whether browser initialization is required; never reveals the operator token.',
        responses: { '200': json({ type: 'object' }) },
      },
      post: {
        description:
          'Creates the first instance administrator using the operator token printed in server startup logs. Closes after initialization.',
        requestBody: json({
          type: 'object',
          required: ['token', 'name', 'email', 'password', 'publicOrigin'],
          properties: {
            token: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 12, maxLength: 256 },
            publicOrigin: { type: 'string', format: 'uri' },
          },
        }),
        responses: { '201': json({ type: 'object' }), '403': json(error), '409': json(error) },
      },
    },
    '/admin/instance': {
      get: {
        security: [{ session: [] }],
        responses: { '200': json({ type: 'object' }), '403': json(error) },
      },
      patch: {
        security: [{ session: [] }],
        parameters: [writeHeaders[0]],
        requestBody: json({
          type: 'object',
          required: ['publicOrigin', 'logLevel'],
          properties: {
            publicOrigin: { type: 'string', format: 'uri' },
            logLevel: { enum: ['debug', 'info', 'warn', 'error'] },
          },
        }),
        responses: { '200': json({ type: 'object' }), '403': json(error) },
      },
    },
    '/admin/account': {
      patch: {
        security: [{ session: [] }],
        parameters: [writeHeaders[0]],
        requestBody: json({
          type: 'object',
          required: ['name', 'email', 'currentPassword'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            currentPassword: { type: 'string', minLength: 12 },
            newPassword: { type: 'string', minLength: 12 },
          },
        }),
        responses: { '200': json({ type: 'object' }), '403': json(error) },
      },
    },
    '/admin/logs': {
      get: {
        security: [{ session: [] }],
        description:
          'Redacted application logs from the current process. Browser instance administrators only.',
        responses: { '200': json({ type: 'object' }), '403': json(error) },
      },
    },
    '/admin/secrets/reveal': {
      post: {
        security: [{ session: [] }],
        description:
          'Reauthenticate the browser instance administrator before revealing deployment secrets. Response is not cached or stored in idempotency records.',
        requestBody: json({
          type: 'object',
          required: ['currentPassword'],
          properties: { currentPassword: { type: 'string', minLength: 12 } },
        }),
        responses: { '200': json({ type: 'object' }), '403': json(error) },
      },
    },
    '/health': { get: { responses: { '200': json({ type: 'object' }) } } },
    '/auth/login': {
      post: {
        requestBody: json({
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 12 },
            deviceName: { type: 'string' },
            tokenKind: { enum: ['browser', 'agent'] },
          },
        }),
        responses: { '200': json({ type: 'object' }), '401': json(error) },
      },
    },
    '/devices': {
      get: {
        security: [{ session: [] }, { deviceToken: [] }],
        responses: { '200': json({ type: 'object' }) },
      },
    },
    '/devices/{deviceId}/revoke': {
      post: {
        security: [{ session: [] }, { deviceToken: [] }],
        parameters: [
          {
            in: 'path',
            name: 'deviceId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          writeHeaders[0],
        ],
        responses: { '200': json({ type: 'object' }), '404': json(error) },
      },
    },
    '/spaces': {
      get: {
        security: [{ session: [] }, { deviceToken: [] }],
        responses: { '200': json({ type: 'object' }), '401': json(error) },
      },
      post: {
        security: [{ session: [] }],
        parameters: writeHeaders,
        requestBody: json({
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            icon: { type: 'string' },
            color: { type: 'string' },
            description: { type: 'string' },
          },
        }),
        responses: { '201': json({ type: 'object' }), '409': json(error) },
      },
    },
    '/spaces/{spaceId}/tasks': {
      get: {
        security: [{ session: [] }, { deviceToken: [] }],
        parameters: [
          {
            in: 'path',
            name: 'spaceId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': json({ type: 'object' }) },
      },
      post: {
        security: [{ session: [] }, { deviceToken: [] }],
        parameters: [
          {
            in: 'path',
            name: 'spaceId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          ...writeHeaders,
        ],
        requestBody: json({ $ref: '#/components/schemas/TaskInput' }),
        responses: { '201': json({ type: 'object' }), '422': json(error) },
      },
    },
    '/tasks/{taskId}': {
      get: {
        security: [{ session: [] }, { deviceToken: [] }],
        responses: { '200': json({ type: 'object' }), '404': json(error) },
      },
      patch: {
        security: [{ session: [] }, { deviceToken: [] }],
        parameters: writeHeaders,
        requestBody: json({ $ref: '#/components/schemas/TaskInput' }),
        responses: { '200': json({ type: 'object' }), '409': json(error) },
      },
    },
    '/tasks/{taskId}/claim': {
      post: {
        security: [{ session: [] }, { deviceToken: [] }],
        parameters: writeHeaders,
        requestBody: json({
          type: 'object',
          properties: { threadId: { type: ['string', 'null'] } },
        }),
        responses: { '201': json({ type: 'object' }), '409': json(error) },
      },
    },
    '/tasks/{taskId}/submit': {
      post: {
        security: [{ session: [] }, { deviceToken: [] }],
        parameters: writeHeaders,
        requestBody: json({
          type: 'object',
          required: ['summary', 'verification'],
          properties: {
            summary: { type: 'string' },
            verification: { type: 'string' },
          },
        }),
        responses: { '200': json({ type: 'object' }), '409': json(error) },
      },
    },
    '/tasks/{taskId}/release': {
      post: {
        security: [{ session: [] }, { deviceToken: [] }],
        parameters: writeHeaders,
        requestBody: json({
          type: 'object',
          required: ['reason'],
          properties: { reason: { type: 'string', minLength: 1, maxLength: 2000 } },
        }),
        responses: { '200': json({ type: 'object' }), '409': json(error) },
      },
    },
    '/spaces/{spaceId}/statuses/reorder': {
      post: {
        security: [{ session: [] }],
        parameters: [
          {
            in: 'path',
            name: 'spaceId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          writeHeaders[0],
        ],
        requestBody: json({
          type: 'object',
          required: ['statusIds'],
          properties: {
            statusIds: {
              type: 'array',
              minItems: 1,
              maxItems: 100,
              items: { type: 'string', format: 'uuid' },
            },
          },
        }),
        responses: { '200': json({ type: 'object' }), '422': json(error) },
      },
    },
  },
} as const;

import { describe, it, expect } from 'vitest';
import { openapiDocument } from '../apps/server/src/openapi.ts';
import {
  collaborationPaths,
  collaborationSchemas,
} from '../apps/server/src/collaboration-openapi.ts';
describe('collaborative OpenAPI contract', () => {
  it('documents every relationship, human command, notification lease and runtime operation', () => {
    for (const path of [
      '/tasks/{taskId}/detail',
      '/tasks/{taskId}/children',
      '/tasks/{taskId}/participants/{userId}',
      '/tasks/{taskId}/dependencies/{dependencyId}',
      '/tasks/{taskId}/progress',
      '/tasks/{taskId}/accept',
      '/tasks/{taskId}/return',
      '/tasks/{taskId}/cancel',
      '/tasks/{taskId}/reopen',
      '/tasks/{taskId}/artifacts/{artifactId}',
      '/tasks/{taskId}/proposals/{proposalId}/confirm',
      '/me/tasks',
      '/me/saved-filters/{filterId}',
      '/me/notifications',
      '/me/notifications/{notificationId}/snooze',
      '/me/notifications/{notificationId}/delivery',
      '/me/notifications/{notificationId}/delivered',
      '/spaces/{spaceId}/automation-rules/{ruleId}',
      '/spaces/{spaceId}/workflow-metrics',
      '/tasks/{taskId}/runs',
      '/tasks/{taskId}/runs/{runId}/events',
      '/tasks/{taskId}/runs/{runId}/resolve',
    ])
      expect(collaborationPaths).toHaveProperty([path]);
    expect(JSON.stringify(collaborationSchemas.SubmitInput)).toContain('requirementsVersion');
    expect(JSON.stringify(collaborationSchemas.TaskRun)).toContain('permissionMode');
    expect(JSON.stringify(collaborationSchemas.TaskRun)).toContain('resolutionReason');
    expect(
      JSON.stringify(collaborationPaths['/me/notifications/{notificationId}/delivered']),
    ).toContain('deliveryToken');
    expect(JSON.stringify(collaborationPaths['/me/notifications'])).toContain('deliverable');
  });
  it('resolves all schema references and declares every placeholder as a required path parameter', () => {
    const allSchemas = Object.keys(openapiDocument.components.schemas);
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (
          key === '$ref' &&
          typeof child === 'string' &&
          child.startsWith('#/components/schemas/')
        )
          expect(allSchemas).toContain(child.split('/').at(-1));
        visit(child);
      }
    };
    visit(collaborationPaths);
    visit(collaborationSchemas);
    for (const [path, methods] of Object.entries(collaborationPaths))
      for (const operation of Object.values(methods)) {
        const parsed = operation as {
          parameters?: { in: string; name: string; required?: boolean }[];
        };
        for (const match of path.matchAll(/\{([^}]+)\}/g))
          expect(
            parsed.parameters?.some(
              (param) => param.in === 'path' && param.name === match[1] && param.required,
            ),
          ).toBe(true);
      }
  });
  it('keeps PATCH optional fields free of creation defaults and restricts artifact patches', () => {
    const schema = collaborationSchemas.TaskPatch as {
      properties: Record<string, { default?: unknown }>;
    };
    expect(schema.properties.reviewerId).not.toHaveProperty('default');
    const artifact = collaborationSchemas.ArtifactPatchInput as {
      properties: Record<string, unknown>;
    };
    expect(artifact.properties).not.toHaveProperty('executionId');
  });
});

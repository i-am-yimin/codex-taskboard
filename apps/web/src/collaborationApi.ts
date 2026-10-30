import type { z } from 'zod';
import { artifactSchema, participantSchema, proposalSchema } from '@taskboard/core';
import { request } from './api';

export const collaborationApi = {
  participant: (
    id: string,
    userId: string,
    body: z.input<typeof participantSchema>,
    version: number,
  ) => request(`/tasks/${id}/participants/${userId}`, { method: 'PUT', body, version }),
  removeParticipant: (id: string, userId: string, version: number) =>
    request(`/tasks/${id}/participants/${userId}`, { method: 'DELETE', version }),
  dependency: (id: string, dependencyId: string, version: number, remove = false) =>
    request(`/tasks/${id}/dependencies/${dependencyId}`, {
      method: remove ? 'DELETE' : 'PUT',
      body: {},
      version,
    }),
  command: (
    id: string,
    command: 'return' | 'cancel' | 'reopen' | 'progress' | 'accept' | 'submit' | 'release',
    body: unknown,
    version: number,
    idempotencyKey?: string,
  ) => request(`/tasks/${id}/${command}`, { method: 'POST', body, version, idempotencyKey }),
  proposal: (id: string, body: z.input<typeof proposalSchema>, version: number) =>
    request(`/tasks/${id}/proposals`, { method: 'POST', body, version }),
  resolveProposal: (
    id: string,
    proposalId: string,
    confirm: boolean,
    version: number,
    payload?: unknown,
  ) =>
    request(`/tasks/${id}/proposals/${proposalId}/${confirm ? 'confirm' : 'reject'}`, {
      method: 'POST',
      body: confirm && payload ? { payload } : {},
      version,
    }),
  artifact: (
    id: string,
    body: z.input<typeof artifactSchema>,
    version: number,
    artifactId?: string,
  ) =>
    request(`/tasks/${id}/artifacts${artifactId ? `/${artifactId}` : ''}`, {
      method: artifactId ? 'PATCH' : 'POST',
      body,
      version,
    }),
  removeArtifact: (id: string, artifactId: string, version: number) =>
    request(`/tasks/${id}/artifacts/${artifactId}`, { method: 'DELETE', version }),
};

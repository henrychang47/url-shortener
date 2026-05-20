import { apiPath } from './config';
import type { CreateLinkInput, ShortLink } from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(response: Response) {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? `Unexpected error (${response.status}). Please try again.`;
  } catch {
    return `Unexpected error (${response.status}). Please try again.`;
  }
}

async function ensureOk(response: Response) {
  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }
}

export async function createLink(input: CreateLinkInput): Promise<ShortLink> {
  const response = await fetch(apiPath('/links'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  await ensureOk(response);
  return (await response.json()) as ShortLink;
}

export async function fetchLinks(codes: string[]): Promise<ShortLink[]> {
  const params = new URLSearchParams(codes.map((code) => ['codes', code]));
  const query = params.toString();
  const response = await fetch(`${apiPath('/links')}${query ? `?${query}` : ''}`);
  await ensureOk(response);
  return (await response.json()) as ShortLink[];
}

export async function deleteLink(code: string): Promise<void> {
  const response = await fetch(apiPath(`/links/${code}`), { method: 'DELETE' });
  await ensureOk(response);
}

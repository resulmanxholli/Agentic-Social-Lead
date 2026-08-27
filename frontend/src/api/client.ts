import type { Keyword, Lead, StatusResponse } from './types';

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch('/status');
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

export async function getLeads(): Promise<Lead[]> {
  const res = await fetch('/leads');
  if (!res.ok) throw new Error(`Failed to load leads: ${res.status}`);
  return res.json();
}

// Wired to the real GET/POST /keywords routes.
export async function getKeywords(): Promise<Keyword[]> {
  const res = await fetch('/keywords');
  if (!res.ok) throw new Error(`Failed to load keywords: ${res.status}`);
  return res.json();
}

export async function addKeyword(input: {
  keyword: string;
  cron: string;
  targetUrls: string[];
}): Promise<Keyword> {
  const res = await fetch('/keywords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to add keyword: ${res.status}`);
  }
  return res.json();
}

// Wired to the real PATCH /keywords/:id route, which accepts any subset of
// these fields — the backend handles rescheduling (and cleaning up the old
// schedule on rename) internally.
export async function updateKeyword(
  id: string,
  updates: { keyword?: string; cron?: string; enabled?: boolean; targetUrls?: string[] },
): Promise<Keyword> {
  const res = await fetch(`/keywords/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to update keyword: ${res.status}`);
  }
  return res.json();
}

export async function setKeywordEnabled(id: string, enabled: boolean): Promise<Keyword> {
  return updateKeyword(id, { enabled });
}

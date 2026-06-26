const API = import.meta.env.VITE_API_URL || 'http://localhost:3100';
const TOKEN_KEY = 'vnu_composer_token';

export function getComposerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setComposerToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearComposerToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function composerLogin(username: string, password: string) {
  const res = await fetch(`${API}/api/auth/composer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  setComposerToken(data.token);
  return data;
}

export async function downloadBlob(path: string, filename: string) {
  const token = getComposerToken();
  const res = await fetch(`${API}/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export async function validatePackage(body: unknown, subjectCode?: string) {
  const token = getComposerToken();
  const res = await fetch(`${API}/api/composer/packages/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(subjectCode ? { ...(body as object), subjectCode } : body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ valid: boolean; errors: string[]; warnings: string[] }>;
}

export async function exportPackageSubject(body: unknown, subjectCode: string): Promise<string> {
  const token = getComposerToken();
  const res = await fetch(`${API}/api/composer/packages/export-by-subject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...(body as object), subjectCode }),
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { message?: string };
      throw new Error(j.message ?? text);
    } catch {
      throw new Error(text);
    }
  }
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `exam-${subjectCode.toLowerCase()}.zip`;
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  return filename;
}

export async function exportPackagesBySubject(body: unknown): Promise<number> {
  const token = getComposerToken();
  const res = await fetch(`${API}/api/composer/packages/export-by-subject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as {
    packageId: string;
    files: Array<{ subjectCode: string; filename: string; data: string }>;
  };
  for (const f of data.files) {
    const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = f.filename;
    a.click();
    await new Promise((r) => setTimeout(r, 300));
  }
  return data.files.length;
}

export async function exportPackage(body: unknown) {
  const token = getComposerToken();
  const res = await fetch(`${API}/api/composer/packages/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'exam-package.zip';
  a.click();
}

import type { ExamPackageExportState } from '@vnu/shared-types';
import { registerMediaFile } from './draft';

export async function uploadMedia(file: File): Promise<string> {
  const token = getComposerToken();
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API}/api/core/media/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) throw new Error('Upload thất bại');
  const data = await res.json();
  return data.path as string;
}

/** Upload server + đăng ký vào draft để bundle ZIP */
export async function uploadMediaForZip(draft: ExamPackageExportState, file: File): Promise<string> {
  await uploadMedia(file);
  return registerMediaFile(draft, file);
}


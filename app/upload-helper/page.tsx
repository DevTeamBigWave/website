'use client';

import { useState } from 'react';

export default function UploadHelperPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setUrl(null);
    setCopied(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/party-image', { method: 'POST', body: fd });
      const json = (await res.json()) as { url?: string; error?: string; detail?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? json.detail ?? `Upload failed (${res.status})`);
      }
      setUrl(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <header>
        <h1 className="font-display text-2xl text-slate-700">Photo upload helper</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick a photo, tap upload, then copy the link and paste it in chat.
        </p>
      </header>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setUrl(null);
          setError(null);
        }}
        className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm"
      />

      <button
        type="button"
        disabled={!file || uploading}
        onClick={onUpload}
        className="w-full rounded-full bg-coral px-6 py-4 text-base font-bold text-white shadow-playful disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : 'Upload'}
      </button>

      {error && (
        <div className="rounded-2xl border-2 border-coral-200 bg-coral-50 p-4 text-sm text-coral-700">
          {error}
        </div>
      )}

      {url && (
        <div className="space-y-3 rounded-2xl border-2 border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Uploaded ✓ — copy this link</p>
          <p className="break-all rounded-xl bg-white p-3 font-mono text-xs text-slate-700">{url}</p>
          <button
            type="button"
            onClick={onCopy}
            className="w-full rounded-full bg-sky-500 px-6 py-3 text-sm font-bold text-white"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      )}
    </main>
  );
}

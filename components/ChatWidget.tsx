'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const STORAGE_KEY = 'wp-chat-v1';
const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    "Hi! I'm the Wonderland Playhouse assistant. Ask me about parties, open play, memberships, gift cards, or anything else. What can I help with?",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore quota errors
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status, loading]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setStatus(null);

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.slice(0, -1).filter((m) => m.role !== 'assistant' || m.content),
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          try {
            const event = JSON.parse(line.slice(5).trim()) as
              | { type: 'text'; text: string }
              | { type: 'status'; status: string }
              | { type: 'done' }
              | { type: 'error'; message: string };

            if (event.type === 'text') {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                copy[copy.length - 1] = {
                  ...last,
                  content: last.content + event.text,
                };
                return copy;
              });
              setStatus(null);
            } else if (event.type === 'status') {
              setStatus(event.status);
            } else if (event.type === 'error') {
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: event.message,
                };
                return copy;
              });
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'assistant',
          content:
            'Sorry — connection error. Try again, or email info@wonderlandplayhouse.com.',
        };
        return copy;
      });
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }, [input, loading, messages]);

  const resetChat = () => {
    setMessages([GREETING]);
    setStatus(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-coral text-white shadow-playful transition hover:bg-coral-600 sm:bottom-6 sm:right-6 sm:h-16 sm:w-16"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Wonderland Playhouse chat"
          className="fixed inset-x-3 bottom-3 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-card sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[400px]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-cream px-4 py-3">
            <div>
              <p className="font-display text-base text-slate-700">
                Ask Wonderland
              </p>
              <p className="text-xs text-slate-500">
                AI assistant · ages, pricing, parties
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={resetChat}
                className="rounded-full px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-coral"
                aria-label="Start over"
              >
                Reset
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="rounded-full p-2 text-slate-500 transition hover:bg-white hover:text-coral"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === 'user'
                    ? 'ml-auto max-w-[85%] rounded-2xl bg-coral px-4 py-2.5 text-sm text-white'
                    : 'mr-auto max-w-[88%] rounded-2xl bg-cream-deep px-4 py-2.5 text-sm leading-relaxed text-slate-700'
                }
              >
                {m.content || (loading && i === messages.length - 1 ? '…' : '')}
              </div>
            ))}
            {status && (
              <p className="ml-2 text-xs italic text-slate-400">{status}</p>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-slate-100 bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={loading ? 'Wonderland is typing…' : 'Type a message'}
              disabled={loading}
              className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-coral focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { createBrowserClient } from '@supabase/ssr';

// Google Identity Services renders the Sign In With Google button and
// returns an ID token directly to our callback — no page redirects, no
// Supabase URL Configuration involved. The token is verified by Supabase
// via signInWithIdToken().
//
// Setup required in Google Cloud Console:
//   Authorized JavaScript origins for this OAuth Client must include
//   the production site URL (e.g. https://www.wonderlandplayhouse.com)

const GOOGLE_CLIENT_ID =
  '782668080864-7k411vdrqicqirju0vr8phkou4l44a8l.apps.googleusercontent.com';

type GoogleCredentialResponse = {
  credential: string;
  select_by?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: GoogleCredentialResponse) => void;
            ux_mode?: 'popup' | 'redirect';
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function GoogleSignInButton() {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);

  const handleCredential = async (resp: GoogleCredentialResponse) => {
    setPending(true);
    setError(null);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: resp.credential,
    });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    router.replace('/admin');
  };

  useEffect(() => {
    if (!ready) return;
    if (!window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
      ux_mode: 'popup',
      auto_select: false,
    });
    if (buttonRef.current) {
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: 320,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div className="space-y-3">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div ref={buttonRef} className="flex justify-center" />
      {pending && (
        <p className="text-center text-sm text-slate-500">Signing in…</p>
      )}
      {error && (
        <p className="text-center text-sm text-coral-700">{error}</p>
      )}
      {!ready && (
        <p className="text-center text-xs text-slate-400">
          Loading Google Sign-In…
        </p>
      )}
    </div>
  );
}

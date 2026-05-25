import React, { useEffect, useRef } from 'react';

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

let googleScriptPromise;

const loadGoogleScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google sign-in requires a browser environment'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-google-identity="true"]');

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.google), { once: true });
        existingScript.addEventListener(
          'error',
          () => reject(new Error('Could not load Google sign-in')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error('Could not load Google sign-in'));
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
};

export default function GoogleAuthButton({
  text = 'signin_with',
  disabled = false,
  onCredential,
  onError,
}) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!buttonRef.current || disabled) {
      return undefined;
    }

    if (!GOOGLE_CLIENT_ID) {
      return undefined;
    }

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) {
          return;
        }

        buttonRef.current.innerHTML = '';

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (!response?.credential) {
              onError?.('Google sign-in could not be completed. Please try again.');
              return;
            }

            onCredential?.(response.credential);
          },
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          text,
          shape: 'pill',
          size: 'large',
          width: Math.max(buttonRef.current.offsetWidth || 280, 240),
        });
      })
      .catch((err) => {
        if (!cancelled) {
          onError?.(err.message || 'Google sign-in is unavailable right now.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [disabled, onCredential, onError, text]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <button
        type="button"
        onClick={() =>
          onError?.('Google sign-in is not configured yet. Add VITE_GOOGLE_CLIENT_ID to enable it.')
        }
        disabled={disabled}
        className="w-full rounded-2xl border border-premium-lilac/30 bg-white py-3 text-sm font-semibold text-premium-purple-plum transition-all hover:bg-premium-lilac-light/40 disabled:opacity-60"
      >
        Continue with Google
      </button>
    );
  }

  return <div ref={buttonRef} className="min-h-[44px] w-full" />;
}

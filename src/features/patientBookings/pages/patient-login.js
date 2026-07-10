// Vanilla JS patient login.
// This is the missing piece that let patients back into their account
// without going through a doctor's /book/:token link again. It mirrors the
// auth step in public-booking.js but is standalone (no doctor context).

import { googleAuth, loginUser } from '../../../services/api';
import { setStoredAuthSession } from '../../../services/authStorage';

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
let googleScriptPromise;

function loadGoogleScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google sign-in requires a browser'));
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-identity="true"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.google), { once: true });
        existing.addEventListener('error', () => reject(new Error('Could not load Google sign-in')), { once: true });
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
}

function mountGoogleAuthButton(el, { onCredential, onError }) {
  if (!GOOGLE_CLIENT_ID) return;
  loadGoogleScript()
    .then(() => {
      if (!window.google?.accounts?.id) return;
      el.innerHTML = '';
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
      window.google.accounts.id.renderButton(el, {
        type: 'standard',
        theme: 'outline',
        text: 'signin_with',
        shape: 'pill',
        size: 'large',
        width: Math.max(el.offsetWidth || 280, 240),
      });
    })
    .catch((err) => onError?.(err.message || 'Google sign-in is unavailable right now.'));
}

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function mountPatientLogin(root, { onSignedIn } = {}) {
  if (!root) return () => {};

  const state = { loading: false, error: '', form: { email: '', password: '' } };

  root.innerHTML = `
    <div class="mx-auto max-w-sm px-4 py-16">
      <h1 class="font-display text-2xl font-bold text-premium-purple-plum">Sign in to your bookings</h1>
      <p class="mt-1 text-sm text-premium-purple-plum/60">Check on appointments you've already requested.</p>

      <form data-form="login" class="kura-card mt-6 px-5 py-5">
        <div class="pb-field"><input name="email" type="email" required class="premium-input" placeholder="Email address" /></div>
        <div class="pb-field mt-3"><input name="password" type="password" required class="premium-input" placeholder="Password" /></div>
        <p data-el="error" class="mt-3 text-xs font-semibold text-rose-600"></p>
        <button type="submit" data-el="submit" class="kura-primary-button mt-3 w-full rounded-xl py-3 text-sm">Sign in</button>
      </form>

      <div class="mt-4 text-center" data-el="google"></div>

      <p class="mt-6 text-center text-xs text-premium-purple-plum/45">
        Booked through a doctor's link before? Use that same link to request a new appointment — it'll sign you in automatically.
      </p>
    </div>
  `;

  const form = root.querySelector('[data-form="login"]');
  const errorEl = root.querySelector('[data-el="error"]');
  const submitBtn = root.querySelector('[data-el="submit"]');

  async function finalize(session) {
    if (session.user?.role !== 'patient') {
      throw new Error('This sign-in page is for patient accounts only.');
    }
    setStoredAuthSession(session);
    onSignedIn?.(session.user);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    state.loading = true;
    state.error = '';
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';
    try {
      const fd = new FormData(form);
      const session = await loginUser({ email: fd.get('email'), password: fd.get('password') });
      await finalize(session);
    } catch (err) {
      errorEl.textContent = err.message || 'Sign-in failed.';
    } finally {
      state.loading = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });

  mountGoogleAuthButton(root.querySelector('[data-el="google"]'), {
    onCredential: async (credential) => {
      try {
        const session = await googleAuth({ credential, role: 'patient' });
        await finalize(session);
      } catch (err) {
        errorEl.textContent = err.message || 'Google sign-in failed.';
      }
    },
    onError: (message) => {
      errorEl.textContent = message;
    },
  });

  return () => {};
}

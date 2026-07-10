// Vanilla JS public patient booking flow.
// Owns everything inside the PublicBookingPage container — see
// PublicBookingPage.jsx for the thin mount point. Nothing else was touched.
//
// Redesigned as a focused, one-question-per-screen wizard instead of one
// long scrolling page:
//   1. Doctor + reason for visit
//   2. Sign in / create account (single active form, not both at once)
//   3. Visit type + preferred time
//   4. Review, consent, submit (then redirect to payment if required)
//   5. Confirmation
//
// Booking history / notifications were intentionally moved out of this flow
// (agreed simplification) — they belong on their own "my bookings" screen so
// this page stays focused on completing one booking.

import {
  analyzeReasonForVisit,
  createPayment,
  createPublicBooking,
  getPatientProfile,
  getPublicBookingContext,
  googleAuth,
  loginUser,
  registerPatient,
  trackAiInteraction,
  updatePatientProfile,
  verifyPaymentReference,
} from '../../../services/api';
import { clearStoredAuthSession, getStoredUser, setStoredAuthSession } from '../../../services/authStorage';

const WHATSAPP_REGEX = /^\+?[0-9]{7,15}$/;

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const formatDoctorDisplayName = (fullName) => {
  if (!fullName) return 'Your doctor';
  const cleaned = String(fullName).trim().replace(/\s+/g, ' ');
  return /^dr\.?\s/i.test(cleaned) ? cleaned : `Dr. ${cleaned}`;
};

const initials = (name) =>
  String(name || 'Doctor')
    .replace(/^dr\.?\s*/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'DR';

const formatCurrency = (value, currency = 'NGN') => `${currency} ${Number(value || 0).toLocaleString()}`;

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

// Payment collection is not live yet on the backend (POST /payments isn't
// implemented). Flip this to true once Paystack is wired up server-side —
// nothing else in this file needs to change.
const PAYMENTS_ENABLED = false;

const STEPS = ['reason', 'account', 'time', 'review', 'confirmed'];
const STEP_LABELS = {
  reason: 'Reason for visit',
  account: 'Your details',
  time: 'Visit type & time',
  review: 'Review & confirm',
  confirmed: 'Confirmed',
};

export function mountPublicBookingPage(root, { token }) {
  if (!root) return () => {};

  const state = {
    loading: true,
    pageError: '',
    doctorContext: null,
    viewer: getStoredUser(),
    stepIndex: 0,
    authMode: 'login', // 'login' | 'register'
    authLoading: false,
    authError: '',
    authForm: { email: '', password: '' },
    registerForm: { full_name: '', email: '', whatsapp_number: '', password: '', confirmPassword: '' },
    patientProfile: null,
    whatsappForm: { whatsapp_number: '' },
    whatsappSaving: false,
    whatsappError: '',
    bookingForm: {
      reason: '',
      booking_date: '',
      consultation_service_id: '',
      consultation_fee_type: 'first_time',
    },
    consentForm: { patient_consent_given: false, emergency_acknowledged: false },
    aiLoading: false,
    aiError: '',
    aiSuggestion: '',
    bookingLoading: false,
    bookingError: '',
    confirmation: null,
    paymentLoading: false,
    paymentError: '',
  };

  let destroyed = false;

  root.innerHTML = `
    <div class="pb-root" style="max-width:560px;margin:0 auto">
      <div data-el="content"></div>
    </div>
    <style>
      .pb-progress { display:flex; align-items:center; gap:6px; margin-bottom:8px; }
      .pb-progress span { flex:1; height:4px; border-radius:2px; background:#DCD2EC; }
      .pb-progress span.done { background:#3C2B59; }
      .pb-field + .pb-field { margin-top:14px; }
      .pb-service-card { width:100%; text-align:left; border-radius:1rem; border:1px solid #DCD2EC66; padding:14px; min-width:0; }
      .pb-service-card + .pb-service-card { margin-top:8px; }
      .pb-service-card.active { border-color:#51406F; background:#EEE7F74d; }
    </style>
  `;

  const contentEl = root.querySelector('[data-el="content"]');

  // ---- data loading ------------------------------------------------------

  async function loadDoctorContext() {
    if (!token) {
      state.pageError = 'This booking link is missing or invalid.';
      state.loading = false;
      render();
      return;
    }
    state.loading = true;
    render();
    try {
      state.doctorContext = await getPublicBookingContext(token);
    } catch (err) {
      state.pageError = err.message || 'This booking link is invalid, expired, or unavailable.';
    } finally {
      state.loading = false;
      render();
    }
  }

  async function loadPatientProfileIfSignedIn() {
    const user = getStoredUser();
    if (!user || user.role !== 'patient') {
      state.patientProfile = null;
      return;
    }
    try {
      state.patientProfile = await getPatientProfile();
      state.whatsappForm.whatsapp_number = state.patientProfile?.whatsapp_number || state.patientProfile?.phone_number || '';
    } catch {
      // Non-fatal — the WhatsApp step will simply ask again if needed.
    }
  }

  // ---- derived -----------------------------------------------------------

  function getDoctor() {
    return state.doctorContext?.doctor || null;
  }

  function getAvailableServices() {
    const doctor = getDoctor();
    return Array.isArray(doctor?.consultation_services) ? doctor.consultation_services : [];
  }

  function getSelectedService() {
    return getAvailableServices().find((s) => s.id === state.bookingForm.consultation_service_id) || null;
  }

  function requiresFeeTypeChoice() {
    const service = getSelectedService();
    if (!service) return false;
    return Number(service.follow_up_price_amount || 0) > 0;
  }

  function getSelectedFee() {
    const doctor = getDoctor();
    const service = getSelectedService();
    if (service) {
      return state.bookingForm.consultation_fee_type === 'follow_up'
        ? Number(service.follow_up_price_amount || 0)
        : Number(service.first_time_price_amount ?? service.price_naira ?? 0);
    }
    return Number(doctor?.consultation_fee || 0);
  }

  function canCollectPaymentNow() {
    if (!PAYMENTS_ENABLED) return false;
    const service = getSelectedService();
    if (service?.requires_payment === false) return false;
    return getSelectedFee() > 0;
  }

  function patientSignedIn() {
    return state.viewer?.role === 'patient';
  }

  function patientWhatsapp() {
    return state.patientProfile?.whatsapp_number || state.patientProfile?.phone_number || '';
  }

  // ---- rendering: shell ----------------------------------------------------

  function render() {
    if (state.loading) {
      contentEl.innerHTML = `
        <div class="py-24 text-center">
          <div class="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-premium-purple-plum"></div>
          <p class="mt-4 text-sm text-premium-purple-plum/60">Loading booking details&hellip;</p>
        </div>`;
      return;
    }

    if (state.pageError) {
      contentEl.innerHTML = `
        <div class="kura-card px-6 py-10 text-center">
          <p class="font-display text-xl font-bold text-premium-purple-plum">This link isn't working</p>
          <p class="mt-2 text-sm text-premium-purple-plum/65">${escapeHtml(state.pageError)}</p>
        </div>`;
      return;
    }

    const step = STEPS[state.stepIndex];

    if (step === 'confirmed') {
      renderConfirmed();
      return;
    }

    const doctor = getDoctor();
    const doneCount = state.stepIndex;

    contentEl.innerHTML = `
      <div class="pb-progress">
        ${STEPS.slice(0, 4)
          .map((_, i) => `<span class="${i <= doneCount ? 'done' : ''}"></span>`)
          .join('')}
      </div>
      <p class="mb-5 text-xs font-semibold uppercase tracking-[0.1em] text-premium-purple-plum/45">Step ${state.stepIndex + 1} of 4 &middot; ${escapeHtml(STEP_LABELS[step])}</p>

      <div class="mb-5 flex items-center gap-3">
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-premium-royal text-xs font-semibold text-white">${escapeHtml(initials(doctor?.full_name))}</div>
        <div class="min-w-0">
          <p class="truncate font-bold text-premium-purple-plum">${escapeHtml(formatDoctorDisplayName(doctor?.full_name))}</p>
          <p class="truncate text-xs text-premium-purple-plum/55">${escapeHtml(doctor?.specialization || 'Private consultation')}</p>
        </div>
      </div>

      <div data-el="step" class="kura-card px-5 py-5"></div>
    `;

    const stepEl = contentEl.querySelector('[data-el="step"]');

    if (step === 'reason') renderReasonStep(stepEl);
    else if (step === 'account') renderAccountStep(stepEl);
    else if (step === 'time') renderTimeStep(stepEl);
    else if (step === 'review') renderReviewStep(stepEl);
  }

  // ---- step 1: reason for visit -------------------------------------------

  function renderReasonStep(el) {
    el.innerHTML = `
      <label class="kura-label">What brings you in today?</label>
      <textarea data-el="reason" rows="4" class="premium-input mt-2" placeholder="Describe your symptoms or reason for the visit">${escapeHtml(state.bookingForm.reason)}</textarea>
      ${state.aiError ? `<p class="mt-2 text-xs font-semibold text-rose-600">${escapeHtml(state.aiError)}</p>` : ''}
      <button type="button" data-action="ai-assist" class="mt-2 text-xs font-semibold text-premium-royal hover:underline" ${state.aiLoading ? 'disabled' : ''}>
        ${state.aiLoading ? 'Thinking&hellip;' : 'Help me describe this'}
      </button>
      ${
        state.aiSuggestion
          ? `
        <div class="mt-3 rounded-xl border border-premium-lilac/30 bg-premium-lilac-light/30 p-3">
          <p class="text-xs font-semibold text-premium-purple-plum/60">Suggested wording</p>
          <p class="mt-1 text-sm text-premium-purple-plum/80">${escapeHtml(state.aiSuggestion)}</p>
          <div class="mt-2 flex gap-2">
            <button type="button" data-action="ai-apply" class="kura-secondary-button rounded-lg px-3 py-1.5 text-xs">Use this</button>
            <button type="button" data-action="ai-dismiss" class="rounded-lg px-3 py-1.5 text-xs font-semibold text-premium-purple-plum/60">Dismiss</button>
          </div>
        </div>`
          : ''
      }
      <button type="button" data-action="next" class="kura-primary-button mt-6 w-full rounded-xl py-3 text-sm">Continue</button>
    `;

    el.querySelector('[data-el="reason"]').addEventListener('input', (e) => {
      state.bookingForm.reason = e.target.value;
    });

    el.querySelector('[data-action="ai-assist"]').addEventListener('click', () => handleAiAssist());
    el.querySelector('[data-action="ai-apply"]')?.addEventListener('click', () => {
      state.bookingForm.reason = state.aiSuggestion;
      state.aiSuggestion = '';
      trackAiInteraction({ feature: 'booking_summary', action: 'applied' }).catch(() => {});
      render();
    });
    el.querySelector('[data-action="ai-dismiss"]')?.addEventListener('click', () => {
      state.aiSuggestion = '';
      trackAiInteraction({ feature: 'booking_summary', action: 'ignored' }).catch(() => {});
      render();
    });
    el.querySelector('[data-action="next"]').addEventListener('click', () => {
      if (!state.bookingForm.reason.trim()) {
        state.bookingError = 'Please tell the doctor why you need this consultation.';
      }
      goToStep(1);
    });
  }

  async function handleAiAssist() {
    const input = state.bookingForm.reason.trim();
    if (!input) {
      state.aiError = 'Enter your reason for visit first.';
      render();
      return;
    }
    state.aiLoading = true;
    state.aiError = '';
    render();
    try {
      const result = await analyzeReasonForVisit({ input, previous_activity: [], regenerate_key: 0 });
      const parts = [
        result.symptoms?.length ? `Symptoms: ${result.symptoms.join(', ')}` : '',
        result.duration ? `Duration: ${result.duration}` : '',
        result.additional_notes || '',
      ].filter(Boolean);
      state.aiSuggestion = parts.join('. ') || input;
    } catch (err) {
      state.aiError = err.message || 'The AI helper is unavailable right now. You can continue manually.';
    } finally {
      state.aiLoading = false;
      render();
    }
  }

  // ---- step 2: account -----------------------------------------------------

  function renderAccountStep(el) {
    if (patientSignedIn() && !patientWhatsapp()) {
      renderWhatsappStep(el);
      return;
    }

    if (patientSignedIn()) {
      el.innerHTML = `
        <p class="text-sm text-premium-purple-plum/70">Signed in as <span class="font-semibold text-premium-purple-plum">${escapeHtml(state.viewer?.full_name || state.viewer?.email || 'patient')}</span></p>
        <button type="button" data-action="next" class="kura-primary-button mt-6 w-full rounded-xl py-3 text-sm">Continue</button>
        <button type="button" data-action="sign-out" class="mt-3 w-full text-xs font-semibold text-premium-purple-plum/50">Not you? Sign out</button>
      `;
      el.querySelector('[data-action="next"]').addEventListener('click', () => goToStep(2));
      el.querySelector('[data-action="sign-out"]').addEventListener('click', () => {
        clearStoredAuthSession();
        state.viewer = null;
        state.patientProfile = null;
        render();
      });
      return;
    }

    el.innerHTML = `
      <div class="flex gap-1 rounded-xl bg-premium-lilac-light/40 p-1">
        <button type="button" data-action="mode-login" class="flex-1 rounded-lg py-2 text-xs font-semibold ${state.authMode === 'login' ? 'bg-white text-premium-purple-plum shadow-premium-soft' : 'text-premium-purple-plum/55'}">Sign in</button>
        <button type="button" data-action="mode-register" class="flex-1 rounded-lg py-2 text-xs font-semibold ${state.authMode === 'register' ? 'bg-white text-premium-purple-plum shadow-premium-soft' : 'text-premium-purple-plum/55'}">Create account</button>
      </div>

      <div data-el="auth-form" class="mt-4"></div>

      ${state.authError ? `<p class="mt-3 text-xs font-semibold text-rose-600">${escapeHtml(state.authError)}</p>` : ''}

      <div class="mt-4 border-t border-premium-lilac/20 pt-4" data-el="google-auth"></div>
    `;

    renderAuthForm(el.querySelector('[data-el="auth-form"]'));
    mountGoogleAuthButton(el.querySelector('[data-el="google-auth"]'), {
      onCredential: (credential) => handleGoogleAuth(credential),
      onError: (message) => {
        state.authError = message;
        render();
      },
    });

    el.querySelector('[data-action="mode-login"]').addEventListener('click', () => {
      state.authMode = 'login';
      render();
    });
    el.querySelector('[data-action="mode-register"]').addEventListener('click', () => {
      state.authMode = 'register';
      render();
    });
  }

  function renderAuthForm(el) {
    if (state.authMode === 'login') {
      el.innerHTML = `
        <form data-form="login">
          <div class="pb-field"><input name="email" type="email" required class="premium-input" placeholder="Email address" value="${escapeHtml(state.authForm.email)}" /></div>
          <div class="pb-field"><input name="password" type="password" required class="premium-input" placeholder="Password" value="${escapeHtml(state.authForm.password)}" /></div>
          <button type="submit" class="kura-primary-button mt-4 w-full rounded-xl py-3 text-sm" ${state.authLoading ? 'disabled' : ''}>${state.authLoading ? 'Signing in&hellip;' : 'Sign in'}</button>
        </form>`;
      el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        handleLogin(fd.get('email'), fd.get('password'));
      });
      return;
    }

    el.innerHTML = `
      <form data-form="register">
        <div class="pb-field"><input name="full_name" required class="premium-input" placeholder="Full name" value="${escapeHtml(state.registerForm.full_name)}" /></div>
        <div class="pb-field"><input name="email" type="email" required class="premium-input" placeholder="Email address" value="${escapeHtml(state.registerForm.email)}" /></div>
        <div class="pb-field"><input name="whatsapp_number" required class="premium-input" placeholder="WhatsApp number, e.g. +2348012345678" value="${escapeHtml(state.registerForm.whatsapp_number)}" /></div>
        <div class="pb-field"><input name="password" type="password" required class="premium-input" placeholder="Password (min. 12 characters)" value="${escapeHtml(state.registerForm.password)}" /></div>
        <div class="pb-field"><input name="confirmPassword" type="password" required class="premium-input" placeholder="Confirm password" value="${escapeHtml(state.registerForm.confirmPassword)}" /></div>
        <button type="submit" class="kura-primary-button mt-4 w-full rounded-xl py-3 text-sm" ${state.authLoading ? 'disabled' : ''}>${state.authLoading ? 'Creating account&hellip;' : 'Create account'}</button>
      </form>`;
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      handleRegister({
        full_name: fd.get('full_name'),
        email: fd.get('email'),
        whatsapp_number: fd.get('whatsapp_number'),
        password: fd.get('password'),
        confirmPassword: fd.get('confirmPassword'),
      });
    });
  }

function mountGoogleAuthButton(el, { onCredential, onError }) {
  if (!GOOGLE_CLIENT_ID) {
    el.innerHTML = `<button type="button" data-el="google-fallback" class="w-full rounded-xl border border-premium-lilac/30 bg-white py-2.5 text-sm font-semibold text-premium-purple-plum">Continue with Google</button>`;
    el.querySelector('[data-el="google-fallback"]').addEventListener('click', () =>
      onError?.('Google sign-in is not configured yet. Add VITE_GOOGLE_CLIENT_ID to enable it.')
    );
    return;
  }

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

  async function handleLogin(email, password) {
    state.authLoading = true;
    state.authError = '';
    render();
    try {
      const session = await loginUser({ email, password });
      await finalizeAuthenticatedPatient(session);
    } catch (err) {
      state.authError = err.message || 'Sign-in failed.';
    } finally {
      state.authLoading = false;
      render();
    }
  }

  async function handleRegister(form) {
    state.authLoading = true;
    state.authError = '';
    render();
    try {
      if (!form.full_name.trim()) throw new Error('Full name is required');
      if (!WHATSAPP_REGEX.test(form.whatsapp_number.trim())) throw new Error('Enter a valid WhatsApp number in international format');
      if (form.password.length < 12) throw new Error('Use at least 12 characters for your password');
      if (form.password !== form.confirmPassword) throw new Error('Passwords do not match');

      await registerPatient({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        whatsapp_number: form.whatsapp_number.trim(),
      });
      const session = await loginUser({ email: form.email.trim(), password: form.password });
      await finalizeAuthenticatedPatient(session);
    } catch (err) {
      state.authError = err.message || 'Registration failed.';
    } finally {
      state.authLoading = false;
      render();
    }
  }

  async function handleGoogleAuth(credential) {
    state.authLoading = true;
    state.authError = '';
    render();
    try {
      const session = await googleAuth({ credential, role: 'patient' });
      await finalizeAuthenticatedPatient(session);
    } catch (err) {
      state.authError = err.message || 'Google sign-in failed.';
    } finally {
      state.authLoading = false;
      render();
    }
  }

  async function finalizeAuthenticatedPatient(session) {
    if (session.user?.role !== 'patient') {
      clearStoredAuthSession();
      throw new Error('Only patient accounts can book through this doctor link.');
    }
    setStoredAuthSession(session);
    state.viewer = session.user;
    await loadPatientProfileIfSignedIn();
    render();
  }

  function renderWhatsappStep(el) {
    el.innerHTML = `
      <p class="text-sm text-premium-purple-plum/70">We'll use WhatsApp to send appointment updates.</p>
      <div class="pb-field mt-3"><input data-el="whatsapp" class="premium-input" placeholder="WhatsApp number, e.g. +2348012345678" value="${escapeHtml(state.whatsappForm.whatsapp_number)}" /></div>
      ${state.whatsappError ? `<p class="mt-2 text-xs font-semibold text-rose-600">${escapeHtml(state.whatsappError)}</p>` : ''}
      <button type="button" data-action="save-whatsapp" class="kura-primary-button mt-4 w-full rounded-xl py-3 text-sm" ${state.whatsappSaving ? 'disabled' : ''}>${state.whatsappSaving ? 'Saving&hellip;' : 'Continue'}</button>
    `;
    el.querySelector('[data-action="save-whatsapp"]').addEventListener('click', async () => {
      const value = el.querySelector('[data-el="whatsapp"]').value.trim();
      if (!WHATSAPP_REGEX.test(value)) {
        state.whatsappError = 'Enter a valid WhatsApp number in international format.';
        render();
        return;
      }
      state.whatsappSaving = true;
      state.whatsappError = '';
      render();
      try {
        state.patientProfile = await updatePatientProfile({ whatsapp_number: value });
        goToStep(2);
      } catch (err) {
        state.whatsappError = err.message || 'Could not save your WhatsApp number.';
      } finally {
        state.whatsappSaving = false;
        render();
      }
    });
  }

  // ---- step 3: visit type + time --------------------------------------

  function renderTimeStep(el) {
    const services = getAvailableServices();
    const selected = getSelectedService();

    el.innerHTML = `
      ${
        services.length > 0
          ? `
        <p class="kura-label mb-2">Consultation type</p>
        <div data-el="services"></div>
      `
          : ''
      }

      ${
        selected && requiresFeeTypeChoice()
          ? `
        <p class="kura-label mb-2 mt-4">Visit type</p>
        <div class="flex gap-2">
          <button type="button" data-action="fee-first" class="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${state.bookingForm.consultation_fee_type === 'first_time' ? 'border-premium-purple-plum bg-premium-lilac-light/40' : 'border-premium-lilac/30'}">First visit</button>
          <button type="button" data-action="fee-followup" class="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${state.bookingForm.consultation_fee_type === 'follow_up' ? 'border-premium-purple-plum bg-premium-lilac-light/40' : 'border-premium-lilac/30'}">Follow-up</button>
        </div>
      `
          : ''
      }

      <p class="kura-label mb-2 mt-4">Preferred date and time</p>
      <input data-el="booking-date" type="datetime-local" class="premium-input" value="${escapeHtml(state.bookingForm.booking_date)}" min="${new Date().toISOString().slice(0, 16)}" />

      ${state.bookingError ? `<p class="mt-3 text-xs font-semibold text-rose-600">${escapeHtml(state.bookingError)}</p>` : ''}

      <button type="button" data-action="next" class="kura-primary-button mt-6 w-full rounded-xl py-3 text-sm">Continue</button>
    `;

    if (services.length > 0) {
      const servicesEl = el.querySelector('[data-el="services"]');
      servicesEl.innerHTML = services
        .map(
          (s) => `
        <button type="button" data-action="select-service" data-service-id="${s.id}" class="pb-service-card ${s.id === state.bookingForm.consultation_service_id ? 'active' : ''}">
          <p class="font-semibold text-premium-purple-plum">${escapeHtml(s.display_name || s.service_type)}</p>
          <p class="mt-0.5 text-xs text-premium-purple-plum/55">${escapeHtml(formatCurrency(s.first_time_price_amount ?? s.price_naira, getDoctor()?.currency))}</p>
        </button>`
        )
        .join('');
      servicesEl.querySelectorAll('[data-action="select-service"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const service = services.find((s) => s.id === btn.dataset.serviceId);
          state.bookingForm.consultation_service_id = service.id;
          state.bookingForm.consultation_fee_type = Number(service.follow_up_price_amount || 0) > 0 ? state.bookingForm.consultation_fee_type : 'first_time';
          render();
        });
      });
    }

    el.querySelector('[data-action="fee-first"]')?.addEventListener('click', () => {
      state.bookingForm.consultation_fee_type = 'first_time';
      render();
    });
    el.querySelector('[data-action="fee-followup"]')?.addEventListener('click', () => {
      state.bookingForm.consultation_fee_type = 'follow_up';
      render();
    });

    el.querySelector('[data-el="booking-date"]').addEventListener('change', (e) => {
      state.bookingForm.booking_date = e.target.value;
    });

    el.querySelector('[data-action="next"]').addEventListener('click', () => {
      if (services.length > 0 && !state.bookingForm.consultation_service_id) {
        state.bookingError = 'Please select a consultation type.';
        render();
        return;
      }
      if (!state.bookingForm.booking_date) {
        state.bookingError = 'Please choose your preferred appointment time.';
        render();
        return;
      }
      state.bookingError = '';
      goToStep(3);
    });
  }

  // ---- step 4: review + consent + submit ------------------------------

  function renderReviewStep(el) {
    const service = getSelectedService();
    const fee = getSelectedFee();

    el.innerHTML = `
      <div class="rounded-xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-3">
        <p class="text-sm text-premium-purple-plum/80">${escapeHtml(state.bookingForm.reason)}</p>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p class="text-xs text-premium-purple-plum/50">Visit type</p>
          <p class="font-semibold text-premium-purple-plum">${escapeHtml(service?.display_name || 'Consultation')}</p>
        </div>
        <div>
          <p class="text-xs text-premium-purple-plum/50">Time</p>
          <p class="font-semibold text-premium-purple-plum">${escapeHtml(new Date(state.bookingForm.booking_date).toLocaleString())}</p>
        </div>
        <div class="col-span-2">
          <p class="text-xs text-premium-purple-plum/50">Consultation fee</p>
          <p class="font-semibold text-premium-purple-plum">${fee > 0 ? escapeHtml(formatCurrency(fee, getDoctor()?.currency)) : 'To be confirmed by the clinic'}</p>
          ${!PAYMENTS_ENABLED && fee > 0 ? '<p class="mt-1 text-xs text-premium-purple-plum/45">Online payment isn\'t available yet — the clinic will arrange payment with you directly.</p>' : ''}
        </div>
      </div>

      <label class="mt-4 flex items-start gap-2 text-xs text-premium-purple-plum/70">
        <input data-el="consent" type="checkbox" ${state.consentForm.patient_consent_given ? 'checked' : ''} />
        <span>I consent to sharing my health information with this doctor for this consultation.</span>
      </label>
      <label class="mt-2 flex items-start gap-2 text-xs text-premium-purple-plum/70">
        <input data-el="emergency" type="checkbox" ${state.consentForm.emergency_acknowledged ? 'checked' : ''} />
        <span>I understand this is not for medical emergencies. I will call emergency services if needed.</span>
      </label>

      ${state.bookingError ? `<p class="mt-3 text-xs font-semibold text-rose-600">${escapeHtml(state.bookingError)}</p>` : ''}

      <button type="button" data-action="submit" class="kura-primary-button mt-5 w-full rounded-xl py-3 text-sm" ${state.bookingLoading ? 'disabled' : ''}>
        ${state.bookingLoading ? 'Sending request&hellip;' : 'Send appointment request'}
      </button>
    `;

    el.querySelector('[data-el="consent"]').addEventListener('change', (e) => {
      state.consentForm.patient_consent_given = e.target.checked;
    });
    el.querySelector('[data-el="emergency"]').addEventListener('change', (e) => {
      state.consentForm.emergency_acknowledged = e.target.checked;
    });
    el.querySelector('[data-action="submit"]').addEventListener('click', handleBookingSubmit);
  }

  async function handleBookingSubmit() {
    state.bookingError = '';
    if (!state.consentForm.patient_consent_given || !state.consentForm.emergency_acknowledged) {
      state.bookingError = 'Please review and tick both acknowledgements before submitting.';
      render();
      return;
    }

    state.bookingLoading = true;
    render();

    try {
      const service = getSelectedService();
      const visitLabel = service?.display_name || 'Consultation';
      const trimmedReason = state.bookingForm.reason.trim();

      const booking = await createPublicBooking(token, {
        booking_date: new Date(state.bookingForm.booking_date).toISOString(),
        reason: trimmedReason ? `${visitLabel}: ${trimmedReason}` : visitLabel,
        consultation_service_id: service?.id,
        consultation_type: service?.service_type,
        consultation_fee_type: service ? state.bookingForm.consultation_fee_type : undefined,
        patient_consent_given: state.consentForm.patient_consent_given,
        emergency_acknowledged: state.consentForm.emergency_acknowledged,
      });

      state.confirmation = booking;

      if (booking?.payment_required !== false && canCollectPaymentNow() && booking?.id) {
        await startPaymentFlow(booking.id);
        return; // startPaymentFlow redirects the browser away on success
      }

      goToStep(4);
    } catch (err) {
      state.bookingError = err.message || 'Could not create booking.';
    } finally {
      state.bookingLoading = false;
      render();
    }
  }

  async function startPaymentFlow(bookingId) {
    state.paymentLoading = true;
    state.paymentError = '';
    render();
    try {
      const payment = await createPayment({
        booking_id: bookingId,
        amount: undefined,
        currency: getDoctor()?.currency || 'NGN',
        provider: 'paystack',
        return_path: `/book/${token}`,
      });
      const checkoutUrl = payment.checkout_url || payment.authorization_url;
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      throw new Error('Could not start payment. Please try again.');
    } catch (err) {
      state.paymentError = err.message || 'Payment could not be started right now.';
      goToStep(4);
    } finally {
      state.paymentLoading = false;
    }
  }

  // ---- step 5: confirmation ---------------------------------------------

  function renderConfirmed() {
    const booking = state.confirmation;
    contentEl.innerHTML = `
      <div class="kura-card px-6 py-10 text-center">
        <p class="font-display text-xl font-bold text-premium-purple-plum">Your request has been sent</p>
        <p class="mt-2 text-sm text-premium-purple-plum/65">
          ${booking?.booking_date ? escapeHtml(new Date(booking.booking_date).toLocaleString()) : ''}
        </p>
        <p class="mt-4 text-sm text-premium-purple-plum/70">The doctor will confirm your appointment shortly. You'll receive updates on WhatsApp.</p>
        ${state.paymentError ? `<p class="mt-3 text-xs font-semibold text-rose-600">${escapeHtml(state.paymentError)}</p>` : ''}
        <a href="/patient/bookings" class="kura-secondary-button mt-6 inline-block rounded-xl px-5 py-2.5 text-sm">View my bookings</a>
      </div>
    `;
  }

  // ---- navigation ---------------------------------------------------------

  function goToStep(index) {
    state.stepIndex = index;
    state.bookingError = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    render();
  }

  // ---- payment return handling ---------------------------------------

  async function checkForPaymentReturn() {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference || !patientSignedIn()) return;

    state.paymentLoading = true;
    render();
    try {
      const payment = await verifyPaymentReference(reference);
      state.confirmation = { id: payment.booking_id, booking_date: payment.booking_date, status: payment.booking_status || 'pending' };
      state.stepIndex = 4;
    } catch (err) {
      state.paymentError = err.message || 'Could not verify your payment status right now.';
    } finally {
      state.paymentLoading = false;
      params.delete('reference');
      params.delete('trxref');
      params.delete('payment_status');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState({}, '', next);
      render();
    }
  }

  // ---- boot ----------------------------------------------------------------

  (async () => {
    await loadDoctorContext();
    if (destroyed) return;
    await loadPatientProfileIfSignedIn();
    if (destroyed) return;
    await checkForPaymentReturn();
  })();

  return function cleanup() {
    destroyed = true;
  };
}

// Vanilla JS patient bookings & activity page.
// Route: /patient/bookings (patient-only, no dashboard sidebar — this is the
// patient-facing side of the app, styled as its own standalone page, same
// convention as PatientBookingChatPage.jsx).
//
// This is where booking history, notifications, and self-service actions
// (pay now, cancel, message doctor, download receipt, book a follow-up)
// live now that they've been moved out of the public booking flow.

import { cancelMyBooking, createPayment, getMyBookings, getMyNotifications } from '../../../services/api';

const statusTone = {
  pending: 'warning',
  pending_confirmation: 'warning',
  confirmed: 'success',
  reschedule_requested: 'premium',
  completed: 'premium',
  cancelled: 'error',
};

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const badgeTone = {
  success: 'background:#ecfdf5cc;color:#047857;border-color:#a7f3d066',
  warning: 'background:#fffbebcc;color:#b45309;border-color:#fde68a66',
  error: 'background:#fff1f2cc;color:#be123c;border-color:#fecdd366',
  premium: '',
};

const badgeHtml = (label, tone) => `<span class="kura-badge" style="${badgeTone[tone] || ''}">${escapeHtml(label)}</span>`;

const formatDateTime = (value) => {
  if (!value) return 'Date unavailable';
  try {
    return new Date(value).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return String(value);
  }
};

export function mountPatientBookings(root) {
  if (!root) return () => {};

  const state = {
    loading: true,
    error: '',
    info: '',
    bookings: [],
    notifications: [],
    busyId: null,
  };

  let destroyed = false;
  let pollTimer = null;

  root.innerHTML = `
    <div class="mx-auto max-w-3xl px-4 py-10">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <a href="/" class="text-xs font-semibold text-premium-purple-plum/50">&larr; Back to KuraMedics</a>
          <h1 class="mt-1 font-display text-2xl font-bold text-premium-purple-plum">My bookings</h1>
        </div>
        <button type="button" data-action="refresh" class="kura-secondary-button rounded-xl px-4 py-2 text-xs font-semibold">Refresh</button>
      </div>
      <p data-el="banner" class="mb-4 text-sm font-semibold"></p>
      <div data-el="notifications" class="mb-6"></div>
      <div data-el="bookings"></div>
    </div>
  `;

  const el = {
    banner: root.querySelector('[data-el="banner"]'),
    notifications: root.querySelector('[data-el="notifications"]'),
    bookings: root.querySelector('[data-el="bookings"]'),
  };

  function setBanner() {
    if (state.error) {
      el.banner.textContent = state.error;
      el.banner.className = 'mb-4 text-sm font-semibold text-rose-600';
    } else if (state.info) {
      el.banner.textContent = state.info;
      el.banner.className = 'mb-4 text-sm font-semibold text-emerald-700';
    } else {
      el.banner.textContent = '';
      el.banner.className = 'mb-4 text-sm font-semibold';
    }
  }

  function renderNotifications() {
    const items = state.notifications.slice(0, 4);
    if (items.length === 0) {
      el.notifications.innerHTML = '';
      return;
    }
    el.notifications.innerHTML = `
      <p class="kura-label mb-2">Recent updates</p>
      <div class="space-y-2">
        ${items
          .map(
            (n) => `
          <div class="rounded-xl border border-premium-lilac/20 bg-white/70 p-3">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-premium-purple-plum">${escapeHtml(n.title)}</p>
              ${!n.is_read ? '<span class="kura-badge">New</span>' : ''}
            </div>
            <p class="mt-0.5 text-xs text-premium-purple-plum/60">${escapeHtml(n.message)}</p>
          </div>`
          )
          .join('')}
      </div>
    `;
  }

  function renderBookings() {
    if (state.loading) {
      el.bookings.innerHTML = `
        <div class="py-16 text-center">
          <div class="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-premium-purple-plum"></div>
        </div>`;
      return;
    }

    if (state.bookings.length === 0) {
      el.bookings.innerHTML = `
        <div class="kura-card px-6 py-10 text-center">
          <p class="font-semibold text-premium-purple-plum">No bookings yet</p>
          <p class="mt-1 text-sm text-premium-purple-plum/60">Appointments you request will show up here.</p>
        </div>`;
      return;
    }

    el.bookings.innerHTML = state.bookings
      .map((booking) => {
        const tone = statusTone[booking.status] || 'premium';
        const busy = state.busyId === booking.id;
        const canPay = booking.payment_status !== 'paid' && !['cancelled', 'completed'].includes(booking.status);
        const canCancel = ['pending', 'confirmed'].includes(booking.status) && booking.payment_status !== 'paid';
        const isPaid = booking.payment_status === 'paid';
        const isCompleted = booking.status === 'completed';

        return `
        <div class="kura-card mb-4 px-5 py-4" data-booking-id="${booking.id}">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-premium-purple-plum">${escapeHtml(formatDateTime(booking.booking_date))}</p>
              <p class="truncate text-sm text-premium-purple-plum/60">with ${escapeHtml(booking.doctor_name || 'your doctor')}</p>
            </div>
            <div class="flex flex-shrink-0 flex-wrap gap-1.5">
              ${badgeHtml(booking.status, tone)}
              ${badgeHtml(booking.payment_status || 'pending payment', booking.payment_status === 'paid' ? 'success' : 'warning')}
            </div>
          </div>
          ${booking.reason ? `<p class="mt-2 text-sm text-premium-purple-plum/70">${escapeHtml(booking.reason)}</p>` : ''}
          <div class="mt-3 flex flex-wrap gap-2">
            ${canPay ? `<button type="button" data-action="pay" ${busy ? 'disabled' : ''} class="kura-primary-button rounded-lg px-3 py-1.5 text-xs">Pay now</button>` : ''}
            ${canCancel ? `<button type="button" data-action="cancel" ${busy ? 'disabled' : ''} class="rounded-lg px-3 py-1.5 text-xs font-semibold text-premium-purple-plum/60 hover:bg-premium-lilac-light">Cancel request</button>` : ''}
            ${isPaid ? `<button type="button" data-action="message" class="kura-secondary-button rounded-lg px-3 py-1.5 text-xs">Message doctor</button>` : ''}
            ${isPaid ? `<button type="button" data-action="receipt" class="kura-secondary-button rounded-lg px-3 py-1.5 text-xs">Receipt</button>` : ''}
            ${isCompleted && booking.doctor_booking_link_path ? `<a href="${escapeHtml(booking.doctor_booking_link_path)}" class="kura-secondary-button rounded-lg px-3 py-1.5 text-xs inline-flex items-center">Book follow-up</a>` : ''}
          </div>
        </div>`;
      })
      .join('');
  }

  function render() {
    setBanner();
    renderNotifications();
    renderBookings();
  }

  async function loadData(silent = false) {
    if (!silent) {
      state.loading = true;
      render();
    }
    try {
      const [bookingsRes, notificationsRes] = await Promise.all([getMyBookings(), getMyNotifications()]);
      if (destroyed) return;
      state.bookings = Array.isArray(bookingsRes?.items) ? bookingsRes.items : [];
      state.notifications = Array.isArray(notificationsRes?.items) ? notificationsRes.items : [];
      state.bookings.sort((a, b) => new Date(b.booking_date || 0) - new Date(a.booking_date || 0));
    } catch (err) {
      if (!destroyed) state.error = err.message || 'Could not load your bookings';
    } finally {
      if (!destroyed) {
        state.loading = false;
        render();
      }
    }
  }

  async function handlePay(bookingId) {
    state.busyId = bookingId;
    render();
    try {
      const payment = await createPayment({ booking_id: bookingId, amount: undefined, currency: 'NGN', provider: 'paystack', return_path: '/patient/bookings' });
      const checkoutUrl = payment.checkout_url || payment.authorization_url;
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      throw new Error('Could not start payment. Please try again.');
    } catch (err) {
      state.error = err.message || 'Payment could not be started right now.';
      state.busyId = null;
      render();
    }
  }

  async function handleCancel(bookingId) {
    if (!window.confirm('Cancel this appointment request?')) return;
    state.busyId = bookingId;
    render();
    try {
      await cancelMyBooking(bookingId);
      state.info = 'Your appointment request has been cancelled.';
      await loadData(true);
    } catch (err) {
      state.error = err.message || 'This booking could not be cancelled right now.';
    } finally {
      state.busyId = null;
      render();
    }
  }

  function handleReceipt(booking) {
    const receiptWindow = window.open('', '_blank', 'width=720,height=900');
    if (!receiptWindow) return;
    receiptWindow.document.write(`
      <html>
        <head>
          <title>KuraMedics Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #2d1b45; }
            h1 { margin-bottom: 8px; }
            .card { border: 1px solid #d9cdea; border-radius: 16px; padding: 20px; margin-top: 20px; }
            .muted { color: #6b5a7e; }
          </style>
        </head>
        <body>
          <h1>KuraMedics payment receipt</h1>
          <p class="muted">Generated from your bookings page</p>
          <div class="card">
            <p><strong>Doctor:</strong> ${escapeHtml(booking.doctor_name || 'Your doctor')}</p>
            <p><strong>Booking reference:</strong> ${escapeHtml(String(booking.id || '').slice(0, 8))}</p>
            <p><strong>Appointment time:</strong> ${escapeHtml(formatDateTime(booking.booking_date))}</p>
            <p><strong>Payment status:</strong> ${escapeHtml(booking.payment_status || 'paid')}</p>
          </div>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    receiptWindow.focus();
    receiptWindow.print();
  }

  function onClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    if (actionEl.dataset.action === 'refresh') {
      loadData();
      return;
    }
    const card = e.target.closest('[data-booking-id]');
    const bookingId = card?.dataset.bookingId;
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    switch (actionEl.dataset.action) {
      case 'pay':
        handlePay(booking.id);
        break;
      case 'cancel':
        handleCancel(booking.id);
        break;
      case 'message':
        window.location.href = `/patient/bookings/${booking.id}/chat`;
        break;
      case 'receipt':
        handleReceipt(booking);
        break;
      default:
        break;
    }
  }

  root.addEventListener('click', onClick);
  loadData();
  pollTimer = window.setInterval(() => loadData(true), 30000);

  return function cleanup() {
    destroyed = true;
    root.removeEventListener('click', onClick);
    if (pollTimer) window.clearInterval(pollTimer);
  };
}

// Vanilla JS consultation queue.
// Owns everything inside the Bookings page content area. It does not touch
// the app shell, sidebar, or router — see Bookings.jsx for the thin mount point.
//
// Layout: [ patient list pane ] [ booking detail pane ]
// - The list pane shows one row per patient (who needs attention).
// - The detail pane shows the selected booking; if a patient has more than
//   one booking, a pill strip lets the doctor switch between visits.

import {
  archiveCompletedBooking,
  archiveCompletedBookings,
  confirmBookingAppointment,
  declineBooking,
  getCurrentUser,
  getDoctorBookings,
  initiateBookingChat,
  rescheduleBooking,
  suggestBookingTime,
  updateBookingInternalNotes,
  updateBookingStatus,
} from '../../../services/api';

const bookingStatusMeta = {
  pending: { label: 'Pending review', tone: 'warning' },
  pending_confirmation: { label: 'Awaiting confirmation', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  reschedule_requested: { label: 'Reschedule suggested', tone: 'premium' },
  completed: { label: 'Completed', tone: 'premium' },
  cancelled: { label: 'Declined', tone: 'error' },
};

const filterOptions = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'pending_confirmation', label: 'Awaiting confirmation' },
  { id: 'reschedule_requested', label: 'Reschedule suggested' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' },
  { id: 'cancelled', label: 'Declined' },
];

// ---- helpers (ported 1:1 from the original React version) ----------------

const toItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
};

const getPatientName = (b) =>
  b?.patient?.name || b?.patient?.full_name || b?.patient_name || b?.patient_full_name || 'Patient';

const getPatientContact = (b) =>
  b?.patient?.email || b?.patient_email || b?.patient?.phone || b?.patient_phone || b?.patient_whatsapp || 'Contact unavailable';

const getPatientId = (b) => b?.patient_id || b?.patient?.id || getPatientContact(b) || getPatientName(b);

const getBookingDate = (b) => b?.consultation_date || b?.booking_date || b?.created_at || null;

const getPatientRequestedTime = (b) => b?.patient_requested_time || b?.booking_date || b?.consultation_date || null;

const getDoctorConfirmedTime = (b) => b?.doctor_confirmed_time || (getBookingStatus(b) === 'confirmed' ? getBookingDate(b) : null);

const getDoctorSuggestedTime = (b) => b?.doctor_suggested_time || null;

const getBookingStatus = (b) => b?.consultation_status || b?.booking_status || b?.status || 'pending';

const getPaymentStatus = (b) => b?.payment_status || 'pending';

const getPaymentRequired = (b) => b?.payment_required !== false;

const isMessagingStatusOpen = (b) =>
  ['pending_confirmation', 'confirmed', 'reschedule_requested'].includes(getBookingStatus(b));

const getBookingReason = (b) =>
  b?.consultation?.reason || b?.reason || b?.booking?.message || b?.message || b?.notes || 'No reason provided.';

const getConsultationType = (b) => b?.consultation_type || b?.consultation_service_name || b?.service_name || 'Consultation';

const getConsultationFeeTypeLabel = (b) => (b?.consultation_fee_type === 'follow_up' ? 'Follow-up consultation' : 'Initial consultation');

const isArchived = (b) => Boolean(b?.is_archived || b?.archived_at);

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const formatDateTime = (value) => {
  if (!value) return 'Date unavailable';
  try {
    return new Date(value).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return String(value);
  }
};

const formatRelativeTime = (value) => {
  if (!value) return 'Recently';
  try {
    const diffMinutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
    const absMinutes = Math.abs(diffMinutes);
    if (absMinutes < 60) return diffMinutes >= 0 ? `In ${absMinutes} min` : `${absMinutes} min ago`;
    const diffHours = Math.round(absMinutes / 60);
    if (diffHours < 24) return diffMinutes >= 0 ? `In ${diffHours} hr` : `${diffHours} hr ago`;
    const diffDays = Math.round(diffHours / 24);
    return diffMinutes >= 0 ? `In ${diffDays} day${diffDays === 1 ? '' : 's'}` : `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } catch {
    return 'Recently';
  }
};

const createWhatsAppHref = (value) => {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  return digitsOnly ? `https://wa.me/${digitsOnly}` : '';
};

const initials = (name) =>
  String(name || 'Patient')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'PT';

const badgeTone = {
  success: 'background:#ecfdf5cc;color:#047857;border-color:#a7f3d066',
  warning: 'background:#fffbebcc;color:#b45309;border-color:#fde68a66',
  error: 'background:#fff1f2cc;color:#be123c;border-color:#fecdd366',
  premium: '',
};

const badgeHtml = (label, tone) =>
  `<span class="kura-badge" style="${badgeTone[tone] || ''}">${escapeHtml(label)}</span>`;

const buildPatientGroups = (bookings) => {
  const grouped = new Map();

  bookings.filter(Boolean).forEach((booking) => {
    const patientId = getPatientId(booking);
    if (!grouped.has(patientId)) {
      grouped.set(patientId, {
        id: patientId,
        patientName: getPatientName(booking),
        patientContact: getPatientContact(booking),
        latestBooking: booking,
        bookings: [],
      });
    }
    const group = grouped.get(patientId);
    group.bookings.push(booking);
    const currentLatest = new Date(getBookingDate(group.latestBooking) || 0).getTime();
    const nextLatest = new Date(getBookingDate(booking) || 0).getTime();
    if (nextLatest > currentLatest) {
      group.latestBooking = booking;
      group.patientName = getPatientName(booking);
      group.patientContact = getPatientContact(booking);
    }
  });

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      bookings: group.bookings.sort((a, b) => new Date(getBookingDate(b) || 0) - new Date(getBookingDate(a) || 0)),
    }))
    .sort((a, b) => new Date(getBookingDate(b.latestBooking) || 0) - new Date(getBookingDate(a.latestBooking) || 0));
};

// ---- main mount function --------------------------------------------------

export function mountConsultationQueue(root) {
  if (!root) return () => {};

  const state = {
    loading: true,
    error: '',
    success: '',
    bookings: [],
    doctorUser: null,
    busyId: null,
    activeFilter: 'all',
    searchTerm: '',
    sortKey: 'newest',
    selectedPatientId: '',
    selectedBookingId: '',
    showRescheduleForm: false,
    showDeclineForm: false,
    declineReason: '',
    rescheduleForm: { booking_date: '', reason: '' },
    bookingNotes: {},
    serverNotes: {},
    mobileShowingDetail: false,
  };

  const notesSaveTimers = new Map();
  let destroyed = false;

  root.innerHTML = `
    <div class="cq-root">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="font-display text-3xl font-bold text-premium-purple-plum">Consultation queue</h1>
          <p class="mt-2 text-premium-purple-plum/70">Review, confirm, and complete direct consultation requests.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" data-action="archive-all" class="kura-secondary-button rounded-xl px-4 py-2.5 text-sm font-semibold">Archive completed</button>
          <button type="button" data-action="refresh" class="kura-secondary-button rounded-xl px-4 py-2.5 text-sm font-semibold">Refresh</button>
        </div>
      </div>
      <p data-el="banner" class="mt-3 text-sm font-semibold"></p>
      <div data-el="stats" class="mt-6 grid gap-4 sm:grid-cols-2"></div>
      <div class="cq-panes mt-6">
        <div class="cq-list-pane kura-card">
          <div class="border-b border-premium-lilac/25 px-5 py-4">
            <div class="flex flex-col gap-3 sm:flex-row">
              <div class="relative flex-1">
                <input data-el="search" type="text" class="premium-input pl-4" placeholder="Search patients, email, or reason" />
              </div>
              <select data-el="sort" class="premium-input sm:w-44">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="status">Status</option>
              </select>
            </div>
            <div data-el="filters" class="mt-3 flex flex-wrap gap-1.5"></div>
          </div>
          <div data-el="patient-list" class="cq-list-scroll"></div>
        </div>
        <div class="cq-detail-pane kura-card" data-el="detail-pane">
          <button type="button" data-action="back-to-list" class="cq-back-button">
            <span aria-hidden="true">&larr;</span> Back to queue
          </button>
          <div data-el="detail" class="px-5 py-5"></div>
        </div>
      </div>
    </div>
    <style>
      .cq-panes { display: grid; grid-template-columns: minmax(0, 320px) minmax(0, 1fr); gap: 1.5rem; align-items: start; min-width: 0; }
      .cq-list-pane, .cq-detail-pane { min-width: 0; }
      .cq-list-scroll { max-height: 640px; overflow-y: auto; padding: 0.75rem; }
      .cq-patient-row { width: 100%; text-align: left; border-radius: 1rem; border: 1px solid transparent; padding: 0.75rem; min-width: 0; }
      .cq-patient-row + .cq-patient-row { margin-top: 0.5rem; }
      .cq-patient-row.active { border-color: #51406f; background: #eee7f74d; }
      .cq-patient-row:not(.active):hover { background: #ffffffb3; }
      .cq-back-button { display: none; }
      .cq-visit-pill { flex-shrink: 0; white-space: nowrap; border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 600; border: 1px solid #dcd2ec; background: transparent; color: #51406f; }
      .cq-visit-pill.active { background: #3c2b59; border-color: #3c2b59; color: #fff; }
      @media (max-width: 900px) {
        .cq-panes { grid-template-columns: minmax(0, 1fr); }
        .cq-panes.showing-detail .cq-list-pane { display: none; }
        .cq-panes:not(.showing-detail) .cq-detail-pane { display: none; }
        .cq-back-button { display: inline-flex; align-items: center; gap: 6px; padding: 12px 20px 0; font-size: 13px; font-weight: 600; color: #51406f; background: none; border: none; }
      }
    </style>
  `;

  const el = {
    banner: root.querySelector('[data-el="banner"]'),
    stats: root.querySelector('[data-el="stats"]'),
    search: root.querySelector('[data-el="search"]'),
    sort: root.querySelector('[data-el="sort"]'),
    filters: root.querySelector('[data-el="filters"]'),
    patientList: root.querySelector('[data-el="patient-list"]'),
    detail: root.querySelector('[data-el="detail"]'),
    panes: root.querySelector('.cq-panes'),
  };

  // ---- derived data --------------------------------------------------------

  function getFilteredBookings() {
    const query = state.searchTerm.trim().toLowerCase();
    return [...state.bookings]
      .filter((b) => (state.activeFilter === 'archived' ? isArchived(b) : !isArchived(b)))
      .filter((b) => state.activeFilter === 'all' || state.activeFilter === 'archived' || getBookingStatus(b) === state.activeFilter)
      .filter((b) => {
        if (!query) return true;
        return [getPatientName(b), getPatientContact(b), b?.id, getBookingReason(b), getConsultationType(b)]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (state.sortKey === 'oldest') return new Date(getBookingDate(a) || 0) - new Date(getBookingDate(b) || 0);
        if (state.sortKey === 'status') return String(getBookingStatus(a)).localeCompare(String(getBookingStatus(b)));
        return new Date(getBookingDate(b) || 0) - new Date(getBookingDate(a) || 0);
      });
  }

  function getSelectedGroup(groups) {
    return groups.find((g) => g.id === state.selectedPatientId) || null;
  }

  function getSelectedBooking(group) {
    if (!group) return null;
    return group.bookings.find((b) => b.id === state.selectedBookingId) || group.bookings[0] || null;
  }

  // ---- rendering -------------------------------------------------------

  function setBanner() {
    if (state.error) {
      el.banner.textContent = state.error;
      el.banner.className = 'mt-3 text-sm font-semibold text-rose-600';
    } else if (state.success) {
      el.banner.textContent = state.success;
      el.banner.className = 'mt-3 text-sm font-semibold text-emerald-700';
    } else {
      el.banner.textContent = '';
      el.banner.className = 'mt-3 text-sm font-semibold';
    }
  }

  function renderStats() {
    const active = state.bookings.filter((b) => !isArchived(b));
    const pending = active.filter((b) => ['pending', 'pending_confirmation'].includes(getBookingStatus(b))).length;
    const upcoming = active.filter((b) =>
      ['pending', 'pending_confirmation', 'reschedule_requested', 'confirmed'].includes(getBookingStatus(b))
    ).length;

    el.stats.innerHTML = `
      <button type="button" data-action="filter-pending" class="kura-card text-left px-5 py-4">
        <p class="text-sm text-premium-purple-plum/55">Pending requests</p>
        <p class="mt-1 text-2xl font-bold text-premium-purple-plum">${pending}</p>
      </button>
      <button type="button" data-action="filter-confirmed" class="kura-card text-left px-5 py-4">
        <p class="text-sm text-premium-purple-plum/55">Upcoming consultations</p>
        <p class="mt-1 text-2xl font-bold text-premium-purple-plum">${upcoming}</p>
      </button>
    `;
  }

  function renderFilters() {
    el.filters.innerHTML = filterOptions
      .map(
        (f) => `
        <button type="button" data-action="set-filter" data-filter="${f.id}"
          class="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
            state.activeFilter === f.id
              ? 'bg-premium-purple-plum text-white'
              : 'bg-premium-lilac-light/40 text-premium-purple-plum hover:bg-premium-lilac/40'
          }">${escapeHtml(f.label)}</button>`
      )
      .join('');
  }

  function renderPatientList(groups) {
    if (groups.length === 0) {
      el.patientList.innerHTML = `
        <div class="px-4 py-10 text-center">
          <p class="font-semibold text-premium-purple-plum">No consultations to show.</p>
          <p class="mt-1 text-sm text-premium-purple-plum/60">Try a different filter or search term.</p>
        </div>`;
      return;
    }

    el.patientList.innerHTML = groups
      .map((group) => {
        const latest = group.latestBooking;
        const status = bookingStatusMeta[getBookingStatus(latest)] || { label: getBookingStatus(latest), tone: 'premium' };
        const isActive = group.id === state.selectedPatientId;
        return `
        <button type="button" data-action="select-patient" data-patient-id="${escapeHtml(group.id)}"
          class="cq-patient-row ${isActive ? 'active' : ''}">
          <div class="flex items-start justify-between gap-3 min-w-0">
            <div class="flex min-w-0 items-center gap-3">
              <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-premium-royal text-xs font-semibold text-white">${escapeHtml(initials(group.patientName))}</div>
              <div class="min-w-0">
                <p class="truncate font-bold text-premium-purple-plum">${escapeHtml(group.patientName)}</p>
                <p class="truncate text-xs text-premium-purple-plum/55">${escapeHtml(group.patientContact)}</p>
              </div>
            </div>
            ${group.bookings.length > 1 ? `<span class="flex-shrink-0 kura-badge">${group.bookings.length} visits</span>` : ''}
          </div>
          <div class="mt-2 flex min-w-0 items-center justify-between gap-2">
            ${badgeHtml(status.label, status.tone)}
            <span class="flex-shrink-0 text-xs text-premium-purple-plum/50">${escapeHtml(formatRelativeTime(getBookingDate(latest)))}</span>
          </div>
        </button>`;
      })
      .join('');
  }

  function messagingUnavailableReason(booking, doctorUser) {
    if (!booking) return '';
    if (!isMessagingStatusOpen(booking)) return 'Messaging is closed for this booking status.';
    if (getPaymentRequired(booking) && getPaymentStatus(booking) !== 'paid') return 'Messaging opens after payment is confirmed.';
    const enabled = Boolean(doctorUser?.subscription_feature_entitlements?.secure_patient_messaging?.enabled);
    if (!enabled) return 'Secure messaging is available on Professional and Premium plans.';
    return '';
  }

  function renderDetail(group) {
    const booking = getSelectedBooking(group);

    if (!booking) {
      el.detail.innerHTML = `
        <div class="px-1 py-14 text-center">
          <p class="font-semibold text-premium-purple-plum">Select a patient</p>
          <p class="mt-1 text-sm text-premium-purple-plum/60">Choose someone from the queue to review their booking.</p>
        </div>`;
      return;
    }

    const status = getBookingStatus(booking);
    const statusMeta = bookingStatusMeta[status] || { label: status, tone: 'premium' };
    const isFinal = ['completed', 'cancelled'].includes(status);
    const msgUnavailable = messagingUnavailableReason(booking, state.doctorUser);
    const noteValue = state.bookingNotes[booking.id] ?? '';

    const visitPills =
      group.bookings.length > 1
        ? `<div class="mb-4 flex gap-2 overflow-x-auto pb-1">
            ${group.bookings
              .map((b) => {
                const active = b.id === booking.id;
                return `<button type="button" data-action="select-booking" data-booking-id="${b.id}"
                  class="cq-visit-pill ${active ? 'active' : ''}">${escapeHtml(formatDateTime(getBookingDate(b)))}</button>`;
              })
              .join('')}
          </div>`
        : '';

    el.detail.innerHTML = `
      ${visitPills}
      <div class="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4">
        <div class="flex flex-wrap items-center gap-3 min-w-0">
          <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-premium-royal text-sm font-semibold text-white">${escapeHtml(initials(group.patientName))}</div>
          <div class="min-w-0">
            <p class="truncate font-bold text-premium-purple-plum">${escapeHtml(group.patientName)}</p>
            <p class="truncate text-sm text-premium-purple-plum/60">${escapeHtml(group.patientContact)}</p>
          </div>
          <div class="ml-auto flex-shrink-0">${badgeHtml(statusMeta.label, statusMeta.tone)}</div>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-3 min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-premium-purple-plum/45">Requested time</p>
          <p class="mt-1.5 truncate text-sm font-semibold text-premium-purple-plum">${escapeHtml(formatDateTime(getPatientRequestedTime(booking)))}</p>
          ${getDoctorSuggestedTime(booking) ? `<p class="mt-1 truncate text-xs font-semibold text-amber-700">Suggested: ${escapeHtml(formatDateTime(getDoctorSuggestedTime(booking)))}</p>` : ''}
          ${getDoctorConfirmedTime(booking) ? `<p class="mt-1 truncate text-xs font-semibold text-emerald-700">Confirmed: ${escapeHtml(formatDateTime(getDoctorConfirmedTime(booking)))}</p>` : ''}
        </div>
        <div class="rounded-xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-3 min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-premium-purple-plum/45">Payment</p>
          <p class="mt-1.5 text-sm font-semibold text-premium-purple-plum">${escapeHtml(getPaymentStatus(booking))}</p>
        </div>
        <div class="rounded-xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-3 min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-premium-purple-plum/45">Visit type</p>
          <p class="mt-1.5 truncate text-sm font-semibold text-premium-purple-plum">${escapeHtml(getConsultationType(booking))} &middot; ${escapeHtml(getConsultationFeeTypeLabel(booking))}</p>
        </div>
      </div>

      <div class="mt-3 rounded-xl border border-premium-lilac/20 bg-white/75 p-3">
        <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-premium-purple-plum/45">Reason for visit</p>
        <p class="mt-1.5 text-sm text-premium-purple-plum/75">${escapeHtml(getBookingReason(booking))}</p>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" data-action="confirm" ${state.busyId === booking.id || isFinal || status === 'confirmed' || getPaymentStatus(booking) !== 'paid' ? 'disabled' : ''} class="kura-primary-button rounded-lg px-3 py-2 text-xs">Confirm appointment</button>
        <button type="button" data-action="toggle-reschedule" ${state.busyId === booking.id || isFinal ? 'disabled' : ''} class="kura-secondary-button rounded-lg px-3 py-2 text-xs">${state.showRescheduleForm ? 'Close suggestion' : 'Suggest new time'}</button>
        <button type="button" data-action="complete" ${state.busyId === booking.id || isFinal ? 'disabled' : ''} class="kura-secondary-button rounded-lg px-3 py-2 text-xs">Complete consultation</button>
        <button type="button" data-action="message" ${state.busyId === booking.id || Boolean(msgUnavailable) ? 'disabled' : ''} class="kura-secondary-button rounded-lg px-3 py-2 text-xs">Message patient</button>
        <button type="button" data-action="toggle-decline" ${state.busyId === booking.id || isFinal ? 'disabled' : ''} class="rounded-lg px-3 py-2 text-xs font-semibold text-premium-purple-plum/70 hover:bg-premium-lilac-light">${state.showDeclineForm ? 'Close decline' : 'Decline booking'}</button>
        ${status === 'completed' ? `<button type="button" data-action="archive-one" ${state.busyId === booking.id ? 'disabled' : ''} class="rounded-lg px-3 py-2 text-xs font-semibold text-premium-purple-plum/70 hover:bg-premium-lilac-light">Archive</button>` : ''}
        <a href="/consultations" class="kura-secondary-button rounded-lg px-3 py-2 text-xs inline-flex items-center">Open consultation workspace</a>
      </div>

      ${msgUnavailable ? `<p class="mt-2 text-xs font-semibold text-premium-purple-plum/55">${escapeHtml(msgUnavailable)}</p>` : ''}

      ${
        state.showRescheduleForm && !isFinal
          ? `
        <form data-form="reschedule" class="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <p class="text-sm font-bold text-amber-900">Propose a new appointment time</p>
          <input type="datetime-local" name="booking_date" class="premium-input" value="${escapeHtml(state.rescheduleForm.booking_date)}" min="${new Date().toISOString().slice(0, 16)}" required />
          <textarea name="reason" rows="3" class="premium-input" placeholder="Optional note for the patient">${escapeHtml(state.rescheduleForm.reason)}</textarea>
          <div class="flex justify-end gap-2">
            <button type="button" data-action="toggle-reschedule" class="kura-secondary-button rounded-lg px-3 py-2 text-xs">Cancel</button>
            <button type="submit" class="kura-primary-button rounded-lg px-3 py-2 text-xs">Suggest new time</button>
          </div>
        </form>`
          : ''
      }

      ${
        state.showDeclineForm && !isFinal
          ? `
        <form data-form="decline" class="mt-4 space-y-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
          <p class="text-sm font-bold text-rose-900">Decline this booking</p>
          <textarea name="reason" rows="3" class="premium-input" placeholder="Optional reason for the patient">${escapeHtml(state.declineReason)}</textarea>
          <div class="flex justify-end gap-2">
            <button type="button" data-action="toggle-decline" class="kura-secondary-button rounded-lg px-3 py-2 text-xs">Keep booking</button>
            <button type="submit" class="kura-danger-button rounded-lg px-3 py-2 text-xs">Decline booking</button>
          </div>
        </form>`
          : ''
      }

      <div class="mt-4 rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
        <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-premium-purple-plum/45">Internal notes</p>
        <textarea data-el="notes" rows="4" class="premium-input mt-2" placeholder="Preparation notes for this visit">${escapeHtml(noteValue)}</textarea>
      </div>
    `;

    el.detail.querySelector('[data-el="notes"]')?.addEventListener('input', (e) => {
      state.bookingNotes[booking.id] = e.target.value;
      const timers = notesSaveTimers;
      if (timers.has(booking.id)) window.clearTimeout(timers.get(booking.id));
      timers.set(
        booking.id,
        window.setTimeout(() => {
          timers.delete(booking.id);
          persistNote(booking.id, e.target.value);
        }, 700)
      );
    });

    el.detail.querySelector('[data-form="reschedule"]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      handleSuggestTime(booking, fd.get('booking_date'), fd.get('reason'));
    });

    el.detail.querySelector('[data-form="decline"]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      handleDecline(booking, fd.get('reason'));
    });
  }

  function render() {
    setBanner();
    renderStats();
    renderFilters();

    const groups = buildPatientGroups(getFilteredBookings());

    if (!state.selectedPatientId || !groups.some((g) => g.id === state.selectedPatientId)) {
      state.selectedPatientId = groups[0]?.id || '';
      state.selectedBookingId = groups[0]?.bookings?.[0]?.id || '';
    }

    renderPatientList(groups);
    renderDetail(getSelectedGroup(groups));

    el.panes.classList.toggle('showing-detail', state.mobileShowingDetail);
  }

  // ---- actions ------------------------------------------------------------

  async function loadData() {
    state.loading = true;
    state.error = '';
    render();
    try {
      const [user, bookingData] = await Promise.all([getCurrentUser(), getDoctorBookings()]);
      if (destroyed) return;
      state.doctorUser = user;
      const nextBookings = toItems(bookingData);
      state.bookings = nextBookings;

      const nextServerNotes = {};
      nextBookings.forEach((b) => {
        nextServerNotes[b.id] = b.internal_notes || '';
      });
      state.serverNotes = nextServerNotes;
      state.bookingNotes = { ...nextServerNotes, ...state.bookingNotes };
    } catch (err) {
      if (!destroyed) state.error = err.message || 'Could not load your consultation queue';
    } finally {
      if (!destroyed) {
        state.loading = false;
        render();
      }
    }
  }

  async function persistNote(bookingId, value) {
    if (state.serverNotes[bookingId] === value) return;
    try {
      const updated = await updateBookingInternalNotes(bookingId, value);
      const saved = typeof updated?.internal_notes === 'string' ? updated.internal_notes : value;
      state.serverNotes[bookingId] = saved;
    } catch (err) {
      window.alert(err.message || 'Could not save internal notes');
    }
  }

  async function handleConfirm(booking) {
    state.busyId = booking.id;
    state.success = '';
    render();
    try {
      await confirmBookingAppointment(booking.id, {
        booking_date: booking.doctor_suggested_time || booking.booking_date,
        confirmation_note: state.rescheduleForm.reason.trim(),
      });
      state.success = 'Appointment confirmed and the patient has been notified.';
      state.showRescheduleForm = false;
      await loadData();
    } catch (err) {
      window.alert(err.message || 'Could not confirm this booking');
    } finally {
      state.busyId = null;
      render();
    }
  }

  async function handleComplete(booking) {
    state.busyId = booking.id;
    render();
    try {
      await updateBookingStatus(booking.id, 'completed');
      state.success = 'Consultation marked as completed.';
      await loadData();
    } catch (err) {
      window.alert(err.message || 'Could not update this booking');
    } finally {
      state.busyId = null;
      render();
    }
  }

  async function handleSuggestTime(booking, bookingDate, reason) {
    state.busyId = booking.id;
    render();
    try {
      await suggestBookingTime(booking.id, {
        booking_date: new Date(bookingDate).toISOString(),
        confirmation_note: (reason || '').trim(),
      });
      state.success = 'Alternative time suggested and the patient has been notified.';
      state.showRescheduleForm = false;
      await loadData();
    } catch (err) {
      window.alert(err.message || 'Could not suggest this appointment time');
    } finally {
      state.busyId = null;
      render();
    }
  }

  async function handleDecline(booking, reason) {
    state.busyId = booking.id;
    render();
    try {
      await declineBooking(booking.id, { reason: (reason || '').trim() });
      state.success = 'Booking declined and the patient has been notified.';
      state.showDeclineForm = false;
      await loadData();
    } catch (err) {
      window.alert(err.message || 'Could not decline this booking');
    } finally {
      state.busyId = null;
      render();
    }
  }

  async function handleMessage(booking) {
    state.busyId = booking.id;
    render();
    try {
      const conversation = await initiateBookingChat(booking.id);
      window.location.href = `/chat?conversationId=${encodeURIComponent(conversation?.id || '')}&bookingId=${encodeURIComponent(booking.id)}`;
    } catch (err) {
      window.alert(err.message || 'Could not open secure messaging');
      state.busyId = null;
      render();
    }
  }

  async function handleArchiveOne(booking) {
    state.busyId = booking.id;
    render();
    try {
      await archiveCompletedBooking(booking.id);
      state.success = 'Consultation archived.';
      await loadData();
    } catch (err) {
      window.alert(err.message || 'Could not archive this consultation');
    } finally {
      state.busyId = null;
      render();
    }
  }

  async function handleArchiveAll() {
    state.busyId = 'archive-all';
    render();
    try {
      const result = await archiveCompletedBookings({ all: true });
      state.success = `${result?.archived_count || 0} completed consultation(s) archived.`;
      await loadData();
    } catch (err) {
      window.alert(err.message || 'Could not archive completed consultations');
    } finally {
      state.busyId = null;
      render();
    }
  }

  // ---- event delegation -----------------------------------------------

  function onClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    const groups = buildPatientGroups(getFilteredBookings());
    const group = getSelectedGroup(groups);
    const booking = getSelectedBooking(group);

    switch (action) {
      case 'refresh':
        loadData();
        break;
      case 'archive-all':
        handleArchiveAll();
        break;
      case 'filter-pending':
        state.activeFilter = 'pending';
        render();
        break;
      case 'filter-confirmed':
        state.activeFilter = 'confirmed';
        render();
        break;
      case 'set-filter':
        state.activeFilter = actionEl.dataset.filter;
        render();
        break;
      case 'select-patient': {
        const group2 = groups.find((g) => g.id === actionEl.dataset.patientId);
        state.selectedPatientId = actionEl.dataset.patientId;
        state.selectedBookingId = group2?.bookings?.[0]?.id || '';
        state.showRescheduleForm = false;
        state.showDeclineForm = false;
        state.mobileShowingDetail = true;
        render();
        break;
      }
      case 'select-booking':
        state.selectedBookingId = actionEl.dataset.bookingId;
        state.showRescheduleForm = false;
        state.showDeclineForm = false;
        render();
        break;
      case 'back-to-list':
        state.mobileShowingDetail = false;
        render();
        break;
      case 'toggle-reschedule':
        state.showRescheduleForm = !state.showRescheduleForm;
        if (state.showRescheduleForm && booking) {
          const iso = getBookingDate(booking) ? new Date(getBookingDate(booking)).toISOString().slice(0, 16) : '';
          state.rescheduleForm = { booking_date: iso, reason: '' };
        }
        render();
        break;
      case 'toggle-decline':
        state.showDeclineForm = !state.showDeclineForm;
        render();
        break;
      case 'confirm':
        if (booking) handleConfirm(booking);
        break;
      case 'complete':
        if (booking) handleComplete(booking);
        break;
      case 'message':
        if (booking) handleMessage(booking);
        break;
      case 'archive-one':
        if (booking) handleArchiveOne(booking);
        break;
      default:
        break;
    }
  }

  let searchDebounce;
  function onSearchInput(e) {
    window.clearTimeout(searchDebounce);
    const value = e.target.value;
    searchDebounce = window.setTimeout(() => {
      state.searchTerm = value;
      renderPatientList(buildPatientGroups(getFilteredBookings()));
    }, 200);
  }

  function onSortChange(e) {
    state.sortKey = e.target.value;
    render();
  }

  root.addEventListener('click', onClick);
  el.search.addEventListener('input', onSearchInput);
  el.sort.addEventListener('change', onSortChange);

  loadData();

  return function cleanup() {
    destroyed = true;
    root.removeEventListener('click', onClick);
    el.search.removeEventListener('input', onSearchInput);
    el.sort.removeEventListener('change', onSortChange);
    notesSaveTimers.forEach((id) => window.clearTimeout(id));
    notesSaveTimers.clear();
    window.clearTimeout(searchDebounce);
  };
}

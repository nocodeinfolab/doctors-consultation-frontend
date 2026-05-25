export const bookingStatusMeta = {
  pending: {
    label: 'Pending review',
    variant: 'warning',
    helper: 'Waiting for your confirmation',
  },
  pending_confirmation: {
    label: 'Awaiting confirmation',
    variant: 'warning',
    helper: 'Patient requested a time; doctor must confirm',
  },
  confirmed: {
    label: 'Confirmed',
    variant: 'success',
    helper: 'Appointment confirmed with the patient',
  },
  reschedule_requested: {
    label: 'Reschedule suggested',
    variant: 'premium',
    helper: 'Doctor suggested a different appointment time',
  },
  completed: {
    label: 'Completed',
    variant: 'premium',
    helper: 'Consultation finished',
  },
  cancelled: {
    label: 'Declined',
    variant: 'error',
    helper: 'This request is no longer active',
  },
};

export const paymentStatusMeta = {
  paid: { label: 'Paid', variant: 'success' },
  pending: { label: 'Pending payment', variant: 'warning' },
  failed: { label: 'Failed payment', variant: 'error' },
  refunded: { label: 'Refunded', variant: 'premium' },
};

export const consultationStatusMeta = {
  upcoming: { label: 'Upcoming', variant: 'warning' },
  'in-progress': { label: 'In progress', variant: 'premium' },
  completed: { label: 'Completed', variant: 'success' },
};

export const toItems = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  return [];
};

export const formatCurrency = (value, currency = 'NGN') => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return `${currency} 0`;
  }

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(numericValue);
};

export const formatDateTime = (value) => {
  if (!value) {
    return 'Not scheduled';
  }

  try {
    return new Date(value).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

export const formatShortDate = (value) => {
  if (!value) {
    return 'No date';
  }

  try {
    return new Date(value).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

export const formatRelativeTime = (value) => {
  if (!value) {
    return 'Recently';
  }

  try {
    const date = new Date(value);
    const diffMs = date.getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60000);
    const absMinutes = Math.abs(diffMinutes);

    if (absMinutes < 60) {
      return diffMinutes >= 0 ? `In ${absMinutes} min` : `${absMinutes} min ago`;
    }

    const diffHours = Math.round(absMinutes / 60);
    if (diffHours < 24) {
      return diffMinutes >= 0 ? `In ${diffHours} hr` : `${diffHours} hr ago`;
    }

    const diffDays = Math.round(diffHours / 24);
    return diffMinutes >= 0
      ? `In ${diffDays} day${diffDays === 1 ? '' : 's'}`
      : `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } catch {
    return 'Recently';
  }
};

export const calculateProfileCompletion = (profile, user) => {
  const checks = [
    Boolean(profile?.full_name || user?.full_name),
    Boolean(profile?.specialization || user?.specialization),
    Boolean(profile?.phone_number),
    Boolean(profile?.mdcn_registration_number),
    Boolean(profile?.avatar_url),
    profile?.is_available !== false,
    Boolean(user?.email_verified),
    profile?.verification_status === 'verified',
  ];

  const completed = checks.filter(Boolean).length;
  return {
    completed,
    total: checks.length,
    percent: Math.round((completed / checks.length) * 100),
  };
};

export const deriveActivityFeed = (bookings = [], payments = []) => {
  const bookingEvents = bookings.map((booking) => ({
    id: `booking-${booking.id}`,
    type: 'booking',
    title: `${booking.patient_name || 'Patient'} ${booking.status === 'pending' ? 'requested an appointment' : `is ${booking.status}`}`,
    timestamp: booking.updated_at || booking.created_at || booking.booking_date,
    helper: booking.reason || 'Consultation request',
    status: booking.status,
  }));

  const paymentEvents = payments.map((payment) => ({
    id: `payment-${payment.id}`,
    type: 'payment',
    title: `${payment.patient_name || 'Patient'} completed payment`,
    timestamp: payment.paid_at || payment.created_at,
    helper: `${formatCurrency(payment.amount, payment.currency || 'NGN')} · ${paymentStatusMeta[payment.status]?.label || payment.status}`,
    status: payment.status,
  }));

  return [...bookingEvents, ...paymentEvents]
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 8);
};

export const derivePatients = (bookings = [], payments = []) => {
  const grouped = new Map();

  bookings.forEach((booking) => {
    const key = booking.patient_id || booking.patient_email || booking.patient_name || booking.id;

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: key,
        patient_id: booking.patient_id,
        full_name: booking.patient_name || 'Patient',
        email: booking.patient_email || '',
        phone: booking.patient_phone || '',
        date_joined: booking.patient_joined_at || booking.created_at || booking.booking_date,
        totalBookings: 0,
        confirmedBookings: 0,
        completedBookings: 0,
        mostRecentBooking: booking.booking_date,
        lastReason: booking.reason || '',
        history: [],
        totalPaid: 0,
      });
    }

    const patient = grouped.get(key);
    patient.totalBookings += 1;
    patient.confirmedBookings += booking.status === 'confirmed' ? 1 : 0;
    patient.completedBookings += booking.status === 'completed' ? 1 : 0;
    patient.mostRecentBooking =
      !patient.mostRecentBooking ||
      new Date(booking.booking_date) > new Date(patient.mostRecentBooking)
        ? booking.booking_date
        : patient.mostRecentBooking;
    patient.lastReason = booking.reason || patient.lastReason;
    patient.history.push(booking);
  });

  payments.forEach((payment) => {
    const key = payment.patient_id || payment.patient_email || payment.patient_name;
    if (grouped.has(key)) {
      grouped.get(key).totalPaid += Number(payment.amount || 0);
    }
  });

  return Array.from(grouped.values()).sort(
    (a, b) => new Date(b.mostRecentBooking || 0) - new Date(a.mostRecentBooking || 0)
  );
};

export const deriveConsultations = (bookings = [], payments = []) => {
  const paidBookingIds = new Set(
    payments.filter((payment) => payment.status === 'paid').map((payment) => payment.booking_id)
  );

  return bookings
    .filter((booking) => ['confirmed', 'completed'].includes(booking.status))
    .map((booking) => {
      const bookingDate = new Date(booking.booking_date);
      const now = new Date();
      const isCompleted = booking.status === 'completed';
      const isInProgress =
        !isCompleted && bookingDate <= now && Math.abs(now - bookingDate) <= 60 * 60 * 1000;

      return {
        ...booking,
        consultation_status: isCompleted ? 'completed' : isInProgress ? 'in-progress' : 'upcoming',
        payment_status: paidBookingIds.has(booking.id) ? 'paid' : 'pending',
      };
    })
    .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date));
};

export const derivePaymentRecords = (payments = [], bookings = [], profile = null) => {
  const consultationFee = Number(profile?.consultation_fee || 0);
  const liveRecords = payments.map((payment) => ({
    ...payment,
    source: 'live',
    status: payment.status || 'paid',
    sortDate: payment.paid_at || payment.created_at || payment.booking_date,
  }));

  const paidBookingIds = new Set(liveRecords.map((payment) => payment.booking_id));

  const outstanding = bookings
    .filter(
      (booking) =>
        [
          'confirmed',
          'completed',
          'pending',
          'pending_confirmation',
          'reschedule_requested',
        ].includes(booking.status) && !paidBookingIds.has(booking.id)
    )
    .map((booking) => ({
      id: `pending-${booking.id}`,
      booking_id: booking.id,
      patient_name: booking.patient_name,
      patient_email: booking.patient_email,
      booking_date: booking.booking_date,
      amount: consultationFee || 0,
      currency: profile?.currency || 'NGN',
      status: booking.status === 'cancelled' ? 'failed' : 'pending',
      transaction_id: 'Awaiting payment',
      sortDate: booking.booking_date,
      source: 'derived',
    }));

  return [...liveRecords, ...outstanding].sort(
    (a, b) => new Date(b.sortDate || 0) - new Date(a.sortDate || 0)
  );
};

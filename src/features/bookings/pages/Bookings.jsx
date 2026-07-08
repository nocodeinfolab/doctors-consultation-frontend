import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  Archive,
  ChevronDown,
  Clock3,
  FileText,
  MessageCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SkeletonBlock,
} from '../../../components/ui';
import useDoctorWorkspace from '../../../hooks/useDoctorWorkspace';
import {
  archiveCompletedBooking,
  archiveCompletedBookings,
  confirmBookingAppointment,
  declineBooking,
  initiateBookingChat,
  rescheduleBooking,
  suggestBookingTime,
  updateBookingInternalNotes,
  updateBookingStatus,
} from '../../../services/api';
import {
  bookingStatusMeta,
  formatDateTime,
  formatRelativeTime,
} from '../../../utils/doctorWorkspace';

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

const sorters = {
  newest: (a, b) => new Date(getBookingDate(b) || 0) - new Date(getBookingDate(a) || 0),
  oldest: (a, b) => new Date(getBookingDate(a) || 0) - new Date(getBookingDate(b) || 0),
  appointment: (a, b) => new Date(getBookingDate(a) || 0) - new Date(getBookingDate(b) || 0),
  status: (a, b) => String(getBookingStatus(a)).localeCompare(String(getBookingStatus(b))),
};

const getPatientName = (booking) =>
  booking?.patient?.name ||
  booking?.patient?.full_name ||
  booking?.patient_name ||
  booking?.patient_full_name ||
  'Patient';

const getPatientContact = (booking) =>
  booking?.patient?.email ||
  booking?.patient_email ||
  booking?.patient?.phone ||
  booking?.patient_phone ||
  booking?.patient_whatsapp ||
  'Contact unavailable';

const getPatientId = (booking) =>
  booking?.patient_id ||
  booking?.patient?.id ||
  getPatientContact(booking) ||
  getPatientName(booking);

const getBookingDate = (booking) =>
  booking?.consultation_date || booking?.booking_date || booking?.created_at || null;

const getPatientRequestedTime = (booking) =>
  booking?.patient_requested_time || booking?.booking_date || booking?.consultation_date || null;

const getDoctorConfirmedTime = (booking) =>
  booking?.doctor_confirmed_time ||
  (getBookingStatus(booking) === 'confirmed' ? getBookingDate(booking) : null);

const getDoctorSuggestedTime = (booking) => booking?.doctor_suggested_time || null;

const getBookingStatus = (booking) =>
  booking?.consultation_status || booking?.booking_status || booking?.status || 'pending';

const getPaymentStatus = (booking) => booking?.payment_status || 'pending';

const getPaymentRequired = (booking) => booking?.payment_required !== false;

const isMessagingStatusOpen = (booking) =>
  ['pending_confirmation', 'confirmed', 'reschedule_requested'].includes(getBookingStatus(booking));

const getPaymentStateLabel = (booking) => {
  const paymentStatus = getPaymentStatus(booking);
  const bookingStatus = getBookingStatus(booking);

  if (paymentStatus === 'paid' && bookingStatus !== 'confirmed' && bookingStatus !== 'completed') {
    return 'Paid awaiting confirmation';
  }

  if (paymentStatus === 'failed') {
    return 'Failed payment';
  }

  if (paymentStatus === 'pending') {
    return 'Pending payment';
  }

  return paymentStatus;
};

const getBookingReason = (booking) =>
  booking?.consultation?.reason ||
  booking?.reason ||
  booking?.booking?.message ||
  booking?.message ||
  booking?.notes ||
  'No reason provided.';

const getConsultationType = (booking) =>
  booking?.consultation_type ||
  booking?.consultation_service_name ||
  booking?.service_name ||
  'Consultation';

const getConsultationFeeTypeLabel = (booking) =>
  booking?.consultation_fee_type === 'follow_up'
    ? 'Follow-up consultation'
    : 'Initial consultation';

const isArchived = (booking) => Boolean(booking?.is_archived || booking?.archived_at);

const formatSafeDateTime = (value) => {
  if (!value) return 'Date unavailable.';
  return formatDateTime(value);
};

const buildPatientGroups = (bookings = []) => {
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
      bookings: group.bookings.sort(sorters.newest),
    }))
    .sort(
      (a, b) =>
        new Date(getBookingDate(b.latestBooking) || 0) -
        new Date(getBookingDate(a.latestBooking) || 0)
    );
};

const createWhatsAppHref = (value) => {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  return digitsOnly ? `https://wa.me/${digitsOnly}` : '';
};

const BookingSkeleton = () => (
  <div className="space-y-6">
    <div className="grid gap-6 md:grid-cols-2">
      <SkeletonBlock className="h-28" />
      <SkeletonBlock className="h-28" />
    </div>
    <SkeletonBlock className="h-96" />
  </div>
);

export default function Bookings() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loading, error, refresh, bookings, doctorUser } = useDoctorWorkspace({
    loadPayments: false,
  });
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState(
    typeof location.state?.search === 'string' ? location.state.search : ''
  );
  const [sortKey, setSortKey] = useState('newest');
  const [selectedId, setSelectedId] = useState('');
  const [expandedPatientIds, setExpandedPatientIds] = useState(() => new Set());
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({ booking_date: '', reason: '' });
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [bookingNotes, setBookingNotes] = useState({});
  const notesSaveTimersRef = useRef(new Map());
  const serverNotesRef = useRef({});

  useEffect(() => {
    if (typeof location.state?.search === 'string') {
      setSearchTerm(location.state.search);
    }
  }, [location.state]);

  useEffect(() => {
    setShowRescheduleForm(false);
    setShowDeclineForm(false);
    setDeclineReason('');
  }, [selectedId]);

  useEffect(() => {
    const nextServerNotes = {};
    bookings.filter(Boolean).forEach((booking) => {
      nextServerNotes[booking.id] = booking.internal_notes || '';
    });

    const previousServerNotes = serverNotesRef.current;
    serverNotesRef.current = nextServerNotes;

    setBookingNotes((current) => {
      const next = {};

      bookings.filter(Boolean).forEach((booking) => {
        const serverValue = nextServerNotes[booking.id];
        const currentValue = current[booking.id];
        const previousServerValue = previousServerNotes[booking.id];

        next[booking.id] =
          currentValue === undefined || currentValue === previousServerValue
            ? serverValue
            : currentValue;
      });

      return next;
    });
  }, [bookings]);

  useEffect(() => {
    return () => {
      const timers = notesSaveTimersRef.current;
      timers.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timers.clear();
    };
  }, []);

  const filteredBookings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return [...bookings]
      .filter((booking) =>
        activeFilter === 'archived' ? isArchived(booking) : !isArchived(booking)
      )
      .filter(
        (booking) =>
          activeFilter === 'all' ||
          activeFilter === 'archived' ||
          getBookingStatus(booking) === activeFilter
      )
      .filter((booking) => {
        if (!query) {
          return true;
        }

        return [
          getPatientName(booking),
          getPatientContact(booking),
          booking?.id,
          getBookingReason(booking),
          getConsultationType(booking),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort(sorters[sortKey] || sorters.newest);
  }, [activeFilter, bookings, searchTerm, sortKey]);

  const activeBookings = useMemo(
    () => bookings.filter((booking) => !isArchived(booking)),
    [bookings]
  );
  const archivedCompletedCount = useMemo(
    () =>
      bookings.filter((booking) => isArchived(booking) && getBookingStatus(booking) === 'completed')
        .length,
    [bookings]
  );
  const patientGroups = useMemo(() => buildPatientGroups(filteredBookings), [filteredBookings]);

  useEffect(() => {
    if (!filteredBookings.length) {
      setSelectedId('');
      return;
    }

    if (!selectedId || !filteredBookings.some((booking) => booking?.id === selectedId)) {
      setSelectedId(filteredBookings[0]?.id || '');
    }
  }, [filteredBookings, selectedId]);

  useEffect(() => {
    if (!selectedBooking) {
      setShowRescheduleForm(false);
      setRescheduleForm({ booking_date: '', reason: '' });
      return;
    }

    const selectedDate = getBookingDate(selectedBooking);
    const isoDate = selectedDate ? new Date(selectedDate).toISOString().slice(0, 16) : '';

    setRescheduleForm({ booking_date: isoDate, reason: '' });
    setShowRescheduleForm(false);
  }, [selectedId]);

  const selectedBooking = filteredBookings.find((booking) => booking?.id === selectedId) || null;
  const pendingCount = activeBookings.filter((item) => getBookingStatus(item) === 'pending').length;
  const awaitingConfirmationCount = activeBookings.filter((item) =>
    ['pending_confirmation', 'reschedule_requested'].includes(getBookingStatus(item))
  ).length;
  const upcomingCount = activeBookings.filter((item) =>
    ['pending', 'pending_confirmation', 'reschedule_requested', 'confirmed'].includes(
      getBookingStatus(item)
    )
  ).length;
  const secureMessagingEnabled = Boolean(
    doctorUser?.subscription_feature_entitlements?.secure_patient_messaging?.enabled
  );

  const getMessagingUnavailableReason = (booking) => {
    if (!booking) return '';
    if (!isMessagingStatusOpen(booking)) return 'Messaging is closed for this booking status.';
    if (getPaymentRequired(booking) && getPaymentStatus(booking) !== 'paid') {
      return 'Messaging opens after payment is confirmed.';
    }
    if (!secureMessagingEnabled) {
      return 'Secure messaging is available on Professional and Premium plans.';
    }
    return '';
  };

  const togglePatientGroup = (group) => {
    if (group.bookings.length === 1) {
      setSelectedId(group.bookings[0].id);
      return;
    }

    setExpandedPatientIds((current) => {
      const next = new Set(current);
      if (next.has(group.id)) {
        next.delete(group.id);
      } else {
        next.add(group.id);
      }
      return next;
    });
  };

  const handleStatusChange = async (bookingId, status) => {
    setBusyId(bookingId);
    setSuccess('');

    try {
      await updateBookingStatus(bookingId, status);
      setSuccess(`Booking updated to ${bookingStatusMeta[status]?.label || status}.`);
      await refresh();
    } catch (err) {
      setSuccess('');
      window.alert(err.message || 'Could not update booking status');
    } finally {
      setBusyId(null);
    }
  };

  const handleArchiveBooking = async (bookingId) => {
    if (!bookingId) return;
    setBusyId(bookingId);
    setSuccess('');

    try {
      const result = await archiveCompletedBooking(bookingId);
      setSuccess(`${result?.archived_count || 0} completed consultation archived.`);
      await refresh();
    } catch (err) {
      window.alert(err.message || 'Could not archive this completed consultation');
    } finally {
      setBusyId(null);
    }
  };

  const handleArchivePatientCompleted = async (patientId) => {
    if (!patientId) return;
    setBusyId(patientId);
    setSuccess('');

    try {
      const result = await archiveCompletedBookings({ patient_id: patientId });
      setSuccess(
        `${result?.archived_count || 0} completed consultation(s) archived for this patient.`
      );
      await refresh();
    } catch (err) {
      window.alert(err.message || 'Could not archive this patient’s completed consultations');
    } finally {
      setBusyId(null);
    }
  };

  const handleArchiveAllCompleted = async () => {
    setBusyId('archive-all');
    setSuccess('');

    try {
      const result = await archiveCompletedBookings({ all: true });
      setSuccess(`${result?.archived_count || 0} completed consultation(s) archived.`);
      await refresh();
    } catch (err) {
      window.alert(err.message || 'Could not archive completed consultations');
    } finally {
      setBusyId(null);
    }
  };

  const persistBookingNote = async (bookingId, value) => {
    if (serverNotesRef.current[bookingId] === value) {
      return;
    }

    try {
      const updated = await updateBookingInternalNotes(bookingId, value);
      const savedNotes =
        typeof updated?.internal_notes === 'string' ? updated.internal_notes : value;

      serverNotesRef.current = {
        ...serverNotesRef.current,
        [bookingId]: savedNotes,
      };

      setBookingNotes((current) =>
        current[bookingId] === value ? { ...current, [bookingId]: savedNotes } : current
      );
    } catch (err) {
      window.alert(err.message || 'Could not save internal notes');
    }
  };

  const handleNoteChange = (bookingId, value) => {
    setBookingNotes((current) => ({ ...current, [bookingId]: value }));
    const timers = notesSaveTimersRef.current;

    if (timers.has(bookingId)) {
      window.clearTimeout(timers.get(bookingId));
    }

    const timeoutId = window.setTimeout(() => {
      timers.delete(bookingId);
      persistBookingNote(bookingId, value);
    }, 700);

    timers.set(bookingId, timeoutId);
  };

  const handleRescheduleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedBooking) {
      return;
    }

    setBusyId(selectedBooking.id);
    setSuccess('');

    try {
      await rescheduleBooking(selectedBooking.id, {
        booking_date: new Date(rescheduleForm.booking_date).toISOString(),
        reason: rescheduleForm.reason.trim(),
      });

      setSuccess('Booking time updated and the patient has been notified.');
      setShowRescheduleForm(false);
      await refresh();
    } catch (err) {
      setSuccess('');
      window.alert(err.message || 'Could not reschedule this booking');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmBooking = async (booking, explicitDate = '') => {
    if (!booking?.id) return;

    setBusyId(booking.id);
    setSuccess('');

    try {
      await confirmBookingAppointment(booking.id, {
        booking_date: explicitDate || booking.doctor_suggested_time || booking.booking_date,
        confirmation_note: rescheduleForm.reason.trim(),
      });
      setSuccess('Appointment time confirmed and the patient has been notified.');
      setShowRescheduleForm(false);
      await refresh();
    } catch (err) {
      window.alert(err.message || 'Could not confirm this booking');
    } finally {
      setBusyId(null);
    }
  };

  const handleSuggestTimeSubmit = async (event) => {
    event.preventDefault();

    if (!selectedBooking) return;

    setBusyId(selectedBooking.id);
    setSuccess('');

    try {
      await suggestBookingTime(selectedBooking.id, {
        booking_date: new Date(rescheduleForm.booking_date).toISOString(),
        confirmation_note: rescheduleForm.reason.trim(),
      });
      setSuccess('Alternative time suggested and the patient has been notified.');
      setShowRescheduleForm(false);
      await refresh();
    } catch (err) {
      window.alert(err.message || 'Could not suggest this appointment time');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeclineSubmit = async (event) => {
    event.preventDefault();

    if (!selectedBooking?.id) return;

    setBusyId(selectedBooking.id);
    setSuccess('');

    try {
      await declineBooking(selectedBooking.id, { reason: declineReason.trim() });
      setSuccess('Booking declined and the patient has been notified.');
      setShowDeclineForm(false);
      setDeclineReason('');
      await refresh();
    } catch (err) {
      window.alert(err.message || 'Could not decline this booking');
    } finally {
      setBusyId(null);
    }
  };

  const handleMessagePatient = async (booking) => {
    if (!booking?.id) return;

    setBusyId(booking.id);
    setSuccess('');

    try {
      const conversation = await initiateBookingChat(booking.id);
      setSuccess('Secure chat opened for this booking.');
      navigate('/chat', {
        state: {
          conversationId: conversation?.id,
          bookingId: booking.id,
        },
      });
    } catch (err) {
      window.alert(err.message || 'Could not open secure messaging');
    } finally {
      setBusyId(null);
    }
  };

  const timeline = selectedBooking
    ? [
        {
          label: 'Request submitted',
          time: selectedBooking.created_at || getBookingDate(selectedBooking),
          helper: 'Patient sent a booking request.',
        },
        getBookingStatus(selectedBooking) !== 'pending'
          ? {
              label: 'Doctor review',
              time: selectedBooking.updated_at || getBookingDate(selectedBooking),
              helper: `Current status is ${bookingStatusMeta[getBookingStatus(selectedBooking)]?.label || getBookingStatus(selectedBooking)}.`,
            }
          : null,
        getBookingStatus(selectedBooking) === 'completed'
          ? {
              label: 'Consultation completed',
              time: selectedBooking.updated_at || getBookingDate(selectedBooking),
              helper: 'This visit has been marked as finished.',
            }
          : null,
        getBookingStatus(selectedBooking) === 'cancelled'
          ? {
              label: 'Booking declined',
              time: selectedBooking.updated_at || getBookingDate(selectedBooking),
              helper: selectedBooking.confirmation_note
                ? `Reason: ${selectedBooking.confirmation_note}`
                : 'The doctor declined this appointment request.',
            }
          : null,
      ].filter(Boolean)
    : [];

  if (loading) {
    return <BookingSkeleton />;
  }

  if (error && bookings.length === 0) {
    return (
      <ErrorState
        icon={CalendarDays}
        title="Could not load consultation queue"
        message={error || 'Something went wrong. Please try again.'}
        actionLabel="Try again"
        onAction={refresh}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-premium-purple-plum">
            Consultation Queue
          </h1>
          <p className="mt-2 text-premium-purple-plum/70">
            Review, confirm, and complete direct consultation requests from one clinical queue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={handleArchiveAllCompleted}
            disabled={busyId === 'archive-all'}
          >
            <Archive className="h-4 w-4" />
            {busyId === 'archive-all' ? 'Archiving...' : 'Archive completed'}
          </Button>
          <Button variant="secondary" onClick={refresh}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
      {success && <p className="text-sm font-semibold text-emerald-700">{success}</p>}
      {activeBookings.length === 0 && archivedCompletedCount > 0 && (
        <p className="text-sm font-semibold text-premium-purple-plum/60">
          Your active consultation queue is clear.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="guided-flow-card">
          <button
            type="button"
            onClick={() => setActiveFilter('pending')}
            className="w-full text-left"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Clock3 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-premium-purple-plum/55">Pending requests</p>
                <p className="text-3xl font-bold text-premium-purple-plum">
                  {pendingCount + awaitingConfirmationCount}
                </p>
                <p className="mt-1 text-xs text-premium-purple-plum/50">
                  Requests awaiting doctor review
                </p>
              </div>
            </div>
          </button>
        </Card>
        <Card className="guided-flow-card">
          <button
            type="button"
            onClick={() => setActiveFilter('confirmed')}
            className="w-full text-left"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-premium-purple-plum/55">Upcoming consultations</p>
                <p className="text-3xl font-bold text-premium-purple-plum">{upcomingCount}</p>
                <p className="mt-1 text-xs text-premium-purple-plum/50">View confirmed visits</p>
              </div>
            </div>
          </button>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
        <Card
          title="Consultation Queue"
          subtitle="Search, filter, and manage your consultation flow"
        >
          <div className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-premium-purple-plum/35" />
                <input
                  className="premium-input pl-11"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by patient, email, booking ID, or reason"
                />
              </div>
              <div className="relative min-w-[180px]">
                <SlidersHorizontal className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-premium-purple-plum/35" />
                <select
                  className="premium-input pl-11"
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="appointment">Appointment date</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {filterOptions.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${activeFilter === filter.id ? 'bg-premium-purple-plum text-white' : 'bg-premium-lilac-light/40 text-premium-purple-plum hover:bg-premium-lilac/40'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {patientGroups.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={
                  activeBookings.length === 0 && archivedCompletedCount > 0
                    ? 'Your active consultation queue is clear.'
                    : 'No consultations yet.'
                }
                message={
                  activeBookings.length === 0 && archivedCompletedCount > 0
                    ? 'Archived consultations remain available in patient records.'
                    : 'Try a different filter or share your live clinic link to bring in new requests.'
                }
              />
            ) : (
              <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {patientGroups.map((group) => {
                  const latest = group.latestBooking;
                  const latestStatus = getBookingStatus(latest);
                  const status = bookingStatusMeta[latestStatus] || {
                    variant: 'premium',
                    label: latestStatus,
                    helper: 'Status updated',
                  };
                  const isExpanded = expandedPatientIds.has(group.id);
                  const completedInGroup = group.bookings.filter(
                    (booking) => getBookingStatus(booking) === 'completed'
                  );

                  return (
                    <div key={group.id} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => togglePatientGroup(group)}
                        className={`w-full rounded-3xl border p-4 text-left transition-all ${
                          group.bookings.some((booking) => booking.id === selectedId)
                            ? 'border-premium-purple-plum bg-premium-lilac-light/30 shadow-premium-soft'
                            : 'border-premium-lilac/20 bg-white/70 hover:bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar
                              name={group.patientName}
                              className="h-11 w-11 text-sm"
                              textClassName="text-sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-premium-purple-plum">
                                {group.patientName}
                              </p>
                              <p className="truncate text-xs text-premium-purple-plum/55">
                                {group.patientContact}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant={status.variant}>{status.label}</Badge>
                            <Badge variant="premium">
                              {group.bookings.length} consult
                              {group.bookings.length === 1 ? '' : 's'}
                            </Badge>
                            {group.bookings.length > 1 && (
                              <ChevronDown
                                className={`h-4 w-4 text-premium-purple-plum/55 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            )}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-premium-purple-plum/70">
                          {getBookingReason(latest)}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-premium-purple-plum/50">
                          <span>{formatSafeDateTime(getBookingDate(latest))}</span>
                          {completedInGroup.length > 0 && (
                            <span>{completedInGroup.length} completed</span>
                          )}
                        </div>
                      </button>

                      {completedInGroup.length > 0 && (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === group.id}
                            onClick={() => handleArchivePatientCompleted(group.id)}
                          >
                            <Archive className="h-4 w-4" /> Archive patient completed
                          </Button>
                        </div>
                      )}

                      {group.bookings.length > 1 && isExpanded && (
                        <div className="ml-5 space-y-2 border-l border-premium-lilac/25 pl-3">
                          {group.bookings.map((booking) => {
                            const nestedStatus = getBookingStatus(booking);
                            const nestedStatusMeta = bookingStatusMeta[nestedStatus] || {
                              variant: 'premium',
                              label: nestedStatus,
                            };

                            return (
                              <div
                                key={booking.id}
                                className={`rounded-2xl border p-3 ${
                                  selectedId === booking.id
                                    ? 'border-premium-purple-plum bg-white shadow-premium-soft'
                                    : 'border-premium-lilac/15 bg-white/65'
                                }`}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedId(booking.id)}
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <p className="text-sm font-bold text-premium-purple-plum">
                                      {formatSafeDateTime(getBookingDate(booking))}
                                    </p>
                                    <p className="mt-1 truncate text-xs text-premium-purple-plum/55">
                                      {getConsultationType(booking)} · {getBookingReason(booking)}
                                    </p>
                                  </button>
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <Badge
                                      variant={
                                        getPaymentStatus(booking) === 'paid' ? 'success' : 'warning'
                                      }
                                    >
                                      {getPaymentStatus(booking)}
                                    </Badge>
                                    <Badge variant={nestedStatusMeta.variant}>
                                      {nestedStatusMeta.label}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setSelectedId(booking.id)}
                                  >
                                    View
                                  </Button>
                                  {nestedStatus !== 'completed' && nestedStatus !== 'cancelled' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedId(booking.id)}
                                    >
                                      Continue
                                    </Button>
                                  )}
                                  {nestedStatus === 'confirmed' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={busyId === booking.id}
                                      onClick={() => handleStatusChange(booking.id, 'completed')}
                                    >
                                      Complete
                                    </Button>
                                  )}
                                  {nestedStatus === 'completed' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={busyId === booking.id}
                                      onClick={() => handleArchiveBooking(booking.id)}
                                    >
                                      <Archive className="h-4 w-4" /> Archive
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card title="Booking detail" subtitle="Doctor actions, patient context, and internal notes">
          {!selectedBooking ? (
            <EmptyState
              icon={FileText}
              title="Select a booking"
              message="Choose a request from the queue to review the patient details and status timeline."
            />
          ) : (
            <div className="space-y-5">
              <div className="rounded-3xl border border-premium-lilac/20 bg-white/70 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar
                    name={getPatientName(selectedBooking)}
                    className="h-12 w-12 text-sm"
                    textClassName="text-sm"
                  />
                  <div>
                    <p className="font-bold text-premium-purple-plum">
                      {getPatientName(selectedBooking)}
                    </p>
                    <p className="text-sm text-premium-purple-plum/60">
                      {getPatientContact(selectedBooking)}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <Badge
                      variant={
                        bookingStatusMeta[getBookingStatus(selectedBooking)]?.variant || 'premium'
                      }
                    >
                      {bookingStatusMeta[getBookingStatus(selectedBooking)]?.label ||
                        getBookingStatus(selectedBooking)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Patient preferred time
                  </p>
                  <p className="mt-2 font-semibold text-premium-purple-plum">
                    {formatSafeDateTime(getPatientRequestedTime(selectedBooking))}
                  </p>
                  {getDoctorSuggestedTime(selectedBooking) && (
                    <p className="mt-2 text-xs font-semibold text-amber-700">
                      Suggested: {formatSafeDateTime(getDoctorSuggestedTime(selectedBooking))}
                    </p>
                  )}
                  {getDoctorConfirmedTime(selectedBooking) && (
                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                      Confirmed: {formatSafeDateTime(getDoctorConfirmedTime(selectedBooking))}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Patient WhatsApp
                  </p>
                  <p className="mt-2 font-semibold text-premium-purple-plum">
                    {selectedBooking.patient_phone || 'Not provided yet'}
                  </p>
                  {selectedBooking.patient_phone && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() =>
                        window.open(
                          createWhatsAppHref(selectedBooking.patient_phone),
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                    >
                      Message on WhatsApp
                    </Button>
                  )}
                </div>
                <div className="rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Payment status
                  </p>
                  <p className="mt-2 font-semibold text-premium-purple-plum">
                    {getPaymentStateLabel(selectedBooking)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Consultation type
                  </p>
                  <p className="mt-2 font-semibold text-premium-purple-plum">
                    {getConsultationType(selectedBooking)}
                  </p>
                </div>
                <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Visit category
                  </p>
                  <p className="mt-2 font-semibold text-premium-purple-plum">
                    {getConsultationFeeTypeLabel(selectedBooking)}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                  Reason for visit
                </p>
                <p className="mt-2 text-sm text-premium-purple-plum/75">
                  {getBookingReason(selectedBooking)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(() => {
                  const messagingUnavailableReason = getMessagingUnavailableReason(selectedBooking);
                  return (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={
                        busyId === selectedBooking.id || Boolean(messagingUnavailableReason)
                      }
                      onClick={() => handleMessagePatient(selectedBooking)}
                    >
                      <MessageCircle className="h-4 w-4" />{' '}
                      {busyId === selectedBooking.id ? 'Opening...' : 'Message patient'}
                    </Button>
                  );
                })()}
                <Button
                  size="sm"
                  disabled={
                    busyId === selectedBooking.id ||
                    ['completed', 'cancelled', 'confirmed'].includes(
                      getBookingStatus(selectedBooking)
                    ) ||
                    getPaymentStatus(selectedBooking) !== 'paid'
                  }
                  onClick={() => handleConfirmBooking(selectedBooking)}
                >
                  <CheckCircle2 className="h-4 w-4" />{' '}
                  {busyId === selectedBooking.id
                    ? 'Updating...'
                    : getPaymentStatus(selectedBooking) === 'paid'
                      ? 'Confirm appointment'
                      : 'Await payment'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={
                    busyId === selectedBooking.id ||
                    ['completed', 'cancelled'].includes(getBookingStatus(selectedBooking))
                  }
                  onClick={() => setShowRescheduleForm((current) => !current)}
                >
                  <CalendarDays className="h-4 w-4" />{' '}
                  {showRescheduleForm ? 'Close suggestion' : 'Suggest new time'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    busyId === selectedBooking.id ||
                    ['completed', 'cancelled'].includes(getBookingStatus(selectedBooking))
                  }
                  onClick={() => handleStatusChange(selectedBooking.id, 'completed')}
                >
                  Complete consultation
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={
                    busyId === selectedBooking.id ||
                    ['completed', 'cancelled'].includes(getBookingStatus(selectedBooking))
                  }
                  onClick={() => setShowDeclineForm((current) => !current)}
                >
                  <XCircle className="h-4 w-4" />{' '}
                  {showDeclineForm ? 'Close decline' : 'Decline booking'}
                </Button>
                {getBookingStatus(selectedBooking) === 'completed' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === selectedBooking.id}
                    onClick={() => handleArchiveBooking(selectedBooking.id)}
                  >
                    <Archive className="h-4 w-4" /> Archive
                  </Button>
                )}
                <Link to="/consultations">
                  <Button size="sm" variant="secondary">
                    Open consultation workspace
                  </Button>
                </Link>
              </div>

              {getMessagingUnavailableReason(selectedBooking) && (
                <p className="text-sm font-semibold text-premium-purple-plum/60">
                  {getMessagingUnavailableReason(selectedBooking)}
                </p>
              )}

              {showRescheduleForm &&
                !['completed', 'cancelled'].includes(getBookingStatus(selectedBooking)) && (
                  <form
                    onSubmit={handleSuggestTimeSubmit}
                    className="space-y-4 rounded-3xl border border-amber-200 bg-amber-50/70 p-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-amber-900">
                        Propose a new appointment time
                      </p>
                      <p className="mt-1 text-sm text-amber-800">
                        If your schedule changes, you can offer the patient a calmer alternative
                        time with a reassuring note.
                      </p>
                    </div>
                    <input
                      type="datetime-local"
                      className="premium-input"
                      value={rescheduleForm.booking_date}
                      onChange={(event) =>
                        setRescheduleForm((current) => ({
                          ...current,
                          booking_date: event.target.value,
                        }))
                      }
                      min={new Date().toISOString().slice(0, 16)}
                      required
                    />
                    <textarea
                      rows="3"
                      className="premium-input min-h-[96px]"
                      placeholder="Optional reassuring note, for example: I’m sorry for the inconvenience. I’m still available to see you and have proposed a new suitable time."
                      value={rescheduleForm.reason}
                      onChange={(event) =>
                        setRescheduleForm((current) => ({ ...current, reason: event.target.value }))
                      }
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowRescheduleForm(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={busyId === selectedBooking.id}>
                        {busyId === selectedBooking.id
                          ? 'Sending suggestion...'
                          : 'Suggest new time'}
                      </Button>
                    </div>
                  </form>
                )}

              {showDeclineForm &&
                !['completed', 'cancelled'].includes(getBookingStatus(selectedBooking)) && (
                  <form
                    onSubmit={handleDeclineSubmit}
                    className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50/70 p-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-rose-900">Decline this booking</p>
                      <p className="mt-1 text-sm text-rose-800">
                        Use this only when you cannot take this appointment. The request will be
                        closed and the patient will be notified.
                      </p>
                    </div>
                    <textarea
                      rows="3"
                      className="premium-input min-h-[96px]"
                      placeholder="Optional reason for the patient, for example: I’m not available at this time. Please book another slot."
                      value={declineReason}
                      onChange={(event) => setDeclineReason(event.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowDeclineForm(false)}
                      >
                        Keep booking
                      </Button>
                      <Button type="submit" disabled={busyId === selectedBooking.id}>
                        {busyId === selectedBooking.id ? 'Declining...' : 'Decline booking'}
                      </Button>
                    </div>
                  </form>
                )}

              <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                  Internal notes
                </p>
                <textarea
                  rows="5"
                  className="premium-input mt-3 min-h-[140px]"
                  placeholder="Add your internal preparation notes for this patient visit"
                  value={bookingNotes[selectedBooking.id] ?? ''}
                  onChange={(event) => handleNoteChange(selectedBooking.id, event.target.value)}
                />
                <p className="mt-2 text-xs text-premium-purple-plum/50">
                  These notes are saved to your clinic workspace for future reference.
                </p>
              </div>

              <div>
                <p className="mb-3 text-sm font-bold text-premium-purple-plum">Timeline</p>
                <div className="space-y-3">
                  {timeline.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/40 p-4"
                    >
                      <p className="font-semibold text-premium-purple-plum">{item.label}</p>
                      <p className="mt-1 text-xs text-premium-purple-plum/55">
                        {formatDateTime(item.time)} · {formatRelativeTime(item.time)}
                      </p>
                      <p className="mt-2 text-sm text-premium-purple-plum/70">{item.helper}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

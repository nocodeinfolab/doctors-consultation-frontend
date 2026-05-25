import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Link2,
  MessageCircle,
  RefreshCw,
  Share2,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { Button, ErrorState, LoadingState } from '../../../components/ui';
import { getDashboardSummary, getCurrentUser, initiateBookingChat } from '../../../services/api';
import { clearStoredAuthSession, getStoredUser } from '../../../services/authStorage';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatStatusLabel = (value = '') =>
  String(value || 'pending')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getPatientName = (booking) =>
  booking?.patient?.name ||
  booking?.patient?.full_name ||
  booking?.patient_name ||
  booking?.patient_full_name ||
  'Patient';

const getServiceType = (booking) =>
  booking?.service_name ||
  booking?.consultation_service_name ||
  booking?.service_type ||
  booking?.consultation_type ||
  booking?.reason ||
  'Private consultation';

const getBookingStatus = (booking) =>
  booking?.booking_status || booking?.status || booking?.consultation_status || 'pending';

const getPaymentStatus = (booking) => booking?.payment_status || 'pending';

const getBookingDateLabel = (booking, includeTime = true) => {
  const dateValue = booking?.booking_date || booking?.created_at;

  if (!dateValue) {
    return 'Time unavailable';
  }

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Time unavailable';
  }

  return parsedDate.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
};

const isToday = (booking) => {
  const dateValue = booking?.booking_date;
  if (!dateValue) return false;

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return false;

  const today = new Date();
  return parsedDate.toDateString() === today.toDateString();
};

const getStatusTone = (status) => {
  const normalized = String(status || '').toLowerCase();

  if (['paid', 'confirmed', 'completed', 'consultation_logged', 'logged'].includes(normalized)) {
    return 'success';
  }

  if (['pending', 'pending_confirmation', 'reschedule_requested'].includes(normalized)) {
    return 'warning';
  }

  if (['unpaid', 'failed', 'cancelled', 'canceled'].includes(normalized)) {
    return 'critical';
  }

  return 'neutral';
};

const StatusPill = ({ children, tone }) => {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    critical: 'border-rose-200 bg-rose-50 text-rose-700',
    neutral: 'border-premium-lilac/35 bg-premium-lilac-light/50 text-premium-purple-plum/75',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${styles[tone || getStatusTone(children)]}`}
    >
      {formatStatusLabel(children)}
    </span>
  );
};

const DashboardSection = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`rounded-2xl border border-premium-lilac/25 bg-white/90 shadow-premium-soft ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-premium-lilac/20 px-5 py-4">
      <div>
        <h2 className="font-sans text-base font-bold tracking-normal text-premium-purple-plum">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-premium-purple-plum/58">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const KPICard = ({ label, value, helper, icon: Icon, accent = 'indigo' }) => {
  const accents = {
    indigo: 'bg-premium-lilac-light text-premium-purple-plum',
    gold: 'bg-premium-champagne-soft text-premium-champagne-gold',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="rounded-2xl border border-premium-lilac/25 bg-white/90 p-4 shadow-premium-soft">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-premium-purple-plum/52">
          {label}
        </p>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accents[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 break-words text-2xl font-bold leading-tight text-premium-purple-plum">
        {value}
      </p>
      <p className="mt-1 text-sm text-premium-purple-plum/55">{helper}</p>
    </div>
  );
};

const ReadinessChecklist = ({ items }) => (
  <div className="space-y-3">
    {items.map((item) => (
      <div
        key={item.title}
        className="flex items-start gap-3 rounded-xl border border-premium-lilac/20 bg-premium-pearl-tint/80 p-3"
      >
        <div
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
            item.complete
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          {item.complete ? <Check className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-premium-purple-plum">{item.title}</p>
          <p className="mt-0.5 text-xs leading-5 text-premium-purple-plum/55">{item.helper}</p>
        </div>
      </div>
    ))}
  </div>
);

const BookingLinkCard = ({ bookingLinkUrl, copied, onCopy }) => {
  const handleShare = async () => {
    if (!bookingLinkUrl || typeof navigator === 'undefined' || !navigator.share) return;

    await navigator.share({
      title: 'Book a consultation',
      text: 'Use this private KuraMedics link to request a consultation.',
      url: bookingLinkUrl,
    });
  };

  const shareSupported = typeof navigator !== 'undefined' && Boolean(navigator.share);

  return (
    <DashboardSection
      title="Booking Link"
      subtitle="Unique patient access for your clinic"
      action={
        bookingLinkUrl ? (
          <StatusPill tone="success">Active</StatusPill>
        ) : null
      }
    >
      {bookingLinkUrl ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-premium-lilac/25 bg-premium-pearl-tint p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-premium-purple-plum/50">
              Public booking URL
            </p>
            <code className="block break-all font-mono text-sm text-premium-purple-plum">
              {bookingLinkUrl}
            </code>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button type="button" size="sm" onClick={onCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => window.open(bookingLinkUrl, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-4 w-4" />
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!shareSupported}
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
          {!shareSupported && (
            <p className="text-xs text-premium-purple-plum/52">
              Use copy when native sharing is not available in this browser.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="font-semibold text-premium-purple-plum">No active booking link found</p>
          <p className="mt-1 text-sm text-premium-purple-plum/60">
            Your booking link will be generated automatically when your clinic setup is ready.
          </p>
        </div>
      )}
    </DashboardSection>
  );
};

const BookingQueueItem = ({
  booking,
  messageBusy,
  messagingEnabled,
  onMessage,
  onStartConsultation,
}) => {
  const status = getBookingStatus(booking);
  const paymentStatus = getPaymentStatus(booking);
  const paid = paymentStatus === 'paid';
  const canStartConsultation = paid && ['confirmed', 'pending_confirmation'].includes(status);
  const canMessage =
    messagingEnabled &&
    paid &&
    ['pending_confirmation', 'confirmed', 'reschedule_requested', 'completed'].includes(status);

  return (
    <div className="rounded-xl border border-premium-lilac/20 bg-white p-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="truncate font-semibold text-premium-purple-plum">{getPatientName(booking)}</p>
          <p className="mt-1 text-sm text-premium-purple-plum/58">{getServiceType(booking)}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-premium-purple-plum">
            {getBookingDateLabel(booking)}
          </p>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={paid ? 'success' : 'critical'}>{paid ? 'paid' : 'unpaid'}</StatusPill>
            <StatusPill>{status}</StatusPill>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!canStartConsultation}
            onClick={() => onStartConsultation(booking)}
            title={!paid ? 'Payment required before consultation.' : undefined}
          >
            <Stethoscope className="h-4 w-4" />
            Start
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canMessage || messageBusy}
            onClick={() => onMessage(booking)}
          >
            <MessageCircle className="h-4 w-4" />
            {messageBusy ? 'Opening' : 'Message'}
          </Button>
        </div>
      </div>
      {!paid && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Payment required before consultation.
        </p>
      )}
    </div>
  );
};

class DashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {}

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          icon={AlertCircle}
          title="Dashboard could not render"
          message="One clinic record could not be displayed. Refresh the dashboard or try again shortly."
          actionLabel="Refresh dashboard"
          onAction={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}

function DashboardContent() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [messageBusyId, setMessageBusyId] = useState('');

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSummaryError('');

      const storedUser = getStoredUser();
      if (storedUser) {
        setUser(storedUser);
      }

      const [summaryResult, userResult] = await Promise.allSettled([
        getDashboardSummary(),
        getCurrentUser(),
      ]);

      if (userResult.status === 'fulfilled') {
        setUser(userResult.value || storedUser || null);
      } else if (userResult.reason?.status === 401) {
        clearStoredAuthSession();
        navigate('/login', {
          replace: true,
          state: { message: 'Your session has expired. Please log in again.' },
        });
        return;
      } else {
        setUser(storedUser || null);
      }

      if (summaryResult.status === 'fulfilled') {
        const summaryData = summaryResult.value || {};
        setDashboardSummary(summaryData);
        setBookings(
          Array.isArray(summaryData?.recentBookings)
            ? summaryData.recentBookings.filter(Boolean)
            : []
        );
      } else if (summaryResult.reason?.status === 401) {
        clearStoredAuthSession();
        navigate('/login', {
          replace: true,
          state: { message: 'Your session has expired. Please log in again.' },
        });
        return;
      } else {
        setDashboardSummary({});
        setBookings([]);
        setSummaryError(
          summaryResult.reason?.message ||
            'Clinic metrics are temporarily unavailable. You can retry without leaving the dashboard.'
        );
      }

      if (summaryResult.status === 'rejected' && userResult.status === 'rejected') {
        setError('Dashboard data is temporarily unavailable. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const getDoctorName = useCallback(() => {
    if (user?.full_name) {
      return user.full_name.replace(/^Dr\.\s*/i, '');
    }
    return 'Doctor';
  }, [user?.full_name]);

  const bookingLinkUrl = useMemo(() => {
    if (!user?.booking_link_path) {
      return null;
    }

    const token = user.booking_link_path.split('/').pop();
    return `${window.location.origin}/book/${token}`;
  }, [user?.booking_link_path]);

  const secureMessagingEnabled = Boolean(
    user?.subscription_feature_entitlements?.secure_patient_messaging?.enabled
  );

  const dashboardStats = useMemo(() => {
    const recentBookings = bookings;
    const totalBookings = Number(dashboardSummary?.totalBookings || 0);
    const confirmedBookings = Number(dashboardSummary?.confirmedBookings || 0);
    const pendingBookings = Number(dashboardSummary?.pendingBookings || 0);
    const totalRevenue = Number(dashboardSummary?.totalRevenue || 0);
    const paidBookings = recentBookings.filter((booking) => getPaymentStatus(booking) === 'paid').length;
    const unreadMessages = Number(
      dashboardSummary?.unreadMessages ||
        dashboardSummary?.unreadMessageCount ||
        dashboardSummary?.unread_messages ||
        0
    );
    const readyConsultations = recentBookings.filter(
      (booking) => getPaymentStatus(booking) === 'paid' && getBookingStatus(booking) === 'confirmed'
    ).length;
    const todayBookings = recentBookings.filter(isToday).length;
    const followUpsDue = recentBookings.filter((booking) =>
      String(getServiceType(booking)).toLowerCase().includes('follow')
    ).length;

    return {
      totalBookings,
      confirmedBookings,
      pendingBookings,
      totalRevenue,
      paidBookings,
      unreadMessages,
      readyConsultations,
      todayBookings,
      followUpsDue,
      recentBookings,
    };
  }, [bookings, dashboardSummary]);

  const readinessItems = useMemo(
    () => [
      {
        title: 'Profile completed',
        complete: Boolean(user?.full_name && user?.specialization),
        helper: user?.specialization
          ? `${user.specialization} is visible to patients.`
          : 'Add your specialty and clinic details in settings.',
      },
      {
        title: 'Services configured',
        complete: Boolean(user?.subscription_plan_code || user?.specialization),
        helper: 'Consultation services and fees support the public booking flow.',
      },
      {
        title: 'Availability set',
        complete: dashboardStats.totalBookings > 0,
        helper:
          dashboardStats.totalBookings > 0
            ? 'Patients are already reaching your schedule.'
            : 'Set availability before sharing your link broadly.',
      },
      {
        title: 'Booking link ready',
        complete: Boolean(bookingLinkUrl),
        helper: bookingLinkUrl ? 'Your unique booking URL is active.' : 'A link is needed for patient requests.',
      },
      {
        title: 'Payment setup complete',
        complete: dashboardStats.totalRevenue > 0 || dashboardStats.paidBookings > 0,
        helper:
          dashboardStats.paidBookings > 0
            ? 'Paid bookings are being recorded.'
            : 'Confirm Paystack setup before taking live payments.',
      },
      {
        title: 'Verification status',
        complete: user?.account_status === 'active',
        helper:
          user?.account_status === 'active'
            ? 'Your doctor account is active.'
            : 'Verification or account review may still be pending.',
      },
    ],
    [bookingLinkUrl, dashboardStats, user]
  );

  const copyBookingLink = async () => {
    if (!bookingLinkUrl) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(bookingLinkUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = bookingLinkUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleMessagePatient = async (booking) => {
    if (!booking?.id) return;
    setMessageBusyId(booking.id);
    setError(null);
    try {
      const conversation = await initiateBookingChat(booking.id);
      navigate('/chat', {
        state: {
          conversationId: conversation?.id,
          bookingId: booking.id,
        },
      });
    } catch (err) {
      setError(err.message || 'Could not open secure messaging');
    } finally {
      setMessageBusyId('');
    }
  };

  if (loading) {
    return <LoadingState title="Loading dashboard" message="Fetching your clinic overview..." />;
  }

  if (error) {
    return (
      <ErrorState
        icon={AlertCircle}
        title="Could not load dashboard"
        message={error || 'Something went wrong. Please try again.'}
        actionLabel="Try again"
        onAction={loadDashboardData}
      />
    );
  }

  const operationalSummary = `You have ${dashboardStats.todayBookings} bookings today, ${dashboardStats.pendingBookings} pending confirmations, and ${dashboardStats.readyConsultations} consultation${dashboardStats.readyConsultations === 1 ? '' : 's'} ready to begin.`;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-premium-lilac/25 bg-white/90 p-5 shadow-premium-soft md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-premium-lilac/30 bg-premium-pearl-tint px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-premium-purple-plum/60">
              <ShieldCheck className="h-3.5 w-3.5 text-premium-champagne-gold" />
              KuraMedics Command Centre
            </div>
            <h1 className="font-sans text-2xl font-bold tracking-normal text-premium-purple-plum md:text-3xl">
              Welcome back, Dr. {getDoctorName()}
            </h1>
            <p className="mt-2 text-sm leading-6 text-premium-purple-plum/64 md:text-base">
              {operationalSummary}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:w-[420px]">
            <Button type="button" size="sm" onClick={() => navigate('/bookings')}>
              <CalendarDays className="h-4 w-4" />
              Queue
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/consultations')}>
              <FileText className="h-4 w-4" />
              Notes
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={copyBookingLink} disabled={!bookingLinkUrl}>
              <Link2 className="h-4 w-4" />
              {linkCopied ? 'Copied' : 'Booking link'}
            </Button>
          </div>
        </div>
      </section>

      {summaryError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
          <div>
            <p className="font-bold">Clinic metrics need a refresh</p>
            <p className="mt-1">{summaryError}</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={loadDashboardData}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KPICard
          label="Today's Bookings"
          value={dashboardStats.todayBookings}
          helper="Scheduled for today"
          icon={CalendarDays}
        />
        <KPICard
          label="Pending Consultations"
          value={dashboardStats.pendingBookings}
          helper="Needs confirmation"
          icon={Clock3}
          accent="amber"
        />
        <KPICard
          label="Paid Bookings"
          value={dashboardStats.paidBookings}
          helper="Recent paid requests"
          icon={CheckCircle2}
          accent="green"
        />
        <KPICard
          label="Revenue This Month"
          value={formatCurrency(dashboardStats.totalRevenue)}
          helper="Paid payments"
          icon={CreditCard}
          accent="gold"
        />
        {secureMessagingEnabled && (
          <KPICard
            label="Unread Messages"
            value={dashboardStats.unreadMessages}
            helper="Secure patient messages"
            icon={MessageCircle}
          />
        )}
        <KPICard
          label="Follow-ups Due"
          value={dashboardStats.followUpsDue}
          helper="From recent queue"
          icon={Activity}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <DashboardSection
            title="Operational Queue"
            subtitle="Recent booking requests with payment and confirmation status"
            action={
              <Link
                to="/bookings"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-premium-purple-plum/70 transition-colors hover:bg-premium-lilac-light hover:text-premium-purple-plum"
              >
                View all
              </Link>
            }
          >
            {dashboardStats.recentBookings.length > 0 ? (
              <div className="space-y-3">
                {dashboardStats.recentBookings.map((booking, index) => (
                  <BookingQueueItem
                    key={booking?.id || `booking-${index}`}
                    booking={booking}
                    messagingEnabled={secureMessagingEnabled}
                    messageBusy={messageBusyId === booking?.id}
                    onMessage={handleMessagePatient}
                    onStartConsultation={() => navigate('/consultations')}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-premium-lilac/20 bg-premium-pearl-tint p-8 text-center">
                <CalendarDays className="mx-auto h-9 w-9 text-premium-purple-plum/28" />
                <h3 className="mt-4 text-base font-semibold text-premium-purple-plum">
                  Your clinic queue is clear
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-premium-purple-plum/58">
                  Share your booking link to start receiving private consultation requests.
                </p>
                <Button type="button" onClick={copyBookingLink} disabled={!bookingLinkUrl} className="mx-auto mt-5">
                  <Share2 className="h-4 w-4" />
                  Share booking link
                </Button>
              </div>
            )}
          </DashboardSection>

          <DashboardSection
            title="Recent Consultations"
            subtitle="Paid and completed clinical work stays visible for quick handoff"
            action={
              <Link
                to="/consultations"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-premium-purple-plum/70 transition-colors hover:bg-premium-lilac-light hover:text-premium-purple-plum"
              >
                Open notes
              </Link>
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              {dashboardStats.recentBookings.slice(0, 4).map((booking, index) => {
                const paid = getPaymentStatus(booking) === 'paid';
                const completed = getBookingStatus(booking) === 'completed';

                return (
                  <div
                    key={booking?.id || `consultation-${index}`}
                    className="rounded-xl border border-premium-lilac/20 bg-premium-pearl-tint/80 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-premium-purple-plum">
                          {getPatientName(booking)}
                        </p>
                        <p className="mt-1 text-sm text-premium-purple-plum/56">
                          {getBookingDateLabel(booking)}
                        </p>
                      </div>
                      <StatusPill tone={completed ? 'success' : paid ? 'neutral' : 'critical'}>
                        {completed ? 'Consultation Logged' : paid ? 'Confirmed' : 'Unpaid'}
                      </StatusPill>
                    </div>
                  </div>
                );
              })}
              {dashboardStats.recentBookings.length === 0 && (
                <p className="rounded-xl border border-premium-lilac/20 bg-premium-pearl-tint p-4 text-sm text-premium-purple-plum/58 md:col-span-2">
                  Recent consultation activity will appear here after bookings are confirmed and completed.
                </p>
              )}
            </div>
          </DashboardSection>
        </div>

        <aside className="space-y-6">
          <BookingLinkCard
            bookingLinkUrl={bookingLinkUrl}
            copied={linkCopied}
            onCopy={copyBookingLink}
          />

          <DashboardSection title="Clinic Readiness" subtitle="Setup checks for a reliable patient flow">
            <ReadinessChecklist items={readinessItems} />
          </DashboardSection>

          <DashboardSection
            title="Secure Messaging"
            subtitle={secureMessagingEnabled ? 'Patient messaging is enabled' : 'Plan-gated feature'}
          >
            <div className="rounded-xl border border-premium-lilac/20 bg-premium-pearl-tint p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-premium-lilac-light text-premium-purple-plum">
                  {secureMessagingEnabled ? (
                    <MessageCircle className="h-4 w-4" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-premium-purple-plum">
                    {secureMessagingEnabled
                      ? 'Messaging is available for eligible paid bookings.'
                      : 'Messaging is available on Professional and Premium plans.'}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-premium-purple-plum/58">
                    {secureMessagingEnabled
                      ? 'Doctors and patients can continue secure post-booking communication from the chat workspace.'
                      : 'This is a subscription capability, not a clinic error. Upgrade when secure patient messaging becomes part of your workflow.'}
                  </p>
                </div>
              </div>
            </div>
          </DashboardSection>
        </aside>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <DashboardErrorBoundary>
      <DashboardContent />
    </DashboardErrorBoundary>
  );
}

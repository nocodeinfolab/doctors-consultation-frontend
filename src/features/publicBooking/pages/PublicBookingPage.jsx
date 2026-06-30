import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Download,
  HeartPulse,
  Lock,
  LogIn,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
  UserPlus,
} from 'lucide-react';
import GoogleAuthButton from '../../../components/auth/GoogleAuthButton';
import { Avatar, Badge, Button, Card, Input, LoadingState } from '../../../components/ui';
import {
  analyzeReasonForVisit,
  cancelMyBooking,
  cancelPaymentReference,
  createPayment,
  createPublicBooking,
  getAiBookingGuidance,
  getMyBookings,
  getMyNotifications,
  getPatientProfile,
  getPublicBookingContext,
  googleAuth,
  loginUser,
  registerPatient,
  trackAiInteraction,
  updatePatientProfile,
  verifyPaymentReference,
} from '../../../services/api';
import {
  clearStoredAuthSession,
  getStoredUser,
  setStoredAuthSession,
} from '../../../services/authStorage';

const formatBookingDate = (value) => {
  if (!value) {
    return 'Not provided';
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const formatDoctorDisplayName = (fullName) => {
  if (!fullName) {
    return 'Your doctor';
  }

  const cleanedName = String(fullName).trim().replace(/\s+/g, ' ');
  return /^dr\.?\s/i.test(cleanedName) ? cleanedName : `Dr. ${cleanedName}`;
};

const formatDoctorChipName = (fullName) => {
  if (!fullName) {
    return 'This doctor';
  }

  const parts = String(fullName).trim().split(/\s+/);
  if (parts[0]?.toLowerCase().startsWith('dr')) {
    const lastName = parts[parts.length - 1];
    return `Dr. ${lastName}`;
  }

  return parts.slice(0, 2).join(' ');
};

const WHATSAPP_REGEX = /^\+?[0-9]{7,15}$/;
const PATIENT_FEEDBACK_STORAGE_KEY = 'kuramedics_patient_feedback';

const loadPatientFeedback = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(PATIENT_FEEDBACK_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const savePatientFeedback = (value) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PATIENT_FEEDBACK_STORAGE_KEY, JSON.stringify(value));
};

const getBookingBadgeVariant = (status) => {
  if (status === 'confirmed' || status === 'completed') {
    return 'success';
  }

  if (status === 'cancelled') {
    return 'error';
  }

  return 'warning';
};

const getPaymentBadgeVariant = (status) => {
  if (status === 'paid') {
    return 'success';
  }

  if (status === 'failed') {
    return 'error';
  }

  return 'warning';
};

const consultationServiceBadge = {
  video_consultation: 'Online',
  chat_consultation: 'Online',
  home_visit: 'Home Visit',
  walk_in_clinic: 'Walk-in',
};

const formatNaira = (value, currency = 'NGN') =>
  `${currency} ${Number(value || 0).toLocaleString()}`;

const isUpcomingReminder = (booking) => {
  const when = new Date(booking?.booking_date || '').getTime();

  if (!Number.isFinite(when)) {
    return false;
  }

  const now = Date.now();
  return (
    when > now &&
    when - now <= 24 * 60 * 60 * 1000 &&
    ['pending', 'confirmed'].includes(booking?.status)
  );
};

const TrustChip = ({ icon: Icon, label, description, index }) => (
  <div className="relative" style={{ animationDelay: `${index * 90}ms` }}>
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/90 shadow-premium-soft backdrop-blur-md transition-all duration-200 hover:border-premium-champagne-gold/30 hover:bg-white/15 hover:text-white"
      aria-label={`${label}: ${description}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-premium-champagne-gold" />
      <span>{label}</span>
    </button>
  </div>
);

const CollapsibleSection = ({
  title,
  summary,
  isExpanded,
  onToggle,
  children,
  hasError = false,
  errorMessage = '',
  className = '',
  containerRef,
  headerRef,
}) => {
  const contentRef = useRef(null);
  const contentId = `${title.replace(/\s+/g, '-').toLowerCase()}-content`;

  useEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return undefined;
    }

    const focusableElements = content.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    focusableElements.forEach((element) => {
      if (!isExpanded) {
        if (!element.dataset.previousTabIndex) {
          element.dataset.previousTabIndex = element.getAttribute('tabindex') ?? '';
        }
        element.setAttribute('tabindex', '-1');
        return;
      }

      const previousTabIndex = element.dataset.previousTabIndex;
      if (previousTabIndex === '') {
        element.removeAttribute('tabindex');
      } else if (previousTabIndex) {
        element.setAttribute('tabindex', previousTabIndex);
      }
      delete element.dataset.previousTabIndex;
    });

    return undefined;
  }, [isExpanded, children]);

  return (
    <div ref={containerRef} className={`scroll-mt-24 space-y-3 ${className}`}>
      <button
        ref={headerRef}
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-premium-purple-plum/30 focus:ring-offset-2 focus:ring-offset-white ${
          hasError
            ? 'border-rose-200 bg-rose-50/70'
            : isExpanded
              ? 'border-premium-purple-plum bg-premium-lilac-light/40 shadow-premium-soft'
              : 'border-premium-lilac/20 bg-white/70 hover:bg-white'
        }`}
        aria-expanded={isExpanded}
        aria-controls={contentId}
      >
        <div className="flex min-w-0 items-center gap-3">
          <ChevronDown
            className={`h-4 w-4 text-premium-purple-plum transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-premium-purple-plum">{title}</p>
            {!isExpanded && summary && (
              <p className="break-words text-xs text-premium-purple-plum/60">{summary}</p>
            )}
          </div>
        </div>
        {hasError && <AlertCircle className="h-4 w-4 text-rose-500" />}
      </button>
      {hasError && errorMessage && (
        <p className="px-1 text-sm font-semibold text-rose-600">{errorMessage}</p>
      )}

      <div
        id={contentId}
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
        style={{
          gridTemplateRows: isExpanded ? '1fr' : '0fr',
          opacity: isExpanded ? 1 : 0,
          pointerEvents: isExpanded ? 'auto' : 'none',
        }}
        aria-hidden={!isExpanded}
        inert={isExpanded ? undefined : ''}
      >
        <div
          ref={contentRef}
          className={`min-h-0 ${isExpanded ? 'overflow-visible' : 'overflow-hidden'}`}
        >
          <div className="space-y-3 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default function PublicBookingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [doctorContext, setDoctorContext] = useState(null);
  const [viewer, setViewer] = useState(getStoredUser());
  const [authMode, setAuthMode] = useState('register');
  const [authError, setAuthError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingErrorTarget, setBookingErrorTarget] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [patientProfileLoading, setPatientProfileLoading] = useState(false);
  const [patientContactSaving, setPatientContactSaving] = useState(false);
  const [patientProfile, setPatientProfile] = useState(null);
  const [patientContactForm, setPatientContactForm] = useState({ whatsapp_number: '' });
  const [patientContactError, setPatientContactError] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentResult, setPaymentResult] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reasonAssistLoading, setReasonAssistLoading] = useState(false);
  const [structuredVisit, setStructuredVisit] = useState(null);
  const [useStructuredVisit, setUseStructuredVisit] = useState(false);
  const [structuredVisitEdited, setStructuredVisitEdited] = useState(false);
  const [bookingGuidance, setBookingGuidance] = useState(null);
  const [patientBookings, setPatientBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [feedbackByBooking, setFeedbackByBooking] = useState(loadPatientFeedback);
  const [consultationFeeTypeTouched, setConsultationFeeTypeTouched] = useState(false);
  const [authForm, setAuthForm] = useState({ email: '', password: '', whatsapp_number: '' });
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    email: '',
    whatsapp_number: '',
    password: '',
    confirmPassword: '',
  });
  const [bookingForm, setBookingForm] = useState({
    booking_date: '',
    reason: '',
    visit_type: 'initial',
    consultation_service_id: '',
    consultation_fee_type: 'first_time',
  });
  const [consentForm, setConsentForm] = useState({
    patient_consent_given: false,
    emergency_acknowledged: false,
  });
  const bookingSnapshotRef = useRef('');
  const authSectionRef = useRef(null);
  const serviceSectionRef = useRef(null);
  const feeSectionRef = useRef(null);
  const dateTimeSectionRef = useRef(null);
  const reasonSectionRef = useRef(null);
  const submitSectionRef = useRef(null);
  const consultationTypeHeaderRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [nextSection, setNextSection] = useState(null);

  // Collapsible section states
  const [consultationTypeExpanded, setConsultationTypeExpanded] = useState(true);

  const loadDoctorContext = useCallback(async () => {
    if (!token) {
      setPageError('This booking link is missing or invalid.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError('');

    try {
      const data = await getPublicBookingContext(token);
      setDoctorContext(data);
    } catch (err) {
      setPageError(err.message || 'This booking link is invalid, expired, or unavailable.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDoctorContext();
  }, [loadDoctorContext]);

  const patientSignedIn = viewer?.role === 'patient';
  const paymentReference = searchParams.get('reference') || searchParams.get('trxref');

  const loadPatientProfile = useCallback(async () => {
    if (!getStoredUser() || getStoredUser()?.role !== 'patient') {
      setPatientProfile(null);
      setPatientContactForm({ whatsapp_number: '' });
      return null;
    }

    setPatientProfileLoading(true);
    setPatientContactError('');

    try {
      const profile = await getPatientProfile();
      setPatientProfile(profile);
      setPatientContactForm({
        whatsapp_number: profile?.whatsapp_number || profile?.phone_number || '',
      });
      return profile;
    } catch (err) {
      setPatientContactError(err.message || 'Could not load your patient contact details');
      return null;
    } finally {
      setPatientProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (patientSignedIn) {
      loadPatientProfile();
    } else {
      setPatientProfile(null);
      setPatientContactForm({ whatsapp_number: '' });
      setPatientContactError('');
    }
  }, [patientSignedIn, loadPatientProfile]);

  useEffect(() => {
    savePatientFeedback(feedbackByBooking);
  }, [feedbackByBooking]);

  const loadPatientWorkspace = useCallback(async ({ silent = false } = {}) => {
    if (!getStoredUser() || getStoredUser()?.role !== 'patient') {
      setPatientBookings([]);
      setNotifications([]);
      bookingSnapshotRef.current = '';
      return;
    }

    if (!silent) {
      setHistoryLoading(true);
    }

    try {
      const [bookingsResponse, notificationsResponse] = await Promise.all([
        getMyBookings(),
        getMyNotifications(),
      ]);

      const nextBookings = Array.isArray(bookingsResponse?.items) ? bookingsResponse.items : [];
      const nextNotifications = Array.isArray(notificationsResponse?.items)
        ? notificationsResponse.items
        : [];
      const nextSnapshot = JSON.stringify(
        nextBookings.map((booking) => ({
          id: booking.id,
          status: booking.status,
          payment_status: booking.payment_status,
          updated_at: booking.updated_at,
        }))
      );

      if (bookingSnapshotRef.current && bookingSnapshotRef.current !== nextSnapshot) {
        setInfoMessage('Your care activity has been refreshed with the latest booking updates.');
      }

      bookingSnapshotRef.current = nextSnapshot;
      setPatientBookings(nextBookings);
      setNotifications(nextNotifications);
    } catch {
      // Keep the booking flow usable even if background activity refresh is temporarily unavailable.
    } finally {
      if (!silent) {
        setHistoryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!patientSignedIn) {
      setPatientBookings([]);
      setNotifications([]);
      setBookingGuidance(null);
      bookingSnapshotRef.current = '';
      return undefined;
    }

    loadPatientWorkspace();

    const intervalId = window.setInterval(() => {
      loadPatientWorkspace({ silent: true });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [patientSignedIn, loadPatientWorkspace]);

  useEffect(() => {
    if (!paymentReference || !patientSignedIn) {
      return;
    }

    let cancelled = false;

    const verifyReturnedPayment = async () => {
      setPaymentLoading(true);
      setPaymentError('');

      try {
        const payment = await verifyPaymentReference(paymentReference);

        if (cancelled) {
          return;
        }

        setPaymentResult(payment);
        setConfirmation({
          id: payment.booking_id,
          booking_date: payment.booking_date,
          status: payment.booking_status || 'pending',
        });
        setInfoMessage(
          payment.status === 'paid'
            ? 'Payment verified successfully. Your booking is now confirmed.'
            : payment.status === 'failed'
              ? 'Payment was not successful. You can retry securely from this page.'
              : 'Payment is still pending confirmation. We will refresh the status once it is verified.'
        );
      } catch (err) {
        if (!cancelled) {
          setPaymentError(err.message || 'Could not verify your payment status right now.');
        }
      } finally {
        if (!cancelled) {
          setPaymentLoading(false);
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete('reference');
          nextParams.delete('trxref');
          nextParams.delete('payment_status');
          setSearchParams(nextParams, { replace: true });
        }
      }
    };

    verifyReturnedPayment();

    return () => {
      cancelled = true;
    };
  }, [paymentReference, patientSignedIn, searchParams, setSearchParams]);

  useEffect(() => {
    const handleScroll = () => {
      const viewportHeight = window.innerHeight;
      const scrollY = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;

      // Show button if there's more content below the viewport
      const hasMoreContent = scrollY + viewportHeight < documentHeight - 100; // 100px buffer
      setShowScrollButton(hasMoreContent);

      // Determine next section to scroll to
      const sections = [
        { ref: authSectionRef, name: 'auth' },
        { ref: serviceSectionRef, name: 'service' },
        { ref: feeSectionRef, name: 'fee' },
        { ref: dateTimeSectionRef, name: 'datetime' },
        { ref: reasonSectionRef, name: 'reason' },
        { ref: submitSectionRef, name: 'submit' },
      ];

      for (const section of sections) {
        if (section.ref.current) {
          const rect = section.ref.current.getBoundingClientRect();
          if (rect.top > viewportHeight * 0.5) {
            // Section is below halfway point
            setNextSection(section.name);
            return;
          }
        }
      }
      setNextSection(null); // At the bottom
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Manage collapsible section states based on form values
  useEffect(() => {
    // Consultation type section: expand if no service selected, collapse if selected
    setConsultationTypeExpanded(!bookingForm.consultation_service_id);
  }, [bookingForm.consultation_service_id]);

  // Auto-expand sections with validation errors
  useEffect(() => {
    if (bookingErrorTarget === 'consultation_type') {
      setConsultationTypeExpanded(true);
    }
  }, [bookingErrorTarget]);

  const doctor = useMemo(() => doctorContext?.doctor || null, [doctorContext]);
  const doctorVerified = doctor?.verification_status === 'verified';
  const doctorDisplayName = useMemo(
    () => formatDoctorDisplayName(doctor?.full_name),
    [doctor?.full_name]
  );
  const paymentCurrency = doctor?.currency || 'NGN';
  const availableServices = useMemo(
    () => (Array.isArray(doctor?.consultation_services) ? doctor.consultation_services : []),
    [doctor?.consultation_services]
  );
  const selectedService = useMemo(
    () =>
      availableServices.find((service) => service.id === bookingForm.consultation_service_id) ||
      null,
    [availableServices, bookingForm.consultation_service_id]
  );
  const initialConsultationFee = Number(doctor?.consultation_fee || 0);
  const followUpReviewFee = Number(doctor?.follow_up_fee || 0);
  const selectedFirstTimeFee = Number(
    selectedService?.first_time_price_amount ?? selectedService?.price_naira ?? 0
  );
  const selectedFollowUpFee = Number(selectedService?.follow_up_price_amount ?? 0);
  const followUpUnavailable = Boolean(selectedService) && selectedFollowUpFee <= 0;
  const requiresFeeTypeChoice = Boolean(selectedService) && !followUpUnavailable;
  const consultationTypeSelectionComplete =
    Boolean(selectedService) && (!requiresFeeTypeChoice || consultationFeeTypeTouched);
  const selectedConsultationFee = selectedService
    ? bookingForm.consultation_fee_type === 'follow_up'
      ? selectedFollowUpFee
      : selectedFirstTimeFee
    : bookingForm.visit_type === 'follow_up' && followUpReviewFee > 0
      ? followUpReviewFee
      : initialConsultationFee;
  console.log({
      consultationServiceId: bookingForm.consultation_service_id,
      selectedService,
      selectedConsultationFee,
      initialConsultationFee,
      followUpReviewFee,
      canCollectPaymentNow
  });
  const canCollectPaymentNow =
    selectedService?.requires_payment === false
      ? false
      : Number.isFinite(selectedConsultationFee) && selectedConsultationFee > 0;
  const missingConsultationFee = !canCollectPaymentNow;
  const patientWhatsappNumber =
    patientProfile?.whatsapp_number || patientProfile?.phone_number || '';
  const patientNeedsWhatsapp = patientSignedIn && !patientProfileLoading && !patientWhatsappNumber;
  const doctorChipName = useMemo(
    () => formatDoctorChipName(doctorDisplayName),
    [doctorDisplayName]
  );
  const trustChips = useMemo(
    () => [
      {
        id: 'private',
        icon: Lock,
        label: 'Private',
        description: 'This direct consultation request is only visible to this doctor',
      },
      ...(doctorVerified
        ? [
            {
              id: 'verified',
              icon: CheckCircle2,
              label: 'Verified doctor',
              description: 'Doctor licence has been reviewed and approved internally',
            },
          ]
        : []),
      {
        id: 'secure',
        icon: ShieldCheck,
        label: 'Secure consultation',
        description: 'Your consultation request is protected within a secure clinic flow',
      },
      {
        id: 'doctor-only',
        icon: User,
        label: `${doctorChipName} only`,
        description: `This clinic page is linked to ${doctorChipName} only`,
      },
    ],
    [doctorChipName, doctorVerified]
  );
  const responseTimeLabel = doctorVerified
    ? 'Typical reply within 2 hours'
    : doctor?.is_available
      ? 'Usually replies the same day'
      : 'Response may take a little longer today';
  const bookingHistory = useMemo(
    () => [...patientBookings].sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date)),
    [patientBookings]
  );
  const liveUpdates = useMemo(() => notifications.slice(0, 4), [notifications]);
  const reminderBookings = useMemo(
    () => bookingHistory.filter((booking) => isUpcomingReminder(booking)).slice(0, 3),
    [bookingHistory]
  );
  const completedBookings = useMemo(
    () => bookingHistory.filter((booking) => booking.status === 'completed').slice(0, 3),
    [bookingHistory]
  );

  useEffect(() => {
    if (!patientSignedIn || bookingHistory.length === 0) {
      setBookingGuidance(null);
      return;
    }

    let active = true;

    const loadGuidance = async () => {
      try {
        const guidance = await getAiBookingGuidance(bookingHistory.slice(0, 8));
        if (active) {
          setBookingGuidance(guidance);
        }
      } catch {
        if (active) {
          setBookingGuidance(null);
        }
      }
    };

    loadGuidance();
    return () => {
      active = false;
    };
  }, [patientSignedIn, bookingHistory]);

  const handleAuthChange = (event) => {
    const { name, value } = event.target;
    setAuthForm((current) => ({ ...current, [name]: value }));
  };

  const handleRegisterChange = (event) => {
    const { name, value } = event.target;
    setRegisterForm((current) => ({ ...current, [name]: value }));
  };

  const handleBookingChange = (event) => {
    const { name, value } = event.target;
    setBookingForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'visit_type'
        ? { consultation_fee_type: value === 'follow_up' ? 'follow_up' : 'first_time' }
        : {}),
    }));

    if (name === 'booking_date' && value) {
      setBookingError('');
      setBookingErrorTarget('');
      scrollAndFocusSection(reasonSectionRef, reasonSectionRef);
    }
  };

  const handleConsultationServiceSelect = (service) => {
    if (!service?.id) {
      return;
    }

    setBookingError('');
    setBookingErrorTarget('');
    setConsultationFeeTypeTouched(false);
    setBookingForm((current) => ({
      ...current,
      consultation_service_id: service.id,
      consultation_fee_type:
        Number(service.follow_up_price_amount || 0) > 0
          ? current.consultation_fee_type
          : 'first_time',
    }));
    const hasFollowUpChoice = Number(service.follow_up_price_amount || 0) > 0;
    if (hasFollowUpChoice) {
      setConsultationTypeExpanded(true);
      window.setTimeout(() => {
        feeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
      return;
    }

    setConsultationFeeTypeTouched(true);
    setConsultationTypeExpanded(false);
    scrollAndFocusSection(dateTimeSectionRef, dateTimeSectionRef);
  };

  const handleConsultationFeeTypeSelect = (feeType) => {
    setBookingError('');
    setBookingErrorTarget('');
    setConsultationFeeTypeTouched(true);
    setBookingForm((current) => ({
      ...current,
      consultation_fee_type: feeType,
    }));
    setConsultationTypeExpanded(false);
    scrollAndFocusSection(dateTimeSectionRef, dateTimeSectionRef);
  };

  const handlePatientContactChange = (event) => {
    const { name, value } = event.target;
    setPatientContactForm((current) => ({ ...current, [name]: value }));
  };

  const fireAndForgetAiTracking = useCallback((feature, action, options = {}) => {
    trackAiInteraction({ feature, action, ...options }).catch(() => {});
  }, []);

  const handleAiReasonAssist = async (mode = 'generate') => {
    const input = bookingForm.reason.trim();

    if (!input) {
      setBookingError('Enter your reason for visit first so the AI helper can organize it.');
      return;
    }

    setReasonAssistLoading(true);
    setBookingError('');

    try {
      const result = await analyzeReasonForVisit({
        input,
        previous_activity: bookingHistory.slice(0, 8),
        regenerate_key: mode === 'regenerate' ? Date.now() : 0,
      });

      setStructuredVisit(result);
      setUseStructuredVisit(true);
      setStructuredVisitEdited(false);

      if (result.consultation_type === 'follow_up') {
        setBookingForm((current) => ({
          ...current,
          visit_type: 'follow_up',
          consultation_fee_type: 'follow_up',
        }));
      }
    } catch (err) {
      setBookingError(
        err.message || 'The AI helper is unavailable right now. You can still continue manually.'
      );
    } finally {
      setReasonAssistLoading(false);
    }
  };

  const handleStructuredVisitChange = (field, value) => {
    setStructuredVisit((current) => ({ ...current, [field]: value }));

    if (!structuredVisitEdited) {
      setStructuredVisitEdited(true);
      fireAndForgetAiTracking('booking_summary', 'edited', { changed: true, context: field });
    }
  };

  const applyStructuredVisitChoice = (shouldUseAi) => {
    setUseStructuredVisit(shouldUseAi);
    fireAndForgetAiTracking('booking_summary', shouldUseAi ? 'applied' : 'ignored', {
      changed: structuredVisitEdited,
      context: shouldUseAi ? 'structured_summary' : 'manual_text',
    });
  };

  const dismissStructuredVisit = () => {
    setStructuredVisit(null);
    setUseStructuredVisit(false);
    setStructuredVisitEdited(false);
    fireAndForgetAiTracking('booking_summary', 'ignored', { changed: false, context: 'dismissed' });
  };

  const applySuggestedVisitType = (label) => {
    const isFollowUp = String(label).toLowerCase().includes('follow-up');
    fireAndForgetAiTracking('booking_guidance', 'applied', { context: label });
    setBookingForm((current) => ({
      ...current,
      visit_type: isFollowUp ? 'follow_up' : 'initial',
      consultation_fee_type: isFollowUp ? 'follow_up' : 'first_time',
    }));
    setConsultationFeeTypeTouched(true);
    scrollToBookingForm();
  };

  const submitTenantBoundBooking = async () => {
    if (!bookingForm.booking_date) {
      throw new Error('Please tell the doctor your preferred appointment time.');
    }

    if (availableServices.length > 0 && !selectedService) {
      throw new Error('Please select a consultation type before booking');
    }

    if (requiresFeeTypeChoice && !consultationFeeTypeTouched) {
      throw new Error('Please choose initial consultation or follow-up consultation.');
    }

    if (
      selectedService &&
      bookingForm.consultation_fee_type === 'follow_up' &&
      followUpUnavailable
    ) {
      throw new Error('Follow-up pricing is not available for this service.');
    }

    const visitLabel =
      selectedService?.display_name ||
      (bookingForm.visit_type === 'follow_up' ? 'Follow-up review' : 'Initial consultation');
    const trimmedReason = bookingForm.reason.trim();
    const structuredReason =
      structuredVisit && useStructuredVisit
        ? [
            structuredVisit.symptoms?.length
              ? `Symptoms: ${structuredVisit.symptoms.join(', ')}`
              : '',
            structuredVisit.duration ? `Duration: ${structuredVisit.duration}` : '',
            structuredVisit.additional_notes ? `Notes: ${structuredVisit.additional_notes}` : '',
            structuredVisit.urgency_level ? `Urgency: ${structuredVisit.urgency_level}` : '',
          ]
            .filter(Boolean)
            .join(' | ')
        : '';

    return createPublicBooking(token, {
      booking_date: new Date(bookingForm.booking_date).toISOString(),
      reason: structuredReason
        ? `${visitLabel}: ${structuredReason}`
        : trimmedReason
          ? `${visitLabel}: ${trimmedReason}`
          : visitLabel,
      consultation_service_id: selectedService?.id,
      consultation_type: selectedService?.service_type,
      consultation_fee_type: selectedService ? bookingForm.consultation_fee_type : undefined,
      patient_consent_given: consentForm.patient_consent_given,
      emergency_acknowledged: consentForm.emergency_acknowledged,
    });
  };

  const finalizeAuthenticatedPatient = async (session, successMessage, whatsappCandidate = '') => {
    if (session.user?.role !== 'patient') {
      clearStoredAuthSession();
      throw new Error('Only patient accounts can book through this private doctor link.');
    }

    setStoredAuthSession(session);
    setViewer(session.user);

    let profile = await loadPatientProfile();
    const cleanedWhatsappCandidate = whatsappCandidate.trim();

    if (!profile?.whatsapp_number && cleanedWhatsappCandidate) {
      if (!WHATSAPP_REGEX.test(cleanedWhatsappCandidate)) {
        throw new Error('Enter a valid WhatsApp line in international format');
      }

      profile = await updatePatientProfile({ whatsapp_number: cleanedWhatsappCandidate });
      setPatientProfile(profile);
      setPatientContactForm({
        whatsapp_number:
          profile?.whatsapp_number || profile?.phone_number || cleanedWhatsappCandidate,
      });
    }

    const hasWhatsapp = Boolean(profile?.whatsapp_number || profile?.phone_number);

    if (!hasWhatsapp) {
      setInfoMessage(
        'Please add your WhatsApp line to complete your patient onboarding before sending this booking request.'
      );
      return;
    }

    setInfoMessage(successMessage);

    if (bookingForm.booking_date) {
      setBookingLoading(true);
      try {
        const booking = await submitTenantBoundBooking();
        setConfirmation(booking);

        if (booking?.payment_required !== false && canCollectPaymentNow && booking?.id) {
          await startPaymentFlow(booking.id);
        }
      } catch (err) {
        revealBookingError(err.message || 'Could not create booking');
      } finally {
        setBookingLoading(false);
      }
    }
  };

  const handlePatientLogin = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setInfoMessage('');

    try {
      const session = await loginUser({
        email: authForm.email,
        password: authForm.password,
      });
      await finalizeAuthenticatedPatient(
        session,
        bookingForm.booking_date
          ? 'You are signed in and your booking request is being submitted.'
          : 'You are signed in. Choose a time and submit your request.',
        authForm.whatsapp_number || ''
      );
    } catch (err) {
      setAuthError(err.message || 'Patient sign-in failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGooglePatientAccess = async (credential) => {
    setAuthLoading(true);
    setAuthError('');
    setInfoMessage('');

    try {
      const session = await googleAuth({
        credential,
        role: 'patient',
        whatsapp_number:
          authMode === 'register'
            ? registerForm.whatsapp_number.trim()
            : authForm.whatsapp_number.trim(),
        full_name: authMode === 'register' ? registerForm.full_name.trim() : undefined,
      });

      await finalizeAuthenticatedPatient(
        session,
        bookingForm.booking_date
          ? 'Your Google account is connected and your booking request is being submitted.'
          : 'Your patient account is connected with Google. Choose a time and submit your request.',
        authMode === 'register'
          ? registerForm.whatsapp_number || ''
          : authForm.whatsapp_number || ''
      );
    } catch (err) {
      setAuthError(err.message || 'Google sign-in failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePatientRegister = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setInfoMessage('');

    try {
      if (!registerForm.full_name.trim()) {
        throw new Error('Full name is required');
      }

      if (!registerForm.whatsapp_number.trim()) {
        throw new Error('WhatsApp line is required');
      }

      if (!/^\+?[0-9]{7,15}$/.test(registerForm.whatsapp_number.trim())) {
        throw new Error('Enter a valid WhatsApp line in international format');
      }

      if (registerForm.password.length < 12) {
        throw new Error('Use at least 12 characters for your password');
      }

      if (registerForm.password !== registerForm.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      await registerPatient({
        full_name: registerForm.full_name.trim(),
        email: registerForm.email.trim(),
        password: registerForm.password,
        whatsapp_number: registerForm.whatsapp_number.trim(),
      });

      const session = await loginUser({
        email: registerForm.email.trim(),
        password: registerForm.password,
      });

      await finalizeAuthenticatedPatient(
        session,
        bookingForm.booking_date
          ? 'Your account was created and your appointment request is being sent now.'
          : 'Your patient account is ready. Choose a time and submit your request.'
      );
    } catch (err) {
      setAuthError(err.message || 'Patient registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePatientContactSubmit = async (event) => {
    event.preventDefault();
    setPatientContactSaving(true);
    setPatientContactError('');
    setInfoMessage('');

    try {
      const whatsappNumber = patientContactForm.whatsapp_number.trim();

      if (!whatsappNumber) {
        throw new Error('WhatsApp line is required');
      }

      if (!WHATSAPP_REGEX.test(whatsappNumber)) {
        throw new Error('Enter a valid WhatsApp line in international format');
      }

      const updatedProfile = await updatePatientProfile({
        whatsapp_number: whatsappNumber,
      });

      setPatientProfile(updatedProfile);
      setPatientContactForm({
        whatsapp_number:
          updatedProfile?.whatsapp_number || updatedProfile?.phone_number || whatsappNumber,
      });
      setInfoMessage(
        'Your WhatsApp line has been saved. You can now continue with your appointment request.'
      );
    } catch (err) {
      setPatientContactError(err.message || 'Could not save your WhatsApp line');
    } finally {
      setPatientContactSaving(false);
    }
  };

  const startPaymentFlow = async (bookingId) => {
    if (!bookingId) {
      return;
    }

    if (confirmation?.payment_required === false) {
      setPaymentError('This booking is set for offline payment.');
      return;
    }

    if (!canCollectPaymentNow && !confirmation?.consultation_fee_amount) {
      setPaymentError(
        'Online payment is not available yet because this doctor has not set a valid consultation fee.'
      );
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');

    try {
      const payment = await createPayment({
        booking_id: bookingId,
        amount: undefined,
        currency: paymentCurrency,
        provider: 'paystack',
        return_path: `/book/${token}`,
      });

      setPaymentResult(payment);

      const checkoutUrl = payment.checkout_url || payment.authorization_url;

      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }

      throw new Error(
        'Paystack did not return a checkout link. Please confirm the payment keys and try again.'
      );
    } catch (err) {
      setPaymentError(err.message || 'Payment could not be completed right now. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const revealBookingError = (message, preferredTarget = '') => {
    setBookingError(message);

    if (preferredTarget === 'auth') {
      setBookingErrorTarget('auth');
      scrollAndFocusSection(authSectionRef, authSectionRef);
      return;
    }

    if (
      preferredTarget === 'consultation_type' ||
      (availableServices.length > 0 &&
        (!selectedService || (requiresFeeTypeChoice && !consultationFeeTypeTouched)))
    ) {
      setBookingErrorTarget('consultation_type');
      setConsultationTypeExpanded(true);
      scrollAndFocusSection(serviceSectionRef, consultationTypeHeaderRef);
      return;
    }

    if (preferredTarget === 'time' || !bookingForm.booking_date) {
      setBookingErrorTarget('time');
      scrollAndFocusSection(dateTimeSectionRef, dateTimeSectionRef);
      return;
    }

    setBookingErrorTarget('general');
    scrollAndFocusSection(submitSectionRef, submitSectionRef);
  };

  const handleBookingSubmit = async (event) => {
    event.preventDefault();
    setBookingError('');
    setBookingErrorTarget('');
    setInfoMessage('');

    try {
      if (!patientSignedIn) {
        revealBookingError('Please sign in or create a patient account to continue', 'auth');
        return;
      }

      if (patientNeedsWhatsapp) {
        revealBookingError(
          'Please add your WhatsApp line to complete onboarding before requesting an appointment',
          'auth'
        );
        return;
      }

      if (availableServices.length > 0 && !selectedService) {
        revealBookingError('Please select a consultation type before booking', 'consultation_type');
        return;
      }

      if (requiresFeeTypeChoice && !consultationFeeTypeTouched) {
        revealBookingError(
          'Please choose initial consultation or follow-up consultation.',
          'consultation_type'
        );
        return;
      }

      if (!bookingForm.booking_date) {
        revealBookingError('Please tell the doctor your preferred appointment time.', 'time');
        return;
      }

      if (!consentForm.patient_consent_given || !consentForm.emergency_acknowledged) {
        revealBookingError(
          'Please review and tick both consent acknowledgements before submitting.',
          'consent'
        );
        return;
      }

      setBookingLoading(true);
      const booking = await submitTenantBoundBooking();
      setPaymentError('');
      setPaymentResult(null);
      setConfirmation(booking);

      if (booking?.payment_required !== false && canCollectPaymentNow && booking?.id) {
        await startPaymentFlow(booking.id);
      }
    } catch (err) {
      revealBookingError(err.message || 'Could not create booking');
    } finally {
      setBookingLoading(false);
    }
  };

  const handlePaymentNow = async () => {
    if (!confirmation?.id) {
      return;
    }

    await startPaymentFlow(confirmation.id);
  };

  const handleDeclinePayment = async () => {
    const reference = paymentResult?.provider_reference || paymentResult?.transaction_id;

    if (!reference) {
      setPaymentError('There is no pending payment reference to cancel right now.');
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');

    try {
      const cancelledPayment = await cancelPaymentReference(
        reference,
        'Patient declined to continue with this consultation payment'
      );
      setPaymentResult(cancelledPayment);
      setConfirmation((current) =>
        current
          ? {
              ...current,
              status: cancelledPayment.booking_status || 'cancelled',
            }
          : current
      );
      setInfoMessage(
        'The pending payment was cancelled and this appointment request has been withdrawn.'
      );
      await loadPatientWorkspace({ silent: true });
    } catch (err) {
      setPaymentError(err.message || 'The pending payment could not be cancelled right now.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const scrollToBookingForm = () => {
    document
      .getElementById('appointment-request-form')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollAndFocusSection = (sectionRef, focusRef) => {
    window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => {
        focusRef.current?.focus({ preventScroll: true });
      }, 250);
    }, 80);
  };

  const scrollToNextSection = () => {
    const sections = [
      { ref: authSectionRef, name: 'auth' },
      { ref: serviceSectionRef, name: 'service' },
      { ref: feeSectionRef, name: 'fee' },
      { ref: dateTimeSectionRef, name: 'datetime' },
      { ref: reasonSectionRef, name: 'reason' },
      { ref: submitSectionRef, name: 'submit' },
    ];

    for (const section of sections) {
      if (section.ref.current) {
        const rect = section.ref.current.getBoundingClientRect();
        if (rect.top > 0) {
          // First section below the top
          section.ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
    }
  };

  const getConsultationTypeSummary = () => {
    if (!consultationTypeSelectionComplete) return null;
    const feeLabel =
      bookingForm.consultation_fee_type === 'follow_up'
        ? 'Follow-up consultation'
        : 'Initial consultation';
    return `Selected: ${selectedService?.display_name || 'Consultation'} · ${feeLabel}`;
  };

  const handleCancelExistingBooking = async (bookingId) => {
    if (!window.confirm('Cancel this appointment request?')) {
      return;
    }

    setBookingLoading(true);
    setBookingError('');

    try {
      const updatedBooking = await cancelMyBooking(bookingId);
      setInfoMessage('Your appointment request has been cancelled successfully.');
      setConfirmation((current) => (current?.id === bookingId ? updatedBooking : current));
      await loadPatientWorkspace({ silent: true });
    } catch (err) {
      setBookingError(err.message || 'This booking could not be cancelled right now.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleFollowUpShortcut = (booking) => {
    setConfirmation(null);
    setBookingForm({
      booking_date: '',
      reason: `Follow-up review after the visit on ${formatBookingDate(booking.booking_date)}`,
      visit_type: 'follow_up',
      consultation_fee_type: 'follow_up',
      consultation_service_id:
        availableServices.find((service) => service.service_type === 'video_consultation')?.id ||
        availableServices[0]?.id ||
        '',
    });
    scrollToBookingForm();
  };

  const handleDownloadReceipt = (booking = null) => {
    if (typeof window === 'undefined') {
      return;
    }

    const source = booking || confirmation || {};
    const receiptWindow = window.open('', '_blank', 'width=720,height=900');

    if (!receiptWindow) {
      return;
    }

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
          <p class="muted">Generated from your patient booking page</p>
          <div class="card">
            <p><strong>Doctor:</strong> ${doctorDisplayName}</p>
            <p><strong>Booking reference:</strong> ${String(source.id || '').slice(0, 8)}</p>
            <p><strong>Appointment time:</strong> ${formatBookingDate(source.booking_date)}</p>
            <p><strong>Payment status:</strong> ${paymentResult?.status || source.payment_status || 'paid'}</p>
            <p><strong>Visit type:</strong> ${bookingForm.consultation_fee_type === 'follow_up' ? 'Follow-up review' : 'First-time consultation'}</p>
          </div>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    receiptWindow.focus();
    receiptWindow.print();
  };

  const handleMessageDoctor = (bookingId) => {
    if (!bookingId) {
      return;
    }
    navigate(`/patient/bookings/${bookingId}/chat`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#170F28] via-[#23163A] to-[#2B1D43]">
        <LoadingState
          tone="dark"
          title="Validating doctor link"
          message="Checking secure tenant context..."
        />
      </div>
    );
  }

  if (pageError || !doctor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#170F28] via-[#23163A] to-[#2B1D43] px-6 py-12">
        <div className="w-full max-w-xl">
          <Card className="text-center">
            <div className="space-y-6 py-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-rose-600">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-premium-purple-plum">Booking unavailable</h1>
                <p className="text-premium-purple-plum/60">
                  {pageError || 'This booking link is not valid.'}
                </p>
              </div>
              <p className="text-sm text-premium-purple-plum/50">
                Please return to the doctor’s original booking link and try again.
              </p>
              <div className="flex justify-center">
                <Button variant="secondary" onClick={loadDoctorContext}>
                  Retry secure link
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (confirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#170F28] via-[#23163A] to-[#2B1D43] px-6 py-12">
        <div className="w-full max-w-2xl">
          <Card className="text-center">
            <div className="space-y-8 py-4">
              <div
                className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] shadow-premium-soft ${confirmation.status === 'cancelled' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}
              >
                {confirmation.status === 'cancelled' ? (
                  <AlertCircle className="h-10 w-10" />
                ) : (
                  <CheckCircle2 className="h-10 w-10" />
                )}
              </div>
              <div className="space-y-3">
                <Badge
                  variant={
                    confirmation.status === 'confirmed'
                      ? 'success'
                      : confirmation.status === 'cancelled'
                        ? 'error'
                        : canCollectPaymentNow && !paymentResult
                          ? 'warning'
                          : 'premium'
                  }
                  className="mx-auto"
                >
                  {confirmation.status === 'confirmed'
                    ? 'Booking confirmed'
                    : confirmation.status === 'cancelled'
                      ? 'Request cancelled'
                      : canCollectPaymentNow && !paymentResult
                        ? 'Payment required'
                        : 'Request received'}
                </Badge>
                <h1 className="text-3xl font-bold text-premium-purple-plum">
                  {confirmation.status === 'confirmed'
                    ? 'Your booking is confirmed'
                    : confirmation.status === 'cancelled'
                      ? 'This payment request was cancelled'
                      : canCollectPaymentNow && !paymentResult
                        ? 'Complete payment so the doctor can confirm this consultation'
                        : 'Your request has been sent'}
                </h1>
                <p className="text-premium-purple-plum/60">
                  {confirmation.status === 'cancelled'
                    ? `You declined the pending payment for ${doctorDisplayName}, so this appointment request has been withdrawn.`
                    : canCollectPaymentNow && !paymentResult
                      ? `Your request has been sent. Complete payment below, then the doctor will confirm your appointment time.`
                      : missingConsultationFee
                        ? `Your request has been sent. The doctor will confirm your appointment time.`
                        : `Your request has been sent. The doctor will confirm your appointment time.`}
                </p>
              </div>
              <div className="rounded-3xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-5 text-left">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                  What happens next
                </p>
                <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-premium-purple-plum/70">
                  <li>
                    {confirmation.status === 'confirmed'
                      ? 'Your consultation slot is already confirmed for the selected time.'
                      : confirmation.status === 'cancelled'
                        ? 'This booking request has been withdrawn and no further payment will be processed.'
                        : 'The doctor will review your request and confirm the appointment.'}
                  </li>
                  <li>
                    Watch your email and WhatsApp for KuraMedics follow-up instructions or payment
                    guidance.
                  </li>
                  <li>
                    If your symptoms are urgent, use emergency care instead of waiting for this
                    booking response.
                  </li>
                </ul>
              </div>
              <div className="grid gap-4 text-left sm:grid-cols-3">
                <div className="rounded-2xl border border-premium-lilac/20 bg-premium-lilac-light/30 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                    Doctor
                  </p>
                  <p className="mt-2 font-bold text-premium-purple-plum">{doctorDisplayName}</p>
                </div>
                <div className="rounded-2xl border border-premium-lilac/20 bg-premium-lilac-light/30 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                    Booking reference
                  </p>
                  <p className="mt-2 font-bold text-premium-purple-plum">
                    {String(confirmation.id).slice(0, 8)}
                  </p>
                </div>
                <div className="rounded-2xl border border-premium-lilac/20 bg-premium-lilac-light/30 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                    Appointment time
                  </p>
                  <p className="mt-2 font-bold text-premium-purple-plum">
                    {formatBookingDate(confirmation.booking_date)}
                  </p>
                </div>
              </div>

              {missingConsultationFee && (
                <div className="space-y-2 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-left">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800">
                    Payment unavailable
                  </p>
                  <p className="text-sm font-semibold text-amber-900">
                    This doctor has not set a valid consultation fee yet.
                  </p>
                  <p className="text-sm text-amber-800">
                    Your request was still created successfully, but the Paystack handoff will only
                    appear once a consultation fee is configured.
                  </p>
                </div>
              )}

              {canCollectPaymentNow && confirmation.status !== 'cancelled' && (
                <div className="space-y-4 rounded-3xl border border-premium-lilac/20 bg-white/70 p-5 text-left">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                        Secure payment step
                      </p>
                      <h2 className="mt-2 text-xl font-bold text-premium-purple-plum">
                        Complete payment for this consultation
                      </h2>
                      <p className="mt-1 text-sm text-premium-purple-plum/65">
                        The page now attempts to open Paystack automatically after booking. If it
                        does not open, use the button below to retry instantly.
                      </p>
                    </div>
                    <Badge
                      variant={
                        paymentResult?.status === 'paid'
                          ? 'success'
                          : paymentResult?.status === 'failed'
                            ? 'error'
                            : 'warning'
                      }
                    >
                      {paymentResult?.status === 'paid'
                        ? 'Paid'
                        : paymentResult?.status === 'failed'
                          ? 'Failed'
                          : 'Pending'}
                    </Badge>
                  </div>

                  <div className="rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/40 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                      {bookingForm.consultation_fee_type === 'follow_up'
                        ? 'Follow-up review fee'
                        : 'Consultation fee'}
                    </p>
                    <p className="mt-2 font-bold text-premium-purple-plum">
                      {paymentCurrency}{' '}
                      {Number(
                        paymentResult?.amount || selectedConsultationFee || 0
                      ).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm text-premium-purple-plum/60">
                      Payment status:{' '}
                      {paymentResult?.status === 'paid'
                        ? 'Paid successfully'
                        : paymentResult?.status === 'failed'
                          ? 'Payment failed'
                          : 'Awaiting payment verification'}
                    </p>
                  </div>

                  {paymentError && (
                    <p className="text-sm font-semibold text-rose-600">{paymentError}</p>
                  )}
                  {paymentResult?.status === 'paid' && (
                    <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <p>
                        Payment confirmed with transaction reference {paymentResult.transaction_id}.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownloadReceipt()}
                      >
                        <Download className="h-4 w-4" /> Download receipt
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleMessageDoctor(confirmation.id)}
                      >
                        <MessageCircle className="h-4 w-4" /> Message Doctor
                      </Button>
                    </div>
                  )}

                  {paymentResult?.status === 'failed' && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                      {confirmation.status === 'cancelled'
                        ? 'This pending payment was cancelled at your request.'
                        : 'The payment was not successful. You can retry securely below or decline it.'}
                    </div>
                  )}

                  {paymentResult?.status !== 'paid' && confirmation.status !== 'cancelled' && (
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={handlePaymentNow} disabled={paymentLoading}>
                        {paymentLoading ? 'Redirecting to Paystack...' : 'Pay with Paystack'}
                      </Button>
                      {paymentResult?.status === 'pending' && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleDeclinePayment}
                          disabled={paymentLoading}
                        >
                          {paymentLoading ? 'Cancelling...' : 'Decline payment'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() => {
                    setConfirmation(null);
                    setBookingForm({
                      booking_date: '',
                      reason: '',
                      visit_type: 'initial',
                      consultation_service_id: '',
                      consultation_fee_type: 'first_time',
                    });
                  }}
                  variant="secondary"
                >
                  Book another slot
                </Button>
                <Button onClick={() => setConfirmation(null)}>Return to booking page</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-premium-indigo-deep via-premium-purple-plum to-premium-royal px-6 py-16 text-white">
      <div className="soft-fade-in mx-auto max-w-6xl space-y-8">
        <section className="rounded-[2rem] border border-white/20 bg-white/5 p-6 text-white shadow-2xl backdrop-blur-sm sm:p-8 lg:p-10">
          <div className="relative z-10 grid items-start gap-8 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-5">
              <Badge
                variant="gold"
                className="w-fit border-premium-champagne-gold/30 bg-premium-champagne-gold/20 text-premium-champagne-gold"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> KuraMedics private booking
              </Badge>
              <div className="space-y-4">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-kura-lilac">
                  Confidential consultation access
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar
                    src={doctor.avatar_url}
                    name={doctorDisplayName}
                    className="border-kura-champagne/30 h-16 w-16 border-2 text-xl sm:h-20 sm:w-20"
                    textClassName="text-xl"
                    alt={`${doctorDisplayName} profile photo`}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-2xl font-bold text-premium-champagne-gold">
                        {doctorDisplayName}
                      </p>
                      {doctorVerified && (
                        <Badge
                          variant="gold"
                          className="border-premium-champagne-gold/30 bg-premium-champagne-gold/10 text-premium-champagne-gold"
                        >
                          Verified doctor
                        </Badge>
                      )}
                    </div>
                    <p className="text-base font-medium text-premium-lilac">
                      {doctor.specialization || 'General Practice'}
                    </p>
                  </div>
                </div>
                <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                  Welcome to {doctorDisplayName}&apos;s private consultation page
                </h1>
                <p className="max-w-2xl text-base leading-relaxed text-kura-lilac sm:text-lg">
                  Request care directly with this doctor through a calm, secure KuraMedics booking
                  flow.
                </p>
              </div>

              {/* Emergency Warning */}
              <div className="rounded-2xl border border-rose-200/50 bg-rose-50/10 p-4 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                  <div>
                    <p className="font-semibold text-rose-200">Medical Emergency?</p>
                    <p className="mt-1 text-sm text-rose-100/80">
                      This platform is for scheduled consultations only. For emergencies, call
                      emergency services immediately (e.g., 112 or local equivalent). This doctor
                      will confirm your appointment time after booking.
                    </p>
                  </div>
                </div>
              </div>

              <div className="trust-chip-row">
                {trustChips.map((chip, index) => (
                  <TrustChip
                    key={chip.id}
                    icon={chip.icon}
                    label={chip.label}
                    description={chip.description}
                    index={index}
                  />
                ))}
              </div>

              {/* Security Reassurance */}
              <div className="rounded-2xl border border-emerald-200/50 bg-emerald-50/10 p-4 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="font-semibold text-emerald-200">Secure & Private</p>
                    <p className="mt-1 text-sm text-emerald-100/80">
                      Your health information is protected with healthcare-grade security.
                      KuraMedics is designed with privacy in mind, ensuring your data is shared only
                      with your chosen doctor.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-2xl border border-premium-champagne-gold/20 bg-premium-purple-plum/60 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-premium-lilac">
                    Specialty
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    {doctor.specialization || 'General Practice'}
                  </p>
                </div>
                <div className="rounded-2xl border border-premium-champagne-gold/20 bg-premium-purple-plum/60 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-premium-lilac">
                    Clinic
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    {doctor.clinic_name || 'Private consultation practice'}
                  </p>
                </div>
                <div className="rounded-2xl border border-premium-champagne-gold/20 bg-premium-purple-plum/60 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-premium-lilac">
                    Availability
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    {doctor.is_available ? 'Currently accepting requests' : 'Limited availability'}
                  </p>
                </div>
              </div>
            </div>

            <div className="guided-flow-card relative z-10 rounded-[1.75rem] border border-premium-champagne-gold/20 bg-premium-purple-plum/80 p-5 text-white shadow-2xl backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-premium-champagne-gold/30 bg-premium-champagne-gold/10 text-premium-champagne-gold">
                  <Stethoscope className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">Your care journey</p>
                  <p className="mt-1 text-base text-premium-lilac">
                    A calm, guided process from secure access to appointment request.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-base text-white">
                <div className="rounded-2xl border border-premium-champagne-gold/20 bg-premium-champagne-gold/5 px-4 py-3 font-medium text-white">
                  1. Review the doctor's details
                </div>
                <div className="rounded-2xl border border-premium-champagne-gold/20 bg-premium-champagne-gold/5 px-4 py-3 font-medium text-white">
                  2. Sign in or create your patient account
                </div>
                <div className="rounded-2xl border border-premium-champagne-gold/20 bg-premium-champagne-gold/5 px-4 py-3 font-medium text-white">
                  3. Request your appointment securely
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <Card
            className="guided-flow-card"
            title="About your doctor"
            subtitle="Public-safe clinic profile"
          >
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <Avatar
                  src={doctor.avatar_url}
                  name={doctorDisplayName}
                  className="h-14 w-14 text-base"
                  textClassName="text-base"
                  alt={`${doctorDisplayName} profile photo`}
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold text-premium-purple-plum">
                      {doctorDisplayName}
                    </h2>
                    {doctorVerified && <Badge variant="success">Verified</Badge>}
                  </div>
                  <p className="text-sm text-premium-purple-plum/60">
                    {doctor.specialization || 'General Practice'}
                  </p>
                  <p className="mt-2 text-sm text-premium-purple-plum/55">
                    A calm private consultation space for direct patient requests.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-premium-lilac/20 bg-premium-lilac-light/20 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                  Clinic
                </p>
                <p className="mt-2 font-semibold text-premium-purple-plum">
                  {doctor.clinic_name || 'Private consultation practice'}
                </p>
              </div>

              {doctor.bio && (
                <div className="rounded-2xl border border-premium-lilac/20 bg-white/60 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                    About
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-premium-purple-plum/70">
                    {doctor.bio}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Badge variant={doctor.is_available ? 'success' : 'warning'}>
                  {doctor.is_available ? 'Accepting bookings' : 'Limited availability'}
                </Badge>
                <Badge variant="premium">Private and confidential</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                    Response time
                  </p>
                  <p className="mt-2 font-semibold text-premium-purple-plum">{responseTimeLabel}</p>
                  <p className="mt-1 text-xs text-premium-purple-plum/55">
                    You will also see updates appear here automatically as your booking changes.
                  </p>
                </div>
                <div className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                    Trust and billing
                  </p>
                  <p className="mt-2 font-semibold text-premium-purple-plum">
                    {missingConsultationFee
                      ? 'Billing will appear after fee setup'
                      : 'Secure Paystack payment available'}
                  </p>
                  <p className="mt-1 text-xs text-premium-purple-plum/55">
                    Verified doctors and clear fees help patients book with confidence.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4 text-sm leading-relaxed text-premium-purple-plum/70">
                Use the trust chips above for quick privacy and security details while you book.
              </div>
            </div>
          </Card>

          <Card
            className="guided-flow-card"
            title="Request your appointment"
            subtitle="A simple guided flow"
          >
            <div className="space-y-6">
              {patientSignedIn ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                        Signed in as patient
                      </p>
                      <p className="mt-1 font-semibold text-emerald-900">
                        {viewer.full_name || viewer.email}
                      </p>
                    </div>
                    <Button
                      type="submit"
                      variant="gold"
                      size="lg"
                      className="w-full shadow-premium-soft"
                      disabled={bookingLoading || authLoading}
                    >
                      {bookingLoading
                        ? 'Submitting booking...'
                        : canCollectPaymentNow
                          ? 'Request appointment and continue to payment'
                          : 'Request appointment'}
                    </Button>
                  </div>
                  {viewer?.email_verified === false && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800">
                      Please verify your email when the message arrives so you can manage future
                      appointments smoothly.
                    </div>
                  )}
                  {patientProfileLoading && (
                    <div className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4 text-sm text-premium-purple-plum/70">
                      Loading your patient contact details...
                    </div>
                  )}
                  {!patientProfileLoading && patientNeedsWhatsapp && (
                    <form
                      onSubmit={handlePatientContactSubmit}
                      className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
                    >
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800">
                          Complete onboarding
                        </p>
                        <p className="mt-1 text-sm text-amber-900">
                          Add your WhatsApp line so the doctor can reach you after a valid booking
                          is created.
                        </p>
                      </div>
                      <Input
                        label="WhatsApp line"
                        name="whatsapp_number"
                        type="tel"
                        value={patientContactForm.whatsapp_number}
                        onChange={handlePatientContactChange}
                        placeholder="+2348012345678"
                        required
                      />
                      {patientContactError && (
                        <p className="text-sm font-semibold text-rose-600">{patientContactError}</p>
                      )}
                      <Button type="submit" disabled={patientContactSaving}>
                        {patientContactSaving ? 'Saving WhatsApp...' : 'Save and continue'}
                      </Button>
                    </form>
                  )}
                  {!patientProfileLoading && !patientNeedsWhatsapp && patientWhatsappNumber && (
                    <div className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4 text-sm text-premium-purple-plum/70">
                      Your WhatsApp line is on file and will only be shared with this doctor after a
                      booking exists.
                    </div>
                  )}
                </div>
              ) : (
                <div
                  ref={authSectionRef}
                  tabIndex={-1}
                  className="scroll-mt-24 space-y-4 rounded-3xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-5 focus:outline-none"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-premium-purple-plum">
                        Step 1: secure patient access
                      </h3>
                      <p className="text-sm text-premium-purple-plum/60">
                        Sign in or create your patient account here. You will stay within this
                        private doctor flow the entire time.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={authMode === 'register' ? 'primary' : 'secondary'}
                        onClick={() => {
                          setAuthMode('register');
                          setAuthError('');
                        }}
                      >
                        <UserPlus className="h-4 w-4" />
                        New patient
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={authMode === 'login' ? 'primary' : 'secondary'}
                        onClick={() => {
                          setAuthMode('login');
                          setAuthError('');
                        }}
                      >
                        <LogIn className="h-4 w-4" />
                        Existing patient
                      </Button>
                    </div>
                  </div>

                  {authMode === 'login' ? (
                    <form onSubmit={handlePatientLogin} className="space-y-4">
                      <Input
                        label="Email"
                        name="email"
                        type="email"
                        value={authForm.email}
                        onChange={handleAuthChange}
                        placeholder="patient@example.com"
                        required
                      />
                      <div>
                        <Input
                          label="Password"
                          name="password"
                          type={showLoginPassword ? 'text' : 'password'}
                          value={authForm.password}
                          onChange={handleAuthChange}
                          placeholder="Enter your password"
                          required
                        />
                        <label className="mt-2 inline-flex items-center gap-2 text-xs text-premium-purple-plum/70">
                          <input
                            type="checkbox"
                            checked={showLoginPassword}
                            onChange={(event) => setShowLoginPassword(event.target.checked)}
                          />
                          Show password
                        </label>
                      </div>
                      <Input
                        label="WhatsApp line"
                        name="whatsapp_number"
                        type="tel"
                        value={authForm.whatsapp_number}
                        onChange={handleAuthChange}
                        placeholder="Add or confirm your WhatsApp line"
                      />
                      <p className="text-xs text-premium-purple-plum/55">
                        Returning patients can add or confirm their WhatsApp line here. Repeat
                        consultations still continue to secure payment after the booking request is
                        submitted.
                      </p>
                      <Button type="submit" className="w-full" disabled={authLoading}>
                        {authLoading
                          ? 'Signing in...'
                          : canCollectPaymentNow
                            ? 'Sign in and continue to payment'
                            : 'Sign in and continue'}
                      </Button>
                      <div className="flex items-center gap-3 text-xs text-premium-purple-plum/45">
                        <span className="h-px flex-1 bg-premium-lilac/40" />
                        <span>or</span>
                        <span className="h-px flex-1 bg-premium-lilac/40" />
                      </div>
                      <GoogleAuthButton
                        text="signin_with"
                        disabled={authLoading}
                        onCredential={handleGooglePatientAccess}
                        onError={setAuthError}
                      />
                    </form>
                  ) : (
                    <form onSubmit={handlePatientRegister} className="space-y-4">
                      <Input
                        label="Full name"
                        name="full_name"
                        type="text"
                        value={registerForm.full_name}
                        onChange={handleRegisterChange}
                        placeholder="Your full name"
                        required
                      />
                      <Input
                        label="Email"
                        name="email"
                        type="email"
                        value={registerForm.email}
                        onChange={handleRegisterChange}
                        placeholder="patient@example.com"
                        required
                      />
                      <Input
                        label="WhatsApp line"
                        name="whatsapp_number"
                        type="tel"
                        value={registerForm.whatsapp_number}
                        onChange={handleRegisterChange}
                        placeholder="+2348012345678"
                        required
                      />
                      <div>
                        <Input
                          label="Password"
                          name="password"
                          type={showRegisterPassword ? 'text' : 'password'}
                          value={registerForm.password}
                          onChange={handleRegisterChange}
                          placeholder="Create a secure password"
                          required
                        />
                        <label className="mt-2 inline-flex items-center gap-2 text-xs text-premium-purple-plum/70">
                          <input
                            type="checkbox"
                            checked={showRegisterPassword}
                            onChange={(event) => setShowRegisterPassword(event.target.checked)}
                          />
                          Show password
                        </label>
                      </div>
                      <div>
                        <Input
                          label="Confirm password"
                          name="confirmPassword"
                          type={showRegisterConfirmPassword ? 'text' : 'password'}
                          value={registerForm.confirmPassword}
                          onChange={handleRegisterChange}
                          placeholder="Repeat your password"
                          required
                        />
                        <label className="mt-2 inline-flex items-center gap-2 text-xs text-premium-purple-plum/70">
                          <input
                            type="checkbox"
                            checked={showRegisterConfirmPassword}
                            onChange={(event) =>
                              setShowRegisterConfirmPassword(event.target.checked)
                            }
                          />
                          Show confirm password
                        </label>
                      </div>
                      <p className="text-xs text-premium-purple-plum/55">
                        Use a valid WhatsApp number the doctor can reach, and keep your password at
                        12 or more characters for production security.
                      </p>
                      <Button type="submit" className="w-full" disabled={authLoading}>
                        {authLoading
                          ? 'Creating account...'
                          : bookingForm.booking_date
                            ? 'Create account and book now'
                            : 'Create patient account'}
                      </Button>
                      <div className="flex items-center gap-3 text-xs text-premium-purple-plum/45">
                        <span className="h-px flex-1 bg-premium-lilac/40" />
                        <span>or</span>
                        <span className="h-px flex-1 bg-premium-lilac/40" />
                      </div>
                      <GoogleAuthButton
                        text="signup_with"
                        disabled={authLoading}
                        onCredential={handleGooglePatientAccess}
                        onError={setAuthError}
                      />
                    </form>
                  )}

                  {authError && <p className="text-sm font-semibold text-rose-600">{authError}</p>}
                  {infoMessage && (
                    <p className="text-sm font-semibold text-emerald-700">{infoMessage}</p>
                  )}
                </div>
              )}

              <form
                id="appointment-request-form"
                onSubmit={handleBookingSubmit}
                className="scroll-mt-24 space-y-4"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                    Step 2: choose a suitable time
                  </p>
                  <p className="mt-1 text-sm text-premium-purple-plum/60">
                    Tell the doctor how & when you'd like to be seen.
                  </p>
                </div>

                {patientSignedIn && bookingGuidance && (
                  <div className="space-y-3 rounded-3xl border border-premium-lilac/20 bg-premium-pearl-tint/40 p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-premium-purple-plum" />
                      <div>
                        <p className="font-semibold text-premium-purple-plum">
                          Smart booking suggestion
                        </p>
                        <p className="text-sm text-premium-purple-plum/65">
                          {bookingGuidance.explanation}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => applySuggestedVisitType(bookingGuidance.primary_option)}
                      >
                        {bookingGuidance.primary_option}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => applySuggestedVisitType(bookingGuidance.secondary_option)}
                      >
                        {bookingGuidance.secondary_option}
                      </Button>
                    </div>
                  </div>
                )}
                <CollapsibleSection
                  title="Choose consultation type"
                  summary={getConsultationTypeSummary()}
                  isExpanded={consultationTypeExpanded}
                  onToggle={() => setConsultationTypeExpanded(!consultationTypeExpanded)}
                  hasError={bookingErrorTarget === 'consultation_type'}
                  errorMessage={bookingErrorTarget === 'consultation_type' ? bookingError : ''}
                  containerRef={serviceSectionRef}
                  headerRef={consultationTypeHeaderRef}
                >
                  {availableServices.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {availableServices.map((service) => {
                        const isSelected = bookingForm.consultation_service_id === service.id;

                        return (
                          <button
                            key={service.id || service.display_name || service.service_type}
                            type="button"
                            onClick={() => handleConsultationServiceSelect(service)}
                            disabled={bookingLoading || authLoading}
                            className={`min-h-[112px] rounded-3xl border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-premium-purple-plum/30 focus:ring-offset-2 focus:ring-offset-white ${
                              isSelected
                                ? 'border-premium-purple-plum bg-premium-lilac-light/40 shadow-premium-soft'
                                : 'border-premium-lilac/20 bg-white/70 hover:bg-white'
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="break-words font-bold text-premium-purple-plum">
                                  {service.display_name || 'Consultation'}
                                </p>
                                <p className="mt-1 text-sm text-premium-purple-plum/65">
                                  {service.description || 'Private consultation with this doctor.'}
                                </p>
                              </div>
                              <Badge variant="premium">
                                {consultationServiceBadge[service.service_type] || 'Consultation'}
                              </Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-premium-purple-plum/60">
                              <span>
                                First-time:{' '}
                                {formatNaira(
                                  service.first_time_price_amount ?? service.price_naira,
                                  paymentCurrency
                                )}
                              </span>
                              <span>
                                Follow-up:{' '}
                                {Number(service.follow_up_price_amount || 0) > 0
                                  ? formatNaira(service.follow_up_price_amount, paymentCurrency)
                                  : 'Not available'}
                              </span>
                              {service.duration_minutes && (
                                <span>
                                  {Number(service.duration_minutes) || service.duration_minutes}{' '}
                                  mins
                                </span>
                              )}
                              {service.requires_payment === false && <span>Offline payment</span>}
                            </div>
                            {service.availability_note && (
                              <p className="mt-2 text-xs text-premium-purple-plum/55">
                                {service.availability_note}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-sm text-premium-purple-plum/60">
                        No consultation types available at the moment.
                      </p>
                    </div>
                  )}
                </CollapsibleSection>

                {selectedService && (
                  <div
                    ref={feeSectionRef}
                    tabIndex={-1}
                    className="scroll-mt-24 space-y-2 focus:outline-none"
                  >
                    <label
                      htmlFor="consultation-fee-type"
                      className="ml-1 text-[11px] font-bold uppercase tracking-widest text-premium-purple-plum/50"
                    >
                      Consultation package
                    </label>
                    <select
                      id="consultation-fee-type"
                      name="consultation_fee_type"
                      className="premium-input"
                      value={bookingForm.consultation_fee_type}
                      onChange={(event) => handleConsultationFeeTypeSelect(event.target.value)}
                      disabled={bookingLoading || authLoading}
                    >
                      <option value="first_time">
                        First-time consultation -{' '}
                        {formatNaira(selectedFirstTimeFee, paymentCurrency)}
                      </option>
                      <option value="follow_up" disabled={followUpUnavailable}>
                        {followUpUnavailable
                          ? 'Follow-up / review - Not available'
                          : `Follow-up / review - ${formatNaira(selectedFollowUpFee, paymentCurrency)}`}
                      </option>
                    </select>
                    {followUpUnavailable && (
                      <p className="px-1 text-xs font-semibold text-premium-purple-plum/55">
                        Follow-up pricing is not available for this service.
                      </p>
                    )}
                    {requiresFeeTypeChoice && !consultationFeeTypeTouched && (
                      <p className="text-sm font-semibold text-premium-purple-plum/70">
                        Choose initial consultation or follow-up consultation to continue.
                      </p>
                    )}
                    <p className="text-xs text-premium-purple-plum/55">
                      {selectedService?.requires_payment === false
                        ? 'This service is set for offline payment with the clinic.'
                        : missingConsultationFee
                          ? 'Online payment is currently unavailable because the doctor has not set a valid consultation fee yet.'
                          : selectedService
                            ? `Final price: ${formatNaira(selectedConsultationFee, paymentCurrency)} for ${bookingForm.consultation_fee_type === 'follow_up' ? 'follow-up / review' : 'first-time'} ${selectedService.display_name || 'consultation'}.`
                            : ''}
                    </p>
                  </div>
                )}

                <div
                  ref={dateTimeSectionRef}
                  tabIndex={-1}
                  className="scroll-mt-24 space-y-2 focus:outline-none"
                >
                  <Input
                    label="Preferred appointment time"
                    name="booking_date"
                    type="datetime-local"
                    value={bookingForm.booking_date}
                    onChange={handleBookingChange}
                    required
                    min={new Date().toISOString().slice(0, 16)}
                    disabled={bookingLoading || authLoading}
                    aria-describedby={
                      bookingErrorTarget === 'time' && bookingError ? 'time-error' : undefined
                    }
                  />
                  {bookingErrorTarget === 'time' && bookingError && (
                    <p
                      id="time-error"
                      className="px-1 text-sm font-semibold text-rose-600"
                      role="alert"
                    >
                      {bookingError}
                    </p>
                  )}
                </div>

                <div
                  ref={reasonSectionRef}
                  tabIndex={-1}
                  className="scroll-mt-24 space-y-2.5 focus:outline-none"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-premium-purple-plum/50">
                      Reason for consultation
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleAiReasonAssist}
                      disabled={reasonAssistLoading || bookingLoading || authLoading}
                    >
                      <Sparkles className="h-4 w-4" />{' '}
                      {reasonAssistLoading ? 'Organizing...' : 'Organize with AI'}
                    </Button>
                  </div>
                  <textarea
                    name="reason"
                    rows="4"
                    className="premium-input min-h-[120px]"
                    value={bookingForm.reason}
                    onChange={handleBookingChange}
                    placeholder="Briefly describe the reason for this appointment"
                    disabled={bookingLoading || authLoading}
                  />
                  <p className="text-xs text-premium-purple-plum/55">
                    Type naturally. The AI helper keeps the output short, editable, and easy to
                    skip.
                  </p>
                </div>

                {structuredVisit && (
                  <div className="space-y-4 rounded-3xl border border-premium-lilac/20 bg-white/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                          AI summary preview
                        </p>
                        <p className="mt-1 text-sm text-premium-purple-plum/65">
                          Review, edit, or ignore this before you submit.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={
                            structuredVisit.urgency_level === 'high'
                              ? 'error'
                              : structuredVisit.urgency_level === 'medium'
                                ? 'warning'
                                : 'success'
                          }
                        >
                          {structuredVisit.urgency_level} urgency
                        </Badge>
                        <Badge variant="premium">
                          {structuredVisit.consultation_type === 'follow_up'
                            ? 'Follow-up'
                            : 'New consultation'}
                        </Badge>
                      </div>
                    </div>

                    <Input
                      label="Symptoms"
                      value={
                        Array.isArray(structuredVisit.symptoms)
                          ? structuredVisit.symptoms.join(', ')
                          : ''
                      }
                      onChange={(event) =>
                        handleStructuredVisitChange(
                          'symptoms',
                          event.target.value
                            .split(',')
                            .map((item) => item.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder="fever, cough"
                    />
                    <Input
                      label="Duration"
                      value={structuredVisit.duration || ''}
                      onChange={(event) =>
                        handleStructuredVisitChange('duration', event.target.value)
                      }
                      placeholder="3 days"
                    />
                    <div className="space-y-2.5">
                      <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-premium-purple-plum/50">
                        Additional notes
                      </label>
                      <textarea
                        rows="3"
                        className="premium-input min-h-[90px]"
                        value={structuredVisit.additional_notes || ''}
                        onChange={(event) =>
                          handleStructuredVisitChange('additional_notes', event.target.value)
                        }
                        placeholder="Other important context"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => applyStructuredVisitChoice(true)}
                      >
                        Use AI summary
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => applyStructuredVisitChoice(false)}
                      >
                        Use my original text
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAiReasonAssist('regenerate')}
                        disabled={reasonAssistLoading}
                      >
                        Regenerate
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={dismissStructuredVisit}
                      >
                        Dismiss
                      </Button>
                    </div>
                    <p className="text-xs text-premium-purple-plum/55">
                      Current choice:{' '}
                      {useStructuredVisit
                        ? 'The structured AI summary will be used.'
                        : 'Your original free-text note will be used.'}
                    </p>
                  </div>
                )}

                {bookingError && (
                  <p className="text-sm font-semibold text-rose-600">{bookingError}</p>
                )}

                <div
                  ref={submitSectionRef}
                  tabIndex={-1}
                  className="scroll-mt-24 space-y-4 focus:outline-none"
                >
                  {!patientSignedIn && (
                    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800">
                      <User className="mt-0.5 h-5 w-5 shrink-0" />
                      <span>
                        Choose your preferred time now. Then sign in or create your patient account
                        on this same page to complete your request with confidence.
                      </span>
                    </div>
                  )}

                  <div className="flex gap-3 rounded-2xl border border-premium-lilac/20 bg-premium-lilac-light/20 p-4 text-sm text-premium-purple-plum/70">
                    <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>
                      Your request stays connected to {doctorDisplayName} only. No public doctor
                      browsing or switching happens inside this page.
                    </span>
                  </div>

                  {/* Payment Information */}
                  {selectedService && (
                    <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800">
                      <CreditCard className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-semibold">Payment Required</p>
                        <p className="mt-1">
                          {selectedService?.requires_payment === false
                            ? 'This service requires offline payment at the clinic.'
                            : missingConsultationFee
                              ? 'Payment setup is pending. Contact the doctor for details.'
                              : `Secure online payment of ${formatNaira(selectedConsultationFee, paymentCurrency)} is required before your consultation. Payment may be processed after doctor confirmation.`}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
                    <p className="text-sm font-semibold text-premium-purple-plum">
                      Your information will be shared only with the selected doctor and used to
                      manage your consultation.
                    </p>
                    <div>
                      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/40 p-3 text-sm text-premium-purple-plum/75 focus-within:ring-2 focus-within:ring-premium-purple-plum/50 hover:bg-premium-pearl-tint/60">
                        <input
                          type="checkbox"
                          id="patient-consent"
                          className="mt-1 h-4 w-4 shrink-0"
                          checked={consentForm.patient_consent_given}
                          onChange={(event) =>
                            setConsentForm((current) => ({
                              ...current,
                              patient_consent_given: event.target.checked,
                            }))
                          }
                          required
                          aria-describedby="consent-description"
                        />
                        <span id="consent-description">
                          I consent to KuraMedics collecting and sharing my booking details,
                          consultation reason, messages, and related information with the selected
                          doctor for the purpose of arranging and managing my consultation.
                        </span>
                      </label>
                    </div>
                    <div>
                      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/40 p-3 text-sm text-premium-purple-plum/75 focus-within:ring-2 focus-within:ring-premium-purple-plum/50 hover:bg-premium-pearl-tint/60">
                        <input
                          type="checkbox"
                          id="emergency-acknowledgement"
                          className="mt-1 h-4 w-4 shrink-0"
                          checked={consentForm.emergency_acknowledged}
                          onChange={(event) =>
                            setConsentForm((current) => ({
                              ...current,
                              emergency_acknowledged: event.target.checked,
                            }))
                          }
                          required
                          aria-describedby="emergency-description"
                        />
                        <span id="emergency-description">
                          I understand that this is not for medical emergencies and that the doctor
                          will confirm my appointment time.
                        </span>
                      </label>
                    </div>
                    <p className="text-xs leading-5 text-premium-purple-plum/55">
                      By continuing, you agree to the{' '}
                      <Link
                        to="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-premium-purple-plum underline"
                      >
                        Privacy Policy
                      </Link>{' '}
                      and{' '}
                      <Link
                        to="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-premium-purple-plum underline"
                      >
                        Terms of Use
                      </Link>
                      .
                    </p>
                    {bookingErrorTarget === 'consent' && bookingError && (
                      <p
                        id="consent-error"
                        className="text-sm font-semibold text-rose-600"
                        role="alert"
                      >
                        {bookingError}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      !patientSignedIn ||
                      bookingLoading ||
                      authLoading ||
                      patientProfileLoading ||
                      patientNeedsWhatsapp ||
                      patientContactSaving ||
                      !consentForm.patient_consent_given ||
                      !consentForm.emergency_acknowledged
                    }
                  >
                    <CalendarDays className="h-4 w-4" />
                    {bookingLoading
                      ? 'Submitting booking...'
                      : canCollectPaymentNow
                        ? 'Request appointment and continue to payment'
                        : 'Request appointment'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>

        {patientSignedIn && (
          <section className="grid items-start gap-8 lg:grid-cols-[0.88fr_1.12fr]">
            <Card
              className="guided-flow-card"
              title="Live care updates"
              subtitle="Auto-refreshing reminders and status changes"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/40 p-4 text-sm text-premium-purple-plum/70">
                  <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-premium-purple-plum" />
                  <div>
                    <p className="font-semibold text-premium-purple-plum">
                      Live updates stay in sync
                    </p>
                    <p className="mt-1">
                      This page refreshes your booking status automatically so you can spot
                      confirmations, reminders, and schedule changes quickly.
                    </p>
                  </div>
                </div>

                {reminderBookings.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                      Upcoming reminders
                    </p>
                    {reminderBookings.map((booking) => (
                      <div
                        key={`reminder-${booking.id}`}
                        className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold text-amber-900">
                            Upcoming visit on {formatBookingDate(booking.booking_date)}
                          </p>
                          <Badge variant="warning">Reminder due</Badge>
                        </div>
                        <p className="mt-1 text-sm text-amber-800">
                          Keep your phone close for reminder updates by email and in-app notice.
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/50">
                    Recent activity
                  </p>
                  {historyLoading ? (
                    <div className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4 text-sm text-premium-purple-plum/60">
                      Refreshing your care updates...
                    </div>
                  ) : liveUpdates.length ? (
                    liveUpdates.map((notice) => (
                      <div
                        key={notice.id}
                        className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold text-premium-purple-plum">{notice.title}</p>
                          {!notice.is_read && <Badge variant="premium">New</Badge>}
                        </div>
                        <p className="mt-1 text-sm text-premium-purple-plum/70">{notice.message}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4 text-sm text-premium-purple-plum/60">
                      Your latest notifications and reminders will appear here after you start
                      booking.
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card
              className="guided-flow-card"
              title="My care activity"
              subtitle="History, self-service actions, and follow-up care"
            >
              <div className="space-y-4">
                {bookingHistory.length ? (
                  bookingHistory.slice(0, 6).map((booking) => (
                    <div
                      key={booking.id}
                      className="space-y-3 rounded-3xl border border-premium-lilac/20 bg-white/70 p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-premium-purple-plum">
                            {formatBookingDate(booking.booking_date)}
                          </p>
                          <p className="text-sm text-premium-purple-plum/60">
                            with {booking.doctor_name || doctorDisplayName}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={getBookingBadgeVariant(booking.status)}>
                            {booking.status}
                          </Badge>
                          <Badge variant={getPaymentBadgeVariant(booking.payment_status)}>
                            {booking.payment_status || 'pending payment'}
                          </Badge>
                        </div>
                      </div>

                      {booking.reason && (
                        <p className="text-sm text-premium-purple-plum/70">{booking.reason}</p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {booking.payment_status !== 'paid' &&
                          booking.status !== 'cancelled' &&
                          booking.status !== 'completed' && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setConfirmation(booking);
                                startPaymentFlow(booking.id);
                              }}
                            >
                              Pay now
                            </Button>
                          )}
                        {['pending', 'confirmed'].includes(booking.status) &&
                          booking.payment_status !== 'paid' && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelExistingBooking(booking.id)}
                            >
                              Cancel request
                            </Button>
                          )}
                        {booking.payment_status === 'paid' && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleMessageDoctor(booking.id)}
                            >
                              <MessageCircle className="h-4 w-4" /> Message Doctor
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDownloadReceipt(booking)}
                            >
                              <Download className="h-4 w-4" /> Receipt
                            </Button>
                          </>
                        )}
                        {booking.status === 'completed' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleFollowUpShortcut(booking)}
                          >
                            Book follow-up
                          </Button>
                        )}
                      </div>

                      {booking.status === 'completed' && (
                        <div className="space-y-3 rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/40 p-4">
                          <div className="flex items-start gap-3">
                            <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-premium-purple-plum" />
                            <div>
                              <p className="font-semibold text-premium-purple-plum">
                                Post-consultation check-in
                              </p>
                              <p className="text-sm text-premium-purple-plum/65">
                                Record how you feel, then use the follow-up shortcut if you still
                                need the doctor.
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {['Feeling better', 'Need advice', 'Need follow-up'].map((option) => (
                              <button
                                key={`${booking.id}-${option}`}
                                type="button"
                                onClick={() =>
                                  setFeedbackByBooking((current) => ({
                                    ...current,
                                    [booking.id]: option,
                                  }))
                                }
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${feedbackByBooking[booking.id] === option ? 'border-premium-purple-plum bg-premium-lilac-light text-premium-purple-plum' : 'border-premium-lilac/30 bg-white text-premium-purple-plum/70'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                          {feedbackByBooking[booking.id] && (
                            <p className="text-xs text-premium-purple-plum/65">
                              Saved update: {feedbackByBooking[booking.id]}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4 text-sm text-premium-purple-plum/60">
                    Your appointment history with this doctor will appear here after you sign in and
                    book.
                  </div>
                )}
              </div>
            </Card>
          </section>
        )}
      </div>

      {!confirmation && (
        <div className="fixed inset-x-3 bottom-3 z-40 lg:hidden">
          <div className="flex items-center justify-between gap-3 rounded-3xl border border-premium-lilac/20 bg-white/90 px-4 py-3 shadow-premium-layered backdrop-blur-xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                Quick action
              </p>
              <p className="text-sm font-semibold text-premium-purple-plum">
                {missingConsultationFee
                  ? 'Choose a time securely'
                  : `${paymentCurrency} ${selectedConsultationFee.toLocaleString()} consultation`}
              </p>
            </div>
            <Button type="button" size="sm" onClick={scrollToBookingForm}>
              <Sparkles className="h-4 w-4" /> Continue
            </Button>
          </div>
        </div>
      )}
      {!confirmation && showScrollButton && (
        <button
          type="button"
          onClick={scrollToNextSection}
          className="fixed bottom-6 right-6 z-50 hidden rounded-full border border-premium-purple-plum/20 bg-premium-purple-plum px-4 py-2 text-sm font-semibold text-white shadow-premium-soft transition-all duration-200 hover:bg-premium-purple-plum/90 hover:shadow-premium-layered focus:outline-none focus:ring-2 focus:ring-premium-purple-plum/50 lg:flex"
          aria-label="Continue to next booking section"
        >
          <ChevronDown className="mr-2 h-4 w-4" />
          Continue
        </button>
      )}
      <footer className="mx-auto mt-10 flex max-w-5xl flex-wrap justify-center gap-4 border-t border-premium-lilac/20 pt-6 text-sm font-semibold text-white/85">
        <Link to="/privacy" className="hover:text-white">
          Privacy Policy
        </Link>
        <Link to="/terms" className="hover:text-white">
          Terms of Use
        </Link>
        <Link to="/security" className="hover:text-white">
          Security
        </Link>
        <Link to="/data-retention" className="hover:text-white">
          Data Retention
        </Link>
      </footer>
    </div>
  );
}

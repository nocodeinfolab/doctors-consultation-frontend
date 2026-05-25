import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  CheckCircle2,
  Copy,
  ExternalLink,
  Home,
  MailCheck,
  MessageCircle,
  Share2,
  Sparkles,
  Video,
  Building2,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, Input, LoadingState } from '../../../components/ui';
import {
  buildPublicBookingUrl,
  changePassword,
  getCurrentUser,
  getDoctorConsultationServices,
  getDoctorProfile,
  regenerateBookingLink,
  resendVerificationEmail,
  updateDoctorConsultationService,
  updateDoctorProfile,
  uploadDoctorAvatar,
} from '../../../services/api';
import {
  getStoredUser,
  getStoredAuthSession,
  setStoredAuthSession,
} from '../../../services/authStorage';

const loadClinicPreferences = () => {
  try {
    return JSON.parse(window.localStorage.getItem('kuramedics_clinic_preferences') || '{}');
  } catch {
    return {};
  }
};

const serviceIconMap = {
  video_consultation: Video,
  chat_consultation: MessageCircle,
  home_visit: Home,
  walk_in_clinic: Building2,
};

const serviceBadgeMap = {
  video_consultation: 'Online',
  chat_consultation: 'Online',
  home_visit: 'Home Visit',
  walk_in_clinic: 'Walk-in',
};

const MAX_SERVICE_DURATION_MINUTES = 12 * 60;

const getDurationParts = (durationMinutes) => {
  const totalMinutes = Math.max(0, Number.parseInt(durationMinutes, 10) || 0);

  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
};

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [regeneratingLink, setRegeneratingLink] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [doctorUser, setDoctorUser] = useState(getStoredUser());
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [serviceSavingId, setServiceSavingId] = useState('');
  const [serviceErrors, setServiceErrors] = useState({});
  const [preferences, setPreferences] = useState(() => ({
    sendEmailReminders: true,
    paymentAfterBooking: true,
    bookingApprovalsRequired: true,
    ...loadClinicPreferences(),
  }));
  const [form, setForm] = useState({
    full_name: '',
    specialization: '',
    mdcn_registration_number: '',
    consultation_fee: '',
    follow_up_fee: '',
    clinic_name: '',
    bio: '',
    phone_number: '',
    is_available: true,
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [doctorTermsAccepted, setDoctorTermsAccepted] = useState(false);

  const loadDoctorSetup = async () => {
    setLoading(true);
    setError('');

    try {
      const [user, doctorProfile, consultationServices] = await Promise.all([
        getCurrentUser(),
        getDoctorProfile(),
        getDoctorConsultationServices(),
      ]);

      setDoctorUser(user);
      setProfile(doctorProfile);
      setServices(Array.isArray(consultationServices) ? consultationServices : []);
      setForm({
        full_name: doctorProfile.full_name || user.full_name || '',
        specialization: doctorProfile.specialization || user.specialization || '',
        mdcn_registration_number: doctorProfile.mdcn_registration_number || '',
        consultation_fee: doctorProfile.consultation_fee || '',
        follow_up_fee: doctorProfile.follow_up_fee || '',
        clinic_name: doctorProfile.clinic_name || '',
        bio: doctorProfile.bio || '',
        phone_number: doctorProfile.phone_number || '',
        is_available: doctorProfile.is_available !== false,
      });
      setDoctorTermsAccepted(Boolean(doctorProfile.doctor_terms_accepted_at));

      const session = getStoredAuthSession();
      if (session) {
        setStoredAuthSession({
          ...session,
          user: {
            ...session.user,
            ...user,
            full_name: doctorProfile.full_name || user.full_name || session.user?.full_name,
            specialization:
              doctorProfile.specialization || user.specialization || session.user?.specialization,
            avatar_url: doctorProfile.avatar_url || session.user?.avatar_url || null,
            clinic_name: doctorProfile.clinic_name || session.user?.clinic_name || null,
          },
        });
      }
    } catch (err) {
      setError(err.message || 'Could not load your clinic settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctorSetup();
  }, []);

  useEffect(() => {
    window.localStorage.setItem('kuramedics_clinic_preferences', JSON.stringify(preferences));
  }, [preferences]);

  const bookingLink = useMemo(() => buildPublicBookingUrl(profile?.booking_link_path), [profile]);
  const verificationStatus = profile?.verification_status || 'unsubmitted';
  const subscriptionStatus =
    profile?.subscription_status || doctorUser?.subscription_status || 'active';
  const subscriptionMessage =
    profile?.subscription_message || doctorUser?.subscription_message || '';
  const isSubscriptionRestricted = Boolean(
    profile?.subscription_access_restricted || subscriptionStatus === 'suspended'
  );
  const statusLabel = verificationStatus.replace(/_/g, ' ');
  const hasVerificationSubmission = Boolean(
    form.full_name?.trim() &&
    form.specialization?.trim() &&
    form.phone_number?.trim() &&
    form.mdcn_registration_number?.trim()
  );
  const isVerifiedDoctor = verificationStatus === 'verified';
  const canRevealBookingLink = Boolean(
    isVerifiedDoctor && doctorUser?.email_verified && bookingLink && !isSubscriptionRestricted
  );
  const isLive = canRevealBookingLink;
  const onboardingSteps = useMemo(
    () => [
      {
        id: 'email',
        title: 'Verify your email',
        description: 'Confirm your inbox so KuraMedics can activate secure doctor access.',
        complete: Boolean(doctorUser?.email_verified),
      },
      {
        id: 'identity',
        title: 'Submit licence details',
        description:
          'Provide your legal name, MDCN registration number, specialty, and phone number.',
        complete: hasVerificationSubmission,
      },
      {
        id: 'review',
        title: 'Internal review',
        description: 'Our team validates your licence before any public booking link can go live.',
        complete: ['pending_review', 'verified'].includes(verificationStatus),
      },
      {
        id: 'live',
        title: 'Verified and shareable',
        description: 'Once approved, your verified booking page can be copied and shared publicly.',
        complete: isLive,
      },
    ],
    [doctorUser?.email_verified, hasVerificationSubmission, verificationStatus, isLive]
  );

  const completedSteps = onboardingSteps.filter((step) => step.complete).length;
  const progressPercent = Math.round((completedSteps / onboardingSteps.length) * 100);
  const nextStep =
    onboardingSteps.find((step) => !step.complete) || onboardingSteps[onboardingSteps.length - 1];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleServiceChange = (serviceId, field, value) => {
    setServices((current) =>
      current.map((service) =>
        service.id === serviceId
          ? {
              ...service,
              [field]: value,
            }
          : service
      )
    );
    setServiceErrors((current) => ({ ...current, [serviceId]: '' }));
  };

  const handleServiceDurationChange = (serviceId, part, value) => {
    const rawValue = value === '' ? 0 : Number.parseInt(value, 10);
    const nextValue = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;

    setServices((current) =>
      current.map((service) => {
        if (service.id !== serviceId) {
          return service;
        }

        const currentParts = getDurationParts(service.duration_minutes);
        const hours = part === 'hours' ? Math.min(nextValue, 12) : currentParts.hours;
        const minutes = part === 'minutes' ? Math.min(nextValue, 59) : currentParts.minutes;

        return {
          ...service,
          duration_minutes: Math.min(hours * 60 + minutes, MAX_SERVICE_DURATION_MINUTES),
        };
      })
    );
    setServiceErrors((current) => ({ ...current, [serviceId]: '' }));
  };

  const handleServiceToggle = (serviceId, field) => {
    setServices((current) =>
      current.map((service) =>
        service.id === serviceId
          ? {
              ...service,
              [field]: !service[field],
            }
          : service
      )
    );
    setServiceErrors((current) => ({ ...current, [serviceId]: '' }));
  };

  const validateService = (service) => {
    const firstTimePrice = Number(service.first_time_price_amount ?? service.price_naira ?? 0);
    const followUpPrice = Number(service.follow_up_price_amount ?? 0);

    if (firstTimePrice < 0 || followUpPrice < 0) {
      return 'Prices cannot be negative.';
    }

    if (service.is_enabled && firstTimePrice <= 0) {
      return 'Enabled services need a valid first-time consultation price.';
    }

    const durationMinutes = Number(service.duration_minutes || 0);
    if (durationMinutes < 0 || durationMinutes > MAX_SERVICE_DURATION_MINUTES) {
      return 'Duration must be between 0 and 12 hours.';
    }

    return '';
  };

  const handleSaveService = async (service) => {
    const validationError = validateService(service);

    if (validationError) {
      setServiceErrors((current) => ({ ...current, [service.id]: validationError }));
      return;
    }

    setServiceSavingId(service.id);
    setError('');
    setSuccess('');

    try {
      const updated = await updateDoctorConsultationService(service.id, {
        display_name: service.display_name,
        first_time_price_amount: Number(
          service.first_time_price_amount ?? service.price_naira ?? 0
        ),
        follow_up_price_amount: Number(service.follow_up_price_amount ?? 0),
        duration_minutes: service.duration_minutes ? Number(service.duration_minutes) : null,
        is_enabled: Boolean(service.is_enabled),
        requires_payment: Boolean(service.requires_payment),
        availability_note: service.availability_note,
      });

      setServices((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSuccess('Consultation service pricing updated.');
    } catch (err) {
      setServiceErrors((current) => ({
        ...current,
        [service.id]: err.message || 'Could not update this consultation service.',
      }));
    } finally {
      setServiceSavingId('');
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!doctorTermsAccepted) {
        throw new Error(
          'Please confirm your professional information is accurate and accept the Doctor Terms.'
        );
      }

      const updated = await updateDoctorProfile({
        full_name: form.full_name,
        specialization: form.specialization,
        mdcn_registration_number: form.mdcn_registration_number,
        consultation_fee: form.consultation_fee ? Number(form.consultation_fee) : undefined,
        follow_up_fee: form.follow_up_fee ? Number(form.follow_up_fee) : undefined,
        clinic_name: form.clinic_name,
        bio: form.bio,
        phone_number: form.phone_number,
        currency: 'NGN',
        is_available: Boolean(form.is_available),
        doctor_terms_accepted: true,
      });

      setProfile(updated);
      setDoctorTermsAccepted(Boolean(updated?.doctor_terms_accepted_at));
      setSuccess(
        updated?.verification_status === 'pending_review'
          ? 'Verification submitted. Your licence is now pending internal review.'
          : updated?.verification_status === 'verified'
            ? 'Doctor identity updated. Your verified booking page is live.'
            : 'Doctor identity saved successfully.'
      );
    } catch (err) {
      setError(err.message || 'Could not update your clinic setup');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    if (!isLive || !bookingLink) {
      setError(
        isSubscriptionRestricted
          ? subscriptionMessage || 'Renew your subscription to restore public booking access.'
          : 'Your booking link unlocks only after email confirmation and verification approval.'
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(bookingLink);
      setSuccess('Your live clinic link has been copied.');
    } catch {
      setError('Could not copy the booking link from this browser.');
    }
  };

  const handleShareWhatsApp = () => {
    if (!isLive || !bookingLink) {
      setError(
        isSubscriptionRestricted
          ? subscriptionMessage || 'Renew your subscription to restore public booking access.'
          : 'Finish doctor verification first to share your booking page.'
      );
      return;
    }

    const message = encodeURIComponent(
      `You can book a private consultation with me here: ${bookingLink}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const handleResendVerification = async () => {
    try {
      await resendVerificationEmail(doctorUser.email);
      setSuccess('A new verification email has been sent.');
    } catch (err) {
      setError(err.message || 'Could not resend the verification email');
    }
  };

  const handlePreferenceToggle = (key) => {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  };

  const handlePasswordFormChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((current) => ({ ...current, [name]: value }));
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!passwordForm.current_password || !passwordForm.new_password) {
        throw new Error('Current password and new password are required');
      }

      if (passwordForm.new_password !== passwordForm.confirm_password) {
        throw new Error('New password and confirmation do not match');
      }

      await changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });

      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      setSuccess('Your password has been updated successfully.');
    } catch (err) {
      setError(err.message || 'Could not update your password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleRegenerateLink = async () => {
    if (!isVerifiedDoctor) {
      setError('Your public booking link can only be regenerated after verification approval.');
      return;
    }

    setRegeneratingLink(true);
    setError('');
    setSuccess('');

    try {
      const updated = await regenerateBookingLink();
      setProfile(updated);
      setSuccess(
        'A new booking link has been generated. Share the updated clinic page going forward.'
      );
    } catch (err) {
      setError(err.message || 'Could not regenerate your booking link');
    } finally {
      setRegeneratingLink(false);
    }
  };

  const handleAvatarSelected = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      setError('Use a JPG, PNG, or WEBP image for your profile photo.');
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Profile photo must be 2MB or smaller.');
      event.target.value = '';
      return;
    }

    setAvatarUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const updated = await uploadDoctorAvatar(formData);
      setProfile(updated);
      setSuccess('Profile photo updated successfully.');
    } catch (err) {
      setError(err.message || 'Could not upload your profile photo');
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <LoadingState
        title="Loading verification guide"
        message="Preparing your doctor approval steps..."
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="guided-flow-card rounded-[28px] border border-premium-lilac/20 bg-gradient-to-r from-white to-premium-pearl-tint/70 p-7 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-premium-champagne-gold" />
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-premium-champagne-gold">
                Guided launch
              </p>
            </div>
            <h1 className="font-display text-3xl font-bold text-premium-purple-plum">
              Complete your KuraMedics doctor verification in 4 clear steps
            </h1>
            <p className="text-premium-purple-plum/70">
              Submit your legal identity, wait for internal KuraMedics licence review, and unlock
              your verified public booking page only after approval.
            </p>
          </div>
          <div className="min-w-[220px] rounded-3xl border border-premium-lilac/20 bg-white/80 p-4 shadow-premium-soft">
            <div className="flex items-center justify-between text-sm font-semibold text-premium-purple-plum">
              <span>Launch progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-premium-lilac/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-premium-purple-plum to-premium-champagne-gold"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-premium-purple-plum/65">
              Next step:{' '}
              <span className="font-semibold text-premium-purple-plum">{nextStep.title}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {onboardingSteps.map((step, index) => (
            <div
              key={step.id}
              className={`rounded-3xl border p-4 transition-all duration-300 ${step.complete ? 'border-emerald-200 bg-emerald-50/70' : 'border-premium-lilac/20 bg-white/80'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-premium-lilac/20 bg-white text-sm font-bold text-premium-purple-plum">
                  {step.complete ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    index + 1
                  )}
                </div>
                <Badge variant={step.complete ? 'success' : 'warning'}>
                  {step.complete ? 'Done' : 'Up next'}
                </Badge>
              </div>
              <p className="mt-3 font-bold text-premium-purple-plum">{step.title}</p>
              <p className="mt-1 text-sm text-premium-purple-plum/65">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
      {success && <p className="text-sm font-semibold text-emerald-700">{success}</p>}

      {verificationStatus === 'pending_review' && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Your profile is under review. You’ll be notified once your licence is verified.
        </div>
      )}
      {verificationStatus === 'rejected' && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          Review update:{' '}
          {profile?.verification_notes ||
            'Please correct your identity details and resubmit for review.'}
        </div>
      )}
      {verificationStatus === 'suspended' && (
        <div className="rounded-3xl border border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
          Your doctor profile is currently suspended from public booking until an admin reactivates
          it.
        </div>
      )}
      {subscriptionStatus === 'past_due' && !isSubscriptionRestricted && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          {subscriptionMessage ||
            'Your clinic subscription is past due. Renew within the grace period to avoid access restrictions.'}
        </div>
      )}
      {isSubscriptionRestricted && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {subscriptionMessage ||
            'Your clinic subscription is suspended. Renew the outstanding plan to restore booking access.'}
        </div>
      )}

      <Card title="Doctor identity" subtitle="What patients will trust at first glance">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <Avatar
            src={profile?.avatar_url}
            name={form.full_name || doctorUser?.full_name || 'Doctor'}
            className="h-24 w-24 text-2xl"
            textClassName="text-2xl"
          />

          <div className="space-y-3">
            <div>
              <p className="text-lg font-bold text-premium-purple-plum">
                {form.full_name || doctorUser?.full_name || 'Doctor profile'}
              </p>
              <p className="text-sm text-premium-purple-plum/65">
                {form.specialization || 'Add your specialty to complete your public identity'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer">
                <span className="flex items-center justify-center gap-2.5 rounded-2xl border border-premium-purple-plum/10 bg-premium-purple-plum px-6 py-3.5 text-sm font-semibold text-white shadow-premium-layered transition-all duration-500 hover:bg-premium-purple-dark hover:shadow-premium-hover active:scale-[0.98]">
                  <Camera className="h-4 w-4" />
                  {avatarUploading ? 'Uploading photo...' : 'Upload profile photo'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleAvatarSelected}
                  disabled={avatarUploading}
                />
              </label>
              <p className="text-xs text-premium-purple-plum/55">
                JPG, PNG, or WEBP only. Maximum size: 2MB.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div
        className={`rounded-[28px] border p-6 shadow-premium-layered ${canRevealBookingLink ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white' : 'border-premium-lilac/20 bg-gradient-to-br from-premium-pearl-tint/80 to-white'}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-premium-champagne-gold">
              Booking link reveal
            </p>
            <h2 className="mt-2 text-2xl font-bold text-premium-purple-plum">
              {isLive
                ? 'Your verified booking page is ready to share'
                : 'Verification approval unlocks public sharing'}
            </h2>
            <p className="mt-2 text-sm text-premium-purple-plum/65">
              {isLive
                ? 'Patients who open this link come straight into your verified private booking flow.'
                : 'Submit your licence details and wait for internal approval before this page becomes shareable.'}
            </p>
          </div>
          <Badge variant={isLive ? 'success' : 'premium'}>
            {isLive ? 'Live now' : 'Verification required'}
          </Badge>
        </div>

        <div className="mt-5 flex min-h-[74px] items-center break-all rounded-3xl border border-premium-lilac/20 bg-white/80 p-4 text-sm font-semibold text-premium-purple-plum">
          {isLive && bookingLink
            ? bookingLink
            : 'Your verified booking link will appear here once email and licence approval are complete.'}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" onClick={handleCopyLink} disabled={!isLive || !bookingLink}>
            <Copy className="h-4 w-4" /> Copy link
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleShareWhatsApp}
            disabled={!isLive || !bookingLink}
          >
            <Share2 className="h-4 w-4" /> Share on WhatsApp
          </Button>
          {isLive && bookingLink && (
            <a href={bookingLink} target="_blank" rel="noreferrer">
              <Button type="button" variant="outline">
                <ExternalLink className="h-4 w-4" /> Preview page
              </Button>
            </a>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={handleRegenerateLink}
            disabled={regeneratingLink}
          >
            {regeneratingLink ? 'Generating new link...' : 'Regenerate link'}
          </Button>
        </div>

        <div className="mt-4 space-y-1 rounded-2xl border border-premium-lilac/20 bg-white/70 p-4 text-sm text-premium-purple-plum/65">
          <p>
            Verification status:{' '}
            <span className="font-semibold text-premium-purple-plum">{statusLabel}</span>
          </p>
          <p>
            Last opened:{' '}
            <span className="font-semibold text-premium-purple-plum">
              {profile?.booking_link_last_used_at
                ? new Date(profile.booking_link_last_used_at).toLocaleString()
                : 'No visits recorded yet'}
            </span>
          </p>
          <p>This link stays hidden from patients until the doctor profile is verified.</p>
        </div>
      </div>
      <Card
        title="Consultation Services & Pricing"
        subtitle="Set prices for the consultation types you offer"
      >
        <div className="space-y-5">
          <div className="rounded-3xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-4 text-sm text-premium-purple-plum/65">
            <p className="font-semibold text-premium-purple-plum">
              Only enabled services will appear on your public booking page.
            </p>
            <p className="mt-1">
              Set separate prices for new patients and returning/follow-up visits. Patients will pay
              based on the service and consultation category selected at booking.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {services.map((service) => {
              const ServiceIcon = serviceIconMap[service.service_type] || Sparkles;
              const durationParts = getDurationParts(service.duration_minutes);

              return (
                <div
                  key={service.id}
                  className={`rounded-3xl border p-5 shadow-premium-soft transition-all ${
                    service.is_enabled
                      ? 'border-premium-purple-plum/25 bg-white'
                      : 'border-premium-lilac/20 bg-white/70'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-premium-lilac-light text-premium-purple-plum">
                        <ServiceIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-premium-purple-plum">{service.display_name}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="gold">{serviceBadgeMap[service.service_type]}</Badge>
                          <Badge variant={service.is_enabled ? 'success' : 'warning'}>
                            {service.is_enabled ? 'Visible' : 'Hidden'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm font-semibold text-premium-purple-plum">
                      <input
                        type="checkbox"
                        checked={Boolean(service.is_enabled)}
                        onChange={() => handleServiceToggle(service.id, 'is_enabled')}
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Input
                      label="First-time consultation price"
                      type="number"
                      min="0"
                      step="1"
                      value={service.first_time_price_amount ?? service.price_naira ?? ''}
                      onChange={(event) =>
                        handleServiceChange(
                          service.id,
                          'first_time_price_amount',
                          event.target.value
                        )
                      }
                      placeholder="15000"
                    />
                    <Input
                      label="Follow-up price"
                      type="number"
                      min="0"
                      step="1"
                      value={service.follow_up_price_amount ?? ''}
                      onChange={(event) =>
                        handleServiceChange(
                          service.id,
                          'follow_up_price_amount',
                          event.target.value
                        )
                      }
                      placeholder="8000"
                    />
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Duration hours"
                      type="number"
                      min="0"
                      max="12"
                      step="1"
                      value={durationParts.hours}
                      onChange={(event) =>
                        handleServiceDurationChange(service.id, 'hours', event.target.value)
                      }
                      placeholder="0"
                    />
                    <Input
                      label="Duration minutes"
                      type="number"
                      min="0"
                      max="59"
                      step="5"
                      value={durationParts.minutes}
                      onChange={(event) =>
                        handleServiceDurationChange(service.id, 'minutes', event.target.value)
                      }
                      placeholder="30"
                    />
                  </div>

                  <div className="mt-4 space-y-4">
                    <Input
                      label="Availability note"
                      value={service.availability_note || ''}
                      onChange={(event) =>
                        handleServiceChange(service.id, 'availability_note', event.target.value)
                      }
                      placeholder="Available weekdays, Lagos only, or by appointment"
                    />
                    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-4">
                      <div>
                        <p className="font-semibold text-premium-purple-plum">
                          Require payment before confirmation
                        </p>
                        <p className="mt-1 text-sm text-premium-purple-plum/60">
                          Turn this off only when you want offline payment for in-person services.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(service.requires_payment)}
                        onChange={() => handleServiceToggle(service.id, 'requires_payment')}
                        className="mt-1 h-4 w-4"
                      />
                    </label>
                  </div>

                  {serviceErrors[service.id] && (
                    <p className="mt-4 text-sm font-semibold text-rose-600">
                      {serviceErrors[service.id]}
                    </p>
                  )}

                  <div className="mt-5 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => handleSaveService(service)}
                      disabled={serviceSavingId === service.id}
                    >
                      {serviceSavingId === service.id ? 'Saving...' : 'Save service'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card title="License Verification" subtitle="Keep your public doctor trust details current">
        <form onSubmit={handleSave} className="grid gap-5 md:grid-cols-2">
          <Input
            label="Full legal name"
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            placeholder="Dr. Jane Smith"
            required
          />
          <Input
            label="MDCN registration number"
            name="mdcn_registration_number"
            value={form.mdcn_registration_number}
            onChange={handleChange}
            placeholder="MDCN-12345"
            required
          />
          <Input
            label="Specialty"
            name="specialization"
            value={form.specialization}
            onChange={handleChange}
            placeholder="Cardiology"
            required
          />
          <Input
            label="Phone number"
            name="phone_number"
            value={form.phone_number}
            onChange={handleChange}
            placeholder="+2348012345678"
            required
          />
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-premium-lilac/20 bg-white/70 p-4 md:col-span-2">
            <div>
              <p className="text-sm font-bold text-premium-purple-plum">Verification status</p>
              <p className="text-sm text-premium-purple-plum/60">
                {isVerifiedDoctor
                  ? 'Your doctor profile has been approved for public trust.'
                  : verificationStatus === 'pending_review'
                    ? 'Your medical license is under review. You will be notified once verification is complete.'
                    : 'Public booking stays locked until approval.'}
              </p>
            </div>
            <Badge
              variant={
                isVerifiedDoctor
                  ? 'success'
                  : verificationStatus === 'pending_review'
                    ? 'premium'
                    : 'warning'
              }
            >
              {isVerifiedDoctor ? 'Verified' : statusLabel}
            </Badge>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-4 md:col-span-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0"
              checked={doctorTermsAccepted}
              onChange={(event) => setDoctorTermsAccepted(event.target.checked)}
              required
            />
            <span className="text-sm leading-6 text-premium-purple-plum/75">
              I confirm that the professional information I provide is accurate and that I agree to
              the{' '}
              <Link
                to="/doctor-terms"
                target="_blank"
                className="font-semibold text-premium-purple-plum underline"
              >
                Doctor Terms
              </Link>
              .
            </span>
          </label>
          <div className="flex justify-end md:col-span-2">
            <Button type="submit" disabled={saving || !doctorTermsAccepted}>
              {saving ? (
                'Submitting verification...'
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Save and submit
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card title="Notifications" subtitle="Email delivery and patient communication preferences">
          <div className="space-y-4">
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <div>
                <p className="font-semibold text-premium-purple-plum">Email reminders enabled</p>
                <p className="text-sm text-premium-purple-plum/60">
                  Keep patient and doctor reminder emails turned on.
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(preferences.sendEmailReminders)}
                onChange={() => handlePreferenceToggle('sendEmailReminders')}
                className="mt-1 h-4 w-4"
              />
            </label>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <div>
                <p className="font-semibold text-premium-purple-plum">Email verification</p>
                <p className="text-sm text-premium-purple-plum/60">{doctorUser?.email}</p>
              </div>
              {doctorUser?.email_verified === false ? (
                <Button size="sm" variant="secondary" onClick={handleResendVerification}>
                  <MailCheck className="h-4 w-4" /> Resend
                </Button>
              ) : (
                <Badge variant="success">Verified</Badge>
              )}
            </div>
          </div>
        </Card>

        <Card title="Account" subtitle="Clinic availability and password security">
          <div className="space-y-4">
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <div>
                <p className="font-semibold text-premium-purple-plum">
                  Accept new booking requests
                </p>
                <p className="text-sm text-premium-purple-plum/60">
                  Temporarily pause incoming requests when you are unavailable.
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(form.is_available)}
                onChange={(event) =>
                  setForm((current) => ({ ...current, is_available: event.target.checked }))
                }
                className="mt-1 h-4 w-4"
              />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <div>
                <p className="font-semibold text-premium-purple-plum">Require booking approvals</p>
                <p className="text-sm text-premium-purple-plum/60">
                  Keep every request pending review until you confirm it.
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(preferences.bookingApprovalsRequired)}
                onChange={() => handlePreferenceToggle('bookingApprovalsRequired')}
                className="mt-1 h-4 w-4"
              />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <div>
                <p className="font-semibold text-premium-purple-plum">
                  Collect payment after booking
                </p>
                <p className="text-sm text-premium-purple-plum/60">
                  Show a payment handoff after patients submit a request.
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(preferences.paymentAfterBooking)}
                onChange={() => handlePreferenceToggle('paymentAfterBooking')}
                className="mt-1 h-4 w-4"
              />
            </label>
            <form
              onSubmit={handlePasswordSubmit}
              className="space-y-4 rounded-2xl border border-premium-lilac/20 bg-white/75 p-4"
            >
              <Input
                label="Current password"
                name="current_password"
                type="password"
                value={passwordForm.current_password}
                onChange={handlePasswordFormChange}
                placeholder="Enter your current password"
                required
              />
              <Input
                label="New password"
                name="new_password"
                type="password"
                value={passwordForm.new_password}
                onChange={handlePasswordFormChange}
                placeholder="Use 12+ characters with uppercase, number, and symbol"
                required
              />
              <Input
                label="Confirm new password"
                name="confirm_password"
                type="password"
                value={passwordForm.confirm_password}
                onChange={handlePasswordFormChange}
                placeholder="Repeat the new password"
                required
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={passwordSaving}>
                  {passwordSaving ? 'Updating password...' : 'Update password'}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
      <footer className="flex flex-wrap justify-center gap-4 border-t border-premium-lilac/20 pt-6 text-sm font-semibold text-premium-purple-plum/60">
        <Link to="/doctor-terms" className="hover:text-premium-purple-plum">
          Doctor Terms
        </Link>
        <Link to="/privacy" className="hover:text-premium-purple-plum">
          Privacy Policy
        </Link>
        <Link to="/security" className="hover:text-premium-purple-plum">
          Security
        </Link>
      </footer>
    </div>
  );
}

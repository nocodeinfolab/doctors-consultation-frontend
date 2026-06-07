import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, LoadingState } from '../../../components/ui';
import {
  getAdminDashboardStats,
  updateAdminSubscriptionSettings,
  updateAdminUserAccess,
} from '../../../services/api';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

const formatPercent = (value) => {
  const percentValue = Number(value || 0) * 100;
  return `${Number.isInteger(percentValue) ? percentValue.toFixed(0) : percentValue.toFixed(1)}%`;
};

const MetricCard = ({ label, value, helper, icon: Icon }) => (
  <div className="rounded-3xl border border-premium-lilac/20 bg-white/80 p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">{label}</p>
        <p className="mt-2 text-3xl font-bold text-premium-purple-plum">{value}</p>
        <p className="mt-2 text-xs text-premium-purple-plum/60">{helper}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-premium-lilac-light text-premium-purple-plum">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const TrendList = ({ items, valueKey, formatter }) => {
  const maxValue = useMemo(
    () =>
      Math.max(
        ...(Array.isArray(items) && items.length
          ? items.map((item) => Number(item[valueKey] || 0))
          : [1])
      ),
    [items, valueKey]
  );

  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-premium-purple-plum/60">Not enough history yet.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const value = Number(item[valueKey] || 0);
        const width = maxValue > 0 ? `${Math.max((value / maxValue) * 100, 8)}%` : '8%';

        return (
          <div key={`${item.period}-${valueKey}`}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-premium-purple-plum">{item.period}</span>
              <span className="text-premium-purple-plum/65">{formatter(value)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-premium-lilac/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-premium-purple-plum to-premium-champagne-gold"
                style={{ width }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const PieChartSummary = ({ title, segments = [] }) => {
  const filteredSegments = segments.filter((segment) => Number(segment.value || 0) > 0);
  const total = filteredSegments.reduce((sum, segment) => sum + Number(segment.value || 0), 0);

  if (!total) {
    return (
      <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
        <p className="font-semibold text-premium-purple-plum">{title}</p>
        <p className="mt-2 text-sm text-premium-purple-plum/60">Not enough data yet.</p>
      </div>
    );
  }

  let cursor = 0;
  const gradient = filteredSegments
    .map((segment) => {
      const start = cursor;
      const slice = (Number(segment.value || 0) / total) * 100;
      cursor += slice;
      return `${segment.color} ${start}% ${cursor}%`;
    })
    .join(', ');

  return (
    <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
      <p className="font-semibold text-premium-purple-plum">{title}</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div
          className="relative h-28 w-28 shrink-0 rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div className="absolute inset-4 flex items-center justify-center rounded-full bg-white text-sm font-bold text-premium-purple-plum">
            {total}
          </div>
        </div>
        <div className="min-w-[180px] flex-1 space-y-2">
          {filteredSegments.map((segment) => (
            <div key={segment.label} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-premium-purple-plum/70">{segment.label}</span>
              </div>
              <span className="font-semibold text-premium-purple-plum">{segment.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState(null);
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [actioningProfile, setActioningProfile] = useState('');
  const [subscriptionForm, setSubscriptionForm] = useState({
    enabled: true,
    defaultPlan: 'starter',
    biWeeklyFee: 2500,
    monthlyFee: 5000,
    quarterlyFee: 30000,
    annualFee: 240000,
    freeTrialDays: 30,
    gracePeriodDays: 7,
    plans: {
      starter: { monthlyFee: 5000, commissionRate: 0.05 },
      professional: { monthlyFee: 10000, commissionRate: 0.03 },
      premium: { monthlyFee: 20000, commissionRate: 0.015 },
    },
  });

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getAdminDashboardStats();
      setStats(data);
      if (data?.subscription?.settings) {
        setSubscriptionForm({
          enabled: data.subscription.settings.enabled !== false,
          defaultPlan: data.subscription.settings.defaultPlan || 'starter',
          biWeeklyFee: data.subscription.settings.biWeeklyFee || 0,
          monthlyFee: data.subscription.settings.monthlyFee || 0,
          quarterlyFee: data.subscription.settings.quarterlyFee || 0,
          annualFee: data.subscription.settings.annualFee || 0,
          freeTrialDays: data.subscription.settings.freeTrialDays || 30,
          gracePeriodDays: data.subscription.settings.gracePeriodDays || 7,
          plans: {
            starter: {
              monthlyFee: data.subscription.settings.plans?.starter?.monthlyFee || 5000,
              commissionRate: data.subscription.settings.plans?.starter?.commissionRate || 0.05,
            },
            professional: {
              monthlyFee: data.subscription.settings.plans?.professional?.monthlyFee || 10000,
              commissionRate:
                data.subscription.settings.plans?.professional?.commissionRate || 0.03,
            },
            premium: {
              monthlyFee: data.subscription.settings.plans?.premium?.monthlyFee || 20000,
              commissionRate: data.subscription.settings.plans?.premium?.commissionRate || 0.015,
            },
          },
        });
      }
    } catch (err) {
      setError(err.message || 'Could not load admin analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSubscriptionChange = (event) => {
    const { name, value, type, checked } = event.target;
    setSubscriptionForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handlePlanFieldChange = (planCode, field, value) => {
    setSubscriptionForm((current) => ({
      ...current,
      plans: {
        ...current.plans,
        [planCode]: {
          ...current.plans[planCode],
          [field]: value,
        },
      },
    }));
  };

  const handleSaveSubscription = async (event) => {
    event.preventDefault();
    setSavingSubscription(true);
    setError('');
    setSuccess('');

    try {
      await updateAdminSubscriptionSettings({
        enabled: subscriptionForm.enabled,
        defaultPlan: subscriptionForm.defaultPlan || 'starter',
        biWeeklyFee: Number(
          subscriptionForm.biWeeklyFee ||
            Number(subscriptionForm.plans?.starter?.monthlyFee || 0) / 2
        ),
        monthlyFee: Number(subscriptionForm.plans?.starter?.monthlyFee || 0),
        quarterlyFee: Number(subscriptionForm.plans?.professional?.monthlyFee || 0) * 3,
        annualFee: Number(subscriptionForm.plans?.premium?.monthlyFee || 0) * 12,
        freeTrialDays: Number(subscriptionForm.freeTrialDays || 30),
        gracePeriodDays: Number(subscriptionForm.gracePeriodDays || 7),
        currency: 'NGN',
        plans: {
          starter: {
            monthlyFee: Number(subscriptionForm.plans?.starter?.monthlyFee || 0),
            commissionRate: Number(subscriptionForm.plans?.starter?.commissionRate || 0),
          },
          professional: {
            monthlyFee: Number(subscriptionForm.plans?.professional?.monthlyFee || 0),
            commissionRate: Number(subscriptionForm.plans?.professional?.commissionRate || 0),
          },
          premium: {
            monthlyFee: Number(subscriptionForm.plans?.premium?.monthlyFee || 0),
            commissionRate: Number(subscriptionForm.plans?.premium?.commissionRate || 0),
          },
        },
      });
      setSuccess('Doctor subscription pricing updated successfully.');
      await loadStats();
    } catch (err) {
      setError(err.message || 'Could not update subscription pricing');
    } finally {
      setSavingSubscription(false);
    }
  };

  const handleProfileAction = async (profile, action) => {
    const actionLabel =
      action === 'remove'
        ? 'permanently delete this user from the database'
        : action === 'restore'
          ? 'restore this profile'
          : 'suspend this profile';

    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Are you sure you want to ${actionLabel}?`)
    ) {
      return;
    }

    const noteMap = {
      suspend: `${profile.full_name} was suspended from the admin dashboard.`,
      restore: `${profile.full_name} was restored from the admin dashboard.`,
      remove: `${profile.full_name} was permanently deleted from the admin dashboard.`,
    };

    setActioningProfile(`${profile.id}:${action}`);
    setError('');
    setSuccess('');

    try {
      await updateAdminUserAccess(profile.id, {
        action,
        notes: noteMap[action],
      });
      setSuccess(
        action === 'remove'
          ? `${profile.full_name} was deleted from the database.`
          : `${profile.full_name} updated successfully.`
      );
      await loadStats();
    } catch (err) {
      setError(err.message || 'Could not update profile access');
    } finally {
      setActioningProfile('');
    }
  };

  if (loading) {
    return (
      <LoadingState
        title="Loading admin analytics"
        message="Preparing growth, revenue, and activity visibility..."
      />
    );
  }

  if (!stats) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="No analytics available"
        message={error || 'Admin reporting could not be loaded right now.'}
      />
    );
  }

  const overview = stats.overview || {};
  const financial = stats.financial || {};
  const doctors = stats.doctors || {};
  const patients = stats.patients || {};
  const bookings = stats.bookings || {};
  const payments = stats.payments || {};
  const ai = stats.ai || { totals: {}, rates: {}, byFeature: [] };
  const funnel = stats.funnel || { totalVisitors: 0, bookingsCreated: 0, bookingsPaid: 0 };
  const alerts = stats.alerts || { items: [] };
  const subscription = stats.subscription || {
    settings: {},
    billableDoctors: 0,
    projectedBiWeeklyRevenue: 0,
    projectedMonthlyRevenue: 0,
    projectedQuarterlyRevenue: 0,
    projectedAnnualRevenue: 0,
    accounts: [],
    upcomingRenewals: [],
    overdueAccounts: [],
    providerSetup: {},
  };
  const profiles = stats.profiles || { recent: [] };
  const profitSummary = stats.profitSummary || {};
  const businessAnswers = stats.businessAnswers || {};
  const subscriptionAccounts = Array.isArray(subscription.accounts) ? subscription.accounts : [];
  const upcomingRenewals = Array.isArray(subscription.upcomingRenewals)
    ? subscription.upcomingRenewals
    : [];
  const overdueAccounts = Array.isArray(subscription.overdueAccounts)
    ? subscription.overdueAccounts
    : [];
  const providerSetup = subscription.providerSetup || {};
  const planBreakdown = Array.isArray(subscription.planBreakdown) ? subscription.planBreakdown : [];
  const activeSubscriptionCount = subscriptionAccounts.filter(
    (item) => item.status === 'active'
  ).length;
  const pastDueSubscriptionCount = subscriptionAccounts.filter(
    (item) => item.status === 'past_due'
  ).length;
  const suspendedSubscriptionCount = subscriptionAccounts.filter(
    (item) => item.status === 'suspended'
  ).length;

  return (
    <div className="space-y-8">
      <section className="guided-flow-card rounded-[28px] border border-premium-lilac/20 bg-gradient-to-r from-white to-premium-pearl-tint/70 p-7 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-premium-champagne-gold" />
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-premium-champagne-gold">
                Admin visibility
              </p>
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold text-premium-purple-plum">
              Platform growth and revenue dashboard
            </h1>
            <p className="mt-2 text-sm text-premium-purple-plum/70">
              Use this page to understand growth, activity, payment health, and whether the platform
              is making money.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={businessAnswers.isPlatformGrowing ? 'success' : 'warning'}>
              {businessAnswers.isPlatformGrowing ? 'Growing' : 'Needs growth'}
            </Badge>
            <Badge variant={businessAnswers.areUsersActive ? 'success' : 'warning'}>
              {businessAnswers.areUsersActive ? 'Users active' : 'Low activity'}
            </Badge>
            <Badge variant={businessAnswers.isBusinessMakingMoney ? 'success' : 'warning'}>
              {businessAnswers.isBusinessMakingMoney ? 'Profitable' : 'Margin under pressure'}
            </Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
            <p className="font-semibold text-premium-purple-plum">Is the platform growing?</p>
            <p className="mt-2 text-sm text-premium-purple-plum/65">{businessAnswers.growthNote}</p>
          </div>
          <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
            <p className="font-semibold text-premium-purple-plum">Are users active?</p>
            <p className="mt-2 text-sm text-premium-purple-plum/65">
              {businessAnswers.activityNote}
            </p>
          </div>
          <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
            <p className="font-semibold text-premium-purple-plum">Is the business making money?</p>
            <p className="mt-2 text-sm text-premium-purple-plum/65">{businessAnswers.profitNote}</p>
          </div>
        </div>
      </section>

      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
      {success && <p className="text-sm font-semibold text-emerald-700">{success}</p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Doctors"
          value={overview.totalDoctors || 0}
          helper="Total clinicians on platform"
          icon={ShieldCheck}
        />
        <MetricCard
          label="Patients"
          value={overview.totalPatients || 0}
          helper="Registered patient accounts"
          icon={Users}
        />
        <MetricCard
          label="Bookings"
          value={overview.totalBookings || 0}
          helper="All-time appointment requests"
          icon={CalendarDays}
        />
        <MetricCard
          label="Revenue today"
          value={formatCurrency(overview.revenueToday)}
          helper="Paid receipts today"
          icon={CreditCard}
        />
        <MetricCard
          label="Revenue week"
          value={formatCurrency(overview.revenueWeek)}
          helper="Paid receipts this week"
          icon={TrendingUp}
        />
        <MetricCard
          label="Revenue month"
          value={formatCurrency(overview.revenueMonth)}
          helper="Paid receipts this month"
          icon={Activity}
        />
        <MetricCard
          label="Successful payments"
          value={overview.successfulPayments || 0}
          helper="Completed payment records"
          icon={CreditCard}
        />
        <MetricCard
          label="Failed payments"
          value={overview.failedPayments || 0}
          helper="Failed collection attempts"
          icon={Activity}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Conversion funnel"
          subtitle="Track movement from visits to bookings to paid appointments"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Total visitors</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {funnel.totalVisitors || 0}
              </p>
              <p className="mt-1 text-xs text-premium-purple-plum/55">
                {funnel.note || 'Tracking booking-page traffic.'}
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Bookings created</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {funnel.bookingsCreated || 0}
              </p>
              <p className="mt-1 text-xs text-premium-purple-plum/55">
                Visitor to booking: {funnel.visitorToBookingRate ?? '—'}
                {typeof funnel.visitorToBookingRate === 'number' ? '%' : ''}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-800/80">Bookings paid</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{funnel.bookingsPaid || 0}</p>
              <p className="mt-1 text-xs text-emerald-700/80">
                Booking to paid: {funnel.bookingToPaymentRate || 0}%
              </p>
            </div>
          </div>
        </Card>

        <Card title="Alert indicators" subtitle="Spot operational risks quickly">
          <div className="space-y-3">
            {alerts.items?.length ? (
              alerts.items.map((alert, index) => (
                <div
                  key={`${alert.title}-${index}`}
                  className={`rounded-2xl border p-4 ${alert.type === 'critical' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
                >
                  <p className="font-semibold">{alert.title}</p>
                  <p className="mt-1 text-sm opacity-80">{alert.note}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <p className="font-semibold">No urgent alerts right now</p>
                <p className="mt-1 text-sm opacity-80">
                  Bookings and payment failures look stable based on recent activity.
                </p>
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Financial analytics"
          subtitle="Revenue, commission, doctor earnings, and margin view"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Total revenue</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {formatCurrency(financial.totalRevenue)}
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Platform commission</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {formatCurrency(financial.platformCommission)}
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Doctor earnings</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {formatCurrency(financial.doctorEarnings)}
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Estimated monthly profit</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {formatCurrency(profitSummary.estimatedProfit)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-bold text-premium-purple-plum">Payment trends over time</p>
            <div className="mt-3">
              <TrendList
                items={financial.paymentTrends}
                valueKey="revenue"
                formatter={(value) => formatCurrency(value)}
              />
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-bold text-premium-purple-plum">Daily revenue</p>
            <div className="mt-3">
              <TrendList
                items={financial.dailyRevenueTrends}
                valueKey="revenue"
                formatter={(value) => formatCurrency(value)}
              />
            </div>
          </div>
        </Card>

        <Card
          title="Doctor subscription control"
          subtitle="Regulate the recurring SaaS fee doctors pay for platform access"
        >
          <form className="space-y-4" onSubmit={handleSaveSubscription}>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <div>
                <p className="font-semibold text-premium-purple-plum">
                  Subscription billing active
                </p>
                <p className="text-sm text-premium-purple-plum/60">
                  Turn doctor SaaS subscription charging on or off.
                </p>
              </div>
              <input
                type="checkbox"
                name="enabled"
                checked={Boolean(subscriptionForm.enabled)}
                onChange={handleSubscriptionChange}
                className="h-4 w-4 accent-premium-purple-plum"
              />
            </label>

            <div className="grid gap-3 xl:grid-cols-3">
              {['starter', 'professional', 'premium'].map((planCode) => {
                const plan = subscriptionForm.plans?.[planCode] || {};
                const label = planCode.charAt(0).toUpperCase() + planCode.slice(1);
                return (
                  <div
                    key={planCode}
                    className={`rounded-2xl border p-4 ${subscriptionForm.defaultPlan === planCode ? 'border-premium-purple-plum bg-premium-pearl-tint/50' : 'border-premium-lilac/20 bg-white/75'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-premium-purple-plum">{label} plan</p>
                      {subscriptionForm.defaultPlan === planCode && (
                        <Badge variant="success">Default</Badge>
                      )}
                    </div>
                    <label className="mt-3 block">
                      <span className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/55">
                        Monthly price
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={plan.monthlyFee || 0}
                        onChange={(event) =>
                          handlePlanFieldChange(planCode, 'monthlyFee', event.target.value)
                        }
                        className="premium-input mt-2"
                      />
                    </label>
                    <label className="mt-3 block">
                      <span className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/55">
                        Commission rate
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={Number(plan.commissionRate || 0) * 100}
                        onChange={(event) =>
                          handlePlanFieldChange(
                            planCode,
                            'commissionRate',
                            Number(event.target.value || 0) / 100
                          )
                        }
                        className="premium-input mt-2"
                      />
                    </label>
                    <p className="mt-2 text-xs text-premium-purple-plum/60">
                      Doctors see this as {formatCurrency(plan.monthlyFee || 0)}/month and{' '}
                      {planCode === 'premium' ? '1–2%' : formatPercent(plan.commissionRate || 0)}{' '}
                      commission.
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-3">
                <span className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/55">
                  Default plan
                </span>
                <select
                  name="defaultPlan"
                  value={subscriptionForm.defaultPlan}
                  onChange={handleSubscriptionChange}
                  className="premium-input mt-2"
                >
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
              <label className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-3">
                <span className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/55">
                  Free trial days
                </span>
                <input
                  name="freeTrialDays"
                  type="number"
                  min="0"
                  value={subscriptionForm.freeTrialDays}
                  onChange={handleSubscriptionChange}
                  className="premium-input mt-2"
                />
              </label>
              <label className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-3">
                <span className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/55">
                  Grace days
                </span>
                <input
                  name="gracePeriodDays"
                  type="number"
                  min="0"
                  value={subscriptionForm.gracePeriodDays}
                  onChange={handleSubscriptionChange}
                  className="premium-input mt-2"
                />
              </label>
              <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                <p className="text-sm text-premium-purple-plum/60">Billable doctors</p>
                <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                  {subscription.billableDoctors || 0}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                <p className="text-sm text-premium-purple-plum/60">Bi-weekly projection</p>
                <p className="mt-2 text-xl font-bold text-premium-purple-plum">
                  {formatCurrency(subscription.projectedBiWeeklyRevenue)}
                </p>
              </div>
              <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                <p className="text-sm text-premium-purple-plum/60">Monthly projection</p>
                <p className="mt-2 text-xl font-bold text-premium-purple-plum">
                  {formatCurrency(subscription.projectedMonthlyRevenue)}
                </p>
              </div>
              <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                <p className="text-sm text-premium-purple-plum/60">Quarterly projection</p>
                <p className="mt-2 text-xl font-bold text-premium-purple-plum">
                  {formatCurrency(subscription.projectedQuarterlyRevenue)}
                </p>
              </div>
              <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                <p className="text-sm text-premium-purple-plum/60">Annual projection</p>
                <p className="mt-2 text-xl font-bold text-premium-purple-plum">
                  {formatCurrency(subscription.projectedAnnualRevenue)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800/80">Active subscriptions</p>
                <p className="mt-2 text-2xl font-bold text-emerald-700">
                  {activeSubscriptionCount}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-800/80">Past due in grace period</p>
                <p className="mt-2 text-2xl font-bold text-amber-700">{pastDueSubscriptionCount}</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm text-rose-800/80">Suspended accounts</p>
                <p className="mt-2 text-2xl font-bold text-rose-700">
                  {suspendedSubscriptionCount}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {planBreakdown.map((plan) => (
                <div
                  key={plan.code}
                  className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4"
                >
                  <p className="text-sm font-semibold text-premium-purple-plum">{plan.label}</p>
                  <p className="mt-2 text-lg font-bold text-premium-purple-plum">
                    {plan.doctors} doctors
                  </p>
                  <p className="text-sm text-premium-purple-plum/65">
                    {formatCurrency(plan.monthlyFee)}/month • {formatPercent(plan.commissionRate)}{' '}
                    commission
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm font-semibold text-premium-purple-plum">
                Billing provider readiness
              </p>
              <p className="mt-1 text-sm text-premium-purple-plum/65">
                {providerSetup.readyForBillingProviderIntegration
                  ? 'Ready for future provider-backed recurring billing.'
                  : 'Provider wiring is still pending.'}
              </p>
              <p className="mt-2 text-xs text-premium-purple-plum/55">
                Mode: {providerSetup.provider || 'manual'} • Fields prepared:{' '}
                {(providerSetup.supportsFutureFields || []).join(', ') || '—'}
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                <p className="text-sm font-semibold text-premium-purple-plum">Upcoming renewals</p>
                <div className="mt-3 space-y-2">
                  {upcomingRenewals.length ? (
                    upcomingRenewals.slice(0, 5).map((item) => (
                      <div
                        key={`renewal-${item.doctor_user_id}`}
                        className="rounded-xl border border-premium-lilac/20 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-premium-purple-plum">
                            {item.full_name}
                          </span>
                          <Badge variant="premium">
                            {item.plan_name || item.plan_code || item.plan_interval}
                          </Badge>
                        </div>
                        <p className="text-premium-purple-plum/65">
                          Renews {formatDate(item.next_billing_date)} • in{' '}
                          {item.renewal_in_days ?? 0} day(s)
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-premium-purple-plum/60">
                      No renewals due in the next 7 days.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                <p className="text-sm font-semibold text-premium-purple-plum">Overdue accounts</p>
                <div className="mt-3 space-y-2">
                  {overdueAccounts.length ? (
                    overdueAccounts.slice(0, 5).map((item) => (
                      <div
                        key={`overdue-${item.doctor_user_id}`}
                        className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-premium-purple-plum">
                            {item.full_name}
                          </span>
                          <Badge
                            variant={item.status === 'suspended' ? 'warning' : 'premium'}
                          >{`${item.plan_name || item.plan_code || 'Plan'} • ${item.status.replace('_', ' ')}`}</Badge>
                        </div>
                        <p className="text-premium-purple-plum/65">
                          Due {formatDate(item.next_billing_date)} •{' '}
                          {item.restriction_message || 'Renewal attention required.'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-premium-purple-plum/60">
                      No overdue doctor subscriptions right now.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-premium-purple-plum">
                  Doctor subscription status list
                </p>
                <p className="text-xs text-premium-purple-plum/55">
                  Showing {Math.min(subscriptionAccounts.length, 6)} of{' '}
                  {subscriptionAccounts.length}
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {subscriptionAccounts.length ? (
                  subscriptionAccounts.slice(0, 6).map((item) => (
                    <div
                      key={`account-${item.doctor_user_id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-premium-lilac/20 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-premium-purple-plum">{item.full_name}</p>
                        <p className="text-premium-purple-plum/60">
                          {item.specialization} • {item.email}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={item.status === 'active' ? 'success' : 'warning'}>
                          {item.status.replace('_', ' ')}
                        </Badge>
                        <p className="mt-1 text-xs text-premium-purple-plum/55">
                          {formatCurrency(item.monthly_fee || 0)}/month • next bill:{' '}
                          {formatDate(item.next_billing_date)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-premium-purple-plum/60">
                    No doctor subscription records yet.
                  </p>
                )}
              </div>
            </div>

            <Button type="submit" disabled={savingSubscription}>
              <CreditCard className="h-4 w-4" /> Save subscription fees
            </Button>
          </form>
        </Card>

        <Card title="Profit summary" subtitle="Revenue versus estimated operating costs">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <span className="text-sm text-premium-purple-plum">Revenue this month</span>
              <span className="font-bold text-premium-purple-plum">
                {formatCurrency(profitSummary.revenueMonth)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <span className="text-sm text-premium-purple-plum">Estimated payment fees</span>
              <span className="font-bold text-premium-purple-plum">
                {formatCurrency(profitSummary.estimatedPaymentFees)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <span className="text-sm text-premium-purple-plum">Estimated hosting cost</span>
              <span className="font-bold text-premium-purple-plum">
                {formatCurrency(profitSummary.estimatedHostingCost)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <span className="text-sm text-premium-purple-plum">Estimated AI cost</span>
              <span className="font-bold text-premium-purple-plum">
                {formatCurrency(profitSummary.estimatedAiCost)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <span className="text-sm font-semibold text-emerald-800">Estimated net profit</span>
              <span className="font-bold text-emerald-700">
                {formatCurrency(profitSummary.estimatedProfit)}
              </span>
            </div>
            <p className="text-xs text-premium-purple-plum/55">
              Current margin estimate: {profitSummary.marginPercent || 0}%
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card title="Doctor management" subtitle="Verification visibility and performance preview">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
                  Verified
                </p>
                <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                  {doctors.verified || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
                  Pending
                </p>
                <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                  {doctors.pendingReview || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
                  Rejected
                </p>
                <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                  {doctors.rejected || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
                  Suspended
                </p>
                <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                  {doctors.suspended || 0}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {(doctors.performance || []).slice(0, 6).map((doctor) => (
                <div
                  key={doctor.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-premium-lilac/15 bg-white/75 p-3"
                >
                  <div>
                    <p className="font-semibold text-premium-purple-plum">{doctor.full_name}</p>
                    <p className="text-sm text-premium-purple-plum/60">
                      {doctor.specialization} · {doctor.verification_status.replace(/_/g, ' ')} ·{' '}
                      {doctor.account_status || 'active'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-premium-purple-plum">
                      {doctor.bookings_count || 0} bookings
                    </p>
                    <p className="text-xs text-premium-purple-plum/55">
                      {formatCurrency(doctor.total_earnings)} revenue
                    </p>
                    <p className="text-xs text-premium-purple-plum/55">
                      {doctor.paid_bookings || 0} paid · {doctor.conversion_rate || 0}% conversion
                    </p>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      {doctor.account_status === 'active' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleProfileAction(doctor, 'suspend')}
                          disabled={actioningProfile === `${doctor.id}:suspend`}
                        >
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleProfileAction(doctor, 'restore')}
                          disabled={actioningProfile === `${doctor.id}:restore`}
                        >
                          Restore
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleProfileAction(doctor, 'remove')}
                        disabled={actioningProfile === `${doctor.id}:remove`}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Link to="/admin/verifications">
              <Button>
                <ShieldCheck className="h-4 w-4" /> Open approve or reject actions
              </Button>
            </Link>
          </div>
        </Card>

        <Card title="Patient analytics" subtitle="Growth and repeat usage indicators">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Total patients</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {patients.totalPatients || 0}
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Repeat usage rate</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {patients.repeatRate || 0}%
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Repeat patients</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {patients.repeatPatients || 0}
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Active last 30 days</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {patients.activePatientsLast30Days || 0}
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Booking analytics"
          subtitle="Total, completed, cancelled, and trend visibility"
        >
          <div className="mb-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
                Total
              </p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {bookings.total || 0}
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
                Completed
              </p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {bookings.completed || 0}
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
                Cancelled
              </p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {bookings.cancelled || 0}
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
                Completion rate
              </p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {bookings.completionRate || 0}%
              </p>
            </div>
          </div>
          <TrendList
            items={bookings.bookingTrends}
            valueKey="total"
            formatter={(value) => `${value} bookings`}
          />

          <div className="mt-5">
            <p className="text-sm font-bold text-premium-purple-plum">Daily bookings</p>
            <div className="mt-3">
              <TrendList
                items={bookings.dailyBookingTrends}
                valueKey="total"
                formatter={(value) => `${value} bookings`}
              />
            </div>
          </div>
        </Card>

        <Card title="Payment monitoring" subtitle="Success, failed, and pending payment health">
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Successful</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{payments.successful || 0}</p>
              <p className="mt-1 text-xs text-emerald-700/80">{payments.successRate || 0}%</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-rose-700">Failed</p>
              <p className="mt-2 text-2xl font-bold text-rose-700">{payments.failed || 0}</p>
              <p className="mt-1 text-xs text-rose-700/80">{payments.failedRate || 0}%</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Pending</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{payments.pending || 0}</p>
              <p className="mt-1 text-xs text-amber-700/80">{payments.pendingRate || 0}%</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <PieChartSummary
              title="Payment status split"
              segments={[
                { label: 'Successful', value: payments.successful || 0, color: '#10b981' },
                { label: 'Failed', value: payments.failed || 0, color: '#f43f5e' },
                { label: 'Pending', value: payments.pending || 0, color: '#f59e0b' },
              ]}
            />
            <PieChartSummary
              title="Booking status split"
              segments={[
                { label: 'Completed', value: bookings.completed || 0, color: '#10b981' },
                { label: 'Cancelled', value: bookings.cancelled || 0, color: '#f43f5e' },
                { label: 'Pending', value: bookings.pending || 0, color: '#8b5cf6' },
              ]}
            />
          </div>
          <p className="mt-4 text-sm text-premium-purple-plum/65">
            This section shows whether payments are converting smoothly or if attention is needed.
          </p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Profile access control"
          subtitle="Click any recent profile to suspend, restore, or remove access"
        >
          <div className="space-y-3">
            {(profiles.recent || []).length === 0 ? (
              <p className="text-sm text-premium-purple-plum/60">
                No recent profiles are available yet.
              </p>
            ) : (
              (profiles.recent || []).map((profile) => (
                <div
                  key={profile.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-premium-lilac/15 bg-white/75 p-3"
                >
                  <div>
                    <p className="font-semibold text-premium-purple-plum">{profile.full_name}</p>
                    <p className="text-sm text-premium-purple-plum/60">
                      {profile.role} · {profile.email}
                    </p>
                    <p className="text-xs text-premium-purple-plum/55">
                      {profile.role === 'doctor'
                        ? `${profile.specialization} · ${String(profile.verification_status || 'unsubmitted').replace(/_/g, ' ')}`
                        : 'Patient account'}{' '}
                      · {profile.account_status || 'active'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.account_status === 'active' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleProfileAction(profile, 'suspend')}
                        disabled={actioningProfile === `${profile.id}:suspend`}
                      >
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleProfileAction(profile, 'restore')}
                        disabled={actioningProfile === `${profile.id}:restore`}
                      >
                        Restore
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleProfileAction(profile, 'remove')}
                      disabled={actioningProfile === `${profile.id}:remove`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card
          title="AI usage analytics"
          subtitle="How often suggestions are used, edited, ignored, or regenerated"
        >
          <div className="mb-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Used</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {ai.totals?.applied || 0}
              </p>
              <p className="mt-1 text-xs text-premium-purple-plum/55">
                {ai.rates?.useRate || 0}% rate
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Edited</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {ai.totals?.edited || 0}
              </p>
              <p className="mt-1 text-xs text-premium-purple-plum/55">
                {ai.rates?.editRate || 0}% rate
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Ignored</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {ai.totals?.ignored || 0}
              </p>
              <p className="mt-1 text-xs text-premium-purple-plum/55">
                {ai.rates?.ignoreRate || 0}% rate
              </p>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm text-premium-purple-plum/60">Regenerated</p>
              <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                {ai.totals?.regenerated || 0}
              </p>
              <p className="mt-1 text-xs text-premium-purple-plum/55">
                {ai.rates?.regenerateRate || 0}% rate
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="font-semibold text-premium-purple-plum">By feature</p>
              <div className="mt-3 space-y-3">
                {(ai.byFeature || []).length === 0 ? (
                  <p className="text-sm text-premium-purple-plum/60">
                    No AI usage has been recorded yet.
                  </p>
                ) : (
                  ai.byFeature.map((item) => (
                    <div
                      key={item.feature}
                      className="rounded-2xl border border-premium-lilac/15 bg-premium-pearl-tint/40 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-premium-purple-plum">
                          {item.feature.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-premium-purple-plum/55">
                          Used {item.applied || 0} · Edited {item.edited || 0} · Ignored{' '}
                          {item.ignored || 0}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="font-semibold text-premium-purple-plum">Measurement note</p>
              <p className="mt-3 text-sm text-premium-purple-plum/65">
                This dashboard is focused on visibility and decision making. No new AI features were
                introduced in this step.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

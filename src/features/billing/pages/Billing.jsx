import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, LoadingState } from '../../../components/ui';
import PlanComparisonSection from '../../../components/subscription/PlanComparisonSection';
import {
  getMySubscription,
  initializeSubscriptionRenewal,
  updateSubscriptionPreferences,
  verifySubscriptionRenewal,
} from '../../../services/api';
import { CreditCard, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';

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
  return date.toLocaleString();
};

export default function Billing() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [startingRenewal, setStartingRenewal] = useState('');
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [billing, setBilling] = useState(null);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams(location.search);
      const reference = params.get('reference') || params.get('trxref');

      if (reference) {
        await verifySubscriptionRenewal(reference);
        setSuccess('Your renewal has been checked and the latest billing status is now loaded.');
      }

      const data = await getMySubscription();
      setBilling(data);
    } catch (err) {
      setError(err.message || 'Could not load your billing details');
    } finally {
      setLoading(false);
    }
  }, [location.search]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const handleRenewNow = async (planCode = billing?.plan_code || 'starter') => {
    setStartingRenewal(planCode);
    setError('');
    setSuccess('');

    try {
      const selectedPlan = (billing?.available_plans || []).find((item) => item.code === planCode);
      const renewal = await initializeSubscriptionRenewal({
        provider: 'paystack',
        plan_code: planCode,
      });
      setSuccess(
        `${selectedPlan?.label || billing?.plan_name || 'Your'} checkout is ready. Complete the payment and return to this page to refresh your access status.`
      );

      if (renewal?.checkout_url && typeof window !== 'undefined') {
        window.open(renewal.checkout_url, '_blank', 'noopener,noreferrer');
      }

      await loadBilling();
    } catch (err) {
      setError(err.message || 'Could not start subscription checkout');
    } finally {
      setStartingRenewal('');
    }
  };

  const handleToggleAutoRenew = async () => {
    setSavingPreferences(true);
    setError('');
    setSuccess('');

    try {
      const updated = await updateSubscriptionPreferences({
        auto_renew_enabled: !billing?.auto_renew_enabled,
      });
      setBilling(updated);
      setSuccess(
        !billing?.auto_renew_enabled
          ? 'Auto-renew has been enabled. Once a payment method is saved, renewals will be attempted automatically when due.'
          : 'Auto-renew has been turned off. You can still renew manually anytime.'
      );
    } catch (err) {
      setError(err.message || 'Could not update your auto-renew setting');
    } finally {
      setSavingPreferences(false);
    }
  };

  const statusVariant = useMemo(() => {
    if (billing?.is_restricted) return 'warning';
    if (billing?.status === 'past_due') return 'premium';
    return 'success';
  }, [billing]);

  const highlightedPlanCode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const plan = String(params.get('plan') || '')
      .trim()
      .toLowerCase();
    return ['starter', 'professional', 'premium'].includes(plan) ? plan : '';
  }, [location.search]);

  const availablePlans =
    Array.isArray(billing?.available_plans) && billing.available_plans.length
      ? billing.available_plans
      : [
          { code: 'starter', label: 'Starter', monthlyFee: 5000, commissionLabel: '5%' },
          { code: 'professional', label: 'Professional', monthlyFee: 10000, commissionLabel: '3%' },
          { code: 'premium', label: 'Premium', monthlyFee: 20000, commissionLabel: '1–2%' },
        ];

  const featureAccess = Object.values(billing?.feature_entitlements || {}).sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? 1 : -1;
    return String(a.required_plan_label || '').localeCompare(String(b.required_plan_label || ''));
  });

  if (loading) {
    return (
      <LoadingState
        title="Loading billing"
        message="Preparing your subscription and renewal status..."
      />
    );
  }

  if (!billing) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Billing unavailable"
        message={error || 'Your billing details could not be loaded right now.'}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="guided-flow-card rounded-[28px] border border-premium-lilac/25 bg-gradient-to-r from-premium-pearl to-premium-pearl-tint p-7 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-premium-champagne-gold" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-premium-champagne-gold">
                Financial summary
              </p>
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold text-premium-purple-plum">
              Manage your clinic subscription and renewal status
            </h1>
            <p className="mt-2 text-sm text-premium-purple-plum/70">
              Review your current plan, billing interval, next renewal date, grace period, and
              overdue status in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={statusVariant}>
              {billing?.is_restricted
                ? 'Access restricted'
                : billing?.status === 'past_due'
                  ? 'Past due'
                  : billing?.trial_active
                    ? 'Trial active'
                    : 'Active'}
            </Badge>
            <Button onClick={handleToggleAutoRenew} disabled={savingPreferences}>
              {savingPreferences
                ? 'Saving...'
                : billing?.auto_renew_enabled
                  ? 'Turn off auto-renew'
                  : 'Turn on auto-renew'}
            </Button>
            <Button onClick={handleRenewNow} disabled={startingRenewal}>
              <RefreshCw className="h-4 w-4" /> {startingRenewal ? 'Preparing...' : 'Renew now'}
            </Button>
          </div>
        </div>
      </section>

      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
      {success && <p className="text-sm font-semibold text-emerald-700">{success}</p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-premium-lilac/25 bg-premium-pearl p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
            Current plan
          </p>
          <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
            {billing.plan_name || 'Starter'}
          </p>
        </div>
        <div className="rounded-3xl border border-premium-lilac/25 bg-premium-pearl p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
            Billing interval
          </p>
          <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
            {billing.plan_interval || 'monthly'}
          </p>
        </div>
        <div className="rounded-3xl border border-premium-lilac/25 bg-premium-pearl p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
            Next renewal
          </p>
          <p className="mt-2 text-lg font-bold text-premium-purple-plum">
            {formatDate(billing.next_billing_date)}
          </p>
        </div>
        <div className="rounded-3xl border border-premium-lilac/25 bg-premium-pearl p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
            Grace period
          </p>
          <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
            {billing.grace_period_days || 7} days
          </p>
        </div>
        <div className="rounded-3xl border border-premium-lilac/25 bg-premium-pearl p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
            Overdue status
          </p>
          <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
            {billing.overdue_days || 0} days
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card title="Subscription summary" subtitle="What your clinic is billed for right now">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <span className="text-sm text-premium-purple-plum">Monthly charge</span>
              <span className="font-bold text-premium-purple-plum">
                {formatCurrency(billing.monthly_fee)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <span className="text-sm text-premium-purple-plum">Commission rate</span>
              <span className="font-bold text-premium-purple-plum">
                {billing.commission_label || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <span className="text-sm text-premium-purple-plum">Provider</span>
              <span className="font-bold text-premium-purple-plum">
                {billing.billing_provider || billing.provider || 'paystack'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <span className="text-sm text-premium-purple-plum">Auto-renew</span>
              <span className="font-bold text-premium-purple-plum">
                {billing.auto_renew_enabled ? 'Enabled' : 'Off'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <span className="text-sm text-premium-purple-plum">Saved payment method</span>
              <span className="font-bold text-premium-purple-plum">
                {billing.payment_method_ready ? 'Ready' : 'Not saved yet'}
              </span>
            </div>
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm font-semibold text-premium-purple-plum">Status note</p>
              <p className="mt-2 text-sm text-premium-purple-plum/70">
                {billing.restriction_message || 'Your billing status looks healthy.'}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Grace and access state" subtitle="How expiry affects your clinic availability">
          <div className="space-y-3">
            <div
              className={`rounded-2xl border p-4 ${billing.is_restricted ? 'border-rose-200 bg-rose-50 text-rose-800' : billing.status === 'past_due' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
            >
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-semibold">
                    {billing.is_restricted
                      ? 'Access restricted'
                      : billing.status === 'past_due'
                        ? 'Grace period active'
                        : 'Account in good standing'}
                  </p>
                  <p className="mt-1 text-sm opacity-80">
                    {billing.restriction_message || 'You can continue to accept bookings normally.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-1 rounded-2xl border border-premium-lilac/20 bg-white/75 p-4 text-sm text-premium-purple-plum/70">
              <p>
                Grace expires:{' '}
                <span className="font-semibold text-premium-purple-plum">
                  {formatDate(billing.grace_expires_at)}
                </span>
              </p>
              <p>
                Upcoming bookings preserved:{' '}
                <span className="font-semibold text-premium-purple-plum">
                  {billing.upcoming_bookings_count || 0}
                </span>
              </p>
              <p>
                Next booked consultation:{' '}
                <span className="font-semibold text-premium-purple-plum">
                  {formatDate(billing.next_upcoming_booking_date)}
                </span>
              </p>
              <p>
                Provider mode:{' '}
                <span className="font-semibold text-premium-purple-plum">
                  {billing.mock_mode
                    ? 'Local mock or test mode'
                    : billing.provider_configured
                      ? 'Live configured'
                      : 'Not configured'}
                </span>
              </p>
              <p>
                Last auto-renew attempt:{' '}
                <span className="font-semibold text-premium-purple-plum">
                  {formatDate(billing.last_auto_renew_attempt_at)}
                </span>
              </p>
            </div>
          </div>
        </Card>
      </section>

      <Card
        title="Choose the best plan for your clinic"
        subtitle="Simple pricing that helps doctors decide quickly"
      >
        <PlanComparisonSection
          plans={availablePlans}
          currentPlanCode={billing?.plan_code || 'starter'}
          highlightedPlanCode={highlightedPlanCode}
          loadingPlanCode={startingRenewal}
          onSelectPlan={handleRenewNow}
          featureAccess={featureAccess}
          showDetails={featureAccess.length > 0}
          statusNote={`New doctors get a ${billing?.trial_active ? 'live' : ''} 30-day free trial, plus ${billing?.grace_period_days || 7} extra days of grace after expiry.`.replace(
            'live 30-day',
            '30-day'
          )}
        />
      </Card>

      <Card
        title="Recent renewal activity"
        subtitle="Latest successful, failed, or pending renewal attempts"
      >
        <div className="space-y-3">
          {billing.renewals?.length ? (
            billing.renewals.map((item) => (
              <div
                key={item.reference}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-premium-lilac/20 bg-white/75 p-4"
              >
                <div>
                  <p className="font-semibold text-premium-purple-plum">
                    {item.plan_code} plan renewal
                  </p>
                  <p className="text-sm text-premium-purple-plum/60">
                    {formatCurrency(item.amount)} • {item.billing_interval} • {item.provider}
                  </p>
                  <p className="text-xs text-premium-purple-plum/55">
                    Started {formatDate(item.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    variant={
                      item.status === 'paid'
                        ? 'success'
                        : item.status === 'failed'
                          ? 'warning'
                          : 'premium'
                    }
                  >
                    {item.status}
                  </Badge>
                  <p className="mt-2 text-xs text-premium-purple-plum/55">
                    Paid: {formatDate(item.paid_at)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-premium-purple-plum/60">
              No renewal attempts have been recorded yet.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

import React from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { Badge, Button } from '../ui';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const FALLBACK_PLANS = [
  { code: 'starter', label: 'Starter', monthlyFee: 5000, commissionLabel: '5%' },
  { code: 'professional', label: 'Professional', monthlyFee: 10000, commissionLabel: '3%' },
  { code: 'premium', label: 'Premium', monthlyFee: 20000, commissionLabel: '1–2%' },
];

const PLAN_COPY = {
  starter: {
    kicker: 'Core features',
    description: 'A simple way to launch your clinic online and begin accepting patients quickly.',
    features: [
      'Verified public booking page',
      'Appointment and patient management',
      'Secure online payments',
      'WhatsApp patient communication',
      'AI booking assist for intake',
      'Basic clinic dashboard',
    ],
    ctaLabel: 'Start Free Trial',
  },
  professional: {
    kicker: 'Everything in Starter, plus…',
    description:
      'Best for growing clinics that want faster documentation and clearer performance insight.',
    features: [
      'AI consultation note drafts',
      'Full patient e-folder access',
      'Revenue insights',
      'Booking trend visibility',
      'Patient retention insights',
      'Smarter follow-up workflows',
    ],
    ctaLabel: 'Upgrade to Professional',
  },
  premium: {
    kicker: 'Everything in Professional, plus…',
    description: 'For clinics ready to scale with premium visibility, polish, and faster support.',
    features: [
      'Custom clinic branding',
      'Advanced reporting',
      'Deeper financial insights',
      'Conversion tracking',
      'Priority support',
      'Early access to premium tools',
    ],
    ctaLabel: 'Go Premium',
  },
};

const normalizePlanCode = (value) => {
  const normalized = String(value || 'starter')
    .trim()
    .toLowerCase();
  return ['starter', 'professional', 'premium'].includes(normalized) ? normalized : 'starter';
};

export default function PlanComparisonSection({
  plans = [],
  currentPlanCode = 'starter',
  highlightedPlanCode = '',
  loadingPlanCode = '',
  onSelectPlan,
  featureAccess = [],
  statusNote = '',
  showDetails = false,
}) {
  const safeCurrentPlanCode = normalizePlanCode(currentPlanCode);
  const safeHighlightedPlanCode = highlightedPlanCode ? normalizePlanCode(highlightedPlanCode) : '';
  const planList = (Array.isArray(plans) && plans.length ? plans : FALLBACK_PLANS).map((plan) => {
    const safeCode = normalizePlanCode(plan.code);
    return {
      ...plan,
      code: safeCode,
      ...PLAN_COPY[safeCode],
    };
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        {planList.map((plan) => {
          const isCurrentPlan = safeCurrentPlanCode === plan.code;
          const isRecommended = plan.code === 'professional';
          const isHighlighted = safeHighlightedPlanCode === plan.code;

          return (
            <div
              key={plan.code}
              className={`flex h-full flex-col rounded-[26px] border p-5 shadow-premium-soft ${isCurrentPlan ? 'border-premium-purple-plum bg-premium-pearl-tint/60' : isRecommended ? 'border-premium-champagne-gold/40 bg-white' : 'border-premium-lilac/20 bg-white/85'} ${isHighlighted ? 'ring-2 ring-premium-champagne-gold/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-bold text-premium-purple-plum">{plan.label}</p>
                  <p className="mt-1 text-sm font-semibold text-premium-purple-plum/70">
                    {plan.kicker}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isRecommended && <Badge variant="gold">Recommended</Badge>}
                  {isCurrentPlan && <Badge variant="success">Current</Badge>}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-3xl font-bold text-premium-purple-plum">
                  {formatCurrency(plan.monthlyFee)}
                  <span className="text-sm font-semibold text-premium-purple-plum/55">/month</span>
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-premium-purple-plum/50">
                  {plan.commissionLabel || 'Flexible'} commission
                </p>
              </div>

              <p className="mt-4 text-sm leading-6 text-premium-purple-plum/70">
                {plan.description}
              </p>

              <ul className="mt-4 space-y-2.5">
                {plan.features.slice(0, 6).map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-premium-purple-plum/75"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-5">
                <Button
                  className="w-full"
                  variant={isRecommended ? 'primary' : isCurrentPlan ? 'secondary' : 'outline'}
                  disabled={Boolean(loadingPlanCode)}
                  onClick={() => onSelectPlan?.(plan.code)}
                >
                  {loadingPlanCode === plan.code ? 'Opening checkout...' : plan.ctaLabel}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {statusNote && (
        <p className="text-xs font-semibold text-premium-purple-plum/60">{statusNote}</p>
      )}

      {showDetails && featureAccess.length > 0 && (
        <details className="group rounded-[24px] border border-premium-lilac/20 bg-white/80 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-premium-purple-plum">View all features</p>
              <p className="mt-1 text-sm text-premium-purple-plum/60">
                See the full included and locked feature list for your current plan.
              </p>
            </div>
            <ChevronDown className="h-5 w-5 text-premium-purple-plum/60 transition-transform group-open:rotate-180" />
          </summary>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {featureAccess.map((feature) => (
              <div
                key={feature.key}
                className={`rounded-2xl border p-3 ${feature.enabled ? 'border-emerald-200 bg-emerald-50/70' : feature.restricted_by_subscription ? 'border-rose-200 bg-rose-50/80' : 'border-amber-200 bg-amber-50/80'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-premium-purple-plum">{feature.label}</p>
                  <Badge
                    variant={
                      feature.enabled
                        ? 'success'
                        : feature.restricted_by_subscription
                          ? 'warning'
                          : 'premium'
                    }
                  >
                    {feature.enabled
                      ? 'Included'
                      : feature.restricted_by_subscription
                        ? 'Restricted'
                        : `Unlock on ${feature.required_plan_label}`}
                  </Badge>
                </div>
                <p className="mt-2 text-xs font-semibold text-premium-purple-plum/65">
                  {feature.restricted_by_subscription
                    ? feature.message
                    : feature.upgrade_message || feature.message}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

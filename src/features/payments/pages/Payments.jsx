import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, CreditCard, ExternalLink, Receipt, Search } from 'lucide-react';
import { Avatar, Badge, Card, EmptyState, ErrorState, SkeletonBlock } from '../../../components/ui';
import useDoctorWorkspace from '../../../hooks/useDoctorWorkspace';
import { formatCurrency, formatDateTime, paymentStatusMeta } from '../../../utils/doctorWorkspace';

const getPatientName = (payment) =>
  payment?.patient?.name ||
  payment?.patient?.full_name ||
  payment?.patient_name ||
  payment?.patient_full_name ||
  'Patient';

const getPatientContact = (payment) =>
  payment?.patient?.email ||
  payment?.patient_email ||
  payment?.patient?.phone ||
  payment?.patient_phone ||
  'Contact unavailable';

const getPatientId = (payment) =>
  payment?.patient_id ||
  payment?.patient?.id ||
  getPatientContact(payment) ||
  getPatientName(payment);

const getPaymentStatus = (payment) => payment?.payment_status || payment?.status || 'pending';

const getPaymentDate = (payment) =>
  payment?.paid_at || payment?.sortDate || payment?.created_at || payment?.booking_date || null;

const getPaymentReference = (payment) =>
  payment?.reference ||
  payment?.provider_reference ||
  payment?.transaction_id ||
  'Reference unavailable.';

const getPaymentProvider = (payment) => payment?.provider || 'paystack';

const getPaymentAmount = (payment) => Number(payment?.amount || 0);

const getBookingReference = (payment) =>
  payment?.consultation_id || payment?.booking_id || 'Booking unavailable';

const isArchived = (payment) => Boolean(payment?.is_archived || payment?.archived_at);

const isRealPaymentRecord = (payment) => payment?.source !== 'derived';

const formatSafeDateTime = (value) => {
  if (!value) return 'Date unavailable.';
  return formatDateTime(value);
};

const buildPatientGroups = (payments = []) => {
  const grouped = new Map();

  payments.filter(Boolean).forEach((payment) => {
    const patientId = getPatientId(payment);

    if (!grouped.has(patientId)) {
      grouped.set(patientId, {
        id: patientId,
        patientName: getPatientName(payment),
        patientContact: getPatientContact(payment),
        latestPayment: payment,
        payments: [],
        totalPaid: 0,
      });
    }

    const group = grouped.get(patientId);
    group.payments.push(payment);

    if (getPaymentStatus(payment) === 'paid' && isRealPaymentRecord(payment)) {
      group.totalPaid += getPaymentAmount(payment);
    }

    const currentLatest = new Date(getPaymentDate(group.latestPayment) || 0).getTime();
    const nextLatest = new Date(getPaymentDate(payment) || 0).getTime();
    if (nextLatest > currentLatest) {
      group.latestPayment = payment;
      group.patientName = getPatientName(payment);
      group.patientContact = getPatientContact(payment);
    }
  });

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      payments: group.payments.sort(
        (a, b) => new Date(getPaymentDate(b) || 0) - new Date(getPaymentDate(a) || 0)
      ),
    }))
    .sort(
      (a, b) =>
        new Date(getPaymentDate(b.latestPayment) || 0) -
        new Date(getPaymentDate(a.latestPayment) || 0)
    );
};

export default function Payments() {
  const { loading, error, paymentRecords, refresh } = useDoctorWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [expandedPatientIds, setExpandedPatientIds] = useState(() => new Set());

  const realPaymentRecords = useMemo(
    () => paymentRecords.filter((payment) => isRealPaymentRecord(payment) && !isArchived(payment)),
    [paymentRecords]
  );

  const filteredPayments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return realPaymentRecords.filter((payment) => {
      const matchesFilter = activeFilter === 'all' || getPaymentStatus(payment) === activeFilter;
      const matchesSearch =
        !query ||
        [
          getPatientName(payment),
          getPatientContact(payment),
          payment?.booking_id,
          payment?.consultation_id,
          getPaymentReference(payment),
          getPaymentProvider(payment),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, realPaymentRecords, searchTerm]);

  const patientGroups = useMemo(() => buildPatientGroups(filteredPayments), [filteredPayments]);

  useEffect(() => {
    if (!filteredPayments.length) {
      setSelectedId('');
      return;
    }

    if (!selectedId || !filteredPayments.some((payment) => payment?.id === selectedId)) {
      setSelectedId(filteredPayments[0]?.id || '');
    }
  }, [filteredPayments, selectedId]);

  const selectedPayment = filteredPayments.find((payment) => payment?.id === selectedId) || null;
  const totalReceived = realPaymentRecords
    .filter((item) => getPaymentStatus(item) === 'paid')
    .reduce((sum, item) => sum + getPaymentAmount(item), 0);
  const pendingTotal = realPaymentRecords
    .filter((item) => getPaymentStatus(item) === 'pending')
    .reduce((sum, item) => sum + getPaymentAmount(item), 0);

  const togglePatientGroup = (group) => {
    if (group.payments.length === 1) {
      setSelectedId(group.payments[0].id);
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

  if (loading) {
    return <SkeletonBlock className="h-[420px]" />;
  }

  if (error && realPaymentRecords.length === 0) {
    return (
      <ErrorState
        icon={CreditCard}
        title="Could not load payment records"
        message={error || 'Something went wrong. Please try again.'}
        actionLabel="Try again"
        onAction={refresh}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-premium-purple-plum">
          Financial Summary
        </h1>
        <p className="mt-2 text-premium-purple-plum/70">
          Track consultation revenue, payment status, and each linked patient transaction.
        </p>
      </div>

      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="guided-flow-card">
          <button
            type="button"
            onClick={() => setActiveFilter('paid')}
            className="w-full text-left"
          >
            <p className="text-sm text-premium-purple-plum/55">Total received</p>
            <p className="mt-2 text-3xl font-bold text-premium-purple-plum">
              {formatCurrency(totalReceived)}
            </p>
            <p className="mt-1 text-xs text-premium-purple-plum/50">Open paid transactions</p>
          </button>
        </Card>
        <Card className="guided-flow-card">
          <button
            type="button"
            onClick={() => setActiveFilter('pending')}
            className="w-full text-left"
          >
            <p className="text-sm text-premium-purple-plum/55">Pending payments</p>
            <p className="mt-2 text-3xl font-bold text-premium-purple-plum">
              {formatCurrency(pendingTotal)}
            </p>
            <p className="mt-1 text-xs text-premium-purple-plum/50">Review outstanding payments</p>
          </button>
        </Card>
        <Card className="guided-flow-card">
          <button type="button" onClick={() => setActiveFilter('all')} className="w-full text-left">
            <p className="text-sm text-premium-purple-plum/55">Transactions</p>
            <p className="mt-2 text-3xl font-bold text-premium-purple-plum">
              {realPaymentRecords.length}
            </p>
            <p className="mt-1 text-xs text-premium-purple-plum/50">Browse all payment records</p>
          </button>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
        <Card title="Payment Records" subtitle="Grouped by patient, with transaction history">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-premium-purple-plum/35" />
              <input
                className="premium-input pl-11"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search payments"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', 'paid', 'pending', 'failed', 'refunded'].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    activeFilter === filter
                      ? 'bg-premium-purple-plum text-white'
                      : 'bg-premium-lilac-light/40 text-premium-purple-plum'
                  }`}
                >
                  {filter === 'all' ? 'All' : paymentStatusMeta[filter]?.label || filter}
                </button>
              ))}
            </div>

            {patientGroups.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No payment records yet."
                message="As patients complete payment, transaction history will appear here with linked booking details."
              />
            ) : (
              <div className="max-h-[680px] space-y-3 overflow-y-auto pr-1">
                {patientGroups.map((group) => {
                  const latest = group.latestPayment;
                  const latestStatus = getPaymentStatus(latest);
                  const statusMeta = paymentStatusMeta[latestStatus] || {
                    label: latestStatus,
                    variant: 'premium',
                  };
                  const isExpanded = expandedPatientIds.has(group.id);
                  const isSelectedPatient = group.payments.some(
                    (payment) => payment.id === selectedId
                  );

                  return (
                    <div key={group.id} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => togglePatientGroup(group)}
                        className={`w-full rounded-3xl border p-4 text-left transition-all ${
                          isSelectedPatient
                            ? 'border-premium-purple-plum bg-premium-lilac-light/30 shadow-premium-soft'
                            : 'border-premium-lilac/20 bg-white/70 hover:bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
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
                            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                            <Badge variant="premium">
                              {group.payments.length} transaction
                              {group.payments.length === 1 ? '' : 's'}
                            </Badge>
                            {group.payments.length > 1 && (
                              <ChevronDown
                                className={`h-4 w-4 text-premium-purple-plum/55 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            )}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-premium-purple-plum/70 sm:grid-cols-2">
                          <p>
                            Total paid: {formatCurrency(group.totalPaid, latest?.currency || 'NGN')}
                          </p>
                          <p>Latest: {formatSafeDateTime(getPaymentDate(latest))}</p>
                        </div>
                      </button>

                      {group.payments.length > 1 && isExpanded && (
                        <div className="ml-5 space-y-2 border-l border-premium-lilac/25 pl-3">
                          {group.payments.map((payment) => {
                            const status = getPaymentStatus(payment);
                            const nestedStatus = paymentStatusMeta[status] || {
                              label: status,
                              variant: 'premium',
                            };

                            return (
                              <button
                                key={payment?.id}
                                type="button"
                                onClick={() => setSelectedId(payment.id)}
                                className={`w-full rounded-2xl border p-3 text-left transition-all ${
                                  selectedId === payment.id
                                    ? 'border-premium-purple-plum bg-white shadow-premium-soft'
                                    : 'border-premium-lilac/15 bg-white/65 hover:bg-white'
                                }`}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-premium-purple-plum">
                                      {formatCurrency(
                                        getPaymentAmount(payment),
                                        payment?.currency || 'NGN'
                                      )}
                                    </p>
                                    <p className="mt-1 truncate text-xs text-premium-purple-plum/55">
                                      {getPaymentReference(payment)}
                                    </p>
                                  </div>
                                  <Badge variant={nestedStatus.variant}>{nestedStatus.label}</Badge>
                                </div>
                                <p className="mt-2 text-xs text-premium-purple-plum/55">
                                  {formatSafeDateTime(getPaymentDate(payment))} ·{' '}
                                  {getPaymentProvider(payment)} · {getBookingReference(payment)}
                                </p>
                              </button>
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

        <Card title="Transaction Detail" subtitle="Transparent payment-to-consultation visibility">
          {!selectedPayment ? (
            <EmptyState
              icon={Receipt}
              title="Select a payment"
              message="Choose a payment record to view its booking linkage and billing detail."
            />
          ) : (
            <div className="space-y-5">
              <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold text-premium-purple-plum">
                    {getPatientName(selectedPayment)}
                  </p>
                  <Badge
                    variant={
                      paymentStatusMeta[getPaymentStatus(selectedPayment)]?.variant || 'premium'
                    }
                  >
                    {paymentStatusMeta[getPaymentStatus(selectedPayment)]?.label ||
                      getPaymentStatus(selectedPayment)}
                  </Badge>
                </div>
                <p className="mt-2 text-2xl font-bold text-premium-purple-plum">
                  {formatCurrency(
                    getPaymentAmount(selectedPayment),
                    selectedPayment.currency || 'NGN'
                  )}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Booking / consultation
                  </p>
                  <p className="mt-2 break-words font-semibold text-premium-purple-plum">
                    {getBookingReference(selectedPayment)}
                  </p>
                </div>
                <div className="rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Reference
                  </p>
                  <p className="mt-2 break-words font-semibold text-premium-purple-plum">
                    {getPaymentReference(selectedPayment)}
                  </p>
                </div>
                <div className="rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Provider
                  </p>
                  <p className="mt-2 font-semibold capitalize text-premium-purple-plum">
                    {getPaymentProvider(selectedPayment)}
                  </p>
                </div>
                <div className="rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Payment date
                  </p>
                  <p className="mt-2 font-semibold text-premium-purple-plum">
                    {formatSafeDateTime(getPaymentDate(selectedPayment))}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
                <p className="text-sm font-bold text-premium-purple-plum">Receipt summary</p>
                <ul className="mt-3 space-y-2 text-sm text-premium-purple-plum/70">
                  <li>Patient: {getPatientName(selectedPayment)}</li>
                  <li>Email / phone: {getPatientContact(selectedPayment)}</li>
                  <li>Booking date: {formatSafeDateTime(selectedPayment.booking_date)}</li>
                  <li>
                    Status:{' '}
                    {paymentStatusMeta[getPaymentStatus(selectedPayment)]?.label ||
                      getPaymentStatus(selectedPayment)}
                  </li>
                </ul>
                {selectedPayment.authorization_url && (
                  <a
                    href={selectedPayment.authorization_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-premium-purple-plum hover:text-premium-royal"
                  >
                    <ExternalLink className="h-4 w-4" /> Open receipt / proof link
                  </a>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

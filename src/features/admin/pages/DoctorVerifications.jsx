import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, LoadingState } from '../../../components/ui';
import {
  getAdminAiInsights,
  getAdminDoctorVerifications,
  reviewDoctorVerification,
} from '../../../services/api';

const STATUS_META = {
  unsubmitted: { label: 'Unsubmitted', variant: 'warning' },
  pending_review: { label: 'Pending review', variant: 'warning' },
  verified: { label: 'Verified', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
  suspended: { label: 'Suspended', variant: 'premium' },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending_review', label: 'Pending' },
  { id: 'verified', label: 'Verified' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'suspended', label: 'Suspended' },
];

const FEATURE_LABELS = {
  booking_summary: 'Booking summary',
  booking_guidance: 'Booking guidance',
  consultation_notes: 'Consultation notes',
};

const ACTION_LABELS = {
  ai_suggestion_generated: 'Generated',
  ai_suggestion_regenerated: 'Regenerated',
  ai_suggestion_applied: 'Used',
  ai_suggestion_edited: 'Edited',
  ai_suggestion_ignored: 'Ignored',
};

export default function DoctorVerifications() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [queue, setQueue] = useState({ items: [], counts: {} });
  const [aiInsights, setAiInsights] = useState({
    periodDays: 30,
    totals: { generated: 0, regenerated: 0, applied: 0, edited: 0, ignored: 0 },
    byFeature: [],
    recentEvents: [],
  });
  const [notesByDoctor, setNotesByDoctor] = useState({});
  const [submittingKey, setSubmittingKey] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [queueData, insightsData] = await Promise.all([
        getAdminDoctorVerifications(statusFilter),
        getAdminAiInsights(30),
      ]);

      setQueue({
        items: Array.isArray(queueData?.items) ? queueData.items : [],
        counts: queueData?.counts || {},
      });
      setAiInsights({
        periodDays: insightsData?.periodDays || 30,
        totals: insightsData?.totals || {
          generated: 0,
          regenerated: 0,
          applied: 0,
          edited: 0,
          ignored: 0,
        },
        byFeature: Array.isArray(insightsData?.byFeature) ? insightsData.byFeature : [],
        recentEvents: Array.isArray(insightsData?.recentEvents) ? insightsData.recentEvents : [],
      });
    } catch (err) {
      setError(err.message || 'Could not load the doctor verification queue');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleReview = async (doctorId, action) => {
    setSubmittingKey(`${doctorId}:${action}`);
    setError('');
    setSuccess('');

    try {
      await reviewDoctorVerification(doctorId, {
        action,
        notes: notesByDoctor[doctorId] || '',
      });
      setSuccess('Verification review saved successfully.');
      await loadQueue();
    } catch (err) {
      setError(err.message || 'Could not save the review decision');
    } finally {
      setSubmittingKey('');
    }
  };

  if (loading) {
    return (
      <LoadingState
        title="Loading verification queue"
        message="Preparing submitted doctor licence reviews..."
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="guided-flow-card rounded-[28px] border border-premium-lilac/20 bg-gradient-to-r from-white to-premium-pearl-tint/70 p-7 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-premium-champagne-gold" />
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-premium-champagne-gold">
                Internal review
              </p>
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold text-premium-purple-plum">
              Doctor verification queue
            </h1>
            <p className="mt-2 text-sm text-premium-purple-plum/70">
              Validate licence submissions and control which doctors can go live publicly.
            </p>
          </div>

          <Button variant="secondary" onClick={loadQueue}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {FILTERS.slice(1).map((filter) => (
            <div
              key={filter.id}
              className="rounded-3xl border border-premium-lilac/20 bg-white/80 p-4"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
                {filter.label}
              </p>
              <p className="mt-2 text-3xl font-bold text-premium-purple-plum">
                {queue.counts?.[filter.id] || 0}
              </p>
            </div>
          ))}
        </div>
      </section>

      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
      {success && <p className="text-sm font-semibold text-emerald-700">{success}</p>}

      <Card
        title="AI usage insights"
        subtitle={`Internal measurement for the last ${aiInsights.periodDays} days`}
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-premium-lilac/20 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">Used</p>
              <p className="mt-2 text-3xl font-bold text-premium-purple-plum">
                {aiInsights.totals?.applied || 0}
              </p>
            </div>
            <div className="rounded-3xl border border-premium-lilac/20 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
                Edited
              </p>
              <p className="mt-2 text-3xl font-bold text-premium-purple-plum">
                {aiInsights.totals?.edited || 0}
              </p>
            </div>
            <div className="rounded-3xl border border-premium-lilac/20 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
                Ignored
              </p>
              <p className="mt-2 text-3xl font-bold text-premium-purple-plum">
                {aiInsights.totals?.ignored || 0}
              </p>
            </div>
            <div className="rounded-3xl border border-premium-lilac/20 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-premium-purple-plum/50">
                Generated
              </p>
              <p className="mt-2 text-3xl font-bold text-premium-purple-plum">
                {aiInsights.totals?.generated || 0}
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm font-bold text-premium-purple-plum">By feature</p>
              <div className="mt-3 space-y-3">
                {aiInsights.byFeature.length === 0 ? (
                  <p className="text-sm text-premium-purple-plum/60">
                    No AI usage has been recorded yet.
                  </p>
                ) : (
                  aiInsights.byFeature.map((item) => (
                    <div
                      key={item.feature}
                      className="rounded-2xl border border-premium-lilac/15 bg-premium-pearl-tint/40 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-premium-purple-plum">
                          {FEATURE_LABELS[item.feature] || item.feature}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-premium-purple-plum/65">
                          <span>Used {item.applied || 0}</span>
                          <span>Edited {item.edited || 0}</span>
                          <span>Ignored {item.ignored || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
              <p className="text-sm font-bold text-premium-purple-plum">Recent AI activity</p>
              <div className="mt-3 max-h-[320px] space-y-3 overflow-y-auto pr-1">
                {aiInsights.recentEvents.length === 0 ? (
                  <p className="text-sm text-premium-purple-plum/60">
                    No recent AI events have been recorded yet.
                  </p>
                ) : (
                  aiInsights.recentEvents.map((event, index) => (
                    <div
                      key={`${event.created_at}-${event.action}-${index}`}
                      className="rounded-2xl border border-premium-lilac/15 bg-premium-pearl-tint/40 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-premium-purple-plum">
                          {ACTION_LABELS[event.action] || event.action}
                        </p>
                        <span className="text-xs text-premium-purple-plum/55">
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-premium-purple-plum/65">
                        {FEATURE_LABELS[event.feature] || event.feature}
                        {event.context ? ` · ${event.context}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-premium-purple-plum/50">
                        {event.user_email || 'Anonymous internal event'}
                        {event.changed ? ' · user edited the suggestion' : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Button
            key={filter.id}
            type="button"
            variant={statusFilter === filter.id ? 'primary' : 'secondary'}
            onClick={() => setStatusFilter(filter.id)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="space-y-5">
        {queue.items.length === 0 ? (
          <Card
            title="No submissions found"
            subtitle="There are no doctor profiles in this filter right now."
          >
            <div className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4 text-sm text-premium-purple-plum/70">
              Nothing needs action at the moment.
            </div>
          </Card>
        ) : (
          queue.items.map((doctor) => {
            const statusMeta = STATUS_META[doctor.verification_status] || STATUS_META.unsubmitted;

            return (
              <Card
                key={doctor.user_id}
                title={doctor.full_name || 'Doctor profile'}
                subtitle={`${doctor.specialization || 'Specialty pending'} · ${doctor.email}`}
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <Avatar
                        src={doctor.avatar_url}
                        name={doctor.full_name || 'Doctor'}
                        className="h-14 w-14 text-base"
                        textClassName="text-base"
                      />
                      <div className="space-y-1 text-sm text-premium-purple-plum/70">
                        <p>
                          <span className="font-semibold text-premium-purple-plum">MDCN:</span>{' '}
                          {doctor.mdcn_registration_number || 'Not submitted'}
                        </p>
                        <p>
                          <span className="font-semibold text-premium-purple-plum">Phone:</span>{' '}
                          {doctor.phone_number || 'Not provided'}
                        </p>
                        <p>
                          <span className="font-semibold text-premium-purple-plum">Submitted:</span>{' '}
                          {doctor.verification_submitted_at
                            ? new Date(doctor.verification_submitted_at).toLocaleString()
                            : 'Not yet submitted'}
                        </p>
                        <p>
                          <span className="font-semibold text-premium-purple-plum">
                            Performance:
                          </span>{' '}
                          {doctor.bookings_count || 0} bookings · {doctor.completed_bookings || 0}{' '}
                          completed · ₦{Number(doctor.total_earnings || 0).toLocaleString()}{' '}
                          earnings
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  </div>

                  {doctor.verification_notes && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{doctor.verification_notes}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-premium-purple-plum/50">
                      Review notes
                    </label>
                    <textarea
                      rows="3"
                      className="premium-input min-h-[110px]"
                      value={notesByDoctor[doctor.user_id] || ''}
                      onChange={(event) =>
                        setNotesByDoctor((current) => ({
                          ...current,
                          [doctor.user_id]: event.target.value,
                        }))
                      }
                      placeholder="Add an internal note or a correction request for the doctor"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => handleReview(doctor.user_id, 'approve')}
                      disabled={submittingKey === `${doctor.user_id}:approve`}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleReview(doctor.user_id, 'request_correction')}
                      disabled={submittingKey === `${doctor.user_id}:request_correction`}
                    >
                      <AlertCircle className="h-4 w-4" /> Request correction
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleReview(doctor.user_id, 'reject')}
                      disabled={submittingKey === `${doctor.user_id}:reject`}
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleReview(doctor.user_id, 'suspend')}
                      disabled={submittingKey === `${doctor.user_id}:suspend`}
                    >
                      <PauseCircle className="h-4 w-4" /> Suspend
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

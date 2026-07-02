import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FolderOpen,
  MessageCircle,
  Search,
  Sparkles,
  Stethoscope,
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
  createConsultation,
  generateConsultationDraft,
  getConsultationByBooking,
  getConsultationDraft,
  getCurrentUser,
  initiateBookingChat,
  trackAiInteraction,
  updateBookingStatus,
  updateConsultationDraft,
} from '../../../services/api';
import { getStoredUser } from '../../../services/authStorage';
import {
  consultationStatusMeta,
  formatDateTime,
  formatRelativeTime,
} from '../../../utils/doctorWorkspace';

const getConsultationStatus = (consultation) =>
  consultation?.consultation_status ||
  consultation?.booking_status ||
  consultation?.status ||
  'upcoming';

const getPatientName = (consultation) =>
  consultation?.patient?.name ||
  consultation?.patient?.full_name ||
  consultation?.patient_name ||
  consultation?.patient_full_name ||
  'Patient';

const getPatientEmail = (consultation) =>
  consultation?.patient?.email || consultation?.patient_email || '';

const getConsultationReason = (consultation) =>
  consultation?.consultation?.reason ||
  consultation?.reason ||
  consultation?.booking?.message ||
  consultation?.message ||
  consultation?.notes ||
  'Consultation request';

const getConsultationDate = (consultation) =>
  consultation?.booking_date || consultation?.created_at || consultation?.updated_at || null;

const getStatusMeta = (consultation) => {
  const status = getConsultationStatus(consultation);
  return consultationStatusMeta[status] || { label: status, variant: 'premium' };
};

class ConsultationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Consultation dashboard crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          icon={Stethoscope}
          title="Consultation workspace could not render"
          message="One consultation record could not be displayed. Refresh the workspace or try again shortly."
          actionLabel="Refresh workspace"
          onAction={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}

function ConsultationsContent() {
  const navigate = useNavigate();
  const { loading, error, refresh, consultations } = useDoctorWorkspace();
  const [doctorUser, setDoctorUser] = useState(() => getStoredUser());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});
  const [consultationNotes, setConsultationNotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [aiBusyId, setAiBusyId] = useState(null);
  const [aiDraftMeta, setAiDraftMeta] = useState({});
  const [success, setSuccess] = useState('');
  const notesSaveTimersRef = useRef(new Map());
  const serverDraftsRef = useRef({});
  const notesRef = useRef({});

  useEffect(() => {
    notesRef.current = consultationNotes;
  }, [consultationNotes]);

  useEffect(() => {
    return () => {
      const timers = notesSaveTimersRef.current;
      timers.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setDoctorUser(user))
      .catch(() => {});
  }, []);

  const safeConsultations = useMemo(
    () => (Array.isArray(consultations) ? consultations.filter(Boolean) : []),
    [consultations]
  );

  const filteredConsultations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return safeConsultations.filter((consultation) => {
      const status = getConsultationStatus(consultation);
      const matchesFilter = activeFilter === 'all' || status === activeFilter;
      const matchesSearch =
        !query ||
        [
          getPatientName(consultation),
          getPatientEmail(consultation),
          getConsultationReason(consultation),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, safeConsultations, searchTerm]);

  const activeConsultations = useMemo(
    () =>
      filteredConsultations.filter(
        (consultation) => getConsultationStatus(consultation) !== 'completed'
      ),
    [filteredConsultations]
  );

  const aiFeatureAccess =
    doctorUser?.subscription_feature_entitlements?.ai_consultation_notes || null;
  const aiNotesLocked = Boolean(aiFeatureAccess && !aiFeatureAccess.enabled);
  const aiNotesMessage = aiFeatureAccess?.restricted_by_subscription
    ? aiFeatureAccess?.message ||
      doctorUser?.subscription_message ||
      'Your subscription is inactive. Renew to restore access.'
    : aiFeatureAccess?.upgrade_message ||
      aiFeatureAccess?.message ||
      'Upgrade to Professional to unlock AI consultation notes.';
  const secureMessagingEnabled = Boolean(
    doctorUser?.subscription_feature_entitlements?.secure_patient_messaging?.enabled
  );

  const getMessagingUnavailableReason = (booking) => {
    if (!booking) return '';
    if (!['upcoming', 'in-progress'].includes(getConsultationStatus(booking))) {
      return 'Messaging is closed for this booking status.';
    }
    if (booking?.payment_required !== false && booking?.payment_status !== 'paid') {
      return 'Messaging opens after payment is confirmed.';
    }
    if (!secureMessagingEnabled) {
      return 'Secure messaging is available on Professional and Premium plans.';
    }
    return '';
  };

  const completedFolders = useMemo(() => {
    const grouped = new Map();

    filteredConsultations
      .filter((consultation) => getConsultationStatus(consultation) === 'completed')
      .forEach((consultation) => {
        const key =
          consultation?.patient_id ||
          getPatientEmail(consultation) ||
          getPatientName(consultation) ||
          consultation?.id;

        if (!grouped.has(key)) {
          grouped.set(key, {
            id: key,
            patient_name: getPatientName(consultation),
            patient_email: getPatientEmail(consultation),
            consultations: [],
          });
        }

        grouped.get(key).consultations.push(consultation);
      });

    return Array.from(grouped.values())
      .map((folder) => ({
        ...folder,
        consultations: folder.consultations.sort(
          (a, b) => new Date(getConsultationDate(b) || 0) - new Date(getConsultationDate(a) || 0)
        ),
      }))
      .sort(
        (a, b) =>
          new Date(getConsultationDate(b.consultations[0]) || 0) -
          new Date(getConsultationDate(a.consultations[0]) || 0)
      );
  }, [filteredConsultations]);

  useEffect(() => {
    const visibleIds = [
      ...activeConsultations.map((item) => item.id),
      ...completedFolders.flatMap((folder) =>
        expandedFolders[folder.id] ? folder.consultations.map((item) => item.id) : []
      ),
    ];

    if (!visibleIds.length) {
      setSelectedId('');
      return;
    }

    if (!selectedId || !visibleIds.includes(selectedId)) {
      setSelectedId(visibleIds[0]);
    }
  }, [activeConsultations, completedFolders, expandedFolders, selectedId]);

  const selectedConsultation = filteredConsultations.find((item) => item.id === selectedId) || null;

  const fireAndForgetAiTracking = (feature, action, options = {}) => {
    trackAiInteraction({ feature, action, ...options }).catch(() => {});
  };

  const buildDraftPayload = (bookingId) => ({
    raw_notes: notesRef.current[`${bookingId}-raw`] || '',
    outcome_notes: notesRef.current[`${bookingId}-outcome`] || '',
    plan_notes: notesRef.current[`${bookingId}-plan`] || '',
    follow_up_notes: notesRef.current[`${bookingId}-notes`] || '',
  });

  const queueDraftSave = (bookingId) => {
    if (!bookingId) {
      return;
    }

    const timers = notesSaveTimersRef.current;
    if (timers.has(bookingId)) {
      window.clearTimeout(timers.get(bookingId));
    }

    const timeoutId = window.setTimeout(async () => {
      timers.delete(bookingId);
      const payload = buildDraftPayload(bookingId);
      const previous = serverDraftsRef.current[bookingId];
      const hasChanges =
        !previous ||
        previous.raw_notes !== payload.raw_notes ||
        previous.outcome_notes !== payload.outcome_notes ||
        previous.plan_notes !== payload.plan_notes ||
        previous.follow_up_notes !== payload.follow_up_notes;

      if (!hasChanges) {
        return;
      }

      try {
        const saved = await updateConsultationDraft(bookingId, payload);
        serverDraftsRef.current = {
          ...serverDraftsRef.current,
          [bookingId]: {
            raw_notes: saved?.raw_notes ?? payload.raw_notes,
            outcome_notes: saved?.outcome_notes ?? payload.outcome_notes,
            plan_notes: saved?.plan_notes ?? payload.plan_notes,
            follow_up_notes: saved?.follow_up_notes ?? payload.follow_up_notes,
          },
        };
      } catch (err) {
        window.alert(err.message || 'Could not save consultation draft notes');
      }
    }, 800);

    timers.set(bookingId, timeoutId);
  };

  const updateNoteField = (bookingId, field, value) => {
    setConsultationNotes((current) => {
      const next = { ...current, [`${bookingId}-${field}`]: value };
      notesRef.current = next;
      return next;
    });
    queueDraftSave(bookingId);

    if (aiDraftMeta[bookingId]?.generated && !aiDraftMeta[bookingId]?.edited) {
      setAiDraftMeta((current) => ({
        ...current,
        [bookingId]: {
          ...current[bookingId],
          edited: true,
        },
      }));
      fireAndForgetAiTracking('consultation_notes', 'edited', { changed: true, context: field });
    }
  };

  useEffect(() => {
    if (!selectedConsultation) {
      return;
    }

    let active = true;

    const loadSavedConsultation = async () => {
      try {
        const existing = await getConsultationByBooking(selectedConsultation.id);
        if (
          active &&
          existing?.doctor_notes &&
          !notesRef.current[`${selectedConsultation.id}-notes`]
        ) {
          setConsultationNotes((current) => {
            const next = {
              ...current,
              [`${selectedConsultation.id}-notes`]: existing.doctor_notes,
            };
            notesRef.current = next;
            return next;
          });
        }
      } catch {
        // No existing saved consultation yet.
      }
    };

    loadSavedConsultation();

    return () => {
      active = false;
    };
  }, [selectedConsultation?.id]);

  useEffect(() => {
    if (!selectedConsultation?.id) {
      return undefined;
    }

    let cancelled = false;

    const loadDraft = async () => {
      try {
        const draft = await getConsultationDraft(selectedConsultation.id);
        if (cancelled) {
          return;
        }

        const serverDraft = {
          raw_notes: draft?.raw_notes || '',
          outcome_notes: draft?.outcome_notes || '',
          plan_notes: draft?.plan_notes || '',
          follow_up_notes: draft?.follow_up_notes || '',
        };
        const previousDraft = serverDraftsRef.current[selectedConsultation.id];
        serverDraftsRef.current = {
          ...serverDraftsRef.current,
          [selectedConsultation.id]: serverDraft,
        };

        setConsultationNotes((current) => {
          const next = { ...current };
          const fields = [
            ['raw', 'raw_notes'],
            ['outcome', 'outcome_notes'],
            ['plan', 'plan_notes'],
            ['notes', 'follow_up_notes'],
          ];

          fields.forEach(([fieldKey, serverKey]) => {
            const stateKey = `${selectedConsultation.id}-${fieldKey}`;
            const currentValue = current[stateKey];
            const previousServerValue = previousDraft?.[serverKey];
            const serverValue = serverDraft[serverKey];

            if (currentValue === undefined || currentValue === previousServerValue) {
              next[stateKey] = serverValue;
            }
          });

          notesRef.current = next;
          return next;
        });
      } catch (err) {
        if (!cancelled) {
          window.alert(err.message || 'Could not load consultation draft notes');
        }
      }
    };

    loadDraft();

    return () => {
      cancelled = true;
    };
  }, [selectedConsultation?.id]);

  const handleGenerateAiNotes = async (booking, mode = 'generate') => {
    if (aiNotesLocked) {
      window.alert(aiNotesMessage);
      return;
    }

    const rawInput = [
      consultationNotes[`${booking.id}-raw`] || '',
      consultationNotes[`${booking.id}-outcome`] || '',
      consultationNotes[`${booking.id}-plan`] || '',
      consultationNotes[`${booking.id}-notes`] || '',
      getConsultationReason(booking),
    ]
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!rawInput) {
      window.alert('Add a short note first so the AI can organize it.');
      return;
    }

    setAiBusyId(booking.id);
    setSuccess('');

    try {
      const draft = await generateConsultationDraft({
        raw_notes: rawInput,
        patient_reason: getConsultationReason(booking),
        regenerate_key: mode === 'regenerate' ? Date.now() : 0,
      });

      setConsultationNotes((current) => {
        const next = {
          ...current,
          [`${booking.id}-outcome`]: draft.key_findings || current[`${booking.id}-outcome`] || '',
          [`${booking.id}-plan`]: [draft.possible_diagnosis, draft.recommendations]
            .filter(Boolean)
            .join('\n\n'),
          [`${booking.id}-notes`]: `Patient explanation: ${draft.patient_explanation || 'Share clear home-care steps.'}\nFollow-up suggestion: ${draft.follow_up_timeline || 'Review as clinically needed.'}`,
        };
        notesRef.current = next;
        return next;
      });
      setAiDraftMeta((current) => ({
        ...current,
        [booking.id]: {
          generated: true,
          edited: false,
        },
      }));

      setSuccess('AI draft ready. Review and edit it before saving.');
      queueDraftSave(booking.id);
    } catch (err) {
      window.alert(err.message || 'Could not generate the AI note right now');
    } finally {
      setAiBusyId(null);
    }
  };

  const handleIgnoreAiNotes = (booking) => {
    setAiDraftMeta((current) => ({
      ...current,
      [booking.id]: {
        generated: false,
        edited: false,
      },
    }));
    setSuccess('AI suggestions dismissed. You can continue manually.');
    fireAndForgetAiTracking('consultation_notes', 'ignored', { context: 'manual_only' });
    queueDraftSave(booking.id);
  };

  const handleSaveConsultationNotes = async (booking) => {
    const finalNotes = [
      consultationNotes[`${booking.id}-raw`]
        ? `**HISTORY**\n${consultationNotes[`${booking.id}-raw`]}`
        : '',
      consultationNotes[`${booking.id}-outcome`]
        ? `**EXAMINATION FINDINGS**\n${consultationNotes[`${booking.id}-outcome`]}`
        : '',
      consultationNotes[`${booking.id}-plan`]
        ? `**DIAGNOSIS**\n${consultationNotes[`${booking.id}-plan`]}`
        : '',
      consultationNotes[`${booking.id}-notes`]
        ? `**PLAN**\n${consultationNotes[`${booking.id}-notes`]}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    if (!finalNotes.trim()) {
      window.alert('Add or generate the consultation summary before saving.');
      return;
    }

    setBusyId(booking.id);
    setSuccess('');

    try {
      await createConsultation({
        booking_id: booking.id,
        doctor_notes: finalNotes,
      });
      if (aiDraftMeta[booking.id]?.generated || aiDraftMeta[booking.id]?.edited) {
        fireAndForgetAiTracking('consultation_notes', 'applied', {
          changed: Boolean(aiDraftMeta[booking.id]?.edited),
          context: 'saved_note',
        });
      }
      await refresh();
      setSuccess('Consultation summary saved and the visit has been completed.');
    } catch (err) {
      window.alert(err.message || 'Could not save this consultation summary');
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

  const handleComplete = async (bookingId) => {
    setBusyId(bookingId);
    try {
      await updateBookingStatus(bookingId, 'completed');
      await refresh();
    } catch (err) {
      window.alert(err.message || 'Could not mark the consultation as completed');
    } finally {
      setBusyId(null);
    }
  };

  const handleFolderToggle = (folder) => {
    setExpandedFolders((current) => {
      const nextIsExpanded = !current[folder.id];

      if (nextIsExpanded && folder.consultations[0]?.id) {
        setSelectedId(folder.consultations[0].id);
      }

      return {
        ...current,
        [folder.id]: nextIsExpanded,
      };
    });
  };

  if (loading) {
    return <SkeletonBlock className="h-[420px]" />;
  }

  if (error) {
    return (
      <ErrorState
        icon={Stethoscope}
        title="Could not load consultations"
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
          Consultation Workspace
        </h1>
        <p className="mt-2 text-premium-purple-plum/70">
          Review live consultations, draft clinical notes, and complete follow-up records in one
          place.
        </p>
      </div>

      {success && <p className="text-sm font-semibold text-emerald-600">{success}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="guided-flow-card">
          <button
            type="button"
            onClick={() => setActiveFilter('upcoming')}
            className="w-full text-left"
          >
            <p className="text-sm text-premium-purple-plum/55">Upcoming</p>
            <p className="mt-2 text-3xl font-bold text-premium-purple-plum">
              {
                safeConsultations.filter((item) => getConsultationStatus(item) === 'upcoming')
                  .length
              }
            </p>
            <p className="mt-1 text-xs text-premium-purple-plum/50">Open upcoming sessions</p>
          </button>
        </Card>
        <Card className="guided-flow-card">
          <button
            type="button"
            onClick={() => setActiveFilter('in-progress')}
            className="w-full text-left"
          >
            <p className="text-sm text-premium-purple-plum/55">In progress</p>
            <p className="mt-2 text-3xl font-bold text-premium-purple-plum">
              {
                safeConsultations.filter((item) => getConsultationStatus(item) === 'in-progress')
                  .length
              }
            </p>
            <p className="mt-1 text-xs text-premium-purple-plum/50">Review live work</p>
          </button>
        </Card>
        <Card className="guided-flow-card">
          <button
            type="button"
            onClick={() => setActiveFilter('completed')}
            className="w-full text-left"
          >
            <p className="text-sm text-premium-purple-plum/55">Completed</p>
            <p className="mt-2 text-3xl font-bold text-premium-purple-plum">
              {
                safeConsultations.filter((item) => getConsultationStatus(item) === 'completed')
                  .length
              }
            </p>
            <p className="mt-1 text-xs text-premium-purple-plum/50">View completed visits</p>
          </button>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Card
          title="Consultation Workspace"
          subtitle="Open live visits and archived patient records"
        >
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-premium-purple-plum/35" />
              <input
                className="premium-input pl-11"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search consultations or patient records"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', 'upcoming', 'in-progress', 'completed'].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${activeFilter === filter ? 'bg-premium-purple-plum text-white' : 'bg-premium-lilac-light/40 text-premium-purple-plum'}`}
                >
                  {filter === 'all' ? 'All' : consultationStatusMeta[filter]?.label || filter}
                </button>
              ))}
            </div>

            {filteredConsultations.length === 0 ? (
              <EmptyState
                icon={Stethoscope}
                title="No consultations yet"
                message="Confirmed and completed bookings will automatically form your clinical workflow here."
              />
            ) : (
              <div className="max-h-[680px] space-y-4 overflow-y-auto pr-1">
                {activeConsultations.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                      Open consultations
                    </p>
                    {activeConsultations.map((consultation, index) => (
                      <button
                        key={consultation?.id || `consultation-${index}`}
                        type="button"
                        onClick={() => setSelectedId(consultation?.id)}
                        className={`w-full rounded-3xl border p-4 text-left transition-all ${selectedId === consultation?.id ? 'border-premium-purple-plum bg-premium-lilac-light/30 shadow-premium-soft' : 'border-premium-lilac/20 bg-white/70 hover:bg-white'}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-bold text-premium-purple-plum">
                              {getPatientName(consultation)}
                            </p>
                            <p className="text-xs text-premium-purple-plum/55">
                              {formatDateTime(getConsultationDate(consultation))}
                            </p>
                          </div>
                          <Badge variant={getStatusMeta(consultation).variant}>
                            {getStatusMeta(consultation).label}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-premium-purple-plum/70">
                          {getConsultationReason(consultation)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {completedFolders.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                      Patient records archive
                    </p>
                    {completedFolders.map((folder) => {
                      const isExpanded = Boolean(expandedFolders[folder.id]);

                      return (
                        <div
                          key={folder.id}
                          className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-3"
                        >
                          <button
                            type="button"
                            onClick={() => handleFolderToggle(folder)}
                            className="flex w-full items-center justify-between gap-3 rounded-2xl px-2 py-2 text-left"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-premium-lilac-light/40 text-premium-purple-plum">
                                <FolderOpen className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-bold text-premium-purple-plum">
                                  {folder.patient_name}
                                </p>
                                <p className="truncate text-xs text-premium-purple-plum/55">
                                  {folder.patient_email || 'Completed patient record'}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant="success">
                                {folder.consultations.length} visit
                                {folder.consultations.length === 1 ? '' : 's'}
                              </Badge>
                              <ChevronDown
                                className={`h-4 w-4 text-premium-purple-plum/60 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="mt-3 space-y-2 border-t border-premium-lilac/15 pt-3">
                              {folder.consultations.map((consultation) => (
                                <button
                                  key={consultation.id}
                                  type="button"
                                  onClick={() =>
                                      setSelectedId(
                                          selectedId === consultation.id ? '' : consultation.id
                                      )
                                  }
                                  className={`w-full rounded-2xl border p-3 text-left transition-all ${selectedId === consultation.id ? 'border-premium-purple-plum bg-premium-lilac-light/30' : 'border-premium-lilac/15 bg-white hover:bg-premium-pearl-tint/40'}`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-premium-purple-plum">
                                      {formatDateTime(getConsultationDate(consultation))}
                                    </p>
                                    <Badge variant="success">Completed</Badge>
                                  </div>
                                  <p className="mt-1 text-sm text-premium-purple-plum/65">
                                    {getConsultationReason(consultation)}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card title="Clinical note workspace" subtitle="Notes, outcomes, and next steps">
          {!selectedConsultation ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Select a consultation"
              message="Open any live consultation or click a patient folder to expand completed visits."
            />
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Avatar
                  name={getPatientName(selectedConsultation)}
                  className="h-12 w-12 text-sm"
                  textClassName="text-sm"
                />
                <div>
                  <p className="font-bold text-premium-purple-plum">
                    {getPatientName(selectedConsultation)}
                  </p>
                  <p className="text-sm text-premium-purple-plum/60">
                    {getPatientEmail(selectedConsultation) || 'Email unavailable'}
                  </p>
                </div>
                <div className="ml-auto">
                  <Badge variant={getStatusMeta(selectedConsultation).variant}>
                    {getStatusMeta(selectedConsultation).label}
                  </Badge>
                </div>
              </div>

              <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
                <p className="text-sm font-bold text-premium-purple-plum">Consultation reason</p>
                <p className="mt-2 text-sm text-premium-purple-plum/70">
                  {getConsultationReason(selectedConsultation) || 'No reason recorded.'}
                </p>
                <p className="mt-3 text-xs text-premium-purple-plum/55">
                  Scheduled {formatDateTime(getConsultationDate(selectedConsultation))} ·{' '}
                  {formatRelativeTime(getConsultationDate(selectedConsultation))}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      busyId === selectedConsultation.id ||
                      Boolean(getMessagingUnavailableReason(selectedConsultation))
                    }
                    onClick={() => handleMessagePatient(selectedConsultation)}
                  >
                    <MessageCircle className="h-4 w-4" />{' '}
                    {busyId === selectedConsultation.id ? 'Opening...' : 'Message patient'}
                  </Button>
                  {getMessagingUnavailableReason(selectedConsultation) && (
                    <p className="text-sm font-semibold text-premium-purple-plum/60">
                      {getMessagingUnavailableReason(selectedConsultation)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-premium-lilac/20 bg-premium-pearl-tint/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-premium-purple-plum">
                      AI documentation helper
                    </p>
                    <p className="text-sm text-premium-purple-plum/65">
                      Short, editable suggestions only. Nothing is saved until you approve it.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        aiNotesLocked
                          ? doctorUser?.subscription_status === 'suspended'
                            ? 'warning'
                            : 'premium'
                          : 'success'
                      }
                    >
                      {aiNotesLocked ? 'Locked on this plan' : 'Included in your plan'}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        handleGenerateAiNotes(
                          selectedConsultation,
                          aiDraftMeta[selectedConsultation.id]?.generated
                            ? 'regenerate'
                            : 'generate'
                        )
                      }
                      disabled={
                        aiNotesLocked ||
                        aiBusyId === selectedConsultation.id ||
                        busyId === selectedConsultation.id
                      }
                    >
                      <Sparkles className="h-4 w-4" />{' '}
                      {aiNotesLocked
                        ? 'Upgrade required'
                        : aiBusyId === selectedConsultation.id
                          ? 'Generating...'
                          : aiDraftMeta[selectedConsultation.id]?.generated
                            ? 'Regenerate'
                            : 'Generate note'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleIgnoreAiNotes(selectedConsultation)}
                    >
                      Work manually
                    </Button>
                  </div>
                </div>
                {aiNotesLocked && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {aiNotesMessage}
                  </div>
                )}
              </div>

              {getConsultationStatus(selectedConsultation) === 'completed' ? (
                <div className="space-y-4">
                  {/* Display structured saved notes for completed consultations */}
                  {consultationNotes[`${selectedConsultation.id}-raw`] && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-1 rounded-full bg-premium-purple-plum"></div>
                        <h3 className="font-semibold text-premium-purple-plum">History</h3>
                      </div>
                      <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                        <p className="whitespace-pre-wrap text-sm text-premium-purple-plum/70">
                          {consultationNotes[`${selectedConsultation.id}-raw`]}
                        </p>
                      </div>
                    </div>
                  )}

                  {consultationNotes[`${selectedConsultation.id}-outcome`] && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-1 rounded-full bg-premium-purple-plum"></div>
                        <h3 className="font-semibold text-premium-purple-plum">
                          Examination Findings
                        </h3>
                      </div>
                      <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                        <p className="whitespace-pre-wrap text-sm text-premium-purple-plum/70">
                          {consultationNotes[`${selectedConsultation.id}-outcome`]}
                        </p>
                      </div>
                    </div>
                  )}

                  {consultationNotes[`${selectedConsultation.id}-plan`] && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-1 rounded-full bg-premium-purple-plum"></div>
                        <h3 className="font-semibold text-premium-purple-plum">Diagnosis</h3>
                      </div>
                      <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                        <p className="whitespace-pre-wrap text-sm text-premium-purple-plum/70">
                          {consultationNotes[`${selectedConsultation.id}-plan`]}
                        </p>
                      </div>
                    </div>
                  )}

                  {consultationNotes[`${selectedConsultation.id}-notes`] && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-1 rounded-full bg-premium-purple-plum"></div>
                        <h3 className="font-semibold text-premium-purple-plum">Plan</h3>
                      </div>
                      <div className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-4">
                        <p className="whitespace-pre-wrap text-sm text-premium-purple-plum/70">
                          {consultationNotes[`${selectedConsultation.id}-notes`]}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800">
                    <p className="font-semibold">Protected Health Information (PHI)</p>
                    <p className="mt-1">
                      This workspace contains sensitive patient data. Ensure notes are accurate and
                      only shared with authorized personnel.
                    </p>
                  </div>

                  {/* History Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-1 rounded-full bg-premium-purple-plum"></div>
                      <h3 className="font-semibold text-premium-purple-plum">History</h3>
                    </div>
                    <textarea
                      className="premium-input min-h-[100px]"
                      placeholder="Patient history, presenting complaint, and relevant background information"
                      value={consultationNotes[`${selectedConsultation.id}-raw`] || ''}
                      onChange={(event) =>
                        updateNoteField(selectedConsultation.id, 'raw', event.target.value)
                      }
                    />
                  </div>

                  {/* Examination Findings Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-1 rounded-full bg-premium-purple-plum"></div>
                      <h3 className="font-semibold text-premium-purple-plum">
                        Examination Findings
                      </h3>
                    </div>
                    <textarea
                      className="premium-input min-h-[120px]"
                      placeholder="Physical examination findings, vital signs, and clinical observations"
                      value={consultationNotes[`${selectedConsultation.id}-outcome`] || ''}
                      onChange={(event) =>
                        updateNoteField(selectedConsultation.id, 'outcome', event.target.value)
                      }
                    />
                  </div>

                  {/* Diagnosis Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-1 rounded-full bg-premium-purple-plum"></div>
                      <h3 className="font-semibold text-premium-purple-plum">Diagnosis</h3>
                    </div>
                    <textarea
                      className="premium-input min-h-[120px]"
                      placeholder="Clinical diagnosis, differential diagnosis, and reasoning"
                      value={consultationNotes[`${selectedConsultation.id}-plan`] || ''}
                      onChange={(event) =>
                        updateNoteField(selectedConsultation.id, 'plan', event.target.value)
                      }
                    />
                  </div>

                  {/* Plan Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-1 rounded-full bg-premium-purple-plum"></div>
                      <h3 className="font-semibold text-premium-purple-plum">Plan</h3>
                    </div>
                    <textarea
                      className="premium-input min-h-[120px]"
                      placeholder="Treatment plan, medications, follow-up instructions, and patient education"
                      value={consultationNotes[`${selectedConsultation.id}-notes`] || ''}
                      onChange={(event) =>
                        updateNoteField(selectedConsultation.id, 'notes', event.target.value)
                      }
                    />
                  </div>
                </div>
              )}

              <div className="rounded-3xl border border-dashed border-premium-lilac/30 bg-premium-pearl-tint/40 p-4">
                <p className="text-sm font-bold text-premium-purple-plum">Attach files</p>
                <p className="mt-2 text-sm text-premium-purple-plum/60">
                  Clinical attachments will appear here when the dedicated consultation attach flow
                  is connected.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={
                    busyId === selectedConsultation.id ||
                    getConsultationStatus(selectedConsultation) === 'completed'
                  }
                  onClick={() => handleSaveConsultationNotes(selectedConsultation)}
                >
                  <CheckCircle2 className="h-4 w-4" />{' '}
                  {busyId === selectedConsultation.id ? 'Saving...' : 'Confirm note'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    busyId === selectedConsultation.id ||
                    getConsultationStatus(selectedConsultation) === 'completed'
                  }
                  onClick={() => handleComplete(selectedConsultation.id)}
                >
                  <CheckCircle2 className="h-4 w-4" /> Complete consultation
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function Consultations() {
  return (
    <ConsultationErrorBoundary>
      <ConsultationsContent />
    </ConsultationErrorBoundary>
  );
}

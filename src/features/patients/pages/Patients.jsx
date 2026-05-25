import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CalendarDays,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Users,
} from 'lucide-react';
import { Avatar, Badge, Card, EmptyState, SkeletonBlock } from '../../../components/ui';
import useDoctorWorkspace from '../../../hooks/useDoctorWorkspace';
import {
  getPatientChatHistory,
  getPatientAiDrafts,
  getPatientInternalNotes,
  getPatientResults,
  getPatientTimeline,
  updatePatientInternalNotes,
} from '../../../services/api';
import { formatCurrency, formatDateTime, formatRelativeTime } from '../../../utils/doctorWorkspace';

const sorters = {
  recent: (a, b) => new Date(b.mostRecentBooking || 0) - new Date(a.mostRecentBooking || 0),
  name: (a, b) => String(a.full_name).localeCompare(String(b.full_name)),
  bookings: (a, b) => b.totalBookings - a.totalBookings,
};

export default function Patients() {
  const { loading, error, patients } = useDoctorWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('recent');
  const [selectedId, setSelectedId] = useState('');
  const [selectedTab, setSelectedTab] = useState('history');
  const [patientNotes, setPatientNotes] = useState({});
  const [patientFolder, setPatientFolder] = useState({
    chat: [],
    results: [],
    timeline: [],
    drafts: [],
  });
  const notesSaveTimersRef = useRef(new Map());
  const serverNotesRef = useRef({});

  const filteredPatients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return [...patients]
      .filter((patient) => {
        if (!query) {
          return true;
        }

        return [patient.full_name, patient.email, patient.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort(sorters[sortKey] || sorters.recent);
  }, [patients, searchTerm, sortKey]);

  useEffect(() => {
    if (!filteredPatients.length) {
      setSelectedId('');
      return;
    }

    if (!selectedId || !filteredPatients.some((patient) => patient.id === selectedId)) {
      setSelectedId(filteredPatients[0].id);
    }
  }, [filteredPatients, selectedId]);

  const selectedPatient = filteredPatients.find((patient) => patient.id === selectedId) || null;
  const selectedPatientKey = selectedPatient?.patient_id || '';
  const returningPatients = patients.filter((patient) => patient.totalBookings > 1).length;
  const paidPatients = patients.filter((patient) => Number(patient.totalPaid || 0) > 0).length;

  useEffect(() => {
    if (!selectedPatientKey) {
      return undefined;
    }

    let cancelled = false;

    const loadNotes = async () => {
      try {
        const response = await getPatientInternalNotes(selectedPatientKey);
        if (cancelled) {
          return;
        }

        const serverValue = response?.notes || '';
        const previousServerValue = serverNotesRef.current[selectedPatientKey];
        serverNotesRef.current = {
          ...serverNotesRef.current,
          [selectedPatientKey]: serverValue,
        };

        setPatientNotes((current) => {
          const currentValue = current[selectedPatientKey];
          if (currentValue === undefined || currentValue === previousServerValue) {
            return { ...current, [selectedPatientKey]: serverValue };
          }
          return current;
        });
      } catch (err) {
        if (!cancelled) {
          window.alert(err.message || 'Could not load patient notes');
        }
      }
    };

    loadNotes();

    return () => {
      cancelled = true;
    };
  }, [selectedPatientKey]);

  useEffect(() => {
    if (!selectedPatientKey) {
      setPatientFolder({ chat: [], results: [], timeline: [], drafts: [] });
      return undefined;
    }

    let cancelled = false;
    const loadFolder = async () => {
      try {
        const [chat, results, timeline, drafts] = await Promise.all([
          getPatientChatHistory(selectedPatientKey).catch(() => []),
          getPatientResults(selectedPatientKey).catch(() => []),
          getPatientTimeline(selectedPatientKey).catch(() => []),
          getPatientAiDrafts(selectedPatientKey).catch(() => []),
        ]);
        if (!cancelled) {
          setPatientFolder({
            chat: chat || [],
            results: results || [],
            timeline: timeline || [],
            drafts: drafts || [],
          });
        }
      } catch {
        if (!cancelled) {
          setPatientFolder({ chat: [], results: [], timeline: [], drafts: [] });
        }
      }
    };
    loadFolder();
    return () => {
      cancelled = true;
    };
  }, [selectedPatientKey]);

  useEffect(() => {
    return () => {
      const timers = notesSaveTimersRef.current;
      timers.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timers.clear();
    };
  }, []);

  const persistPatientNote = async (patientId, value) => {
    if (!patientId) {
      return;
    }

    if (serverNotesRef.current[patientId] === value) {
      return;
    }

    try {
      const updated = await updatePatientInternalNotes(patientId, value);
      const savedNotes = typeof updated?.notes === 'string' ? updated.notes : value;

      serverNotesRef.current = {
        ...serverNotesRef.current,
        [patientId]: savedNotes,
      };

      setPatientNotes((current) =>
        current[patientId] === value ? { ...current, [patientId]: savedNotes } : current
      );
    } catch (err) {
      window.alert(err.message || 'Could not save patient notes');
    }
  };

  const handlePatientNoteChange = (patientId, value) => {
    setPatientNotes((current) => ({ ...current, [patientId]: value }));
    const timers = notesSaveTimersRef.current;

    if (timers.has(patientId)) {
      window.clearTimeout(timers.get(patientId));
    }

    const timeoutId = window.setTimeout(() => {
      timers.delete(patientId);
      persistPatientNote(patientId, value);
    }, 700);

    timers.set(patientId, timeoutId);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
        </div>
        <SkeletonBlock className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-premium-purple-plum">
          Patient Records
        </h1>
        <p className="mt-2 text-premium-purple-plum/70">
          Review your live patient records, follow-up history, and internal notes in one place.
        </p>
      </div>

      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="guided-flow-card">
          <button type="button" onClick={() => setSortKey('recent')} className="w-full text-left">
            <p className="text-sm text-premium-purple-plum/55">Total patients</p>
            <p className="mt-2 text-3xl font-bold text-premium-purple-plum">{patients.length}</p>
            <p className="mt-1 text-xs text-premium-purple-plum/50">View most recent activity</p>
          </button>
        </Card>
        <Card className="guided-flow-card">
          <button type="button" onClick={() => setSortKey('bookings')} className="w-full text-left">
            <p className="text-sm text-premium-purple-plum/55">Returning patients</p>
            <p className="mt-2 text-3xl font-bold text-premium-purple-plum">{returningPatients}</p>
            <p className="mt-1 text-xs text-premium-purple-plum/50">Sort by booking history</p>
          </button>
        </Card>
        <Card className="guided-flow-card">
          <button type="button" onClick={() => setSortKey('name')} className="w-full text-left">
            <p className="text-sm text-premium-purple-plum/55">Patients with payments</p>
            <p className="mt-2 text-3xl font-bold text-premium-purple-plum">{paidPatients}</p>
            <p className="mt-1 text-xs text-premium-purple-plum/50">Browse patient records</p>
          </button>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
        <Card title="Patient Records" subtitle="Search by name, email, or contact details">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-premium-purple-plum/35" />
                <input
                  className="premium-input pl-11"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search patients"
                />
              </div>
              <select
                className="premium-input lg:max-w-[220px]"
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value)}
              >
                <option value="recent">Most recent booking</option>
                <option value="name">Name</option>
                <option value="bookings">Number of bookings</option>
              </select>
            </div>

            {filteredPatients.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No patients yet"
                message="Once requests start coming in, your private patient directory will appear here."
              />
            ) : (
              <div className="max-h-[700px] space-y-3 overflow-y-auto pr-1">
                {filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => setSelectedId(patient.id)}
                    className={`w-full rounded-3xl border p-4 text-left transition-all ${selectedId === patient.id ? 'border-premium-purple-plum bg-premium-lilac-light/30 shadow-premium-soft' : 'border-premium-lilac/20 bg-white/70 hover:bg-white'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={patient.full_name}
                          className="h-11 w-11 text-sm"
                          textClassName="text-sm"
                        />
                        <div>
                          <p className="font-bold text-premium-purple-plum">{patient.full_name}</p>
                          <p className="text-xs text-premium-purple-plum/55">
                            {patient.email || 'Email unavailable'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {patient.totalBookings > 1 && <Badge variant="success">Returning</Badge>}
                        {Number(patient.totalPaid || 0) > 0 && (
                          <Badge variant="premium">Payer</Badge>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-premium-purple-plum/65">
                      {patient.totalBookings} booking{patient.totalBookings === 1 ? '' : 's'} · Last
                      activity {formatRelativeTime(patient.mostRecentBooking)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card title="Patient summary" subtitle="Profile details, history, and doctor notes">
          {!selectedPatient ? (
            <EmptyState
              icon={FileText}
              title="Select a patient"
              message="Choose a patient from the directory to review their interactions and notes."
            />
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Avatar
                  name={selectedPatient.full_name}
                  className="h-14 w-14 text-base"
                  textClassName="text-base"
                />
                <div>
                  <p className="text-lg font-bold text-premium-purple-plum">
                    {selectedPatient.full_name}
                  </p>
                  <p className="text-sm text-premium-purple-plum/60">
                    Joined {formatDateTime(selectedPatient.date_joined)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Email
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-premium-purple-plum">
                    <Mail className="h-4 w-4" /> {selectedPatient.email || 'Not available'}
                  </p>
                </div>
                <div className="rounded-2xl border border-premium-lilac/20 bg-premium-pearl-tint/50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Phone
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-premium-purple-plum">
                    <Phone className="h-4 w-4" /> {selectedPatient.phone || 'Not available'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Bookings
                  </p>
                  <p className="mt-2 font-bold text-premium-purple-plum">
                    {selectedPatient.totalBookings}
                  </p>
                </div>
                <div className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Completed
                  </p>
                  <p className="mt-2 font-bold text-premium-purple-plum">
                    {selectedPatient.completedBookings}
                  </p>
                </div>
                <div className="rounded-2xl border border-premium-lilac/20 bg-white/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-premium-purple-plum/45">
                    Paid
                  </p>
                  <p className="mt-2 font-bold text-premium-purple-plum">
                    {formatCurrency(selectedPatient.totalPaid || 0)}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    ['history', CalendarDays, 'Chat History'],
                    ['results', FileText, 'Results / Files'],
                    ['drafts', Bot, 'AI Drafts'],
                    ['notes', MessageCircle, 'Approved Clinical Notes'],
                  ].map(([key, Icon, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedTab(key)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                        selectedTab === key
                          ? 'border-premium-purple-plum bg-premium-lilac-light text-premium-purple-plum'
                          : 'border-premium-lilac/25 bg-white text-premium-purple-plum/65'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 max-h-[260px] space-y-3 overflow-y-auto pr-1">
                  {selectedTab === 'history' &&
                    [...selectedPatient.history, ...patientFolder.chat].map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-premium-lilac/10 bg-premium-pearl-tint/40 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-sm font-semibold text-premium-purple-plum">
                            <CalendarDays className="h-4 w-4" />{' '}
                            {formatDateTime(
                              item.booking_date || item.last_message_at || item.created_at
                            )}
                          </span>
                          <Badge variant={item.status === 'completed' ? 'success' : 'premium'}>
                            {item.status || 'chat'}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-premium-purple-plum/70">
                          {item.reason || item.patient_name || 'Secure chat thread'}
                        </p>
                      </div>
                    ))}

                  {selectedTab === 'results' &&
                    (patientFolder.results.length ? patientFolder.results : []).map((file) => (
                      <div
                        key={file.id}
                        className="rounded-2xl border border-premium-lilac/10 bg-white/70 p-3"
                      >
                        <p className="font-bold text-premium-purple-plum">{file.file_name}</p>
                        <p className="mt-1 text-xs text-premium-purple-plum/55">
                          {file.attachment_category} · {formatDateTime(file.created_at)}
                        </p>
                      </div>
                    ))}

                  {selectedTab === 'drafts' &&
                    (patientFolder.drafts.length ? patientFolder.drafts : []).map((draft) => (
                      <div
                        key={draft.id}
                        className="rounded-2xl border border-premium-lilac/10 bg-premium-champagne-soft/50 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold text-premium-purple-plum">
                            AI-organised draft for doctor review
                          </p>
                          <Badge variant={draft.status === 'approved' ? 'success' : 'warning'}>
                            {draft.status}
                          </Badge>
                        </div>
                        <p className="mt-2 line-clamp-3 text-sm text-premium-purple-plum/70">
                          {draft.history || 'No history section recorded.'}
                        </p>
                      </div>
                    ))}

                  {selectedTab === 'notes' &&
                    patientFolder.timeline
                      .filter((event) =>
                        [
                          'CHAT_MESSAGE_SENT',
                          'CHAT_RESULT_UPLOADED',
                          'AI_CLINICAL_DRAFT_GENERATED',
                          'CONSULTATION_NOTE_CREATED_FROM_CHAT',
                          'CONSULTATION_COMPLETED',
                        ].includes(event.event_type)
                      )
                      .map((event) => (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-premium-lilac/10 bg-white/70 p-3"
                        >
                          <p className="font-bold text-premium-purple-plum">{event.event_type}</p>
                          <p className="mt-1 text-sm text-premium-purple-plum/65">
                            {event.description}
                          </p>
                        </div>
                      ))}
                </div>
              </div>

              <div className="rounded-3xl border border-premium-lilac/20 bg-white/75 p-4">
                <p className="text-sm font-bold text-premium-purple-plum">Doctor notes</p>
                <textarea
                  className="premium-input mt-3 min-h-[140px]"
                  rows="5"
                  placeholder={
                    selectedPatientKey
                      ? 'Add observations, follow-up reminders, or patient context'
                      : 'Patient notes are unavailable for this record'
                  }
                  value={selectedPatientKey ? (patientNotes[selectedPatientKey] ?? '') : ''}
                  onChange={(event) =>
                    handlePatientNoteChange(selectedPatientKey, event.target.value)
                  }
                  disabled={!selectedPatientKey}
                />
                <p className="mt-2 text-xs text-premium-purple-plum/50">
                  {selectedPatientKey
                    ? 'These notes are saved to your clinic workspace for future reference.'
                    : 'Patient notes require a connected patient record.'}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

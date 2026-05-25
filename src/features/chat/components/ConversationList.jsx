import React, { useMemo, useState } from 'react';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { Avatar, Badge, EmptyState } from '../../../components/ui';

const getPatientName = (conversation) =>
  conversation?.patient?.name ||
  conversation?.patient?.full_name ||
  conversation?.patient_name ||
  conversation?.doctor_name ||
  'Patient';

const getPatientId = (conversation) =>
  conversation?.patient_id || conversation?.patient?.id || getPatientName(conversation);

const getLastActivity = (conversation) =>
  conversation?.last_message_created_at ||
  conversation?.last_message_at ||
  conversation?.updated_at ||
  conversation?.created_at ||
  '';

const getPreview = (conversation) => {
  if (conversation?.last_message_deleted_at) {
    return 'This message was removed';
  }

  if (conversation?.last_message_body) {
    return conversation.last_message_body;
  }

  if (conversation?.last_message_type === 'image') {
    return 'Image shared';
  }

  if (conversation?.last_message_type === 'file') {
    return 'File shared';
  }

  return conversation?.booking_reason || 'Secure clinical thread';
};

const formatTimestamp = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const getThreadLabel = (conversation, index) => {
  if (conversation?.booking_date) {
    const date = new Date(conversation.booking_date);
    if (!Number.isNaN(date.getTime())) {
      return `Booking ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    }
  }

  if (conversation?.consultation_id) {
    return 'Consultation thread';
  }

  return `Conversation ${index + 1}`;
};

const normalizeStatus = (status) => (status === 'active' ? 'open' : status || 'open');

const buildPatientGroups = (conversations = []) => {
  const grouped = new Map();

  conversations.filter(Boolean).forEach((conversation) => {
    const patientId = getPatientId(conversation);

    if (!grouped.has(patientId)) {
      grouped.set(patientId, {
        id: patientId,
        patientName: getPatientName(conversation),
        latestConversation: conversation,
        conversations: [],
        unreadCount: 0,
      });
    }

    const group = grouped.get(patientId);
    group.conversations.push(conversation);
    group.unreadCount += Number(conversation?.unread_count || 0);

    const currentLatest = new Date(getLastActivity(group.latestConversation) || 0).getTime();
    const nextLatest = new Date(getLastActivity(conversation) || 0).getTime();
    if (nextLatest > currentLatest) {
      group.latestConversation = conversation;
    }
  });

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      conversations: group.conversations.sort(
        (a, b) => new Date(getLastActivity(b) || 0) - new Date(getLastActivity(a) || 0)
      ),
    }))
    .sort(
      (a, b) =>
        new Date(getLastActivity(b.latestConversation) || 0) -
        new Date(getLastActivity(a.latestConversation) || 0)
    );
};

export default function ConversationList({ conversations = [], selectedId, onSelect }) {
  const [expandedPatientIds, setExpandedPatientIds] = useState(() => new Set());
  const patientGroups = useMemo(() => buildPatientGroups(conversations), [conversations]);

  const selectedPatientId = useMemo(() => {
    const selectedConversation = conversations.find(
      (conversation) => conversation?.id === selectedId
    );
    return selectedConversation ? getPatientId(selectedConversation) : '';
  }, [conversations, selectedId]);

  const togglePatient = (group) => {
    if (group.conversations.length === 1) {
      onSelect(group.conversations[0].id);
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

  if (!patientGroups.length) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="No secure messages yet."
        message="Secure chats appear here after a paid booking exists."
      />
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto p-3">
      {patientGroups.map((group) => {
        const isExpanded = expandedPatientIds.has(group.id);
        const isSelectedPatient = selectedPatientId === group.id;
        const latest = group.latestConversation;

        return (
          <div key={group.id} className="space-y-2">
            <button
              type="button"
              onClick={() => togglePatient(group)}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                isSelectedPatient
                  ? 'border-premium-purple-plum bg-premium-lilac-light/40'
                  : 'border-premium-lilac/20 bg-white/70 hover:bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar name={group.patientName} className="h-10 w-10 text-xs" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-premium-purple-plum">
                      {group.patientName}
                    </p>
                    <span className="shrink-0 text-[10px] font-semibold text-premium-purple-plum/45">
                      {formatTimestamp(getLastActivity(latest))}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-premium-purple-plum/55">
                    {getPreview(latest)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {group.unreadCount > 0 && <Badge variant="gold">{group.unreadCount}</Badge>}
                  {group.conversations.length > 1 && (
                    <ChevronDown
                      className={`h-4 w-4 text-premium-purple-plum/45 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </div>
              </div>
            </button>

            {group.conversations.length > 1 && isExpanded && (
              <div className="ml-5 space-y-2 border-l border-premium-lilac/25 pl-3">
                {group.conversations.map((conversation, index) => (
                  <button
                    key={conversation?.id || `${group.id}-${index}`}
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selectedId === conversation.id
                        ? 'border-premium-purple-plum bg-white shadow-premium-soft'
                        : 'border-premium-lilac/15 bg-white/60 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-bold text-premium-purple-plum">
                        {getThreadLabel(conversation, index)}
                      </p>
                      <Badge
                        variant={
                          normalizeStatus(conversation?.status) === 'closed' ? 'premium' : 'success'
                        }
                      >
                        {normalizeStatus(conversation?.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-premium-purple-plum/55">
                      {getPreview(conversation)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

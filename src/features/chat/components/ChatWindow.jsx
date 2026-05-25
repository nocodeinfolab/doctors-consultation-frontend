import React, { useEffect, useRef } from 'react';
import { Bot, ShieldAlert } from 'lucide-react';
import { Button } from '../../../components/ui';
import ChatComposer from './ChatComposer';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

const getConversationName = (conversation) =>
  conversation?.patient?.name ||
  conversation?.patient?.full_name ||
  conversation?.patient_name ||
  conversation?.doctor_name ||
  'Patient';

const normalizeStatus = (status) => (status === 'active' ? 'open' : status || 'open');

const getMessageDayLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ChatWindow({
  conversation,
  messages,
  currentUser,
  onSend,
  onOrganise,
  onToggleStatus,
  aiSummary,
  typing,
  busy,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, conversation?.id]);

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center text-sm font-semibold text-premium-purple-plum/55">
        Select a secure conversation
      </div>
    );
  }

  const conversationClosed = normalizeStatus(conversation?.status) === 'closed';

  return (
    <div className="flex h-[760px] flex-col overflow-hidden rounded-2xl border border-premium-lilac/25 bg-white/70">
      <div className="border-b border-premium-lilac/25 bg-premium-pearl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl font-bold text-premium-purple-plum">
              {getConversationName(conversation)}
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-rose-700">
              <ShieldAlert className="h-4 w-4" />
              This chat is not for emergencies. If symptoms are severe or urgent, seek immediate
              medical care.
            </p>
          </div>
          {currentUser?.role === 'doctor' && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onToggleStatus}
                disabled={busy}
              >
                {conversationClosed ? 'Reopen' : 'Close'}
              </Button>
              <Button type="button" variant="gold" size="sm" onClick={onOrganise} disabled={busy}>
                <Bot className="h-4 w-4" />
                AI Organise
              </Button>
            </div>
          )}
        </div>
      </div>

      {aiSummary && (
        <div className="border-b border-premium-lilac/25 bg-premium-champagne-soft/50 p-4 text-sm text-premium-purple-plum">
          <p className="font-bold">AI-organised draft for doctor review</p>
          <p className="mt-1 line-clamp-2 text-premium-purple-plum/70">{aiSummary.history}</p>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length > 0 ? (
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const dayLabel = getMessageDayLabel(message?.created_at);
            const previousDayLabel = getMessageDayLabel(previous?.created_at);

            return (
              <React.Fragment key={message?.id || `message-${index}`}>
                {dayLabel && dayLabel !== previousDayLabel && (
                  <div className="flex justify-center py-2">
                    <span className="rounded-full bg-premium-lilac-light/70 px-3 py-1 text-[11px] font-bold text-premium-purple-plum/55">
                      {dayLabel}
                    </span>
                  </div>
                )}
                <MessageBubble message={message} currentUser={currentUser} />
              </React.Fragment>
            );
          })
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-premium-purple-plum/55">
            No secure messages yet.
          </div>
        )}
        <TypingIndicator typing={typing} />
        <div ref={bottomRef} />
      </div>

      {conversationClosed ? (
        <div className="border-t border-premium-lilac/25 bg-premium-pearl-tint/60 p-4 text-sm font-semibold text-premium-purple-plum/60">
          This conversation is closed.
        </div>
      ) : (
        <ChatComposer onSend={onSend} disabled={busy} />
      )}
    </div>
  );
}

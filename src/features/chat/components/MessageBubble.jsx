import React from 'react';
import AttachmentPreview from './AttachmentPreview';

const formatMessageTime = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString();
};

export default function MessageBubble({ message, currentUser }) {
  const mine = message?.sender_id === currentUser?.id;
  const deleted = Boolean(message?.deleted_at);

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl border px-4 py-3 ${
          mine
            ? 'border-premium-royal/20 bg-premium-royal text-white'
            : 'border-premium-lilac/25 bg-white text-premium-purple-plum'
        }`}
      >
        <p
          className={`text-[10px] font-bold uppercase tracking-[0.12em] ${mine ? 'text-white/65' : 'text-premium-purple-plum/45'}`}
        >
          {message?.sender_role || 'message'}
        </p>
        {deleted ? (
          <p className="mt-1 text-sm italic opacity-70">This message was removed</p>
        ) : (
          message?.body && (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
          )
        )}
        {(message?.attachments || []).map((attachment) => (
          <AttachmentPreview key={attachment.id} attachment={attachment} />
        ))}
        <p className={`mt-2 text-[10px] ${mine ? 'text-white/55' : 'text-premium-purple-plum/45'}`}>
          {formatMessageTime(message?.created_at)}
          {message?.is_edited ? ' · edited' : ''}
        </p>
      </div>
    </div>
  );
}

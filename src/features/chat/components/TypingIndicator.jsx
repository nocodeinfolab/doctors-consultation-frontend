import React from 'react';

export default function TypingIndicator({ typing }) {
  if (!typing) return null;
  return <p className="px-4 py-2 text-xs font-semibold text-premium-purple-plum/50">Typing...</p>;
}

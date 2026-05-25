import React, { useState } from 'react';
import { Send } from 'lucide-react';
import AttachmentUploader from './AttachmentUploader';

export default function ChatComposer({ onSend, disabled }) {
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('result');

  const submit = async (event) => {
    event.preventDefault();
    await onSend({ body, file, category });
    setBody('');
    setFile(null);
    setCategory('result');
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 border-t border-premium-lilac/25 bg-premium-pearl-tint/60 p-4"
    >
      <AttachmentUploader
        file={file}
        category={category}
        onFileChange={setFile}
        onCategoryChange={setCategory}
        onClear={() => setFile(null)}
      />
      <div className="flex gap-3">
        <textarea
          className="premium-input min-h-[52px] flex-1 resize-none"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a secure message"
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled || (!body.trim() && !file)}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-premium-royal text-white disabled:opacity-50"
          title="Send message"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}

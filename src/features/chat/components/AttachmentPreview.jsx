import React from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { getChatAttachmentUrl } from '../../../services/api';
import { getAccessToken } from '../../../services/authStorage';

const formatSize = (bytes = 0) => {
  const value = Number(bytes || 0);
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export default function AttachmentPreview({ attachment }) {
  const isImage = String(attachment.mime_type || '').startsWith('image/');
  const href = getChatAttachmentUrl(attachment.message_id, attachment.id);
  const openSecureFile = async (event) => {
    event.preventDefault();
    const token = getAccessToken();
    const response = await fetch(href, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      window.alert('Could not open this secure file');
      return;
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
  };

  return (
    <a
      href={href}
      onClick={openSecureFile}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-3 rounded-xl border border-premium-lilac/25 bg-white/80 p-3 text-left transition-colors hover:bg-premium-lilac-light/40"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-premium-lilac-light text-premium-purple-plum">
        {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-premium-purple-plum">
          {attachment.file_name}
        </p>
        <p className="text-xs text-premium-purple-plum/55">
          {attachment.attachment_category} · {formatSize(attachment.file_size)}
        </p>
      </div>
    </a>
  );
}

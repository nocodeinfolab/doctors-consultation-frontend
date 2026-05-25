import React from 'react';
import { FileUp, X } from 'lucide-react';

const categories = [
  ['result', 'Lab Result'],
  ['image', 'Scan'],
  ['prescription', 'Prescription'],
  ['document', 'Document'],
];

export default function AttachmentUploader({
  file,
  category,
  onFileChange,
  onCategoryChange,
  onClear,
}) {
  return (
    <div className="rounded-xl border border-dashed border-premium-lilac/45 bg-white/70 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-premium-lilac/35 bg-white px-3 py-2 text-xs font-bold text-premium-purple-plum hover:bg-premium-lilac-light">
          <FileUp className="h-4 w-4" />
          Upload result
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          />
        </label>
        <select
          className="premium-input max-w-[180px] py-2 text-xs"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          {categories.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {file && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-100 px-3 py-2 text-xs font-bold text-rose-700"
          >
            <X className="h-4 w-4" />
            {file.name}
          </button>
        )}
      </div>
    </div>
  );
}

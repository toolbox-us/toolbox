import { useState } from 'react';

export default function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!value) {
      return;
    }
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      className="btn-secondary min-w-[96px]"
      onClick={onCopy}
      disabled={!value}
      aria-live="polite"
    >
      <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}


import { useState } from 'react';

/**
 * Copy-to-clipboard button with inline "Скопировано ✓" feedback. Replaces the
 * select-on-focus readonly inputs where a creator had to copy links by hand.
 * Falls back to a hidden-textarea + execCommand on browsers without the async
 * clipboard API (older mobile Safari / insecure origins).
 */
export default function CopyButton({ value, label = 'Копировать', className = 'btn btn--ghost btn--sm' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      {copied ? 'Скопировано ✓' : label}
    </button>
  );
}

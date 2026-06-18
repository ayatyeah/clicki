/* Social-network platforms with their logos (monochrome, inherits text color). */

const ICONS = {
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 3c.32 2.04 1.62 3.62 3.5 3.9v3.05c-1.39 0-2.72-.43-3.83-1.16v6.34a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6.02.9.07v3.06a2.7 2.7 0 1 0 1.9 2.57V3h3.23z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="16.7" cy="7.3" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="4" />
      <path d="M10 9.2v5.6l5-2.8z" fill="#fff" />
    </svg>
  ),
  threads: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12.5 21C7.7 21 4.5 17.6 4.5 12S7.7 3 12.5 3c3.3 0 5.6 1.6 6.7 4.2" />
      <path d="M12.7 21c3.3 0 5.4-1.9 5.4-4.4 0-2.3-1.9-3.7-4.5-3.7-2 0-3.4 1-3.4 2.6 0 1.4 1.1 2.2 2.5 2.2 1.9 0 3-1.6 3-4.4 0-2.4-1.4-4-3.6-4" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 3h3l-7 8 8.2 10h-6.4l-5-6.2L7 21H4l7.5-8.6L3.5 3H10l4.5 5.7L17.5 3zm-1.1 16h1.7L8.1 4.8H6.3L16.4 19z" />
    </svg>
  ),
};

const PLATFORMS = [
  { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram Reels' },
  { key: 'youtube', label: 'YouTube Shorts' },
  { key: 'threads', label: 'Threads' },
  { key: 'x', label: 'X (Twitter)' },
];

export default function PlatformChips() {
  return (
    <div className="platforms">
      {PLATFORMS.map((p) => (
        <span className="platform-chip" key={p.key}>
          <span className="platform-chip__icon">{ICONS[p.key]}</span>
          {p.label}
        </span>
      ))}
    </div>
  );
}

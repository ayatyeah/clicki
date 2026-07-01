/**
 * Single line-icon set used across the admin panel and cabinets (replaces emoji).
 * 24×24, stroke = currentColor, so colour follows the surrounding text.
 */
const PATHS = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></>,
  briefs: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 3.5V6h6V3.5" /><path d="M8.5 11h7M8.5 15h4.5" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></>,
  chart: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 20v-6M12 20V8M16 20v-9" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 2.7-5.2 6-5.2S15 17 15 20" /><path d="M16 5.2A3 3 0 0 1 16 14M21 20c0-2.4-1.4-4.3-3.5-5" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14" r="1.3" fill="currentColor" stroke="none" /></>,
  video: <><rect x="3" y="6" width="12" height="12" rx="2.5" /><path d="M15 10l6-3v10l-6-3" /></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 9h18M3 15h18M8 4v16M16 4v16" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9" r="1.6" /><path d="M5 18l4.5-4.5 3 3L16 12l3 3" /></>,
  inbox: <><path d="M4 5h16v14H4z" /><path d="M4 13h4l1.5 2.5h5L16 13h4" /></>,
  sparkle: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M18 4.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8L15.5 7l1.8-.7z" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  flame: <><path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-1.6.7-2.8 1.5-3.7C9 10 9.5 11 10 11c0-2 1-4 2-8z" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.8.4-1.4 1-1.4 1.9v.3" /><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" /></>,
};

export default function Icon({ name, size = 20, className = '' }) {
  const body = PATHS[name] || PATHS.grid;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}

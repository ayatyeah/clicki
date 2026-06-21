/* Social-network platforms with their brand logos (full-color SVGs in /public/social). */

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
          <span className="platform-chip__icon">
            <img src={`/social/${p.key}.svg`} alt="" width="22" height="22" loading="lazy" />
          </span>
          {p.label}
        </span>
      ))}
    </div>
  );
}

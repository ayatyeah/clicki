import { FloatingDock } from './ui/floating-dock';

/* Social networks shown as an Aceternity floating dock (icons magnify on hover).
   TODO: swap hrefs for CLICKI's real profile URLs when available. */
const SOCIALS = [
  { key: 'tiktok', title: 'TikTok', href: 'https://www.tiktok.com' },
  { key: 'instagram', title: 'Instagram', href: 'https://www.instagram.com' },
  { key: 'youtube', title: 'YouTube', href: 'https://www.youtube.com' },
  { key: 'x', title: 'X (Twitter)', href: 'https://x.com' },
  { key: 'threads', title: 'Threads', href: 'https://www.threads.net' },
];

export default function PlatformChips() {
  const items = SOCIALS.map((s) => ({
    title: s.title,
    href: s.href,
    icon: <img src={`/social/${s.key}.svg`} alt={s.title} className="h-full w-full" />,
  }));
  return <FloatingDock items={items} desktopClassName="mx-0" />;
}

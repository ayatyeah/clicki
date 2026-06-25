import { FloatingDock } from './ui/floating-dock';

/* Social platforms as a macOS-style floating dock (Aceternity), brand SVG icons. */
const ITEMS = [
  { title: 'TikTok', href: 'https://www.tiktok.com', src: '/social/tiktok.svg' },
  { title: 'Instagram', href: 'https://www.instagram.com', src: '/social/instagram.svg' },
  { title: 'YouTube', href: 'https://www.youtube.com', src: '/social/youtube.svg' },
  { title: 'Threads', href: 'https://www.threads.net', src: '/social/threads.svg' },
  { title: 'X', href: 'https://www.x.com', src: '/social/x.svg' },
].map((it) => ({
  title: it.title,
  href: it.href,
  icon: <img src={it.src} alt="" className="h-full w-full" />,
}));

export default function PlatformChips() {
  return <FloatingDock items={ITEMS} />;
}

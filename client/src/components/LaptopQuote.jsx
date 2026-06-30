/**
 * Quote / manifesto slide shown inside the MacbookScroll lid on the business
 * page. Replaces the fake-metrics dashboard with an on-brand statement so the
 * laptop screen reads as a premium brand moment, not made-up data.
 * Pure CSS/SVG. Bilingual via the `lang` prop.
 */

const COPY = {
  ru: {
    kicker: 'Манифест',
    quote: ['Органика — это не удача.', 'Это система, где ты платишь', 'только за просмотры,', 'которые реально случились.'],
    accent: 'реально случились',
    sign: 'CLICKI',
    signSub: 'performance без обещаний',
  },
  en: {
    kicker: 'Manifesto',
    quote: ['Organic isn’t luck.', 'It’s a system where you pay', 'only for the views that', 'actually happened.'],
    accent: 'actually happened',
    sign: 'CLICKI',
    signSub: 'performance without promises',
  },
};

export default function LaptopQuote({ lang = 'ru' }) {
  const t = COPY[lang] ?? COPY.ru;

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#15102e] via-[#0b0a1c] to-[#08160f] p-8 text-white">
      {/* soft brand glow */}
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-600/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />

      {/* top: brand mark + kicker */}
      <div className="relative flex items-center gap-2.5">
        <span className="text-lg font-extrabold tracking-tight">CLICKI</span>
        <span className="h-3.5 w-px bg-white/20" />
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/45">{t.kicker}</span>
      </div>

      {/* center: the quote */}
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="mb-3 h-9 w-9 fill-violet-400/70"
          aria-hidden="true"
        >
          <path d="M9.5 6C6.5 7.3 4.8 10 4.8 13.2c0 .5.1 1 .3 1.4-.6.5-1 1.3-1 2.2 0 1.6 1.3 2.9 2.9 2.9 1.7 0 3-1.4 3-3.3 0-1.7-1.2-3-2.8-3.1.2-1.8 1.4-3.3 3.2-4.1L9.5 6Zm9 0c-3 1.3-4.7 4-4.7 7.2 0 .5.1 1 .3 1.4-.6.5-1 1.3-1 2.2 0 1.6 1.3 2.9 2.9 2.9 1.7 0 3-1.4 3-3.3 0-1.7-1.2-3-2.8-3.1.2-1.8 1.4-3.3 3.2-4.1L18.5 6Z" />
        </svg>
        <p className="text-[1.6rem] font-bold leading-[1.25] tracking-tight">
          {t.quote.map((line) => {
            const idx = line.indexOf(t.accent);
            if (idx === -1) return <span key={line} className="block">{line}</span>;
            return (
              <span key={line} className="block">
                {line.slice(0, idx)}
                <span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">
                  {t.accent}
                </span>
                {line.slice(idx + t.accent.length)}
              </span>
            );
          })}
        </p>
      </div>

      {/* bottom: signature */}
      <div className="relative flex items-center gap-3">
        <span className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-emerald-400" />
        <div className="leading-tight">
          <div className="text-sm font-semibold">{t.sign}</div>
          <div className="text-[11px] text-white/50">{t.signSub}</div>
        </div>
      </div>
    </div>
  );
}

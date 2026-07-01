import { Link } from 'react-router-dom';
import Reveal from '../Reveal.jsx';
import { ContainerTextFlip } from '../ui/container-text-flip';

/* ============================================================
   Shinta-style funnel sections (light theme).
   Video is intentionally a reserved placeholder for now.
   ============================================================ */

const SOCIALS = ['tiktok', 'instagram', 'youtube', 'threads', 'x'];

/** Reserved media slot — a placeholder where a video/image will go later. */
export function MediaSlot({ ratio = 'portrait', label = 'Видео', stat, accent }) {
  return (
    <div className={`fx-media fx-media--${ratio}`}>
      <div className="fx-media__ph">
        <svg viewBox="0 0 24 24" width="46" height="46" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        <span className="fx-media__label">{label}</span>
      </div>
      {stat && (
        <div className={`fx-stat fx-stat--${accent || 'violet'}`}>
          <span className="fx-stat__value">{stat.value}</span>
          <span className="fx-stat__label">{stat.label}</span>
        </div>
      )}
    </div>
  );
}

/** Hero: animated flip words + headline (with a shimmering accent word) and feats
 *  on the left, lead + CTA on the right. */
export function FunnelHero({ accent = 'violet', flipWords, title, accentWord, tail, feats = [], lead, cta, ctaTo = '#consult', call }) {
  return (
    <section className={`fx-hero fx--${accent}`}>
      <div className="container fx-hero__grid">
        <Reveal className="fx-hero__copy">
          {flipWords && (
            <div className="fx-hero__flip">
              <ContainerTextFlip words={flipWords} />
            </div>
          )}
          <h1 className="fx-hero__title">
            {title}
            {accentWord && <> <span className="accent">{accentWord}</span></>}
            {tail}
          </h1>
          <ul className="fx-feats">
            {feats.map((f) => (
              <li key={f}>
                <span className="fx-feats__star" aria-hidden="true">✳</span>
                {f}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="fx-hero__aside" delay={140}>
          <p className="fx-hero__lead">{lead}</p>
          <div className="fx-hero__actions">
            {ctaTo.startsWith('#') ? (
              <a href={ctaTo} className="btn btn--primary btn--lg" data-track={`Воронка ${accent}: ${cta}`}>{cta}</a>
            ) : (
              <Link to={ctaTo} className="btn btn--primary btn--lg" data-track={`Воронка ${accent}: ${cta}`}>{cta}</Link>
            )}
            {call && (
              <a href={`tel:${call.replace(/[^+\d]/g, '')}`} className="fx-hero__call">
                ☎ {call}
              </a>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Multi-platform reach strip. */
export function LogoStrip({ caption }) {
  return (
    <section className="fx-logos">
      <div className="container">
        <p className="fx-logos__cap">{caption}</p>
        <div className="fx-logos__row">
          {SOCIALS.map((s) => (
            <img key={s} src={`/social/${s}.svg`} alt="" />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Dark "problem" panel: big headline with pain cards floating around it. */
export function ProblemScatter({ title, cards = [] }) {
  return (
    <section className="fx-problem">
      <div className="container fx-problem__inner">
        <h2 className="fx-problem__title">{title}</h2>
        <ul className="fx-problem__cards">
          {cards.map((c, i) => (
            <Reveal as="li" key={c} className={`fx-pcard fx-pcard--${i + 1}`} delay={i * 90}>
              <span className="fx-pcard__x" aria-hidden="true">✕</span>
              <span>{c}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Centered mission statement with a pill eyebrow. */
export function Mission({ eyebrow, title, accent = 'violet' }) {
  return (
    <section className={`fx-mission fx--${accent}`}>
      <div className="container">
        <Reveal>
          <span className="fx-mission__eyebrow">{eyebrow}</span>
          <h2 className="fx-mission__title">{title}</h2>
        </Reveal>
      </div>
    </section>
  );
}

/** Split feature: a big stat panel on one side, copy on the other.
 *  (Video slot intentionally removed for now per request.) */
export function SplitFeature({ accent = 'violet', reversed = false, title, text, stat }) {
  return (
    <section className={`fx-split ${reversed ? 'fx-split--rev' : ''} fx--${accent}`}>
      <div className="container fx-split__grid">
        <Reveal className="fx-split__media">
          <div className="fx-statcard">
            <span className="fx-statcard__value">{stat?.value}</span>
            <span className="fx-statcard__label">{stat?.label}</span>
          </div>
        </Reveal>
        <Reveal className="fx-split__copy" delay={80}>
          <h2 className="fx-split__title">{title}</h2>
          <p className="fx-split__text">{text}</p>
        </Reveal>
      </div>
    </section>
  );
}

/** Numbered steps, light cards. */
export function Steps({ id, accent = 'violet', eyebrow, title, steps = [] }) {
  return (
    <section id={id} className={`fx-section fx--${accent}`}>
      <div className="container">
        <Reveal as="header" className="fx-head">
          {eyebrow && <span className="fx-eyebrow">{eyebrow}</span>}
          <h2 className="fx-section__title">{title}</h2>
        </Reveal>
        <ol className="fx-steps">
          {steps.map((s, i) => (
            <Reveal as="li" key={s.title} className="fx-step" delay={i * 70}>
              <span className="fx-step__num">{i + 1}</span>
              <div>
                <h3 className="fx-step__title">{s.title}</h3>
                <p className="fx-step__text">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Benefit cards grid. */
export function CardsGrid({ id, accent = 'violet', eyebrow, title, cards = [], cols = 3 }) {
  return (
    <section id={id} className={`fx-section fx--${accent}`}>
      <div className="container">
        <Reveal as="header" className="fx-head">
          {eyebrow && <span className="fx-eyebrow">{eyebrow}</span>}
          <h2 className="fx-section__title">{title}</h2>
        </Reveal>
        <div className={`fx-cards fx-cards--${cols}`}>
          {cards.map((c, i) => (
            <Reveal key={c.title} className="fx-card" delay={i * 70}>
              <h3 className="fx-card__title">{c.title}</h3>
              <p className="fx-card__text">{c.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Comparison table. */
export function Compare({ id, eyebrow, title, head = [], rows = [] }) {
  return (
    <section id={id} className="fx-section fx--violet">
      <div className="container">
        <Reveal as="header" className="fx-head">
          {eyebrow && <span className="fx-eyebrow">{eyebrow}</span>}
          <h2 className="fx-section__title">{title}</h2>
        </Reveal>
        <Reveal className="fx-compare">
          <table className="fx-compare__table">
            <thead>
              <tr>
                <th>{head[0]}</th>
                <th>{head[1]}</th>
                <th className="fx-compare__us">{head[2]}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}>
                  <td>{r[0]}</td>
                  <td>{r[1]}</td>
                  <td className="fx-compare__us">{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </section>
  );
}

/** Final CTA split: headline left, form card right (children = form). */
export function ContactSplit({ id = 'consult', accent = 'violet', title, text, contacts, mascot = false, mascotSrc = '/mascot-full.png', mascotCrop = true, children }) {
  return (
    <section id={id} className={`fx-contact fx--${accent}`}>
      <div className="container fx-contact__grid">
        <Reveal className="fx-contact__copy">
          <h2 className="fx-contact__title">{title}</h2>
          <p className="fx-contact__text">{text}</p>
          {contacts}
        </Reveal>
        <Reveal className="fx-contact__form-col" delay={80}>
          {mascot && (
            <div className={`fx-contact__mascot ${mascotCrop ? '' : 'fx-contact__mascot--full'}`} aria-hidden="true">
              <img src={mascotSrc} alt="" />
            </div>
          )}
          <div className="fx-contact__card">{children}</div>
        </Reveal>
      </div>
    </section>
  );
}

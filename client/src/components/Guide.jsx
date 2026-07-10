import { useState } from 'react';
import Lightbox from './Lightbox.jsx';

/**
 * Data-driven help section shown as a tab inside a cabinet ("Как это работает").
 *
 * Content is a plain object so the same component serves the creator guide, the
 * business guide, and their translations:
 *   { intro, steps: [{ title, body, img?, points? }], faq?: [{ q, a }] }
 * `body` is a string or array of lines; `points` is a bullet list; `img` (if set)
 * is a screenshot that opens in the shared Lightbox.
 */
export default function Guide({ content }) {
  const [lightbox, setLightbox] = useState(null);
  const images = content.steps.filter((s) => s.img).map((s) => ({ src: s.img, caption: s.title }));
  const openImage = (src) => setLightbox(images.findIndex((i) => i.src === src));

  return (
    <div className="guide">
      {content.intro && <p className="guide__intro">{content.intro}</p>}

      <ol className="guide__steps">
        {content.steps.map((s, i) => (
          <li key={i} className="guide__step">
            <div className="guide__step-num" aria-hidden="true">{i + 1}</div>
            <div className="guide__step-body">
              <h3 className="guide__step-title">{s.title}</h3>
              {[].concat(s.body || []).map((line, j) => (
                <p key={j} className="guide__step-text">{line}</p>
              ))}
              {s.points && (
                <ul className="guide__points">
                  {s.points.map((p, j) => <li key={j}>{p}</li>)}
                </ul>
              )}
              {s.img && (
                <button type="button" className="guide__shot" onClick={() => openImage(s.img)} title="Открыть крупно">
                  {/* Screenshots are added over time; until a file exists, hide the
                      broken image so the text guide still reads cleanly. */}
                  <img src={s.img} alt={s.title} loading="lazy" onError={(e) => { e.currentTarget.closest('.guide__shot').style.display = 'none'; }} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      {content.faq?.length > 0 && (
        <div className="guide__faq">
          <h3 className="guide__faq-title">{content.faqTitle || 'Частые вопросы'}</h3>
          {content.faq.map((f, i) => (
            <details key={i} className="guide__faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      )}

      <Lightbox items={images} index={lightbox} onClose={() => setLightbox(null)} onIndexChange={setLightbox} />
    </div>
  );
}

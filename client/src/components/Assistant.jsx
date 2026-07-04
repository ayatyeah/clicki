import { useRef, useState } from 'react';
import { useLang } from '../i18n.jsx';
import { API_BASE } from '../lib/config.js';

/**
 * On-page CLICKI assistant. Preset questions answer instantly from a local
 * Q&A list (no tokens spent); a free-text box sends the question to a small,
 * cheap AI endpoint (/api/assistant) for anything else.
 */
export default function Assistant({ accent = 'violet', qa = [] }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role:'user'|'bot', text}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  const t = {
    ru: { title: 'Помощник CLICKI', hint: 'Выберите вопрос или напишите свой 👇', placeholder: 'Напишите вопрос…', send: 'Отправить', open: 'Помощник', typing: 'печатает…', online: 'онлайн', close: 'Закрыть' },
    en: { title: 'CLICKI assistant', hint: 'Pick a question or type your own 👇', placeholder: 'Type a question…', send: 'Send', open: 'Assistant', typing: 'typing…', online: 'online', close: 'Close' },
  }[lang] || {};

  const scrollDown = () => {
    requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    });
  };

  function askPreset(item) {
    setMessages((m) => [...m, { role: 'user', text: item.q }, { role: 'bot', text: item.a }]);
    scrollDown();
  }

  async function askAI(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    scrollDown();
    try {
      const res = await fetch(`${API_BASE}/api/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, lang }),
      });
      const d = await res.json();
      const answer = d?.answer || (lang === 'en' ? 'Please try again later.' : 'Попробуйте ещё раз чуть позже.');
      setMessages((m) => [...m, { role: 'bot', text: answer }]);
    } catch {
      setMessages((m) => [...m, { role: 'bot', text: lang === 'en' ? 'Network error — try again.' : 'Ошибка сети — попробуйте ещё раз.' }]);
    } finally {
      setBusy(false);
      scrollDown();
    }
  }

  return (
    <div className={`assistant assistant--${accent}`}>
      {open && (
        <div className="assistant__panel" role="dialog" aria-label={t.title}>
          <div className="assistant__head">
            <span className="assistant__avatar" aria-hidden="true">
              <img src="/mascot.png" alt="" />
            </span>
            <div>
              <div className="assistant__title">{t.title}</div>
              <div className="assistant__status">{busy ? t.typing : t.online}</div>
            </div>
            <button className="assistant__close" onClick={() => setOpen(false)} aria-label={t.close}>✕</button>
          </div>

          <div className="assistant__body" ref={bodyRef}>
            <p className="assistant__hint">{t.hint}</p>
            <div className="assistant__chips">
              {qa.map((item, i) => (
                <button key={i} className="assistant__chip" onClick={() => askPreset(item)}>
                  {item.q}
                </button>
              ))}
            </div>

            {messages.map((m, i) => (
              <div key={i} className={`assistant__bubble assistant__bubble--${m.role}`}>
                {m.text}
              </div>
            ))}
            {busy && <div className="assistant__bubble assistant__bubble--bot assistant__bubble--typing">…</div>}
          </div>

          <form className="assistant__form" onSubmit={askAI}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.placeholder}
              maxLength={400}
              aria-label={t.placeholder}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label={t.send}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M3 11l18-8-8 18-2-7-8-3z" />
              </svg>
            </button>
          </form>
        </div>
      )}

      <button
        className="assistant__fab"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t.open}
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <img className="assistant__fab-img" src="/mascot.png" alt="" />
        )}
      </button>
    </div>
  );
}

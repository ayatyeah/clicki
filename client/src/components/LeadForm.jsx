import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { submitLead } from '../lib/api.js';
import { trackLead } from '../lib/analytics.js';
import { useLang } from '../i18n.jsx';

const L = {
  ru: {
    fill: (label) => `Заполните поле «${label}»`,
    consentErr: 'Подтвердите согласие на обработку персональных данных',
    adultErr: 'Подтвердите, что вам есть 18 лет',
    failed: 'Не удалось отправить заявку.',
    sending: 'Отправляем…',
    consent1: 'Я согласен на обработку персональных данных в соответствии с ',
    consentLink: 'политикой конфиденциальности',
    adult: 'Мне есть 18 лет.',
    note: 'Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.',
  },
  en: {
    fill: (label) => `Please fill in “${label}”`,
    consentErr: 'Please accept the personal data processing consent',
    adultErr: 'Please confirm you are 18 or older',
    failed: 'Could not send the request.',
    sending: 'Sending…',
    consent1: 'I agree to the processing of my personal data per the ',
    consentLink: 'privacy policy',
    adult: 'I am 18 or older.',
    note: 'By submitting, you agree to the processing of your personal data.',
  },
};

/**
 * Reusable lead form for both funnels.
 *
 * @param {'client'|'creator'} funnel
 * @param {Array<{name,label,type?,required?,placeholder?,autoComplete?}>} fields
 * @param {string} submitLabel
 * @param {boolean} requireAdult - show + require the 18+ checkbox (creators)
 */
export default function LeadForm({ funnel, fields, submitLabel, requireAdult = false }) {
  const navigate = useNavigate();
  const { lang } = useLang();
  const t = L[lang] || L.ru;
  const [values, setValues] = useState({});
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState('idle'); // idle | sending | error
  const [errors, setErrors] = useState([]);

  const onChange = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setErrors([]);

    const localErrors = [];
    for (const f of fields) {
      if (f.required && !String(values[f.name] || '').trim()) {
        localErrors.push(t.fill(f.label));
      }
    }
    if (!consent) localErrors.push(t.consentErr);
    if (requireAdult && !adult) localErrors.push(t.adultErr);
    if (localErrors.length) {
      setErrors(localErrors);
      return;
    }

    setStatus('sending');
    const res = await submitLead(funnel, { ...values, consent, adult, website });
    if (res.ok) {
      trackLead(funnel); // client_lead / creator_lead conversion
      navigate(`/thanks/${funnel}`);
    } else {
      setStatus('error');
      setErrors(res.errors || [t.failed]);
    }
  }

  return (
    <form className="lead-form" onSubmit={onSubmit} noValidate>
      {fields.map((f) => (
        <label key={f.name} className="lead-form__field">
          <span className="lead-form__label">
            {f.label}
            {f.required && (
              <span className="lead-form__req" aria-hidden="true">
                {' '}
                *
              </span>
            )}
          </span>
          {f.type === 'textarea' ? (
            <textarea name={f.name} rows={3} placeholder={f.placeholder} value={values[f.name] || ''} onChange={onChange} />
          ) : (
            <input
              type={f.type || 'text'}
              name={f.name}
              placeholder={f.placeholder}
              autoComplete={f.autoComplete}
              value={values[f.name] || ''}
              onChange={onChange}
            />
          )}
        </label>
      ))}

      {/* Honeypot - hidden from humans, catches bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="lead-form__hp"
        aria-hidden="true"
      />

      <label className="lead-form__check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          {t.consent1}
          <Link to="/privacy" target="_blank">
            {t.consentLink}
          </Link>
          .
        </span>
      </label>

      {requireAdult && (
        <label className="lead-form__check">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          <span>{t.adult}</span>
        </label>
      )}

      {errors.length > 0 && (
        <ul className="lead-form__errors" role="alert">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}

      <button type="submit" className="btn btn--primary btn--block" disabled={status === 'sending'}>
        {status === 'sending' ? t.sending : submitLabel}
      </button>
      <p className="lead-form__note">{t.note}</p>
    </form>
  );
}

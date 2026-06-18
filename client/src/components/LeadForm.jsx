import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitLead } from '../lib/api.js';
import { Link } from 'react-router-dom';

/**
 * Reusable lead form for both funnels.
 *
 * @param {'client'|'creator'} funnel
 * @param {Array<{name,label,type?,required?,placeholder?,autoComplete?}>} fields
 * @param {string} submitLabel
 * @param {boolean} requireAdult — show + require the 18+ checkbox (creators)
 */
export default function LeadForm({ funnel, fields, submitLabel, requireAdult = false }) {
  const navigate = useNavigate();
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
        localErrors.push(`Заполните поле «${f.label}»`);
      }
    }
    if (!consent) localErrors.push('Подтвердите согласие на обработку персональных данных');
    if (requireAdult && !adult) localErrors.push('Подтвердите, что вам есть 18 лет');
    if (localErrors.length) {
      setErrors(localErrors);
      return;
    }

    setStatus('sending');
    const res = await submitLead(funnel, { ...values, consent, adult, website });
    if (res.ok) {
      navigate(`/thanks/${funnel}`);
    } else {
      setStatus('error');
      setErrors(res.errors || ['Не удалось отправить заявку.']);
    }
  }

  return (
    <form className="lead-form" onSubmit={onSubmit} noValidate>
      {fields.map((f) => (
        <label key={f.name} className="lead-form__field">
          <span className="lead-form__label">
            {f.label}
            {f.required && <span className="lead-form__req" aria-hidden="true"> *</span>}
          </span>
          {f.type === 'textarea' ? (
            <textarea
              name={f.name}
              rows={3}
              placeholder={f.placeholder}
              value={values[f.name] || ''}
              onChange={onChange}
            />
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

      {/* Honeypot — hidden from humans, catches bots. */}
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
          Я согласен на обработку персональных данных в соответствии с{' '}
          <Link to="/privacy" target="_blank">
            политикой конфиденциальности
          </Link>
          .
        </span>
      </label>

      {requireAdult && (
        <label className="lead-form__check">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          <span>Мне есть 18 лет.</span>
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
        {status === 'sending' ? 'Отправляем…' : submitLabel}
      </button>
      <p className="lead-form__note">Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.</p>
    </form>
  );
}

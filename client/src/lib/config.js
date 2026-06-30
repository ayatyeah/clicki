// Centralised access to public env-driven config.
export const API_BASE = import.meta.env.VITE_API_BASE || '';
export const PHONE = import.meta.env.VITE_PHONE || '+7 775 305 63 26';
export const TELEGRAM = import.meta.env.VITE_TELEGRAM || 'CLICKI_App';
export const EMAIL = import.meta.env.VITE_EMAIL || 'info@clicki-platform.com';
export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
export const LINKEDIN_URL =
  import.meta.env.VITE_LINKEDIN || 'https://www.linkedin.com/in/assanali-tursumbayev-45795639a/';
// WhatsApp number (digits only, with country code). Defaults to the phone.
export const WHATSAPP = (import.meta.env.VITE_WHATSAPP || PHONE).replace(/[^\d]/g, '');

// Phone stripped down to a valid tel: target.
export const PHONE_TEL = PHONE.replace(/[^\d+]/g, '');
export const TELEGRAM_URL = `https://t.me/${TELEGRAM}`;
export const EMAIL_URL = `mailto:${EMAIL}`;
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP}`;

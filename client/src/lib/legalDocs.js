// Mirrors server/src/legalDocs.js — kept in lockstep so a version bump on the
// backend and the "current" version shown/linked on the frontend never drift.
// The actual gate decision (does THIS user need to accept) comes from the
// server via legalCurrentVersion in the cabinet payload, not from this file —
// this only supplies doc metadata for links/labels on the gate and registration forms.
export const LEGAL_DOCS = {
  offer: { path: '/legal/offer', label: 'Публичная оферта', version: '2026-07-23' },
  personal_data_consent: { path: '/legal/personal-data-consent', label: 'Согласие на обработку персональных данных', version: '2026-07-23' },
};

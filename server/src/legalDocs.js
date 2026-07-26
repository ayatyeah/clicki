// Single source of truth for legal document versions, shared by the acceptance
// gate (server) and the register/gate checks (client, via the mirrored copy in
// client/src/lib/legalDocs.js). Bump the version string whenever a document's
// text changes — this immediately re-shows the gate to everyone, since it's
// compared against creators.legal_accepted_version / business_accounts.legal_accepted_version.
export const LEGAL_DOCS = {
  offer: { version: '2026-07-23' },
  personal_data_consent: { version: '2026-07-23' },
};

// Which doc types a role must accept before using the cabinet.
export const REQUIRED_DOCS = {
  creator: ['offer', 'personal_data_consent'],
  business: ['personal_data_consent'],
};

// Combined version string cached on creators/business_accounts.legal_accepted_version —
// changes whenever ANY required doc for that role gets a new version, so a single
// column comparison (no join, no extra query) tells us if the gate should show.
export function currentLegalVersion(role) {
  return REQUIRED_DOCS[role].map((doc) => `${doc}:${LEGAL_DOCS[doc].version}`).join('|');
}

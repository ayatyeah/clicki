# CLICKI

UGC marketing platform: businesses order short vertical videos, creators shoot and
publish them, payment is per organic view. Monorepo, deployed to DigitalOcean App
Platform (auto-deploy on push to `main`) at https://clicki-platform.com.

## ⚠️ Read before touching data

**Local dev connects to the PRODUCTION database** (`server/.env` → DigitalOcean
Managed Postgres). There is no separate local/staging DB. Any script, migration,
or manual query run locally hits real user data — creators, businesses, wallets,
payouts. Prefer read-only checks; if a write is genuinely needed, say so explicitly
and confirm before running it.

**Never commit or print `server/.env` or `.mcp.json`** — they hold DB credentials,
API keys (Gemini, TikTok, reCAPTCHA), Telegram bot token. Both are already
git-ignored; keep it that way (e.g. when zipping the project for someone).

**Never push to `main` unless explicitly asked.** Pushing deploys to the live site
immediately (DigitalOcean auto-deploy). Committing is fine; pushing is not implied
by "fix this" or "add this" — ask, or wait to be told.

## Usage budget (Pro plan — default to cheap)

This account is on the **Pro plan**, not Max — usage limits are real and worth
respecting by default, not just when a warning shows up.

- **Default to Sonnet.** Opus burns the quota noticeably faster for comparable
  work. Reach for Opus only for genuinely hard problems (a tricky architectural
  call, a bug that's resisted a first pass) — not as the standing default.
- **Don't use `/fast`.** It routes through Opus despite the name — the opposite
  of saving usage.
- **Don't spawn subagents for small, single-file fixes.** Each spawn is a
  fresh, cold-context set of model calls on top of the main conversation, not
  a cheaper substitute for it — see "Where things live" and the `.claude/
  agents/*.md` definitions for the cases where an agent's isolation is actually
  worth that cost (pre-push review, a DB-touching script, UI visual QA).
- **Precise pointers beat broad asks.** "Fix the file at `X.jsx:42`" skips a
  round of Grep/Read exploration that "fix the registration form" doesn't.
- **`/clear` between unrelated topics** in a long session — an unrelated new
  task doesn't need the accumulated context of a finished one sitting in every
  subsequent turn.

## Stack

- **`server/`** — Node ESM, Express + `pg` (raw SQL, no ORM), `helmet`, `multer`,
  `@aws-sdk/client-s3` (DigitalOcean Spaces for media), `nodemailer`. Entry:
  `src/index.js` (routes) + `src/db.js` (schema + all queries — `initDb()` is
  idempotent: `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, safe to
  run repeatedly, runs on every boot).
- **`client/`** — React 18 + Vite + Tailwind, PWA via `vite-plugin-pwa`. Pages in
  `src/pages/` (admin pages in `src/pages/admin/`), shared UI in `src/components/`.
- **Auth**: three separate actor types — admin (env creds + DB-persisted session
  tokens), business, creator (both hashed password + session_token). No shared
  session model between them.
- **i18n**: `src/i18n.jsx` (`useLang()`), `businessI18n.js` / `creatorI18n.js` — the
  Russian source string IS the dict key; `t(lang, 'Русский текст')` returns the EN
  entry or falls back to the Russian itself.

## Commands (run before calling anything done)

```bash
npx eslint <changed files>          # from repo root; flat config covers both client+server
npm --prefix client run build       # must succeed — this is what actually deploys
npm --prefix server test            # node:test, in server/test/*.test.js
```
No test runner on the client side. `npm --prefix client run dev` / `npm --prefix
server run dev` for local servers (client on Vite's default port, server on 4000).

## Conventions this codebase already follows — match them, don't reinvent

- **Comments explain WHY, not WHAT** — a past bug, a non-obvious constraint, a
  trap a future edit could fall into. No restating what the code does.
- **Fail-open over fail-closed for anything that could lock out a real user**
  (captcha, optional integrations). Twice now, a "fail closed to be safe" check
  silently rejected real sign-ups — see `passesCaptcha` in `index.js` and its test
  in `test/recaptcha.test.js` for the reasoning to reuse.
- **Allowlist, not denylist, for anything shown on an unauthenticated route**
  (see `src/mask.js`) — a `SELECT *` behind a public/demo endpoint means every
  future column is public by default until someone remembers to strip it.
- **SQL is parameterized, always** (`$1, $2…`) — no string interpolation into
  queries, including for admin-only inputs.
- Money/rates/config live in the `settings` table, not hardcoded, so they're
  tunable without a deploy.

## Frequently-needed logic (skip the grep)

- Brief lifecycle, the 24h slot rule, assignment/takers: `server/src/db.js`
  (`ACTIVE_HOLDER_SQL`, `takeBrief`, `creatorCanSubmitToBrief`).
- Brief creative fields (product, USP, audience, hooks, refs, etc.) live in the
  `briefs.spec` JSONB column — no per-field migration needed to add one.
- Admin session handling, rate limiters, captcha gate: top portion of
  `server/src/index.js`.
- Shared brief form (business + admin variants): `client/src/components/BriefForm.jsx`.
- Contact normalization (phone/Telegram, lenient — never blocks a signup over
  formatting): `server/src/validate.js` (`normalizeTelegram`, `normalizeContact`).
- Country → region mapping for admin filters: `client/src/lib/regions.js`.
- Legal document acceptance (offer + PDn consent gate, soft-delete): doc
  versions in `server/src/legalDocs.js` (mirrored at `client/src/lib/legalDocs.js`),
  append-only audit table `legal_acceptances` in `server/src/db.js`, gate UI in
  `client/src/components/LegalGate.jsx`. See "Legal document acceptance" below.

## Legal document acceptance

Creators must accept the public offer + PDn (personal data) consent; businesses
must accept the PDn consent. Both documents render in full at `/legal/offer` and
`/legal/personal-data-consent` (Russian-only — binding contract text, KZ law
governs, translations would be non-authoritative).

- **Version source of truth**: `server/src/legalDocs.js` (`LEGAL_DOCS`,
  `REQUIRED_DOCS`, `currentLegalVersion(role)`), mirrored (metadata/labels only,
  not gate logic) at `client/src/lib/legalDocs.js`. Bump a doc's version string
  there when its text changes — every account with a stale
  `legal_accepted_version` sees the gate again on next load.
- **Cache, not a query per click**: `creators.legal_accepted_version` /
  `business_accounts.legal_accepted_version` + `..._legal_accepted_at` are
  columns on the row `requireCreator`/`requireBusiness` already fetch — the
  cabinet payload (`creatorPayload`/`businessPayload`) includes
  `legalCurrentVersion`, and the client does one string comparison. No extra
  DB round-trip on every cabinet load or click.
- **Audit trail**: `legal_acceptances` (append-only, no FK to
  creators/business_accounts — must survive a soft-deleted account) logs every
  `accept` / `decline` / `account_deleted` event with actor, doc type+version,
  IP, user-agent, timestamp. Written via `recordLegalAcceptance` /
  `acceptLegalDocs` / `declineLegalDocs` in `server/src/db.js`. Admin view:
  `client/src/pages/admin/LegalAcceptancesView.jsx` → `GET
  /api/admin/legal-acceptances`.
- **Registration**: creator register requires `acceptOffer` +
  `acceptPersonalData` in the request body; business register requires
  `acceptPersonalData`. Both write an `accept` row immediately (see
  `POST /api/creator/register` / `POST /api/business/register` in `index.js`).
- **Existing-user gate**: `client/src/components/LegalGate.jsx` — full-screen
  blocking modal rendered by `CreatorPortal.jsx`/`BusinessPortal.jsx` before the
  Dashboard when `legal_accepted_version !== legalCurrentVersion`. Decline
  doesn't lock the account — it offers logout or self-service deletion.
- **Self-service account deletion**: soft-delete only (`softDeleteCreator` /
  `softDeleteBusiness` in `db.js`) — row kept (`status='deleted'`,
  `deleted_at`), PII columns cleared, `session_token` wiped so auth stops
  working. Financial/legal rows (payouts, submissions, `legal_acceptances`)
  are NOT cascaded away. Routes: `DELETE /api/creator/account` /
  `DELETE /api/business/account`. UI: bottom of `AccountView`
  (`CreatorPortal.jsx`) / `Profile` (`BusinessPortal.jsx`), behind
  `useConfirm()`.
- **Public visibility**: the documents are also reachable outside the
  acceptance flow — `/legal` (`pages/legal/LegalIndex.jsx`) lists all four
  public documents (offer, PDn consent, privacy, terms) with their versions,
  linked from the footer on every page and from a single "Документы"/"Legal"
  header nav item (replacing the old separate Privacy/Terms links). `/offer`
  redirects to `/legal/offer` as a short alias. The link list itself is
  centralized in `client/src/components/LegalLinks.jsx`
  (`legalDocLinks(lang)`, `<LegalLinks />` for the footer, `<LegalNote
  role="creator|business" />` small print under the `/creators`/`/business`
  lead forms) so every link site reads doc paths/versions from
  `lib/legalDocs.js` instead of retyping them.

## File map

> Generated by reading each file's header/exports on 2026-07-26 (commit `f89527f`
> and later same-day work). **This list decays** — a file added, renamed, or
> substantially rewritten after that point won't be reflected here. Trust the
> filesystem over this list when they disagree; re-scan periodically rather than
> assuming it's still accurate months later.

### `server/src/`

| File | What it does |
|---|---|
| `index.js` | Express app: all routes, admin/creator/business auth middleware, rate limiters, the captcha gate (`passesCaptcha`), upload handlers. The biggest file — routes are grouped by actor (public → creator → business → admin). |
| `db.js` | Schema (`initDb()`, idempotent) + every SQL query. UGC code generation, the 24h brief-slot rule (`ACTIVE_HOLDER_SQL`), assignments, submissions, wallets/payouts, settings. |
| `validate.js` | Lead-form field schemas + `normalizeContact`/`normalizeTelegram` (lenient — never rejects a signup over formatting, only on empty). |
| `mask.js` | Allowlist-based PII masking for the public, unauthenticated `/demo-admin` endpoints — what a demo viewer is allowed to see of leads/creators/submissions/briefs. |
| `security.js` | SSRF-safe outbound fetch, URL scheme validation, CSP directive builder. |
| `recaptcha.js` | `verifyRecaptcha()` — returns `{verified, reason|score}`, never collapses "couldn't grade" into "is a bot" (see recaptcha.test.js). |
| `notify.js` | Telegram + email notifications for new leads/events (`dispatchLead`, `notifyOps`). |
| `storage.js` | DigitalOcean Spaces (S3-compatible) upload; falls back to DB storage if Spaces env vars are unset. AWS SDK imported lazily so a missing dep can't crash boot. |
| `store.js` | Legacy JSON-file lead store, now a thin wrapper delegating to `db.js` (`insertLead`/`listLeads`/`countLeads`). |
| `content.js` | Site content (showcase videos, device mockups) read/write, persisted so it survives redeploys. |
| `gemini.js` | Google Gemini wrapper — rotates up to 3 API keys, small output cap; brief AI-check, AI coach feedback, script drafts. |
| `tiktok.js` | TikTok Login Kit + Display API — OAuth connect + auto-fetch `view_count` per video. |
| `instagram.js` | Same pattern as `tiktok.js`, for Instagram (Business) Login — requires Meta App Review to go live. |
| `clean-briefs.js` | One-off CLI: deletes all briefs (used before onboarding new creators so they don't see stale test orders). |
| `reset-data.js` | CLI: wipes all account + transactional data. **Danger zone — production DB.** |
| `seed-demo.js` | CLI: seeds demo data (brief → matching → content → payment) for screenshots. |
| `legalDocs.js` | `LEGAL_DOCS`/`REQUIRED_DOCS`/`currentLegalVersion(role)` — single source of truth for legal doc versions (see "Legal document acceptance" above). |

### `client/src/` (top level)

| File | What it does |
|---|---|
| `App.jsx` | Route table (`<Routes>`), analytics/emoji init gated on cookie consent, global click tracking. |
| `main.jsx` | React root mount; imports the 4 global stylesheets in order. |
| `i18n.jsx` | `useLang()` context — reads/writes `localStorage('clicki_lang')`. |
| `content.jsx` | Context for server-driven site content (showcase videos etc.), fetched from `/api/content`. |
| `tour-sandbox.jsx` | Standalone dev harness to preview the onboarding tour without a backend. |

### `client/src/pages/`

| File | What it does |
|---|---|
| `Hub.jsx` | `/` — neutral landing, picks business-vs-creator funnel. |
| `Business.jsx` | `/business` — business-facing marketing page + lead form. |
| `Creators.jsx` | `/creators` — creator-facing marketing page + lead form. |
| `About.jsx` | `/about` (+ `/en/about`) — about page. |
| `Contacts.jsx` | `/contacts`. |
| `Privacy.jsx` | `/privacy` — privacy policy (RU/EN), cookie/third-party/cross-border sections. |
| `Terms.jsx` | `/terms` — terms of use. |
| `legal/LegalIndex.jsx` | `/legal` — public index of all four legal documents (offer, PDn consent, privacy, terms), offer first, with version labels; `/offer` redirects here (`App.jsx`). |
| `legal/Offer.jsx` | `/legal/offer` — full public offer contract text (RU-only), incl. tax-scenario and rate-card tables. |
| `legal/PersonalDataConsent.jsx` | `/legal/personal-data-consent` — full PDn consent text (RU-only) + link to download the original PDF. |
| `LoginChoice.jsx` | `/login` — "creator or business" picker before auth. |
| `ThankYou.jsx` | `/thanks/:type` — post-lead-submit confirmation. |
| `NotFound.jsx` | catch-all 404. |
| `AppLauncher.jsx` | `/app` — PWA install / relaunch redirect helper. |
| `RegisterCreator.jsx` | `/registration_creators` — public creator self-registration form. |
| `CreatorPortal.jsx` | `/creator` — the creator's full cabinet (dashboard, briefs, submissions, wallet, onboarding). Large file. |
| `BusinessPortal.jsx` | `/business-cabinet` — the business's full cabinet (briefs, analytics, submissions review). Large file. |
| `CreatorMiniPage.jsx` | `/ref/:login` (+ legacy `/:login`) — a creator's public bio/referral page. |
| `Referral.jsx` | `/friend/:login` — friend-referral landing, sets the referral cookie then redirects. |
| `Admin.jsx` | `/admin` — admin shell: auth gate + tab router into `pages/admin/*`. |
| `DemoAdmin.jsx` | `/demo-admin` — public, no-auth read-only mirror of the admin panel (masked data, for investor demos). |
| `DemoTest.jsx` | `/demo-test` — scratch page for trying demo-mode UI. |

### `client/src/pages/admin/`

| File | What it does |
|---|---|
| `ui.jsx` | Shared presentational primitives (buttons, badges, etc.) for all admin tabs. |
| `CreatorsView.jsx` | Creator roster: search, status/TikTok/access/region/country filters, credentials, ban, bulk register. |
| `BriefsView.jsx` | Brief moderation: create/edit/assign/unassign/close briefs, `briefStatus()` label logic. |
| `BriefReviewView.jsx` | 3-level drill-down: briefs → takers → a creator's videos (views, AI analysis, screenshots). |
| `BriefViewsView.jsx` | Views-by-brief-×-creator aggregate table. |
| `ReviewView.jsx` | Submission review queue — accept/reject/revision with reject codes. |
| `AiAnalysisView.jsx` | Renders Gemini's markdown-ish AI feedback on a submission. |
| `AutopilotView.jsx` | Campaign Autopilot — rule-based recommendations only, never auto-acts (see memory `feedback_ai_recommendations_only`). |
| `BusinessesView.jsx` | Business account list, their briefs, contact, credentials. |
| `PayoutsView.jsx` | Payout queue — mark paid, manual payout creation. |
| `MonthlyReportView.jsx` | Printable monthly report. |
| `DecisionJournalView.jsx` | Audit log of automated/operator decisions. |
| `LegalAcceptancesView.jsx` | Audit log of legal document accept/decline/account-deletion events (`legal_acceptances`). |
| `HealthView.jsx` | "Is the platform alive" — DB latency, pool stats, feature flags (incl. reCAPTCHA on/off). |

### `client/src/components/`

| File | What it does |
|---|---|
| `Header.jsx` / `Footer.jsx` | Site chrome — nav, language switch, footer links incl. cookie-settings reopen. |
| `Seo.jsx` | `<Helmet>` wrapper for title/description/canonical per page. |
| `LeadForm.jsx` | Reusable lead-capture form (business + creator funnels), honeypot + reCAPTCHA token. |
| `CookieBanner.jsx` | Consent banner — gates GA4/Pixel/Metrika behind explicit "accept all"; `getCookieConsent()` read helper. |
| `BriefForm.jsx` | The shared brief builder (`variant='business'|'admin'`) — all creative fields, collapsible sections. |
| `Tour.jsx` | Onboarding tour engine (steps defined in `content/guides.js`). |
| `Guide.jsx` | Renders a guide's step content inside the cabinet. |
| `StatScreenshots.jsx` | Daily stats-screenshot upload/list — creator (upload+series) and admin (read-only) variants. |
| `SocialConnect.jsx` | TikTok/Instagram "connect account" buttons + brand glyphs. |
| `AvatarCropper.jsx` | Client-side image crop before avatar/logo upload. |
| `Assistant.jsx` | AI support-chat widget. |
| `Aurora.jsx` | Decorative WebGL/canvas background effect (hero backdrops). |
| `Playground.jsx` | Decorative gradient-orb backdrop (investor-teaser look). |
| `FloatingBg.jsx` | Decorative drifting blobs + social marks for light funnel pages. |
| `FloatingContacts.jsx` | Floating call/WhatsApp/Telegram contact buttons. |
| `InstallApp.jsx` | PWA "Add to home screen" prompt plumbing. |
| `Lightbox.jsx` | Image/video lightbox viewer. |
| `Logo.jsx` | Brand mark + wordmark component. |
| `Icon.jsx` | Shared 24×24 line-icon set (replaces emoji in the admin UI). |
| `LangSwitch.jsx` | RU/EN toggle control. |
| `CopyButton.jsx` | "Copy to clipboard" button with feedback state. |
| `Toast.jsx` | `useToast()` + provider — success/error toast notifications. |
| `ConfirmDialog.jsx` / `ConfirmDelete.jsx` | `useConfirm()` generic confirm modal, and a delete-specific wrapper. |
| `LegalGate.jsx` | Full-screen blocking modal shown when a creator/business hasn't accepted the current legal doc version — accept, or decline → logout/delete account. |
| `LegalLinks.jsx` | Centralized legal-document link list — `legalDocLinks(lang)`, `<LegalLinks />` (footer column), `<LegalNote role="creator\|business" />` (small print under the funnel lead forms). Paths/versions read from `lib/legalDocs.js`. |
| `EmptyState.jsx` | Consistent "nothing here yet" placeholder (icon + text + optional action). |
| `ErrorBoundary.jsx` | React error boundary wrapper. |
| `Reveal.jsx` | Scroll-triggered fade/slide-in wrapper. |
| `ScrollAway.jsx` | Hide-on-scroll wrapper (e.g. for a sticky header). |
| `funnel/Shinta.jsx` | Landing-page section kit shared by Business/Creators pages: `FunnelHero`, `LogoStrip`, `Mission`, `Steps`, `CardsGrid`, `Compare`, `ContactSplit`, `MediaSlot`. |
| `ui/scroll-morph-hero.tsx` | `IntroAnimation` — scroll-driven hero morph effect (Hub page). |
| `ui/container-text-flip.tsx` | `ContainerTextFlip` — animated word-flip text component. |

### `client/src/content/`

| File | What it does |
|---|---|
| `businessI18n.js` | EN strings for the business cabinet, keyed by Russian source text (`bt(lang, ru)`). |
| `creatorI18n.js` | Same pattern for the creator cabinet (`ct(lang, ru)`). |
| `guides.js` | Data (not JSX) for in-cabinet "how it works" guides + the onboarding tour steps, per actor. |

### `client/src/lib/`

| File | What it does |
|---|---|
| `config.js` | Centralised `import.meta.env.VITE_*` reads (API base, contact info, feature IDs). |
| `api.js` | `submitLead()`, reCAPTCHA token loader (`getRecaptchaToken`, gated by `RECAPTCHA_ENABLED`). |
| `apiClient.js` | `createApiClient()` — authenticated fetch wrapper used by admin/business/creator cabinets. |
| `analytics.js` | GA4/Meta Pixel/Yandex Metrika — config-gated no-ops if IDs unset; first-party `/api/track` beacon is separate and cookieless. |
| `regions.js` | Free-text country → region (`europe`/`asia`/`america`) dictionary for the admin country/region filters; Russia flagged separately. |
| `contact.js` | Client-side mirror of the business-contact validation rules (inline form errors). |
| `briefFields.js` | Shared constants/helpers for `briefs.spec` fields (platforms, styles, formats) — one definition read by the brief builder and every reader. |
| `safeHref.js` | Guards user-supplied hrefs (video/CTA links) against `javascript:` injection. |
| `installPrompt.js` | Captures the `beforeinstallprompt` event early (before the lazy cabinet chunk that offers the install button exists). |
| `appleEmoji.js` | Re-skins emoji to Apple's glyph set for visual consistency. |
| `utils.js` | Misc small helpers (`clsx`/`tailwind-merge` wrapper etc.). |
| `legalDocs.js` | Mirrors `server/src/legalDocs.js` — doc paths/labels/versions for links and registration-form labels (not the gate decision itself, which comes from the server payload). |

### `client/src/styles/`

| File | What it does |
|---|---|
| `index.css` | Main app stylesheet — largest file (~4250 lines), most component/page classes. |
| `app-light.css` | Light-theme app-shell styles (cabinets' 2-column layout, premium polish). |
| `funnel-shinta.css` | Styles for the `components/funnel/Shinta.jsx` landing-page kit. |
| `tailwind.css` | Tailwind directives entry point. |

### `server/test/`

| File | What it does |
|---|---|
| `contact.test.js` | `normalizeContact` phone/Telegram parsing rules. |
| `csp-header.test.js` | CSP directive correctness (inline-script block, allowed third parties). |
| `mask.test.js` | Demo-endpoint PII masking allowlists. |
| `recaptcha.test.js` | Pins "couldn't grade" apart from "is a bot" in `verifyRecaptcha`. |
| `security.test.js` | SSRF guard (`fetchGuarded`/`isPrivateIp`) — refuses private/internal targets. |
| `tiktok-syncing.test.js` | `tiktokSyncing()` — token-present-but-not-syncing edge cases. |
| `legal-docs.test.js` | `legalDocs.js` — required-doc lists per role, version-string stability. |

## Verification habit for UI changes

For anything visual/interactive, actually look at it before calling it done —
start the dev server (or check the live site) and use Playwright MCP if available.
iPhone-accurate viewport for mobile checks: **390×844**. Passing lint/build/tests
proves the code compiles, not that the feature works.

## Git

Commits use this trailer:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```
(model name in place of "Claude" if asked — check current session model rather
than assuming last-used one carries over.)

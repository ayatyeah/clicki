import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import Hub from './pages/Hub.jsx';
import Playground from './components/Playground.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initAnalytics, trackPageview, trackVisit, trackEvent } from './lib/analytics.js';
import { initAppleEmoji, parseAppleEmoji } from './lib/appleEmoji.js';
import { initInstallPrompt } from './lib/installPrompt.js';

// Landing (Hub) ships in the main bundle for instant first paint;
// every other route is code-split and fetched on demand.
const Business = lazy(() => import('./pages/Business.jsx'));
const Creators = lazy(() => import('./pages/Creators.jsx'));
const Contacts = lazy(() => import('./pages/Contacts.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const LoginChoice = lazy(() => import('./pages/LoginChoice.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));
const ThankYou = lazy(() => import('./pages/ThankYou.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const DemoAdmin = lazy(() => import('./pages/DemoAdmin.jsx'));
const DemoTest = lazy(() => import('./pages/DemoTest.jsx'));
const CreatorPortal = lazy(() => import('./pages/CreatorPortal.jsx'));
const RegisterCreator = lazy(() => import('./pages/RegisterCreator.jsx'));
const BusinessPortal = lazy(() => import('./pages/BusinessPortal.jsx'));
const Referral = lazy(() => import('./pages/Referral.jsx'));
const CreatorMiniPage = lazy(() => import('./pages/CreatorMiniPage.jsx'));
const AppLauncher = lazy(() => import('./pages/AppLauncher.jsx'));
// WebGL aurora backdrop - lazy so it never blocks first paint.
const Aurora = lazy(() => import('./components/Aurora.jsx'));

// Scroll to top + report a pageview on every route change.
function RouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    trackPageview(pathname);
    trackVisit(pathname);
    // Re-skin emoji that the new route just rendered.
    requestAnimationFrame(() => parseAppleEmoji(document.body));
  }, [pathname]);
  return null;
}

export default function App() {
  useEffect(() => {
    initAnalytics();
    initAppleEmoji();
    // Chrome fires beforeinstallprompt once and early — catch it here, at app
    // start, because the cabinet that offers the button is a lazy chunk that
    // may not exist yet when it arrives.
    initInstallPrompt();
    // Delegate clicks on any [data-track] element → click analytics.
    const onClick = (e) => {
      const el = e.target.closest?.('[data-track]');
      if (el) trackEvent(el.getAttribute('data-track'));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return (
    <>
      {/* Purely decorative: if WebGL is unavailable the backdrop disappears, the site does not. */}
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <Aurora colorStops={['#7cff67', '#B497CF', '#5227FF']} blend={0.5} amplitude={0.7} speed={0.8} />
        </Suspense>
      </ErrorBoundary>
      <Playground />
      <RouteEffects />
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<Hub />} />
          <Route path="/business" element={<Business />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/about" element={<About />} />
          <Route path="/en/about" element={<About forceLang="en" />} />
          <Route path="/login" element={<LoginChoice />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/thanks/:type" element={<ThankYou />} />
          <Route path="/app" element={<AppLauncher />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/demo-admin" element={<DemoAdmin />} />
          <Route path="/demo-test" element={<DemoTest />} />
          <Route path="/creator" element={<CreatorPortal />} />
          <Route path="/registration_creators" element={<RegisterCreator />} />
          <Route path="/business-cabinet" element={<BusinessPortal />} />
            <Route path="/friend/:login" element={<Referral />} />
            {/* Creator bio / lead link. Moved off the bare "/:login" catch-all
                (which shadowed every top-level route) to an explicit /ref prefix. */}
            <Route path="/ref/:login" element={<CreatorMiniPage />} />
            {/* Back-compat: old bare links redirect to the new /ref path. */}
            <Route path="/:login" element={<CreatorMiniPage legacyRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

/**
 * Shown while a route chunk downloads. Reserves the viewport height so the page
 * doesn't jump when the route lands, and announces the wait to screen readers.
 * The label fades in only after 300ms — on a fast connection the chunk arrives
 * first and nothing flashes.
 */
function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-busy="true">
      <span className="route-fallback__label">Загрузка…</span>
    </div>
  );
}

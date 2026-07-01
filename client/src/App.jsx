import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import Hub from './pages/Hub.jsx';
import Playground from './components/Playground.jsx';
import { initAnalytics, trackPageview, trackVisit, trackEvent } from './lib/analytics.js';
import { initAppleEmoji, parseAppleEmoji } from './lib/appleEmoji.js';

// Landing (Hub) ships in the main bundle for instant first paint;
// every other route is code-split and fetched on demand.
const Business = lazy(() => import('./pages/Business.jsx'));
const Creators = lazy(() => import('./pages/Creators.jsx'));
const Contacts = lazy(() => import('./pages/Contacts.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const ThankYou = lazy(() => import('./pages/ThankYou.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const CreatorPortal = lazy(() => import('./pages/CreatorPortal.jsx'));
const BusinessPortal = lazy(() => import('./pages/BusinessPortal.jsx'));
const Referral = lazy(() => import('./pages/Referral.jsx'));
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
      <Suspense fallback={null}>
        <Aurora colorStops={['#7cff67', '#B497CF', '#5227FF']} blend={0.5} amplitude={0.7} speed={0.8} />
      </Suspense>
      <Playground />
      <RouteEffects />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Hub />} />
          <Route path="/business" element={<Business />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/thanks/:type" element={<ThankYou />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/creator" element={<CreatorPortal />} />
          <Route path="/business-cabinet" element={<BusinessPortal />} />
          <Route path="/:ref" element={<Referral />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

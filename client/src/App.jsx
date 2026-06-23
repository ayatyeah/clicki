import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import Hub from './pages/Hub.jsx';
import Playground from './components/Playground.jsx';
import { initAnalytics, trackPageview } from './lib/analytics.js';

// Landing (Hub) ships in the main bundle for instant first paint;
// every other route is code-split and fetched on demand.
const Business = lazy(() => import('./pages/Business.jsx'));
const Creators = lazy(() => import('./pages/Creators.jsx'));
const Contacts = lazy(() => import('./pages/Contacts.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const ThankYou = lazy(() => import('./pages/ThankYou.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));

// Scroll to top + report a pageview on every route change.
function RouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    trackPageview(pathname);
  }, [pathname]);
  return null;
}

export default function App() {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <>
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

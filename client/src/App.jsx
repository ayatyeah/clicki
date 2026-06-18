import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Hub from './pages/Hub.jsx';
import Business from './pages/Business.jsx';
import Creators from './pages/Creators.jsx';
import Contacts from './pages/Contacts.jsx';
import Privacy from './pages/Privacy.jsx';
import ThankYou from './pages/ThankYou.jsx';
import NotFound from './pages/NotFound.jsx';
import Playground from './components/Playground.jsx';

// Scroll to top on route change so each funnel page starts at its hero.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <Playground />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Hub />} />
        <Route path="/business" element={<Business />} />
        <Route path="/creators" element={<Creators />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/thanks/:type" element={<ThankYou />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

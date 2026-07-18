import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.jsx';
import { LangProvider } from './i18n.jsx';
import { ContentProvider } from './content.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { ConfirmProvider } from './components/ConfirmDialog.jsx';
import './styles/tailwind.css';
import './styles/index.css';
import './styles/funnel-shinta.css';
import './styles/app-light.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <LangProvider>
        <ContentProvider>
          <ToastProvider>
            <ConfirmProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <App />
              </BrowserRouter>
            </ConfirmProvider>
          </ToastProvider>
        </ContentProvider>
      </LangProvider>
    </HelmetProvider>
  </React.StrictMode>
);

// Stale-client self-recovery. Hundreds of people visited before the service
// worker was fixed (mid-July) and may carry an old, stubborn worker that serves
// a stale shell — the kind that only "clear site data" fixed by hand. This makes
// it fix itself: compare the running build id to the one the server reports; on a
// mismatch, tear down the old worker + caches once and reload onto the fresh
// build. Guarded so it can reload at most once per session (no loop), and clears
// the guard when versions match so a later deploy in the same session still heals.
async function ensureFreshBuild() {
  const mine = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '';
  if (!mine) return;
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = await res.json();
    if (!build) return;
    if (build === mine) {
      sessionStorage.removeItem('clicki_stale_reload');
      return;
    }
    if (sessionStorage.getItem('clicki_stale_reload')) return; // already tried this session
    sessionStorage.setItem('clicki_stale_reload', '1');
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    window.location.reload();
  } catch {
    /* offline or no endpoint (dev) — leave the app as is */
  }
}
ensureFreshBuild();
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') ensureFreshBuild();
});

// Service worker: keep the app self-updating so users never need a hard reload.
// A freshly deployed SW skips waiting and claims control (see vite.config PWA);
// when that new SW takes over we reload the page once so the running tab swaps to
// the new build automatically. We also actively check for an update on load and
// whenever the tab regains focus.
if ('serviceWorker' in navigator) {
  // Only reload when a NEW sw replaces an existing one (a deploy) — not on the very
  // first visit, where the freshly-installed sw claims the page and would otherwise
  // trigger a pointless reload.
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        const check = () => reg.update().catch(() => {});
        check();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      })
      .catch(() => {});
  });
}

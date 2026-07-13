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

// Service worker: keep the app self-updating so users never need a hard reload.
// A freshly deployed SW skips waiting and claims control (see vite.config PWA);
// when that new SW takes over we reload the page once so the running tab swaps to
// the new build automatically. We also actively check for an update on load and
// whenever the tab regains focus.
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
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

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.jsx';
import { LangProvider } from './i18n.jsx';
import { ContentProvider } from './content.jsx';
import './styles/tailwind.css';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <LangProvider>
        <ContentProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ContentProvider>
      </LangProvider>
    </HelmetProvider>
  </React.StrictMode>
);

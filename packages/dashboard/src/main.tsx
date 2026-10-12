import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { I18nProvider } from './i18n.js';
import 'leaflet/dist/leaflet.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);

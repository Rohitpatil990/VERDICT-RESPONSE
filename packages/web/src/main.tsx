import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n.js';
import { Shell } from './components/Shell.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Shell />
  </React.StrictMode>
);

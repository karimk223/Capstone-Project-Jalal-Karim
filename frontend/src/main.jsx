/**
 * main.jsx — React app entry point.
 * Imports './i18n' for its side effect: initializing react-i18next before any
 * component calls useTranslation().
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

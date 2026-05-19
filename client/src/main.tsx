import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { applyThemeColors } from './constants/theme';
import { initClientObservability } from './lib/observability';
import { readLocalePreference } from './lib/localePreference';
import './styles.css';

applyThemeColors();
document.documentElement.lang = readLocalePreference();
initClientObservability();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

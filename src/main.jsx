import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

function syncAppViewportHeight() {
  const height = Math.round(window.visualViewport?.height || window.innerHeight);
  if (height > 0) document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
}

syncAppViewportHeight();
window.addEventListener('resize', syncAppViewportHeight);
window.addEventListener('orientationchange', syncAppViewportHeight);
window.addEventListener('pageshow', syncAppViewportHeight);
window.visualViewport?.addEventListener('resize', syncAppViewportHeight);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestAnimationFrame(syncAppViewportHeight);
});

const storedTheme = localStorage.getItem('theme');
if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

if ('serviceWorker' in navigator && (window.isSecureContext || window.location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // A instalação continua funcionando mesmo quando o cache offline não está disponível.
    });
  });
}

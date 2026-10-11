import { init } from './app.js';

// Only register the service worker for production builds; in `vite dev`
// it would cache dev modules and serve stale code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => init().catch(console.error));

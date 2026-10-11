import { init } from './app.js';

// Only register the service worker for production builds; in `vite dev`
// it would cache dev modules and serve stale code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Some iOS versions stop the home-screen app's viewport short of the
// bottom of the screen and draw that strip themselves (tinted with the
// theme colour). The home indicator is then already cleared, so the tab
// bar shouldn't add its own safe-area padding on top of that.
if (navigator.standalone) {
  const checkViewport = () => {
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    const screenHeight = portrait ? screen.height : screen.width;
    document.documentElement.classList.toggle('short-viewport', window.innerHeight < screenHeight - 1);
  };
  checkViewport();
  window.addEventListener('resize', checkViewport);
}

document.addEventListener('DOMContentLoaded', () => init().catch(console.error));

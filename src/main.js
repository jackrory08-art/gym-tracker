import { init } from './app.js';

// Only register the service worker for production builds; in `vite dev`
// it would cache dev modules and serve stale code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// iOS home-screen apps can report a viewport shorter than the physical
// screen, which leaves a strip of background under the tab bar. In
// standalone mode the app always fills the screen, so size it from that.
if (navigator.standalone) {
  const fitToScreen = () => {
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    const screenHeight = portrait ? screen.height : screen.width;
    const height = Math.max(window.innerHeight, screenHeight);
    document.documentElement.style.setProperty('--app-height', `${height}px`);
  };
  fitToScreen();
  window.addEventListener('resize', fitToScreen);
  window.addEventListener('orientationchange', fitToScreen);
}

document.addEventListener('DOMContentLoaded', () => init().catch(console.error));

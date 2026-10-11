// Plain web SVG of the male body (front/back), one <path> per artwork
// shape, each tagged with its body-part slug. No strokes are drawn.
import { BODY_VIEWBOX, BODY_FRONT_PATHS, BODY_BACK_PATHS } from './body-paths.js';

// fillFor(slug) → colour; attrsFor(slug) → extra attribute string (optional).
export function renderBodySVG(view, fillFor, { attrsFor = () => '', label = `Body, ${view}` } = {}) {
  const paths = view === 'back' ? BODY_BACK_PATHS : BODY_FRONT_PATHS;
  return `<svg class="body-svg" viewBox="${BODY_VIEWBOX[view]}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${
    paths.map(p => `<path data-slug="${p.slug}" data-side="${p.side}" fill="${fillFor(p.slug)}" ${attrsFor(p.slug)} d="${p.d}"/>`).join('')
  }</svg>`;
}

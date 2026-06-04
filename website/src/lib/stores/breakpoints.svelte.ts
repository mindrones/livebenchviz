/**
 * Reactive viewport breakpoints (Tailwind-aligned).
 *
 * Layout switch:
 *   - isMobile  (< md / 768px): footer-tab navigation
 *   - isTablet  (md–lg / 768–1023px): desktop sidebar layout, compact sizing
 *   - isDesktop  (≥ lg / 1024px): full desktop layout
 *   - isXl      (≥ xl / 1280px): full axis labels without overlap
 *
 * Tablets/iPads use the desktop sidebar layout, never the mobile tab layout.
 */
import { browser } from '$app/environment';

class Breakpoints {
  /** < 768px — phones: show mobile tab layout */
  isMobile = $state(false);
  /** 768–1023px — tablets: desktop layout, may use compact sizing */
  isTablet = $state(false);
  /** ≥ 1024px — full desktop layout */
  isDesktop = $state(false);
  /** ≥ 1280px (Tailwind xl) — full axis labels fit without overlap */
  isXl = $state(false);
  /** Current viewport width (0 on SSR) */
  width = $state(0);
}

export const breakpoints = new Breakpoints();

if (browser) {
  const mqlMobile = window.matchMedia('(max-width: 767px)');
  const mqlTablet = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
  const mqlXl     = window.matchMedia('(min-width: 1280px)');

  function sync() {
    breakpoints.isMobile  = mqlMobile.matches;
    breakpoints.isTablet  = mqlTablet.matches;
    breakpoints.isDesktop = !mqlMobile.matches && !mqlTablet.matches;
    breakpoints.isXl      = mqlXl.matches;
    breakpoints.width     = window.innerWidth;
  }

  sync();
  mqlMobile.addEventListener('change', sync);
  mqlTablet.addEventListener('change', sync);
  mqlXl.addEventListener('change', sync);
}
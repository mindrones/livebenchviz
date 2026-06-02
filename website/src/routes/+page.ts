// Data is loaded in +layout.ts (once per calendar day, cached in localStorage).
// This file only suppresses SSR/prerender so the layout load runs in-browser.
export const prerender = false;

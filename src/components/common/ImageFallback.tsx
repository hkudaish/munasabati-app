'use client';
import { useEffect } from 'react';

// Neutral sand tile with a camera glyph; used when a supplier-provided image URL is dead.
const FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#F4EFE6'/>" +
      "<g fill='none' stroke='#A78F70' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'>" +
      "<rect x='140' y='110' width='120' height='84' rx='12'/><circle cx='200' cy='152' r='22'/><path d='M170 110l8-14h44l8 14'/></g></svg>"
  );

/** Images fail (dead links, offline): show a quiet placeholder instead of a broken-image icon with overlapping alt text. */
export default function ImageFallback() {
  useEffect(() => {
    const apply = (img: HTMLImageElement) => {
      if (img.dataset.fallback) return;
      img.dataset.fallback = '1';
      img.removeAttribute('srcset');
      img.src = FALLBACK;
    };
    const onError = (e: Event) => { if (e.target instanceof HTMLImageElement) apply(e.target); };
    document.addEventListener('error', onError, true);
    // Images that already failed before hydration never reach the listener.
    document.querySelectorAll('img').forEach(img => { if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) apply(img); });
    return () => document.removeEventListener('error', onError, true);
  }, []);
  return null;
}

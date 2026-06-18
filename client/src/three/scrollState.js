/**
 * Tiny shared scroll store read by the 3D scenes inside their render loops.
 * One passive listener for the whole app — both the background and the hero
 * phone read `scrollState` every frame, so motion stays in sync and cheap.
 */
export const scrollState = { y: 0, progress: 0 };

function update() {
  const y = window.scrollY || window.pageYOffset || 0;
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  scrollState.y = y;
  scrollState.progress = Math.min(1, Math.max(0, y / max));
}

if (typeof window !== 'undefined') {
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
}

/* global window, document, requestAnimationFrame, cancelAnimationFrame */
// Motion belongs to the artwork, never the hit target. Touch remains entirely still.
const motion = window.matchMedia(
  '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)',
);
let active = null;
let frame = 0;
function reset() {
  cancelAnimationFrame(frame);
  if (active) {
    active.style.removeProperty('--drift-x');
    active.style.removeProperty('--drift-y');
  }
  active = null;
}
document.addEventListener(
  'pointermove',
  (event) => {
    if (!motion.matches || event.pointerType !== 'mouse') return;
    const stage = event.target.closest('.specimen-stage');
    if (stage !== active) reset();
    if (!stage) return;
    active = stage;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!stage.isConnected) return reset();
      const rect = stage.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
      const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
      stage.style.setProperty('--drift-x', `${x * 7}px`);
      stage.style.setProperty('--drift-y', `${y * 5}px`);
    });
  },
  { passive: true },
);
document.addEventListener('pointerout', (event) => {
  if (active && !active.contains(event.relatedTarget)) reset();
});
window.addEventListener('blur', reset);
motion.addEventListener('change', reset);

// One arrival, tied to inspection rather than every collection render.
export function revealArtwork(origin, artwork) {
  if (!artwork || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const destination = artwork.getBoundingClientRect();
  if (!destination.width || !destination.height) return;
  const visible = origin && origin.bottom > 0 && origin.top < window.innerHeight;
  const dx = visible
    ? origin.left + origin.width / 2 - destination.left - destination.width / 2
    : 0;
  const dy = visible
    ? origin.top + origin.height / 2 - destination.top - destination.height / 2
    : 8;
  const scale = visible ? Math.max(0.35, Math.min(1, origin.width / destination.width)) : 0.98;
  artwork.getAnimations().forEach((animation) => animation.cancel());
  artwork.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.2 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ],
    { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' },
  );
}

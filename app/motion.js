// Artwork stays still under the pointer. The only motion is one arrival when details open.
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

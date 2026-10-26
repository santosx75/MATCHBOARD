// Background paths: vanilla port of the "BackgroundPaths" component (framer-motion).
// Two mirrored sets of 36 curves drift slowly along their length. CSS does the animation
// (stroke-dashoffset), so there is no per-frame JavaScript; it pauses when off screen.

function paths(position) {
  let out = "";
  for (let i = 0; i < 36; i++) {
    const a = 380 - i * 5 * position, b = 312 - i * 5 * position, c = 152 - i * 5 * position;
    const d1 = 616 - i * 5 * position, e = 684 - i * 5 * position;
    const d = `M-${a} -${189 + i * 6}C-${a} -${189 + i * 6} -${b} ${216 - i * 6} ${c} ${343 - i * 6}C${d1} ${470 - i * 6} ${e} ${875 - i * 6} ${e} ${875 - i * 6}`;
    const dur = (20 + Math.random() * 10).toFixed(1);
    const delay = (-Math.random() * 20).toFixed(1); // start at different points so it never looks synced
    out += `<path d="${d}" pathLength="1" stroke-width="${(0.5 + i * 0.03).toFixed(2)}" stroke-opacity="${(0.1 + i * 0.03).toFixed(2)}" style="--d:${dur}s;animation-delay:${delay}s,${delay}s"/>`;
  }
  return out;
}

export function mountBackgroundPaths(zone) {
  if (!zone) return;
  const layer = document.createElement("div");
  layer.className = "paths-bg";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML =
    `<svg viewBox="0 0 696 316" preserveAspectRatio="xMidYMid slice">${paths(1)}</svg>` +
    `<svg viewBox="0 0 696 316" preserveAspectRatio="xMidYMid slice">${paths(-1)}</svg>`;
  zone.prepend(layer);
  new IntersectionObserver(([e]) => layer.classList.toggle("is-paused", !e.isIntersecting)).observe(zone);
}

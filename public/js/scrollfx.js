// Scroll tilt: vanilla port of Aceternity "ContainerScroll" (framer-motion useScroll/useTransform).
// Boxes and section titles enter tilted back (rotateX), lower and smaller, then flatten as they
// scroll into view. The upload card and the landing title are left out on purpose.
// Uses the CSS `rotate` / `scale` / `translate` properties, so it stacks with the hover lift
// (`transform`) instead of fighting it.

// deg: start tilt, scale: start scale, y: start offset (px), op: start opacity, stagger: per-item delay in a grid.
const KINDS = [
  { sel: ".platform, .tile", deg: 38, scale: 0.84, y: 80, op: 0.15, stagger: 0.09 },
  { sel: ".section-head, .results-head", deg: 32, scale: 0.9, y: 60, op: 0.1, stagger: 0 },
  { sel: ".profile", deg: 24, scale: 1.05, y: 40, op: 0.4, stagger: 0 },
  { sel: ".job, .empty, .notice", deg: 22, scale: 0.93, y: 36, op: 1, stagger: 0 },
];
const TARGETS = KINDS.map((k) => k.sel).join(", ");

export function initScrollTilt(root = document.querySelector("main")) {
  if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const visible = new Set();
  const kindOf = new WeakMap();
  let frame = 0;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
    schedule();
  }, { rootMargin: "15% 0px 15% 0px" });

  const scan = () => {
    root.querySelectorAll(TARGETS).forEach((el) => {
      if (kindOf.has(el) || el.closest(".upload, .hero")) return;
      kindOf.set(el, KINDS.find((k) => el.matches(k.sel)));
      el.classList.add("tilt");
      io.observe(el);
    });
  };

  function update() {
    frame = 0;
    const vh = innerHeight;
    const mobile = innerWidth <= 768;
    for (const el of visible) {
      if (!el.isConnected) { visible.delete(el); continue; }
      const k = kindOf.get(el);
      const top = el.getBoundingClientRect().top;
      // 0 when the element's top enters at the bottom of the screen, 1 once it reaches 25% from the top.
      let p = (vh - top) / (vh * 0.75);
      if (k.stagger) p -= Array.prototype.indexOf.call(el.parentElement.children, el) * k.stagger;
      p = Math.min(1, Math.max(0, p));
      const e = 1 - (1 - p) * (1 - p); // ease-out: moves a lot at first, settles gently
      const deg = k.deg * (mobile ? 0.75 : 1);
      const fromScale = mobile && k.scale > 1 ? 0.92 : k.scale;
      el.style.setProperty("--tilt-r", `${(deg * (1 - e)).toFixed(2)}deg`);
      el.style.setProperty("--tilt-s", (fromScale + (1 - fromScale) * e).toFixed(4));
      el.style.setProperty("--tilt-y", `${(k.y * (1 - e)).toFixed(1)}px`);
      el.style.setProperty("--tilt-o", (k.op + (1 - k.op) * e).toFixed(3));
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }

  scan();
  new MutationObserver(() => { scan(); schedule(); }).observe(root, { childList: true, subtree: true });
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
}

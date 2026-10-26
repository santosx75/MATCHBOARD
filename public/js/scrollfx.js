// Scroll tilt: vanilla port of Aceternity "ContainerScroll" (framer-motion useScroll/useTransform).
// Boxes enter tilted back (rotateX) and slightly scaled, then flatten as they scroll into view.
// The upload card is left out on purpose. Uses the CSS `rotate` / `scale` properties, so it
// stacks with the hover lift (`transform`) instead of fighting it.

const TARGETS = ".profile, .job, .platform, .tile, .empty, .notice";
const BIG = ".profile"; // large panels get the original 20° tilt, cards a softer one

export function initScrollTilt(root = document.querySelector("main")) {
  if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const visible = new Set();
  let frame = 0;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
    schedule();
  }, { rootMargin: "10% 0px 10% 0px" });

  const tracked = new WeakSet();
  const scan = () => {
    root.querySelectorAll(TARGETS).forEach((el) => {
      if (tracked.has(el) || el.closest(".upload")) return;
      tracked.add(el);
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
      const top = el.getBoundingClientRect().top;
      // 0 when the box's top enters at the bottom of the screen, 1 once it reaches 45% from the top.
      const p = Math.min(1, Math.max(0, (vh - top) / (vh * 0.55)));
      const big = el.matches(BIG);
      const maxDeg = big ? 20 : 14;
      const fromScale = mobile ? 0.9 : big ? 1.05 : 0.97;
      el.style.setProperty("--tilt-r", `${(maxDeg * (1 - p)).toFixed(2)}deg`);
      el.style.setProperty("--tilt-s", (fromScale + (1 - fromScale) * p).toFixed(4));
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }

  scan();
  new MutationObserver(() => { scan(); schedule(); }).observe(root, { childList: true, subtree: true });
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
}

// Crowd canvas: vanilla JS port of Skiper UI "Skiper39" (CrowdCanvas), itself adapted from
// https://codepen.io/zadvorsky/pen/xxwbBQV with illustrations by https://www.openpeeps.com/
// Attribution to Skiper UI (https://skiper-ui.com) is required by its free licence — kept here and in an HTML comment in index.html.
// Needs window.gsap (loaded from cdnjs in index.html).

export function mountCrowd(canvas, { src, rows = 15, cols = 7 } = {}) {
  const gsap = window.gsap;
  const ctx = canvas?.getContext("2d");
  if (!ctx || !gsap) return () => {};

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const randomRange = (min, max) => min + Math.random() * (max - min);
  const randomIndex = (arr) => randomRange(0, arr.length) | 0;
  const removeFromArray = (arr, i) => arr.splice(i, 1)[0];
  const removeItemFromArray = (arr, item) => removeFromArray(arr, arr.indexOf(item));
  const removeRandomFromArray = (arr) => removeFromArray(arr, randomIndex(arr));

  const stage = { width: 0, height: 0 };
  const img = new Image();
  const allPeeps = [];
  const availablePeeps = [];
  const crowd = [];
  let running = false;
  let destroyed = false;
  let scale = 1;

  function createPeep(rect) {
    const peep = {
      rect, width: rect[2], height: rect[3], x: 0, y: 0, anchorY: 0, scaleX: 1, walk: null,
      render(c) {
        c.save();
        c.translate(peep.x, peep.y);
        c.scale(peep.scaleX, 1);
        c.drawImage(img, peep.rect[0], peep.rect[1], peep.rect[2], peep.rect[3], 0, 0, peep.width, peep.height);
        c.restore();
      },
    };
    return peep;
  }

  function resetPeep(peep) {
    const direction = Math.random() > 0.5 ? 1 : -1;
    // Original pen: 100 → -150 (bodies cut ~100px below the edge). Here people stand higher: 10 → -160.
    const offsetY = (10 - 170 * gsap.parseEase("power2.in")(Math.random())) * scale;
    const startY = stage.height - peep.height + offsetY;
    let startX, endX;
    if (direction === 1) { startX = -peep.width; endX = stage.width; peep.scaleX = 1; }
    else { startX = stage.width + peep.width; endX = 0; peep.scaleX = -1; }
    peep.x = startX;
    peep.y = startY;
    peep.anchorY = startY;
    return { startX, startY, endX };
  }

  function normalWalk(peep, { startY, endX }) {
    const xDuration = 10, yDuration = 0.25;
    const tl = gsap.timeline();
    tl.timeScale(randomRange(0.5, 1.5));
    tl.to(peep, { duration: xDuration, x: endX, ease: "none" }, 0);
    tl.to(peep, { duration: yDuration, repeat: xDuration / yDuration, yoyo: true, y: startY - 10 }, 0);
    return tl;
  }

  function addPeepToCrowd() {
    const peep = removeRandomFromArray(availablePeeps);
    const walk = normalWalk(peep, resetPeep(peep)).eventCallback("onComplete", () => {
      removeItemFromArray(crowd, peep);
      availablePeeps.push(peep);
      addPeepToCrowd();
    });
    peep.walk = walk;
    crowd.push(peep);
    crowd.sort((a, b) => a.anchorY - b.anchorY);
    return peep;
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(devicePixelRatio, devicePixelRatio);
    crowd.forEach((p) => p.render(ctx));
    ctx.restore();
  }

  function resize() {
    stage.width = canvas.clientWidth;
    stage.height = canvas.clientHeight;
    canvas.width = stage.width * devicePixelRatio;
    canvas.height = stage.height * devicePixelRatio;
    // Fit the people to the canvas: the tallest one (sprite height + 150px lift) keeps its head
    // inside the canvas, below the top fade. Never upscale past the sprite's real size.
    const spriteH = allPeeps[0]?.rect[3] || 1;
    scale = Math.min(1, (stage.height * 0.92) / (spriteH + 170));
    allPeeps.forEach((p) => { p.width = p.rect[2] * scale; p.height = p.rect[3] * scale; });
    crowd.forEach((p) => p.walk.kill());
    crowd.length = 0;
    availablePeeps.length = 0;
    availablePeeps.push(...allPeeps);
    while (availablePeeps.length) addPeepToCrowd().walk.progress(Math.random());
    if (reduceMotion || !running) crowd.forEach((p) => p.walk.pause());
    if (reduceMotion) render();
  }

  // Off screen: stop drawing AND pause the walking timelines so no work runs per frame.
  function start() {
    if (running || reduceMotion) return;
    crowd.forEach((p) => p.walk.resume());
    gsap.ticker.add(render);
    running = true;
  }
  function stop() {
    if (!running) return;
    gsap.ticker.remove(render);
    crowd.forEach((p) => p.walk.pause());
    running = false;
  }

  // Pause the animation when the hero is off screen to save battery.
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
  let resizeTimer;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); };

  img.onload = () => {
    if (destroyed) return;
    const w = img.naturalWidth / rows, h = img.naturalHeight / cols;
    for (let i = 0; i < rows * cols; i++) allPeeps.push(createPeep([(i % rows) * w, ((i / rows) | 0) * h, w, h]));
    resize();
    canvas.classList.add("is-ready");
    io.observe(canvas);
    window.addEventListener("resize", onResize);
  };
  img.onerror = () => canvas.remove(); // decorative only: hide if the image can't load
  img.src = src;

  return () => {
    destroyed = true;
    stop();
    io.disconnect();
    window.removeEventListener("resize", onResize);
    crowd.forEach((p) => p.walk?.kill());
  };
}

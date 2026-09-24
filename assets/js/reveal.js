/* Drawing-to-prototype brush (idea from bleibtgleich.dev).
   The line drawing sits on top of the real photo; the cursor paints a mask that erases the drawing,
   and the mask slowly fades so the drawing closes back over. Canvas 2D, no WebGL needed. */
import { $ } from './ui.js';

export function initReveal({ reduce }) {
  const box = $('#reveal');
  if (!box) return;
  const cvs = $('canvas', box);
  const ctx = cvs.getContext('2d');
  const hint = $('#revealHint');
  const lines = new Image();
  lines.src = 'assets/images/projects/exo-lines.jpg';
  const mask = document.createElement('canvas');
  const m = mask.getContext('2d');
  let W = 0, H = 0, last = null, trail = [], running = false;

  new ResizeObserver(() => {
    const r = box.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    W = cvs.width = Math.round(r.width * d);
    H = cvs.height = Math.round(r.height * d);
    mask.width = Math.round(W / 2);
    mask.height = Math.round(H / 2);
  }).observe(box);

  // auteur-allow: POINTER_NO_RAF -- the handler only queues points; the loop stamps them once per frame
  box.addEventListener('pointermove', (e) => {
    const r = box.getBoundingClientRect();
    trail.push([(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]);
    hint.classList.add('is-gone');
  });
  box.addEventListener('pointerleave', () => { last = null; });

  const stamp = (x, y, s) => {
    const R = mask.width * 0.15 * s;
    const g = m.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.6, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = g;
    m.beginPath(); m.arc(x, y, R, 0, Math.PI * 2); m.fill();
  };

  function loop() {
    if (!running) return;
    m.globalCompositeOperation = 'destination-out';           // the uncovered area slowly closes, like ink drying
    m.fillStyle = `rgba(0,0,0,${reduce ? 0.004 : 0.006})`;
    m.fillRect(0, 0, mask.width, mask.height);
    m.globalCompositeOperation = 'source-over';
    for (const [u, v] of trail) {
      const x = u * mask.width, y = v * mask.height;
      if (last) {
        const n = Math.ceil(Math.hypot(x - last[0], y - last[1]) / 6);
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          stamp(last[0] + (x - last[0]) * t + (Math.random() - 0.5) * 10, last[1] + (y - last[1]) * t + (Math.random() - 0.5) * 10, 0.7 + Math.random() * 0.6);
        }
      } else stamp(x, y, 1);
      last = [x, y];
    }
    trail = [];
    ctx.globalCompositeOperation = 'source-over';
    if (lines.complete) ctx.drawImage(lines, 0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0, W, H);
    requestAnimationFrame(loop);
  }
  new IntersectionObserver(([e]) => {
    const was = running;
    running = e.isIntersecting;
    if (running && !was) requestAnimationFrame(loop);
  }).observe(box);
}

/* Entry point. Each feature lives in its own module:
   ui.js      smooth scroll, reveals, counters, verifier demo, certificate viewer, copy email
   stage.js   the Unitree Go2 (intro, cursor-following body pose, exploded anatomy), uses go2-kinematics.js
   sphere.js  the spinning project index
   reveal.js  the drawing-to-prototype brush on the exoskeleton
   ask.js     the "Ask my portfolio" box, uses agent-core.js (shared with the Cloudflare Worker)
   face.js    the ending portrait made of points */
import { initUI, $ } from './ui.js';
import { initStage } from './stage.js';
import { initSphere } from './sphere.js';
import { initReveal } from './reveal.js';
import { initAsk } from './ask.js';
import { initFace } from './face.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const { lenis, hasGsap } = initUI({ reduce });

initStage({ reduce, hasGsap, lenis });
if (hasGsap) {
  // the stage created a pinned scene after the reveal triggers existed; measure everything again with it in place
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}
initSphere({ reduce, lenis });
initReveal({ reduce });
initAsk();
initFace({ reduce });

// The exoskeleton clip plays only while it is on screen
const video = $('#exo video');
if (video) {
  if (reduce) video.controls = true;
  else new IntersectionObserver(([e]) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause()), { threshold: 0.25 }).observe(video);
}

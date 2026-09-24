/* Option B, "Plano": the page is a drawing sheet and the car is drawn live.
   Rendering: depth-only fill + constant-width silhouette (inverted hull) + iso-parameter lines,
   visible lines solid, hidden lines dashed (a second pass with depthFunc GREATER).
   The lines plot themselves: each segment carries its draw time in the vertex color channel.
   Peak: the perspective view turns to a side elevation, then top and front views plot in
   around it, with projection lines, like a third-angle drawing. */
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { initCommon, $, $$ } from '../shared/common.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const { hasGsap } = initCommon({ reduce });

// ---------- Title block follows the sheet you are on
const sheets = $$('.sheet');
const navLinks = $$('.tblock__nav a[href^="#"]');
if (hasGsap) {
  sheets.forEach((s, i) => ScrollTrigger.create({
    trigger: s, start: 'top 50%', end: 'bottom 50%',
    onToggle: (self) => {
      if (!self.isActive) return;
      $('#sheetName').textContent = s.dataset.sheet;
      $('#sheetNo').textContent = `${i + 1} of ${sheets.length}`;
      navLinks.forEach((a) => (a.getAttribute('href') === '#' + s.id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    },
  }));
}

const video = $('.exo__f1 video');
if (video) {
  if (reduce) video.controls = true;
  else new IntersectionObserver(([e]) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause()), { threshold: 0.25 }).observe(video);
}

const canvas = $('#stage');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  if (!renderer.getContext()) renderer = null;
} catch { renderer = null; }
if (renderer) boot(); else canvas.remove();

function boot() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  const LINE = new THREE.Color(0xeef2fb);

  // ---------- The car, as parametric surfaces (an illustration of an Eco-marathon prototype)
  const L = 2.6, NOSE = 1.3, HW = 0.31, HH = 0.27, Y0 = 0.36;
  let PMAX = 0;
  for (let i = 0; i <= 1000; i++) PMAX = Math.max(PMAX, Math.pow(i / 1000, 0.42) * Math.pow(1 - i / 1000, 0.9));
  const prof = (t) => (Math.pow(t, 0.42) * Math.pow(1 - t, 0.9)) / PMAX;
  const body = (t, th, v = new THREE.Vector3()) => {
    const r = prof(t), s = Math.sin(th);
    return v.set(NOSE - t * L, Y0 + r * HH * s * (s < 0 ? 0.62 : 1), r * HW * Math.cos(th));
  };
  const CC = new THREE.Vector3(NOSE - 0.36 * L, Y0 + HH * 0.7, 0), CR = new THREE.Vector3(0.36, 0.17, 0.19);
  const canopy = (u, v, o = new THREE.Vector3()) =>
    o.set(CC.x + CR.x * Math.cos(u), CC.y + CR.y * Math.sin(u) * Math.sin(v), CC.z + CR.z * Math.sin(u) * Math.cos(v));
  const R = 0.23;
  const WHEELS = [[NOSE - 0.22 * L, 0.2], [NOSE - 0.22 * L, -0.2], [NOSE - 0.8 * L, 0]];

  function surface(fn, nu, nv, u0, u1, v0, v1) {
    const pos = [], idx = [];
    const p = new THREE.Vector3();
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      fn(u0 + (u1 - u0) * (i / nu), v0 + (v1 - v0) * (j / nv), p);
      pos.push(p.x, p.y, p.z);
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1); // outward-facing, so the BackSide hull is the far side
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const bodyGeo = surface(body, 110, 56, 0.0005, 0.9995, 0, Math.PI * 2);
  const canopyGeo = surface(canopy, 40, 40, 0, Math.PI, 0, Math.PI * 2);
  const wheelGeo = new THREE.CylinderGeometry(R, R, 0.04, 48).rotateX(Math.PI / 2);

  // Depth-only fill: hides what is behind the car without painting over the drafting grid
  const fillMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2 });
  const hullMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: LINE }, uThick: { value: 1.6 }, uRes: { value: new THREE.Vector2(1, 1) }, uOpacity: { value: 1 } },
    vertexShader: `
      uniform float uThick; uniform vec2 uRes;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec2 dir = (projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0)).xy;
        float len = length(dir);
        if (len > 1e-5) clip.xy += dir / len * uThick * 2.0 / uRes * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity;
      void main() { gl_FragColor = vec4(uColor, uOpacity);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false,
  });
  const solids = new THREE.Group();
  for (const g of [bodyGeo, canopyGeo]) {
    const fill = new THREE.Mesh(g, fillMat); fill.renderOrder = 0;
    const hull = new THREE.Mesh(g, hullMat); hull.renderOrder = 1;
    solids.add(fill, hull);
  }
  WHEELS.forEach(([x, z]) => { const w = new THREE.Mesh(wheelGeo, fillMat); w.position.set(x, R, z); solids.add(w); });
  scene.add(solids);

  // ---------- Linework, with a draw time per segment
  const polylines = [];
  const pl = (pts, closed = false) => polylines.push({ pts, closed });
  const ring = (fn, n, a0, a1) => Array.from({ length: n + 1 }, (_, k) => fn(a0 + ((a1 - a0) * k) / n));
  pl([new THREE.Vector3(1.45, 0, 0), new THREE.Vector3(-1.45, 0, 0)]);                         // ground line
  for (let k = 1; k <= 9; k++) pl(ring((th) => body(k / 10, th), 72, 0, Math.PI * 2), true); // sections
  for (let k = 0; k < 8; k++) pl(ring((t) => body(t, (k * Math.PI) / 4), 90, 0.0005, 0.9995)); // longitudinals
  for (let k = 1; k <= 4; k++) pl(ring((v) => canopy((k * Math.PI) / 5, v), 40, 0, Math.PI));   // canopy sections
  for (const v of [Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4]) pl(ring((u) => canopy(u, v), 40, 0, Math.PI));
  WHEELS.forEach(([x, z]) => {
    for (const dz of [-0.02, 0.02]) pl(ring((a) => new THREE.Vector3(x + R * Math.cos(a), R + R * Math.sin(a), z + dz), 48, 0, Math.PI * 2), true);
    pl(ring((a) => new THREE.Vector3(x + 0.18 * Math.cos(a), R + 0.18 * Math.sin(a), z + 0.021), 40, 0, Math.PI * 2), true);
    for (let s = 0; s < 6; s++) {
      const a = (s * Math.PI) / 3;
      pl([new THREE.Vector3(x + 0.03 * Math.cos(a), R + 0.03 * Math.sin(a), z + 0.021), new THREE.Vector3(x + 0.18 * Math.cos(a), R + 0.18 * Math.sin(a), z + 0.021)]);
    }
  });

  const pos = [], col = [];
  polylines.forEach(({ pts, closed }, i) => {
    const start = (i / polylines.length) * 0.82, dur = 0.18;  // one pen after another, overlapping a little
    const n = closed ? pts.length : pts.length - 1;
    for (let k = 0; k < n; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const ta = start + (dur * k) / n, tb = start + (dur * (k + 1)) / n;
      col.push(ta, 0, 0, tb, 0, 0);
    }
  });
  const lineGeo = new LineSegmentsGeometry().setPositions(pos).setColors(col);

  const progress = { value: reduce ? 1 : 0 };
  const lineMat = (extra) => {
    const m = new LineMaterial({ color: LINE, linewidth: 1.5, vertexColors: true, transparent: true, ...extra });
    m.uniforms.uProgress = progress;
    m.fragmentShader = 'uniform float uProgress;\n' + m.fragmentShader.replace('#include <color_fragment>', 'if ( vColor.r > uProgress ) discard;');
    return m;
  };
  const visMat = lineMat({});
  const hidMat = lineMat({ linewidth: 1, dashed: true, dashSize: 0.03, gapSize: 0.022, opacity: 0.32, depthWrite: false, depthFunc: THREE.GreaterDepth });
  const visible = new LineSegments2(lineGeo, visMat); visible.renderOrder = 2;
  const hidden = new LineSegments2(lineGeo, hidMat); hidden.renderOrder = 3; hidden.computeLineDistances();
  scene.add(visible, hidden);
  document.documentElement.classList.add('has-stage');

  // ---------- Cameras
  const persp = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  const CENTER = new THREE.Vector3(0, 0.34, 0);
  const D0 = 7;
  const state = { az: 38, el: 14, pan: 0.2, panY: 0, fov: 26, ortho: 0, split: 0, notes: 0 };
  const narrow = () => innerWidth < 900;
  if (innerWidth < 760) Object.assign(state, { pan: 0, panY: 0.2 });
  const pointer = { x: 0, sx: 0 };
  // auteur-allow: POINTER_NO_RAF -- the handler only stores a number; the single render loop eases toward it
  window.addEventListener('pointermove', (e) => { pointer.x = (e.clientX / innerWidth) * 2 - 1; }, { passive: true });

  // ---------- Scroll choreography
  const peak = $('#racing');
  const notes = $('#notes');
  const viewLabels = Object.fromEntries($$('.view-label').map((el) => [el.dataset.view, el]));
  if (hasGsap && !reduce) {
    gsap.to(progress, { value: 1, duration: 2.6, ease: 'power1.inOut', delay: 0.3 });
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } })
      .to(state, { pan: 0, panY: 0, ease: 'none' });
    gsap.timeline({ scrollTrigger: { trigger: peak, start: 'top top', end: () => '+=' + innerHeight * 2.4, pin: '.peak__pin', scrub: 0.6, invalidateOnRefresh: true } })
      .to(state, { az: 0, el: 0, fov: 8, panY: narrow() ? -0.16 : 0, duration: 0.3, ease: 'power2.inOut' }, 0)
      .set(state, { ortho: 1 }, 0.3)
      .to(state, { split: 1, duration: 0.36, ease: 'power2.inOut' }, 0.34)
      .to(state, { notes: 1, duration: 0.14, ease: 'none' }, 0.72)
      .to({}, { duration: 0.14 }, 0.86);
    // triggers made before this pin (sheet names, reveals) must be measured after it
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  } else if (hasGsap) {
    // Reduced motion: everything already drawn; the drawing cuts to its three views when you reach it
    const hero = { ...state };
    const drawing = { az: 0, el: 0, fov: 8, ortho: 1, split: 1, notes: 1, pan: 0, panY: 0 };
    ScrollTrigger.create({ trigger: peak, start: 'top 60%', end: 'bottom 40%', onToggle: (s) => Object.assign(state, s.isActive ? drawing : hero) });
  }

  // ---------- Layout of the three views (CSS px, viewport space)
  function layout(W, H) {
    const gut = Math.max(20, Math.min(96, W * 0.06));
    const notesW = narrow() ? 0 : Math.min(384, W * 0.3) + 48;
    const x0 = gut, x1 = W - gut - notesW;
    const aw = x1 - x0;
    const small = narrow();
    const top = { x: x0, y: H * (small ? 0.25 : 0.3), w: aw * (small ? 0.64 : 0.7), h: H * (small ? 0.13 : 0.2) };
    const side = { x: x0, y: top.y + top.h + 14, w: top.w, h: H * (small ? 0.17 : 0.3) };
    const front = { x: x0 + top.w + 18, y: side.y, w: aw - top.w - 18, h: side.h };
    const s = Math.min(side.w / 3.0, side.h / 0.72, front.w / 0.9);
    return { top, side, front, s };
  }
  const lerp = THREE.MathUtils.lerp;
  const lerpRect = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });

  function renderView(rect, cam, W, H) {
    const r = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.max(1, Math.round(rect.w)), h: Math.max(1, Math.round(rect.h)) };
    renderer.setViewport(r.x, H - r.y - r.h, r.w, r.h);
    renderer.setScissor(r.x, H - r.y - r.h, r.w, r.h);
    visMat.resolution.set(r.w, r.h);
    hidMat.resolution.set(r.w, r.h);
    hullMat.uniforms.uRes.value.set(r.w, r.h);
    renderer.render(scene, cam);
  }
  function orthoView(kind, rect, s, cx, cy) {
    const hw = rect.w / 2 / s, hh = rect.h / 2 / s;
    ortho.left = -hw; ortho.right = hw; ortho.top = hh; ortho.bottom = -hh;
    if (kind === 'side') { ortho.position.set(cx, cy, 10); ortho.up.set(0, 1, 0); ortho.lookAt(cx, cy, 0); }
    if (kind === 'top') { ortho.position.set(cx, 10, 0); ortho.up.set(0, 0, -1); ortho.lookAt(cx, 0, 0); }
    if (kind === 'front') { ortho.position.set(10, cy, 0); ortho.up.set(0, 1, 0); ortho.lookAt(0, cy, 0); }
    ortho.updateProjectionMatrix();
    return ortho;
  }

  // ---------- Projection lines between views
  const svg = $('#proj');
  const projLines = Array.from({ length: 4 }, () => { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); svg.append(l); return l; });
  const setL = (l, x1, y1, x2, y2) => { l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); };
  const placeLabel = (el, rect, a) => { el.style.opacity = a; el.style.transform = `translate(${rect.x}px, ${rect.y + rect.h + 4}px)`; };

  let W = 0, H = 0;
  function frame() {
    const on = peak.getBoundingClientRect().bottom > 0;
    canvas.classList.toggle('is-off', !on);
    if (!on) return;
    if (W !== innerWidth || H !== innerHeight) {
      W = innerWidth; H = innerHeight;
      renderer.setSize(W, H, false);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    }
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, W, H);
    renderer.clear();
    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    const pinTop = $('.peak__pin').getBoundingClientRect().top;

    const portrait = W / H < 1 ? 1.5 : 1;
    if (state.ortho < 0.5) {
      // az 0 looks at the car's side; the cursor turns it only while we are near the cover pose
      const az = THREE.MathUtils.degToRad(state.az + pointer.sx * 18 * THREE.MathUtils.clamp(state.az / 38, 0, 1));
      const el = THREE.MathUtils.degToRad(state.el);
      // dolly zoom: the car keeps its size on screen while the lens narrows toward an orthographic look
      const d = D0 * portrait * Math.tan(THREE.MathUtils.degToRad(13)) / Math.tan(THREE.MathUtils.degToRad(state.fov / 2));
      persp.fov = state.fov;
      persp.aspect = W / H;
      persp.position.set(Math.cos(el) * Math.sin(az) * d, CENTER.y + Math.sin(el) * d, Math.cos(el) * Math.cos(az) * d);
      persp.lookAt(CENTER);
      persp.setViewOffset(W, H, -state.pan * W, -state.panY * H, W, H);
      persp.updateProjectionMatrix();
      hullMat.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(progress.value, 0.6, 1);
      renderView({ x: 0, y: 0, w: W, h: H }, persp, W, H);
      projLines.forEach((l) => { l.style.opacity = 0; });
      Object.values(viewLabels).forEach((el) => { el.style.opacity = 0; });
      notes.style.opacity = narrow() ? '' : 0;
      return;
    }

    // Orthographic sheet: side view moves into place, then top and front plot in around it
    const lay = layout(W, H);
    const shift = (r) => ({ ...r, y: r.y + pinTop });
    const full = { x: 0, y: -state.panY * H, w: W, h: H }; // continues the framing the lens had at the cut
    const t = state.split;
    const side = shift(lerpRect(full, lay.side, t));
    const s = lerp(H / (2 * D0 * portrait * Math.tan(THREE.MathUtils.degToRad(13))), lay.s, t); // same scale the lens had at the cut
    const cx = 0, cy = 0.34;
    hullMat.uniforms.uOpacity.value = 1;
    progress.value = 1;
    renderView(side, orthoView('side', side, s, cx, cy), W, H);

    const reveal = THREE.MathUtils.clamp((t - 0.35) / 0.65, 0, 1);
    if (reveal > 0) {
      const top = shift(lay.top), front = shift(lay.front);
      progress.value = reveal;
      hullMat.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(reveal, 0.5, 1);
      renderView(top, orthoView('top', top, s, cx, cy), W, H);
      renderView(front, orthoView('front', front, s, cx, cy), W, H);
      progress.value = 1;
      // projection lines: nose and tail up to the top view, top and bottom across to the front view
      const sx = (x) => side.x + side.w / 2 + (x - cx) * s;
      const sy = (y) => side.y + side.h / 2 - (y - cy) * s;
      const a = THREE.MathUtils.smoothstep(reveal, 0, 0.6);
      const yTop = sy(Y0 + HH * 0.7 + CR.y), yBot = sy(0);
      setL(projLines[0], sx(NOSE), side.y + side.h * 0.1 - pinTop, sx(NOSE), top.y + top.h * 0.2 - pinTop);
      setL(projLines[1], sx(-NOSE), side.y + side.h * 0.1 - pinTop, sx(-NOSE), top.y + top.h * 0.2 - pinTop);
      setL(projLines[2], side.x + side.w * 0.72, yTop - pinTop, front.x + front.w * 0.85, yTop - pinTop);
      setL(projLines[3], side.x + side.w * 0.72, yBot - pinTop, front.x + front.w * 0.85, yBot - pinTop);
      projLines.forEach((l) => { l.style.opacity = a; });
      // labels sit right under each drawing, not under its viewport
      const under = (x, y) => ({ x, y: y - pinTop, w: 0, h: 0 });
      placeLabel(viewLabels.top, under(sx(-NOSE), top.y + top.h / 2 + HW * s + 8), a);
      placeLabel(viewLabels.side, under(sx(-NOSE), yBot + 10), a);
      placeLabel(viewLabels.front, under(front.x + front.w / 2 - HW * s, yBot + 10), a);
    }
    if (!narrow()) notes.style.opacity = state.notes;
  }
  if (hasGsap) gsap.ticker.add(frame); else renderer.setAnimationLoop(frame);
}

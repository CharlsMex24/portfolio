/* The fixed WebGL stage: a Unitree Go2 (MuJoCo Menagerie model, BSD-3-Clause, Unitree Robotics).
   Intro (first visit): real loading %, the dog appears as a point cloud lying down, then stands up.
   Hero: body-pose control like the Go2's balance stand. The feet stay planted, the body turns and tilts
   toward the cursor, and every leg is solved with analytic inverse kinematics each frame. Click: it waves.
   Anatomy: scroll orbits the camera and pulls the dog apart, with callouts.
   Reduced motion: no intro, no pinning or scrubbing; the scene cuts between states. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { legIK, HIPS, SIDE, OFFSET } from './go2-kinematics.js';
import { $, $$ } from './ui.js';

const LEGS = ['FL', 'FR', 'RL', 'RR'];
const STAND = 0.27;   // body height of the MJCF "home" keyframe
const LIE = 0.1;      // lowest body height the knee limit allows, near the Go2's lying posture

// auteur-allow: WEBGL_NO_REDUCED_MOTION -- prefers-reduced-motion is read once in main.js and passed in as `reduce`; this scene branches on it
export function initStage({ reduce, hasGsap, lenis }) {
  const canvas = $('#stage');
  const html = document.documentElement;
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    if (!renderer.getContext()) renderer = null;
  } catch { renderer = null; }
  if (!renderer) { canvas.remove(); html.classList.remove('intro-on'); return; }

  // index.html already added .intro-on if an intro should play; it still needs GSAP and the top of the page
  const playIntro = html.classList.contains('intro-on') && hasGsap && window.scrollY < 40;
  if (playIntro) lenis?.stop(); else html.classList.remove('intro-on');

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.03, 20);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(0xfff3ea, 2.4);
  key.position.set(-1.2, 2.6, 1.9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -0.9, right: 0.9, top: 0.9, bottom: -0.9, near: 0.3, far: 6 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.015;
  key.shadow.radius = 5;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe4602d, 0.85)); // the orange floor bounces onto the dog
  const rim = new THREE.DirectionalLight(0xffe6da, 1.1);
  rim.position.set(1.8, 1.4, -1.8);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ color: 0x5a1c05, opacity: 0.34 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const MATS = {
    gray: new THREE.MeshPhysicalMaterial({ color: 0xc3c7cf, roughness: 0.32, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    metal: new THREE.MeshPhysicalMaterial({ color: 0xdfe3e6, roughness: 0.3, metalness: 0.6, clearcoat: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.55, metalness: 0.1 }),
    white: new THREE.MeshPhysicalMaterial({ color: 0xf2f2ee, roughness: 0.35, clearcoat: 0.6 }),
  };

  // ---------- Robot
  const robot = new THREE.Group();
  robot.rotation.x = -Math.PI / 2; // MuJoCo is z-up, three.js is y-up
  scene.add(robot);
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  let model, base, legs = {}, parts = [], ready = false;
  const labelEls = $$('#labels li');

  // Body pose (MuJoCo frame). The feet stay where they were put; the body moves over them.
  const pose = { x: 0, y: 0, h: STAND, roll: 0, pitch: 0, yaw: 0 };
  const goal = { ...pose };
  const FEET = Object.fromEntries(LEGS.map((l) => [l, new THREE.Vector3(HIPS[l][0], HIPS[l][1] + SIDE[l] * OFFSET, 0)]));
  const wave = { t: -1 };

  const pctEl = $('#introPct');
  const shownPct = { v: 0 };
  const setPct = (p) => { if (playIntro) gsap.to(shownPct, { v: p, duration: 0.35, overwrite: true, onUpdate: () => { pctEl.textContent = Math.round(shownPct.v); } }); };

  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('assets/models/go2.glb', (gltf) => {
    model = gltf.scene;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = MATS[o.material.name] || o.material;
      o.castShadow = o.receiveShadow = true;
    });
    robot.add(model);
    base = model.getObjectByName('base');
    legs = Object.fromEntries(LEGS.map((l) => [l, ['hip', 'thigh', 'calf'].map((s) => model.getObjectByName(`${l}_${s}`))]));
    // exploded view: body up, hips out, thighs further out, calves down
    parts = [{ node: base, home: base.position.clone(), dir: new THREE.Vector3(0, 0, 1), gap: 0.05, isBase: true }];
    for (const l of LEGS) {
      const [hip, thigh, calf] = legs[l];
      parts.push({ node: hip, home: hip.position.clone(), dir: new THREE.Vector3(Math.sign(HIPS[l][0]), SIDE[l], 0).normalize(), gap: 0.07 });
      parts.push({ node: thigh, home: thigh.position.clone(), dir: new THREE.Vector3(0, SIDE[l], 0), gap: 0.06 });
      parts.push({ node: calf, home: calf.position.clone(), dir: new THREE.Vector3(0, 0, -1), gap: 0.06 });
    }
    if (playIntro) { pose.h = LIE; goal.h = LIE; }   // the intro starts lying down
    applyPose();
    model.updateMatrixWorld(true);
    labelEls.forEach((li) => {
      const node = model.getObjectByName(li.dataset.part);
      li._node = node;
      if (li.dataset.offset) { li._local = new THREE.Vector3(...li.dataset.offset.split(' ').map(Number)); return; }
      const box = new THREE.Box3();
      const toLocal = new THREE.Matrix4().copy(node.matrixWorld).invert();
      node.children.filter((c) => !c.name).forEach((c) => c.traverse((m) => {
        if (!m.isMesh) return;
        m.geometry.computeBoundingBox();
        box.union(m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, m.matrixWorld)));
      }));
      li._local = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    });
    ready = true;
    if (hasGsap) html.classList.add('has-stage');
    if (playIntro) runIntro(); else endIntro();
  }, (e) => { if (e.total) setPct((e.loaded / e.total) * 100); }, () => { canvas.remove(); endIntro(); });

  // ---------- Body pose -> 12 joint angles
  const R = new THREE.Matrix4(), Rt = new THREE.Matrix4(), euler = new THREE.Euler(0, 0, 0, 'ZYX');
  const B = new THREE.Vector3(), f = new THREE.Vector3(), q = new THREE.Quaternion();
  function applyPose(t = 0) {
    euler.set(pose.roll, pose.pitch, pose.yaw);
    base.quaternion.setFromEuler(euler);
    B.set(pose.x, pose.y, pose.h);
    base.position.copy(B);
    R.makeRotationFromEuler(euler);
    Rt.copy(R).transpose();
    for (const l of LEGS) {
      f.copy(FEET[l]);
      if (l === 'FR' && wave.t >= 0) {
        const k = Math.sin(Math.min(1, wave.t / 1.6) * Math.PI);            // up, hold, down
        f.x += 0.11 * k; f.y -= 0.02 * k; f.z += (0.15 + 0.035 * Math.sin(t * 11)) * k;
      }
      f.sub(B).applyMatrix4(Rt);                                           // foot in the body frame
      const [a, th, kn] = legIK(l, f.x - HIPS[l][0], f.y - HIPS[l][1], f.z);
      const [hip, thigh, calf] = legs[l];
      hip.quaternion.copy(q.setFromAxisAngle(X, a));
      thigh.quaternion.copy(q.setFromAxisAngle(Y, th));
      calf.quaternion.copy(q.setFromAxisAngle(Y, kn));
    }
  }

  // ---------- Intro: point cloud of the dog lying down, then it stands up like the real one after power-on
  let cloud = null, introTl = null;
  function runIntro() {
    setPct(100);
    model.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(robot.matrixWorld).invert();
    const pos = [], from = [];
    const v = new THREE.Vector3(), M = new THREE.Matrix4();
    model.traverse((m) => {
      if (!m.isMesh) return;
      M.multiplyMatrices(inv, m.matrixWorld);
      const attr = m.geometry.attributes.position;
      for (let i = 0; i < attr.count; i += 2) {
        v.fromBufferAttribute(attr, i).applyMatrix4(M);
        pos.push(v.x, v.y, v.z);
        const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 0.9;
        from.push(v.x + Math.cos(a) * r, v.y + Math.sin(a) * r, v.z + Math.random() * 0.8);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aFrom', new THREE.Float32BufferAttribute(from, 3));
    const u = { uT: { value: 0 }, uFade: { value: 1 }, uSize: { value: 2.1 * renderer.getPixelRatio() } };
    cloud = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false,
      vertexShader: `uniform float uT, uSize; attribute vec3 aFrom;
        void main() { vec4 mv = modelViewMatrix * vec4(mix(aFrom, position, uT), 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize; }`,
      fragmentShader: `uniform float uFade; void main() { if (length(gl_PointCoord - 0.5) > 0.5) discard; gl_FragColor = vec4(0.059, 0.094, 0.188, uFade); }`,
    }));
    robot.add(cloud);
    model.visible = false;
    const label = $('#introLabel');
    introTl = gsap.timeline({ onComplete: endIntro })
      .call(() => { label.textContent = 'Assembling from a point cloud'; })
      .to(u.uT, { value: 1, duration: 1.0, ease: 'power3.out' })
      .call(() => { model.visible = true; label.textContent = 'Standing up'; })
      .to(u.uFade, { value: 0, duration: 0.35 }, '<')
      .to(goal, { h: STAND + 0.012, duration: 0.75, ease: 'power2.out' }, '+=0.1')
      .to(goal, { h: STAND, duration: 0.3, ease: 'power1.inOut' });
    const skip = () => introTl && introTl.progress(1);
    $('#introSkip').addEventListener('click', skip, { once: true });
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('wheel', skip, { once: true, passive: true });
    window.addEventListener('touchstart', skip, { once: true, passive: true });
  }
  function endIntro() {
    introTl = null;
    if (cloud) { robot.remove(cloud); cloud.geometry.dispose(); cloud = null; }
    if (model) { model.visible = true; goal.h = STAND; }
    try { sessionStorage.setItem('introSeen', '1'); } catch { /* ignore */ }
    html.classList.remove('intro-on');
    lenis?.start();
  }

  // ---------- Cursor: the dog watches it
  const ndc = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane();
  const watch = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
  const hint = $('#hint');
  let lastPointer = -1e9, moves = 0;
  // auteur-allow: POINTER_NO_RAF -- the handler only stores numbers; the single render loop reads them once per frame
  window.addEventListener('pointermove', (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    lastPointer = performance.now();
    if (++moves > 40) hint?.classList.add('is-gone');
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, input, label, dialog, .sphere, .reveal, .askbox')) return;
    if (state.ik > 0.5 && wave.t < 0) wave.t = 0;
  });

  function updateGoal(t) {
    if (t - lastPointer < 3000) {
      // cursor ray against a vertical plane in front of the dog, in three.js space, then into MuJoCo space
      ray.setFromCamera(ndc, camera);
      plane.setFromNormalAndCoplanarPoint(tmp.set(camera.position.x, 0, camera.position.z).normalize(), tmp.clone().multiplyScalar(0.25).setY(0.25));
      if (ray.ray.intersectPlane(plane, watch)) look.set(watch.x, -watch.z, watch.y);
    } else if (!reduce) {
      const s = t / 1000; // idle: looks around slowly
      look.set(0.8, 0.35 * Math.sin(s * 0.5), 0.3 + 0.1 * Math.sin(s * 0.8));
    }
    const dx = look.x, dy = look.y, dz = look.z - STAND;
    const c = THREE.MathUtils.clamp;
    goal.yaw = c(Math.atan2(dy, Math.max(0.2, dx)) * 0.7, -0.4, 0.4);
    goal.pitch = c(-Math.atan2(dz, Math.hypot(dx, dy)) * 0.55, -0.28, 0.24);
    goal.roll = c(-goal.yaw * 0.25, -0.12, 0.12);
    goal.x = c(dx * 0.02, -0.02, 0.03);
    if (!introTl) goal.h = STAND + c(dz * 0.05, -0.03, 0.02);
  }

  // ---------- Camera
  const narrow = () => innerWidth < 760;
  const state = { az: 38, el: 11, dist: 2.05, ty: 0.2, pan: 0.2, panY: 0, ik: 1, explode: 0 };
  if (narrow()) Object.assign(state, { pan: 0, panY: 0.2, dist: 1.8 });
  function placeCamera() {
    const aspect = innerWidth / innerHeight;
    let d = state.dist;
    if (aspect < 1) d *= Math.max(1, 1 + (0.78 - aspect) * 1.5);
    const az = THREE.MathUtils.degToRad(state.az), el = THREE.MathUtils.degToRad(state.el);
    camera.position.set(Math.cos(el) * Math.cos(az) * d, Math.sin(el) * d + state.ty, Math.cos(el) * Math.sin(az) * d);
    camera.lookAt(0, state.ty, 0);
    camera.setViewOffset(innerWidth, innerHeight, -state.pan * innerWidth, -state.panY * innerHeight, innerWidth, innerHeight);
  }
  let W = 0, H = 0;
  const leaders = $('#leaders');
  function resize() {
    if (W === innerWidth && H === innerHeight) return;
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    leaders.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }

  // ---------- Scroll
  const anatomy = $('#anatomy');
  if (hasGsap && !reduce) {
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } })
      .to(state, { pan: 0, panY: 0, ik: 0, ease: 'none' });
    gsap.timeline({
      scrollTrigger: { trigger: anatomy, start: 'top top', end: () => '+=' + innerHeight * (narrow() ? 2.2 : 2.6), pin: '.anatomy__pin', scrub: 0.6, invalidateOnRefresh: true },
    })
      .to(state, { az: -40, el: 20, dist: 1.85, pan: narrow() ? 0 : 0.12, duration: 0.4, ease: 'power1.inOut' }, 0)
      .to(state, { explode: 1, duration: 0.3, ease: 'power2.inOut' }, 0.12)
      .to(state, { az: -62, duration: 0.38, ease: 'none' }, 0.42)
      .to(state, { explode: 0, duration: 0.2, ease: 'power2.inOut' }, 0.8);
  } else if (hasGsap) {
    const heroState = { ...state };
    const anatomyState = { pan: narrow() ? 0 : 0.12, panY: 0, ik: 0, az: -48, el: 20, dist: 1.85, explode: 1 };
    ScrollTrigger.create({ trigger: anatomy, start: 'top 60%', end: 'bottom 40%', onToggle: (s) => Object.assign(state, s.isActive ? anatomyState : heroState) });
  }

  // ---------- Callouts
  const lines = labelEls.map(() => {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', 4.5);
    leaders.append(l, c);
    return { l, c };
  });
  const vW = new THREE.Vector3();
  const setLine = (i, x1, y1, x2, y2) => {
    const { l, c } = lines[i];
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    c.setAttribute('cx', x2); c.setAttribute('cy', y2);
  };
  function updateLabels() {
    const alpha = THREE.MathUtils.smoothstep(state.explode, 0.7, 1);
    leaders.style.opacity = alpha;
    if (alpha <= 0) { labelEls.forEach((li) => { li.style.opacity = 0; }); return; }
    const pinTop = $('.anatomy__pin').getBoundingClientRect().top;
    const pts = labelEls.map((li) => {
      li._node.localToWorld(vW.copy(li._local)).project(camera);
      return { li, x: (vW.x * 0.5 + 0.5) * W, y: (-vW.y * 0.5 + 0.5) * H };
    });
    if (narrow()) {
      const idx = Math.min(labelEls.length - 1, Math.floor(THREE.MathUtils.clamp((state.az + 40) / -22, 0, 0.999) * labelEls.length));
      pts.forEach((p, i) => {
        const on = i === idx;
        p.li.style.opacity = on ? alpha : 0;
        lines[i].l.style.opacity = lines[i].c.style.opacity = on ? 1 : 0;
        const r = p.li.getBoundingClientRect();
        setLine(i, r.left + r.width / 2, r.top - pinTop, p.x, p.y - pinTop);
      });
      return;
    }
    const byX = [...pts].sort((a, b) => a.x - b.x);
    const nLeft = Math.min(2, byX.filter((p) => p.x < W * 0.52).length);
    const cols = { left: byX.slice(0, nLeft), right: byX.slice(nLeft) };
    const gut = Math.max(16, Math.min(56, W * 0.04));
    const lw = labelEls[0].offsetWidth;
    for (const [side, list] of Object.entries(cols)) {
      list.sort((a, b) => a.y - b.y);
      const top = side === 'left' ? H * 0.58 : H * 0.16;
      const span = H * 0.86 - top;
      list.forEach((p, k) => {
        const x = side === 'left' ? gut : W - gut - lw;
        const y = top + (list.length === 1 ? span / 2 : (span * k) / (list.length - 1)) - 20;
        p.li.style.transform = `translate(${x}px, ${y}px)`;
        p.li.style.opacity = alpha;
        const i = labelEls.indexOf(p.li);
        lines[i].l.style.opacity = lines[i].c.style.opacity = 1;
        setLine(i, side === 'left' ? x + lw + 12 : x - 12, y + 12, p.x, p.y - pinTop);
      });
    }
  }

  // ---------- One loop
  let last = performance.now();
  function frame() {
    const visible = anatomy.getBoundingClientRect().bottom > 0;
    canvas.classList.toggle('is-off', !visible);
    if (!visible || !ready) return;
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    resize();
    placeCamera();
    if (!introTl) {
      if (state.ik > 0.02) updateGoal(now);
      // blend toward a square display stance as the hero scrolls away
      const k = 1 - state.ik;
      for (const p of ['yaw', 'pitch', 'roll', 'x']) goal[p] *= 1 - k;
      if (k > 0.98) goal.h = STAND;
    }
    const ease = reduce ? 0.06 : 0.1;
    for (const p in pose) pose[p] += (goal[p] - pose[p]) * (p === 'h' && introTl ? 1 : ease);
    if (!reduce) pose.h += Math.sin(now / 700) * 0.0006 * state.ik;         // breathing
    if (wave.t >= 0) { wave.t += dt; if (wave.t > 1.6) wave.t = -1; }
    applyPose(now / 1000);
    parts.forEach((p) => {
      if (p.isBase) p.node.position.z = pose.h + p.gap * state.explode;
      else p.node.position.copy(p.home).addScaledVector(p.dir, p.gap * state.explode);
    });
    renderer.render(scene, camera);
    updateLabels();
  }
  if (hasGsap) gsap.ticker.add(frame); else renderer.setAnimationLoop(frame);
}

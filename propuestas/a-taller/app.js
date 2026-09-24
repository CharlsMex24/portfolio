/* Option A, "Taller": one fixed WebGL stage with a Franka Panda arm.
   Hero: the gripper follows the cursor (CCD inverse kinematics within the real joint limits).
   Anatomy: scroll orbits the camera and pulls the arm apart at its joints, with callouts.
   Reduced motion: no pinning or scrubbing; the scene cuts between the two states. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initCommon, $, $$ } from '../shared/common.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const { hasGsap } = initCommon({ reduce });

// The case-study clip plays only while it is on screen
const video = $('.exo__media video');
if (video) {
  if (reduce) video.controls = true;
  else new IntersectionObserver(([e]) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause()), { threshold: 0.25 }).observe(video);
}

const canvas = $('#stage');
const anatomy = $('#anatomy');
const hint = $('#hint');
const labelEls = $$('#labels li');
const leaders = $('#leaders');

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) renderer = null;
} catch { renderer = null; }
if (renderer) boot(); else canvas.remove();

function boot() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);

  // Soft studio reflections for the paint, one hard key for shape, the orange floor bouncing back up.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  const key = new THREE.DirectionalLight(0xfff3ea, 2.3);
  key.position.set(-1.4, 3.1, 2.3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -1.3, right: 1.3, top: 1.4, bottom: -1.1, near: 0.5, far: 8 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 6;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe4602d, 0.85));
  const rim = new THREE.DirectionalLight(0xffe6da, 1.0);
  rim.position.set(2.4, 1.8, -2.2);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ color: 0x5a1c05, opacity: 0.32 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const paint = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.2, ...extra });
  const MATS = {
    white: paint(0xf4f4f1),
    off_white: paint(0xdcdfe1, { roughness: 0.5, clearcoat: 0.25 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1a1c21, roughness: 0.5, metalness: 0.15 }),
    light_blue: new THREE.MeshStandardMaterial({ color: 0x1d8fd0, roughness: 0.3, emissive: 0x0a5a8a, emissiveIntensity: 0.5 }),
    green: new THREE.MeshStandardMaterial({ color: 0x5dff9a, emissive: 0x2bd46a, emissiveIntensity: 1.1 }),
  };

  // ---------- Robot
  const robot = new THREE.Group();
  robot.rotation.x = -Math.PI / 2; // MuJoCo is z-up, three.js is y-up
  scene.add(robot);

  const Z = new THREE.Vector3(0, 0, 1);
  // Real Panda limits (rad) from the MJCF, and two poses: one to reach from, one to display
  const LIMITS = [[-2.8973, 2.8973], [-1.7628, 1.7628], [-2.8973, 2.8973], [-3.0718, -0.0698], [-2.8973, 2.8973], [-0.0175, 3.7525], [-2.8973, 2.8973]];
  const REST = [0, -0.35, 0, -2.2, 0, 1.95, 0.785];
  const DISPLAY = [0.35, 0.1, -0.25, -1.75, 0.1, 1.75, 0.6];
  const angles = REST.slice();
  let J = [], q0 = [], hand, fingers = [], fingerHome = [], parts = [], ready = false;

  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('models/panda.glb', (gltf) => {
    const model = gltf.scene;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = MATS[o.material.name] || o.material;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    robot.add(model);

    J = ['link1', 'link2', 'link3', 'link4', 'link5', 'link6', 'link7'].map((n) => model.getObjectByName(n));
    q0 = J.map((j) => j.quaternion.clone());
    hand = model.getObjectByName('hand');
    fingers = ['left_finger', 'right_finger'].map((n) => model.getObjectByName(n));
    fingerHome = fingers.map((f) => ({ p: f.position.clone(), dir: new THREE.Vector3(0, 1, 0).applyQuaternion(f.quaternion) }));

    // Exploded view: every module slides off its parent along its own joint axis
    parts = ['link1', 'link2', 'link3', 'link4', 'link5', 'link6', 'link7', 'hand'].map((n, i) => {
      const node = model.getObjectByName(n);
      return { node, home: node.position.clone(), dir: Z.clone().applyQuaternion(node.quaternion), gap: i === 7 ? 0.08 : 0.1 };
    });

    // Callout anchors: the visual centre of each labelled part's own meshes, in that part's frame
    model.updateMatrixWorld(true);
    labelEls.forEach((li) => {
      const node = model.getObjectByName(li.dataset.part);
      const box = new THREE.Box3();
      node.children.filter((c) => !c.name).forEach((c) => c.traverse((m) => {
        if (!m.isMesh) return;
        m.geometry.computeBoundingBox();
        const b = m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(
          new THREE.Matrix4().copy(node.matrixWorld).invert(), m.matrixWorld));
        box.union(b);
      }));
      li._node = node;
      li._local = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    });

    angles.forEach((_, i) => applyJoint(i));
    ready = true;
    if (hasGsap) document.documentElement.classList.add('has-stage');
  }, undefined, () => canvas.remove());

  const qTmp = new THREE.Quaternion();
  function applyJoint(i) {
    J[i].quaternion.copy(q0[i]).multiply(qTmp.setFromAxisAngle(Z, angles[i]));
  }

  // ---------- Inverse kinematics (cyclic coordinate descent on the tool point)
  const TCP = new THREE.Vector3(0, 0, 0.105);
  const vE = new THREE.Vector3(), vP = new THREE.Vector3(), vA = new THREE.Vector3();
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), qW = new THREE.Quaternion();
  function solveIK(target, gain) {
    for (let it = 0; it < 5; it++) {
      for (let i = 6; i >= 0; i--) {
        robot.updateMatrixWorld(true);
        hand.localToWorld(vE.copy(TCP));
        J[i].getWorldPosition(vP);
        vA.copy(Z).applyQuaternion(J[i].getWorldQuaternion(qW));
        va.subVectors(vE, vP).addScaledVector(vA, -vA.dot(vE.clone().sub(vP)));
        vb.subVectors(target, vP).addScaledVector(vA, -vA.dot(target.clone().sub(vP)));
        if (va.lengthSq() < 1e-8 || vb.lengthSq() < 1e-8) continue;
        const step = Math.atan2(vA.dot(vc.crossVectors(va, vb)), va.dot(vb));
        angles[i] = THREE.MathUtils.clamp(angles[i] + THREE.MathUtils.clamp(step, -0.1, 0.1) * gain, LIMITS[i][0], LIMITS[i][1]);
        applyJoint(i);
      }
    }
  }

  // ---------- Pointer to target: a ray against a plane in front of the arm
  const ndc = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane();
  const planePoint = new THREE.Vector3(0.3, 0.55, 0.1);
  const rawTarget = new THREE.Vector3(0.45, 0.5, 0.15);
  const target = rawTarget.clone();
  const shoulder = new THREE.Vector3(0, 0.333, 0);
  let lastPointer = -1e9;
  let moves = 0;
  // auteur-allow: POINTER_NO_RAF -- the handler only stores numbers; the single render loop reads them once per frame
  window.addEventListener('pointermove', (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    lastPointer = performance.now();
    if (++moves > 40) hint?.classList.add('is-gone');
  }, { passive: true });
  let grip = 0.04, gripTarget = 0.04;
  window.addEventListener('pointerdown', (e) => { if (!e.target.closest('a, button, input, label, dialog')) gripTarget = 0; });
  window.addEventListener('pointerup', () => { gripTarget = 0.04; });

  function updateTarget(t) {
    if (t - lastPointer < 2500) {
      ray.setFromCamera(ndc, camera);
      plane.setFromNormalAndCoplanarPoint(vc.set(camera.position.x, 0, camera.position.z).normalize(), planePoint);
      ray.ray.intersectPlane(plane, rawTarget);
    } else if (!reduce) {
      const s = t / 1000; // idle: a slow figure-eight in front of the arm
      rawTarget.set(0.42 + 0.12 * Math.sin(s * 0.7), 0.5 + 0.16 * Math.sin(s * 1.1), 0.25 * Math.sin(s * 0.55));
    }
    // keep it reachable and above the floor
    rawTarget.y = Math.max(rawTarget.y, 0.12);
    const off = vc.subVectors(rawTarget, shoulder);
    if (off.length() > 0.72) rawTarget.copy(shoulder).addScaledVector(off.normalize(), 0.72);
    target.lerp(rawTarget, reduce ? 0.05 : 0.09);
  }

  // ---------- Camera: orbit + a view offset that slides the arm across the frame
  const state = { az: 34, el: 9, dist: 3.15, ty: 0.5, pan: 0.2, panY: 0, ik: 1, explode: 0 };
  const narrow = () => innerWidth < 760;
  if (narrow()) Object.assign(state, { pan: 0, panY: 0.2, dist: 2.6 });
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
  function resize() {
    if (W === innerWidth && H === innerHeight) return;
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    leaders.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }

  // ---------- Scroll: hero hands over to the anatomy scene
  if (hasGsap && !reduce) {
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } })
      .to(state, { pan: 0, panY: 0, ik: 0, ease: 'none' });
    gsap.timeline({
      scrollTrigger: { trigger: anatomy, start: 'top top', end: () => '+=' + innerHeight * (narrow() ? 2.2 : 2.6), pin: '.anatomy__pin', scrub: 0.6, invalidateOnRefresh: true },
    })
      .to(state, { az: -32, el: 15, dist: 2.85, pan: narrow() ? 0 : 0.14, duration: 0.4, ease: 'power1.inOut' }, 0)
      .to(state, { explode: 1, duration: 0.3, ease: 'power2.inOut' }, 0.12)
      .to(state, { az: -50, duration: 0.38, ease: 'none' }, 0.42)
      .to(state, { explode: 0, duration: 0.2, ease: 'power2.inOut' }, 0.8);
    // reveals and counters were created before this pin; measure them again with it in place
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  } else if (hasGsap) {
    // Reduced motion: a straight cut between the two states, nothing travels on its own
    const heroState = { ...state };
    const anatomyState = { pan: narrow() ? 0 : 0.1, panY: 0, ik: 0, az: -40, el: 15, dist: 2.85, explode: 1 };
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
  function updateLabels() {
    const alpha = THREE.MathUtils.smoothstep(state.explode, 0.7, 1);
    leaders.style.opacity = alpha;
    if (alpha <= 0) { labelEls.forEach((li) => { li.style.opacity = 0; }); return; }
    const pinRect = $('.anatomy__pin').getBoundingClientRect();
    const pts = labelEls.map((li) => {
      li._node.localToWorld(vW.copy(li._local));
      vW.project(camera);
      return { li, x: (vW.x * 0.5 + 0.5) * W, y: (-vW.y * 0.5 + 0.5) * H };
    });
    if (narrow()) {
      // one caption at a time on phones, following the scroll through the exploded hold
      const idx = Math.min(labelEls.length - 1, Math.floor(THREE.MathUtils.clamp((state.az + 32) / -18, 0, 0.999) * labelEls.length));
      pts.forEach((p, i) => {
        const on = i === idx;
        p.li.style.opacity = on ? alpha : 0;
        lines[i].l.style.opacity = lines[i].c.style.opacity = on ? 1 : 0;
        const r = p.li.getBoundingClientRect();
        setLine(i, r.left + r.width / 2, r.top - pinRect.top, p.x, p.y - pinRect.top);
      });
      return;
    }
    // Each callout goes to the side its part is on, ordered top to bottom, so leaders never cross
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
        setLine(i, side === 'left' ? x + lw + 12 : x - 12, y + 12, p.x, p.y - pinRect.top);
      });
    }
  }
  function setLine(i, x1, y1, x2, y2) {
    const { l, c } = lines[i];
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    c.setAttribute('cx', x2); c.setAttribute('cy', y2);
  }

  // ---------- One loop for everything
  const tmpV = new THREE.Vector3();
  function frame() {
    const visible = anatomy.getBoundingClientRect().bottom > 0;
    canvas.classList.toggle('is-off', !visible);
    if (!visible || !ready) return;
    resize();
    placeCamera();
    const t = performance.now();

    if (state.ik > 0.02) {
      updateTarget(t);
      solveIK(target, state.ik);
      for (let i = 0; i < 7; i++) { angles[i] += (REST[i] - angles[i]) * 0.012; applyJoint(i); } // light pull toward a natural pose
    }
    if (state.ik < 0.98) {
      const k = (1 - state.ik) * 0.12;
      for (let i = 0; i < 7; i++) { angles[i] += (DISPLAY[i] - angles[i]) * k; applyJoint(i); }
    }

    grip += (gripTarget - grip) * 0.2;
    fingers.forEach((f, i) => f.position.copy(fingerHome[i].p).addScaledVector(fingerHome[i].dir, grip));
    parts.forEach((p) => p.node.position.copy(p.home).addScaledVector(p.dir, p.gap * state.explode));

    renderer.render(scene, camera);
    updateLabels();
  }
  if (hasGsap) gsap.ticker.add(frame); else renderer.setAnimationLoop(frame);
}

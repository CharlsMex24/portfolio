/* Project index as a sphere of cards (idea from bleibtgleich.dev).
   Cards come from the #projectList links, so the list is also the no-WebGL fallback.
   Drag to spin (with inertia), hover to see the title, click to open the project. */
import * as THREE from 'three';
import { $, $$ } from './ui.js';

// auteur-allow: WEBGL_NO_REDUCED_MOTION -- prefers-reduced-motion is read once in main.js and passed in as `reduce`; this scene branches on it
export async function initSphere({ reduce, lenis }) {
  const wrap = $('#sphere');
  if (!wrap) return;
  const canvas = $('canvas', wrap);
  const tip = $('#sphereTip');
  const hint = $('#sphereHint');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    if (!renderer.getContext()) throw new Error('no webgl');
  } catch { wrap.remove(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const ball = new THREE.Group();
  ball.rotation.set(0.25, -0.6, 0);
  scene.add(ball);

  // Two cards are drawn, not photographed: the Mostla agent has no public screenshot.
  await document.fonts.load('800 90px Archivo').catch(() => {});
  function textCard(kind) {
    const c = Object.assign(document.createElement('canvas'), { width: 960, height: 600 });
    const g = c.getContext('2d');
    const dark = kind === 'agent';
    g.fillStyle = dark ? '#0f1830' : '#e4602d';
    g.fillRect(0, 0, 960, 600);
    g.fillStyle = dark ? '#f1f1ef' : '#0f1830';
    g.font = '800 104px Archivo, sans-serif';
    const lines = dark ? ['No quote,', 'no answer.'] : ['Ask my', 'portfolio.'];
    lines.forEach((l, i) => g.fillText(l, 64, 230 + i * 118));
    g.font = '600 36px Archivo, sans-serif';
    g.fillStyle = dark ? '#e4602d' : '#f1f1ef';
    g.fillText(dark ? 'Mostla AI agent' : 'A grounded Claude agent', 64, 530);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const items = $$('#projectList a').map((a) => ({ href: a.getAttribute('href'), title: a.textContent.trim(), img: a.dataset.img }));
  const loader = new THREE.TextureLoader();
  const R = 2.5;
  const cards = items.map((it, i) => {
    // spread the cards evenly with a Fibonacci spiral
    const y = 1 - ((i + 0.5) / items.length) * 2, r = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
    const dir = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.copy(dir).multiplyScalar(R);
    mesh.lookAt(dir.clone().multiplyScalar(R * 2));
    mesh.userData = { ...it, dir, hover: 0, base: new THREE.Vector3(1, 1, 1) };
    const setTexture = (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex;
      mat.needsUpdate = true;
      const aspect = Math.min(tex.image.width / tex.image.height, 1.7);
      mesh.userData.base.set(1.3 * aspect, 1.3, 1);
      mesh.scale.copy(mesh.userData.base);
    };
    if (it.img.startsWith('card:')) setTexture(textCard(it.img.slice(5)));
    else loader.load(it.img, setTexture);
    ball.add(mesh);
    return mesh;
  });

  // ---------- Interaction
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(9, 9);
  let vx = reduce ? 0 : 0.002, vy = 0, dragging = false, moved = 0, lastX = 0, lastY = 0, hovered = null;
  const qa = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  const setNdc = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
  };
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  // auteur-allow: POINTER_NO_RAF -- the handler stores velocities and the pointer; the render loop applies them once per frame
  canvas.addEventListener('pointermove', (e) => {
    setNdc(e);
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    vx = dx * 0.006; vy = dy * 0.006;
    hint.classList.add('is-gone');
  });
  const open = (href) => (lenis ? lenis.scrollTo(href) : document.querySelector(href)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }));
  canvas.addEventListener('pointerup', () => {
    dragging = false;
    if (moved < 6 && hovered) open(hovered.userData.href);
  });
  canvas.addEventListener('pointerleave', () => { ndc.set(9, 9); });

  // ---------- Loop, only while the section is on screen
  const normal = new THREE.Vector3();
  function frame() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = (R + 1.1) / Math.tan(THREE.MathUtils.degToRad(16)) / Math.min(1, camera.aspect);
      camera.updateProjectionMatrix();
    }
    if (!dragging) {
      vx *= 0.95; vy *= 0.95;
      if (!reduce) vx += (0.0018 - vx) * 0.02; // settles into a slow idle spin
    }
    ball.quaternion.premultiply(qa.setFromAxisAngle(Y, vx)).premultiply(qa.setFromAxisAngle(X, vy));
    ball.updateMatrixWorld(true);

    ray.setFromCamera(ndc, camera);
    const hit = dragging ? null : ray.intersectObjects(cards, false).find((h) => normal.copy(h.object.userData.dir).applyQuaternion(ball.quaternion).z > 0.1);
    hovered = hit ? hit.object : null;
    canvas.style.cursor = hovered ? 'pointer' : '';
    tip.textContent = hovered ? hovered.userData.title : tip.textContent;
    tip.style.opacity = hovered ? 1 : 0;

    for (const c of cards) {
      const facing = normal.copy(c.userData.dir).applyQuaternion(ball.quaternion).z; // 1 = facing the camera
      c.material.opacity = 0.15 + 0.85 * THREE.MathUtils.smoothstep(facing, -0.3, 0.55);
      c.userData.hover += ((c === hovered ? 1 : 0) - c.userData.hover) * 0.2;
      c.scale.copy(c.userData.base).multiplyScalar(1 + 0.14 * c.userData.hover);
    }
    renderer.render(scene, camera);
  }
  new IntersectionObserver(([e]) => renderer.setAnimationLoop(e.isIntersecting ? frame : null), { rootMargin: '100px' }).observe(wrap);
}

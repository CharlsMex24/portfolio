/* Ending portrait made of points (idea from behfar.dev).
   Bright pixels of the photo become points; dark ones disappear. The points fly in when the section
   arrives and move out of the cursor's way. Swap PHOTO and CROP for a new portrait. */
import * as THREE from 'three';
import { $ } from './ui.js';

const PHOTO = 'assets/images/profile/Carlos_Velasco.jpeg';
const CROP = { x: 292, y: 196, w: 236, h: 337 };   // head and shoulders inside the photo, in pixels

// auteur-allow: WEBGL_NO_REDUCED_MOTION -- prefers-reduced-motion is read once in main.js and passed in as `reduce`; this scene branches on it
export async function initFace({ reduce }) {
  const sec = $('#contact');
  const canvas = $('#face');
  const hint = $('#faceHint');
  if (!sec || !canvas) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    if (!renderer.getContext()) throw new Error('no webgl');
  } catch { canvas.remove(); hint?.remove(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0, 4.2);

  const img = new Image();
  img.src = PHOTO;
  try { await img.decode(); } catch { canvas.remove(); return; }
  const up = 1.6;
  const cw = Math.round(CROP.w * up), ch = Math.round(CROP.h * up);
  const c2 = Object.assign(document.createElement('canvas'), { width: cw, height: ch });
  const x2 = c2.getContext('2d', { willReadFrequently: true });
  x2.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, cw, ch);
  const data = x2.getImageData(0, 0, cw, ch).data;
  const pos = [], col = [], lum = [], scatter = [];
  const k = 2.2 / ch;
  for (let y = 0; y < ch; y += 2) for (let x = 0; x < cw; x += 2) {
    const i = (y * cw + x) * 4;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (L < 0.13) continue;                                     // dark areas disappear
    pos.push((x - cw / 2) * k, -(y - ch / 2) * k, L * 0.35);    // brighter points sit a little closer
    col.push(Math.min(1, r * 1.15), Math.min(1, g * 1.05), b * 0.95);
    lum.push(L);
    const a = Math.random() * Math.PI * 2, rr = 1.5 + Math.random() * 2.5;
    scatter.push(Math.cos(a) * rr, Math.sin(a) * rr, (Math.random() - 0.5) * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aLum', new THREE.Float32BufferAttribute(lum, 1));
  geo.setAttribute('aScatter', new THREE.Float32BufferAttribute(scatter, 3));
  const uniforms = {
    uTime: { value: 0 }, uProgress: { value: reduce ? 1 : 0 }, uMouse: { value: new THREE.Vector3(9, 9, 0) },
    uSize: { value: 3.2 * renderer.getPixelRatio() },
  };
  const face = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      uniform float uTime, uProgress, uSize; uniform vec3 uMouse;
      attribute vec3 aColor, aScatter; attribute float aLum;
      varying vec3 vColor; varying float vA;
      void main() {
        float t = smoothstep(0.0, 1.0, clamp(uProgress * 1.4 - aLum * 0.4, 0.0, 1.0)); // bright points land first
        vec3 p = mix(position + aScatter, position, t);
        vec2 d = p.xy - uMouse.xy;
        float f = smoothstep(0.34, 0.0, length(d));
        p.xy += normalize(d + 1e-4) * f * 0.22;
        p.z += f * 0.25 + sin(uTime * 1.3 + position.y * 7.0) * 0.006;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.45 + aLum) * (4.2 / -mv.z);
        vColor = aColor; vA = t;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        gl_FragColor = vec4(vColor, vA * smoothstep(0.5, 0.35, r));
      }`,
  }));
  scene.add(face);

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  let target = 0, tilt = 0;
  // auteur-allow: POINTER_NO_RAF -- the handler only updates a uniform and a number; the render loop draws once per frame
  sec.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) uniforms.uMouse.value.copy(face.worldToLocal(hit.clone()));
    tilt = ndc.x * 0.25;
    hint?.classList.add('is-gone');
  });
  sec.addEventListener('pointerleave', () => uniforms.uMouse.value.set(9, 9, 0));

  const fit = () => {
    const r = sec.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(15)), visW = visH * camera.aspect;
    const wide = r.width > 820;
    face.position.set(wide ? -visW / 4 : 0, wide ? 0 : visH * 0.27, 0);   // left half on desktop, top on phones
    face.scale.setScalar(wide ? 1 : Math.min(0.85, visW / 2.4));
  };
  new ResizeObserver(fit).observe(sec);
  const loop = (t) => {
    uniforms.uTime.value = t / 1000;
    uniforms.uProgress.value += (target - uniforms.uProgress.value) * (reduce ? 1 : 0.025);
    face.rotation.y += (tilt - face.rotation.y) * 0.05;
    renderer.render(scene, camera);
  };
  new IntersectionObserver(([e]) => {
    target = e.intersectionRatio > 0.3 ? 1 : 0;
    renderer.setAnimationLoop(e.isIntersecting ? loop : null);
  }, { threshold: [0, 0.3] }).observe(sec);
}

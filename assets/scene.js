// arshads.space — one point cloud that re-forms itself as you scroll.
// Shapes: 0 silicon die, 1 lidar sweep, 2 polar plot of the primes, 3 leaderboard columns, 4 globe.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.getElementById("gl");
const mobile = matchMedia("(max-width: 760px)").matches;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const N = mobile ? 14000 : 26000;

// ---------- deterministic randomness ----------
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

const C = {
  teal: new THREE.Color("#5ef0d0"),
  ice: new THREE.Color("#9ec9ff"),
  amber: new THREE.Color("#ffb347"),
  rose: new THREE.Color("#ff6f91"),
  violet: new THREE.Color("#a78bfa"),
  white: new THREE.Color("#f4f7ff"),
  dim: new THREE.Color("#3b4a66"),
};

// Fill N points from weighted parts: each part = [weight, (i) => [x,y,z,color]]
function build(parts) {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const total = parts.reduce((s, p) => s + p[0], 0);
  let i = 0;
  parts.forEach(([w, fn], k) => {
    const n = k === parts.length - 1 ? N - i : Math.round((N * w) / total);
    for (let j = 0; j < n && i < N; j++, i++) {
      const [x, y, z, c] = fn(j, n);
      pos.set([x, y, z], i * 3);
      col.set([c.r, c.g, c.b], i * 3);
    }
  });
  return { pos, col };
}
const rect = (x0, y0, w, h, c, z = 0) => () => [x0 + rnd() * w, y0 + rnd() * h, z + gauss() * 0.004, c];
const edge = (x0, y0, w, h, c) => () => {
  const t = rnd() * 2 * (w + h);
  const p = t < w ? [x0 + t, y0] : t < w + h ? [x0 + w, y0 + t - w] : t < 2 * w + h ? [x0 + w - (t - w - h), y0 + h] : [x0, y0 + h - (t - 2 * w - h)];
  return [p[0], p[1], 0, c];
};
function tilt(shape, rx, ry = 0) {
  const m = new THREE.Matrix4().makeRotationX(rx).multiply(new THREE.Matrix4().makeRotationY(ry));
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    v.fromArray(shape.pos, i * 3).applyMatrix4(m).toArray(shape.pos, i * 3);
  }
  return shape;
}

// 0 — SoC die: CPU cluster, GPU, NPU, memory channels, bond pads
function die() {
  const S = 2.3, h = S / 2;
  const parts = [
    [6, edge(-h, -h, S, S, C.ice)],
    [4, () => { // bond pads around the rim
      const side = Math.floor(rnd() * 4), k = Math.floor(rnd() * 28) / 27, a = -h + 0.1 + k * (S - 0.2);
      const jx = (rnd() - 0.5) * 0.05, jy = (rnd() - 0.5) * 0.05, o = h - 0.08;
      const p = [[a, -o], [o, a], [a, o], [-o, a]][side];
      return [p[0] + jx, p[1] + jy, 0, C.white];
    }],
  ];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { // 8 CPU cores
    const x = -0.95 + c * 0.25, y = 0.25 + r * 0.33;
    parts.push([3.2, rect(x, y, 0.2, 0.27, C.teal)], [1, edge(x, y, 0.2, 0.27, C.white)]);
  }
  parts.push(
    [14, rect(0.1, 0.12, 0.85, 0.75, C.amber)], [2, edge(0.1, 0.12, 0.85, 0.75, C.white)], // GPU
    [8, rect(-0.95, -0.55, 0.62, 0.5, C.violet)], [1.5, edge(-0.95, -0.55, 0.62, 0.5, C.white)], // NPU
    [6, () => [-0.25 + rnd() * 1.2, -0.95 + Math.floor(rnd() * 6) * 0.12 + gauss() * 0.006, 0, C.ice]], // memory channels
    [3, rect(-0.95, -0.95, 0.62, 0.3, C.rose)], // safety island
    [4, () => [(rnd() - 0.5) * S * 0.92, (rnd() - 0.5) * S * 0.92, 0, C.dim]], // substrate
  );
  return dim(tilt(build(parts), -0.62, 0.3), 0.5);
}

// 1 — lidar sweep around an ego vehicle, with three tracked objects
function lidar() {
  const boxes = [[1.1, 0.6, 0.5, 0.25], [-0.9, 1.2, 0.45, 0.22], [0.2, -1.3, 0.55, 0.25]];
  const parts = [
    [55, () => {
      const ring = Math.floor(Math.pow(rnd(), 0.8) * 26) + 1, r = ring * 0.085 + gauss() * 0.004;
      const a = rnd() * Math.PI * 2;
      const c = C.teal.clone().lerp(C.violet, Math.min(1, r / 2.2));
      return [Math.cos(a) * r, Math.sin(a) * r, gauss() * 0.01, c];
    }],
    [18, () => { // object surfaces (returns on parked/moving cars)
      const [bx, by, w, hgt] = boxes[Math.floor(rnd() * boxes.length)];
      const f = Math.floor(rnd() * 3);
      const x = bx + (f === 1 ? (rnd() < 0.5 ? 0 : w) : rnd() * w), y = by + (f === 2 ? (rnd() < 0.5 ? 0 : w * 0.5) : rnd() * w * 0.5);
      return [x, y, rnd() * hgt, C.amber];
    }],
    [8, () => { // ego vehicle
      const x = (rnd() - 0.5) * 0.36, y = (rnd() - 0.5) * 0.18, z = rnd() * 0.14;
      return [x, y, z, C.white];
    }],
    [10, () => { const a = 0.5 + gauss() * 0.04, r = rnd() * 2.4; return [Math.cos(a) * r, Math.sin(a) * r, 0.02, C.ice]; }], // beam
    [9, () => { const [bx, by, w] = boxes[Math.floor(rnd() * boxes.length)]; return [...edgeBox(bx, by, w, w * 0.5), 0.3, C.rose]; }],
  ];
  return tilt(build(parts), -1.05, 0);
}
function edgeBox(x, y, w, h) {
  const t = rnd() * 2 * (w + h);
  if (t < w) return [x + t, y];
  if (t < w + h) return [x + w, y + t - w];
  if (t < 2 * w + h) return [x + w - (t - w - h), y + h];
  return [x, y + h - (t - 2 * w - h)];
}

// 2 — primes in polar coordinates: each prime p sits at radius p, angle p radians.
// The arms and rays come from 44/7 and 710/113 approximating 2*pi.
function primes() {
  const want = 1e9, lim = 36000, sieve = new Uint8Array(lim);   // primes < 36,000: the 44-arm regime
  const list = [];
  for (let i = 2; i < lim && list.length < want; i++) {
    if (sieve[i]) continue;
    list.push(i);
    for (let j = i * i; j < lim; j += i) sieve[j] = 1;
  }
  const maxP = list[list.length - 1];
  let k = 0;
  const shape = build([
    [85, () => {
      const p = list[k++ % list.length], r = (p / maxP) * 2.3 + gauss() * 0.006, a = p + gauss() * 0.004;
      const c = C.amber.clone().lerp(C.rose, r / 2.3 * 0.5);
      return [Math.cos(a) * r, Math.sin(a) * r, gauss() * 0.01, c];
    }],
    [15, () => { const r = 2.4 + gauss() * 0.015, a = rnd() * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r, 0, C.dim]; }],
  ]);
  return dim(tilt(shape, -0.5, 0.2), 0.75);
}

// 3 — leaderboard: a field of score columns with one climbing out of it
function columnsIso() {
  seed = 99;
  const G = 9, cell = 0.36, cols = [];
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const d = Math.hypot(i - 6, j - 5);
    cols.push([(i - G / 2) * cell, (j - G / 2) * cell, 0.12 + 0.95 * Math.exp(-d * d / 9) + rnd() * 0.22]);
  }
  cols[6 * G + 5][2] = 2.1;
  const tot = cols.reduce((s, c) => s + c[2], 0);
  const shape = build([
    [88, () => {
      let t = rnd() * tot, c = cols[0];
      for (const cc of cols) { t -= cc[2]; if (t <= 0) { c = cc; break; } }
      const w = cell * 0.7, onWall = rnd() < 0.72;
      let x = c[0] + rnd() * w, y = c[1] + rnd() * w;
      if (onWall) { const s = Math.floor(rnd() * 4); if (s === 0) x = c[0]; else if (s === 1) x = c[0] + w; else if (s === 2) y = c[1]; else y = c[1] + w; }
      const z = onWall ? rnd() * c[2] : c[2];
      const col = c[2] > 2 ? C.amber.clone().lerp(C.white, (z / c[2]) * 0.7) : C.dim.clone().lerp(C.teal, Math.min(1, z / 1.2));
      return [x, y, z - 0.8, col];
    }],
    [12, () => [(rnd() - 0.5) * G * cell * 1.2, (rnd() - 0.5) * G * cell * 1.2, -0.8, C.dim]],
  ]);
  // stand the board up: z becomes height, then view from a raised corner
  const v = new THREE.Vector3(), m = new THREE.Matrix4().makeRotationX(-Math.PI / 2 + 0.55).multiply(new THREE.Matrix4().makeRotationZ(0.75));
  for (let i = 0; i < N; i++) {
    v.fromArray(shape.pos, i * 3);
    v.set(v.x, v.y, v.z).applyMatrix4(m).toArray(shape.pos, i * 3);
  }
  return shape;
}

// 4 — globe: Fibonacci sphere plus a ring of links
function globe() {
  const ga = Math.PI * (3 - Math.sqrt(5));
  return tilt(build([
    [80, (j, n) => {
      const y = 1 - (j / (n - 1)) * 2, r = Math.sqrt(1 - y * y), a = j * ga;
      const c = C.ice.clone().lerp(C.teal, (y + 1) / 2);
      return [Math.cos(a) * r * 1.5, y * 1.5, Math.sin(a) * r * 1.5, c];
    }],
    [20, () => { const a = rnd() * Math.PI * 2, r = 2.15 + gauss() * 0.015; return [Math.cos(a) * r, gauss() * 0.01, Math.sin(a) * r, C.amber]; }],
  ]), 0.35, 0);
}

// dense shapes saturate under additive blending + bloom, so each gets its own exposure
function dim(shape, k) { for (let i = 0; i < shape.col.length; i++) shape.col[i] *= k; return shape; }
const SHAPES = [die(), lidar(), primes(), dim(columnsIso(), 0.7), globe()];

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x05070c, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 7.2);

const geo = new THREE.BufferGeometry();
const rand = new Float32Array(N * 4);
for (let i = 0; i < N * 4; i++) rand[i] = rnd();
geo.setAttribute("position", new THREE.BufferAttribute(SHAPES[0].pos.slice(), 3));
geo.setAttribute("aPosB", new THREE.BufferAttribute(SHAPES[0].pos.slice(), 3));
geo.setAttribute("aColA", new THREE.BufferAttribute(SHAPES[0].col.slice(), 3));
geo.setAttribute("aColB", new THREE.BufferAttribute(SHAPES[0].col.slice(), 3));
geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 4));

const mat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uMix: { value: 0 }, uTime: { value: 0 }, uSize: { value: (mobile ? 2.3 : 2.0) * renderer.getPixelRatio() }, uPointer: { value: new THREE.Vector3(99, 99, 0) } },
  vertexShader: /* glsl */ `
    attribute vec3 aPosB; attribute vec3 aColA; attribute vec3 aColB; attribute vec4 aRand;
    uniform float uMix, uTime, uSize; uniform vec3 uPointer;
    varying vec3 vCol; varying float vA;
    void main() {
      float stagger = clamp(uMix * 1.6 - aRand.x * 0.6, 0.0, 1.0);
      float t = stagger * stagger * (3.0 - 2.0 * stagger);
      vec3 p = mix(position, aPosB, t);
      vec3 dir = normalize(aRand.yzw - 0.5);
      p += dir * sin(t * 3.14159) * (0.6 + aRand.x);           // scatter mid-flight
      p += 0.012 * vec3(sin(uTime * 0.9 + aRand.y * 40.0), cos(uTime * 0.7 + aRand.z * 40.0), sin(uTime * 0.8 + aRand.w * 40.0));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vec4 clip = projectionMatrix * mv;
      vec2 ndc = clip.xy / clip.w;
      float near = smoothstep(0.22, 0.0, distance(ndc, uPointer.xy));  // pointer lights points up
      gl_Position = clip;
      gl_PointSize = uSize * (0.6 + aRand.y * 0.9 + near * 1.6) * (7.0 / -mv.z);
      vCol = mix(aColA, aColB, t) * (0.62 + near * 1.2);
      vA = 0.55 + 0.45 * aRand.z;
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vCol; varying float vA;
    void main() {
      vec2 d = gl_PointCoord - 0.5; float r = dot(d, d);
      if (r > 0.25) discard;
      gl_FragColor = vec4(vCol, vA * smoothstep(0.25, 0.0, r));
    }`,
});
const cloud = new THREE.Points(geo, mat);
const rig = new THREE.Group();
rig.add(cloud);
scene.add(rig);

// faint background dust for depth
{
  const n = mobile ? 1200 : 2600, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) p.set([(rnd() - 0.5) * 30, (rnd() - 0.5) * 18, -6 - rnd() * 14], i * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x6f84b0, size: 0.03, transparent: true, opacity: 0.55, depthWrite: false })));
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), mobile ? 0.55 : 0.7, 0.5, 0.2);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- scroll → shape keyframes ----------
// every <section data-shape="k" data-x="0.3"> is a keyframe; the cloud morphs between neighbours.
const keys = [...document.querySelectorAll("[data-shape]")];
let pair = [0, 0];
function setPair(a, b) {
  if (pair[0] === a && pair[1] === b) return;
  pair = [a, b];
  geo.attributes.position.array.set(SHAPES[a].pos); geo.attributes.position.needsUpdate = true;
  geo.attributes.aPosB.array.set(SHAPES[b].pos); geo.attributes.aPosB.needsUpdate = true;
  geo.attributes.aColA.array.set(SHAPES[a].col); geo.attributes.aColA.needsUpdate = true;
  geo.attributes.aColB.array.set(SHAPES[b].col); geo.attributes.aColB.needsUpdate = true;
}
let targetX = 0, curX = 0, curMix = 0;
function onScroll() {
  const mid = scrollY + innerHeight * 0.5;
  // a shape is fully formed once its section's top reaches mid-screen, so tall sections never stall mid-morph
  const tops = keys.map((k) => k.offsetTop + Math.min(k.offsetHeight, innerHeight) * 0.5);
  let i = 0;
  while (i < tops.length - 1 && mid > tops[i + 1]) i++;
  const span = i < tops.length - 1 ? tops[i + 1] - tops[i] : 1;
  let f = i < tops.length - 1 ? (mid - tops[i]) / span : 0;
  f = Math.min(1, Math.max(0, (f - 0.25) / 0.5));         // hold each shape while its section is centred
  if (mid < tops[0]) f = 0;
  const a = +keys[i].dataset.shape, b = +(keys[i + 1] || keys[i]).dataset.shape;
  setPair(a, b);
  curMix = a === b ? 0 : f;
  const xa = +(keys[i].dataset.x || 0), xb = +((keys[i + 1] || keys[i]).dataset.x || 0);
  targetX = mobile ? 0 : xa + (xb - xa) * f;
}
addEventListener("scroll", onScroll, { passive: true });

const pointer = new THREE.Vector2(0, 0), ptr = new THREE.Vector2(99, 99);
addEventListener("pointermove", (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ptr.copy(pointer);
});
addEventListener("pointerleave", () => ptr.set(99, 99));

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  onScroll();
});

const clock = new THREE.Clock();
let shownMix = 0;
function frame() {
  const t = clock.getElapsedTime();
  shownMix += (curMix - shownMix) * 0.08;
  mat.uniforms.uMix.value = shownMix;
  mat.uniforms.uTime.value = t;
  mat.uniforms.uPointer.value.set(ptr.x, ptr.y, 0);
  curX += (targetX - curX) * 0.06;
  // data-x is a screen fraction: 0 = centre, 0.5 = three quarters across
  rig.position.x = curX * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
  const scale = mobile ? 0.82 : Math.min(1, 0.62 + camera.aspect * 0.12);
  rig.scale.setScalar(scale);
  rig.rotation.y += ((reduced ? 0 : Math.sin(t * 0.15) * 0.25) + pointer.x * 0.25 - rig.rotation.y) * 0.04;
  rig.rotation.x += (-pointer.y * 0.15 - rig.rotation.x) * 0.04;
  composer.render();
  requestAnimationFrame(frame);
}
onScroll();
shownMix = curMix;
frame();
document.documentElement.classList.add("gl-ready");

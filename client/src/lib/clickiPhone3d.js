/**
 * CLICKI — 3D iPhone hero. Sticky-scroll storytelling: a 3D phone sits in the
 * hero's `slot`, then flies across three "beat" sections as the page scrolls.
 * Ported from a designer-supplied vanilla module — kept close to the original
 * mechanics (world-space keyframes, canvas-drawn phone screen), but:
 *   - three.js is a local npm import (was esm.sh CDN) so it code-splits with
 *     the rest of the app instead of hitting a third-party host at runtime.
 *   - Draco decoding points at /draco/ (bundled from node_modules/three) —
 *     no external CDN dependency for the compressed model either.
 *   - The on-screen mockup carries no invented numbers (no fake like/view/
 *     payout counts) — see DEFAULT_SCREENS.
 *
 * mountClickiPhone({ canvas, stage, slot, beats, modelUrl, keys, screens })
 * Returns { destroy() }.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const DEFAULT_KEYS = [
  { x: 0, y: 0.03, ry: -0.14, rx: 0.02, rz: 0, s: 0.56 },    // hero: position comes from `slot`
  { x: -0.5, y: 0, ry: 0.62, rx: -0.03, rz: 0.07, s: 1.04 }, // beat 01 — phone on the left
  { x: 0.5, y: 0, ry: -0.85, rx: -0.06, rz: -0.05, s: 1.02 },// beat 02 — phone on the right
  { x: -0.48, y: 0, ry: 3.32, rx: 0.02, rz: 0.05, s: 0.98 }, // beat 03 — turned back toward camera
];

// No invented metrics: states only ("published" / "counted automatically" /
// "payout sent"), matching the real product's automation, not fabricated
// like/view/payout figures.
export const DEFAULT_SCREENS = [
  { mode: 'reel', badge: '● ОПУБЛИКОВАНО', handle: '@автор', caption: ['UGC-видео о продукте,', 'снято на телефон'], brand: 'CLICKI', note: 'ПРОСМОТРЫ РАСТУТ' },
  { mode: 'stats', kicker: 'ПОДТВЕРЖДЁННЫЕ ПРОСМОТРЫ', bars: [0.34, 0.46, 0.4, 0.58, 0.52, 0.7, 0.86], axis: 'СЧИТАЮТСЯ АВТОМАТИЧЕСКИ', note: 'Метрики подтягиваются из площадок без ручного ввода' },
  { mode: 'payout', kicker: 'ВЫПЛАТА ОТПРАВЛЕНА', sub: 'На карту автора', foot: 'CLICKI · АВТОМАТИЧЕСКИ' },
];

export function mountClickiPhone(opts) {
  const canvas = opts.canvas, stage = opts.stage, slot = opts.slot;
  const beats = Array.from(opts.beats || []);
  const keys = opts.keys || DEFAULT_KEYS;
  const screens = opts.screens || DEFAULT_SCREENS;
  const modelUrl = opts.modelUrl || '/models/iphone.glb';
  const dracoPath = opts.dracoPath || '/draco/';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const S = { stopped: false, dirty: true, px: 0, py: 0, mx: 0, my: 0, t0: 0, frame: 0, lastMode: -1, settled: false, lastFrameAt: 0 };

  const onScroll = () => { S.dirty = true; if (document.hidden && S.renderer) step(); };
  const onResize = () => { resize(); S.dirty = true; };
  const onPointer = (e) => { S.px = (e.clientX / innerWidth - 0.5) * 2; S.py = (e.clientY / innerHeight - 0.5) * 2; };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onResize);
  if (!reduced) addEventListener('pointermove', onPointer, { passive: true });
  // Safety tick in case the browser throttles requestAnimationFrame (hidden tab, weak device).
  const keepAlive = setInterval(() => {
    if (S.stopped || !S.renderer) return;
    if (performance.now() - S.lastFrameAt < 220) return;
    try { step(); } catch (e) { console.warn('[clicki-phone] step failed', e); }
  }, 140);

  function progress() {
    const r = stage.getBoundingClientRect();
    const span = r.height - innerHeight;
    if (span <= 0) return 0;
    return Math.max(0, Math.min(1, -r.top / span));
  }

  function updateBeats() {
    const vh = innerHeight;
    beats.forEach((el) => {
      const r = el.getBoundingClientRect();
      const c = (r.top + Math.min(r.height, vh) / 2) / vh;
      const o = Math.max(0, Math.min(1, 1 - (Math.abs(c - 0.5) - 0.16) / 0.34));
      el.style.opacity = o.toFixed(3);
      el.style.transform = 'translateY(' + ((c - 0.5) * -34).toFixed(1) + 'px)';
    });
  }

  function resize() {
    if (!S.renderer) return;
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    S.renderer.setSize(w, h, false);
    S.camera.aspect = w / h;
    S.camera.updateProjectionMatrix();
    S.viewH = 2 * S.camera.position.z * Math.tan(((S.camera.fov * Math.PI) / 180) / 2);
    S.viewW = S.viewH * S.camera.aspect;
    S.narrow = w < 900;
  }

  async function boot() {
    const attrs = { alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' };
    let ctx = null;
    try { ctx = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs); } catch { ctx = null; }
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, context: ctx || undefined, ...attrs }); }
    catch (e) { console.warn('[clicki-phone] WebGL unavailable', e); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 7);
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.03).texture;

    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2.5, 3.5, 4); scene.add(key);
    const violet = new THREE.PointLight(0x7c3aed, 26, 14); violet.position.set(-3, 1.6, 2.4); scene.add(violet);
    const mint = new THREE.PointLight(0x16a34a, 16, 14); mint.position.set(3.2, -2, 1.6); scene.add(mint);
    scene.add(new THREE.AmbientLight(0xd9cffb, 1.1));

    const holder = new THREE.Group(); scene.add(holder);
    const pivot = new THREE.Group(); holder.add(pivot);
    Object.assign(S, { renderer, scene, camera, holder, pivot });
    resize();

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(dracoPath);
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    let gltf;
    try { gltf = await gltfLoader.loadAsync(modelUrl); }
    catch (e) { console.warn('[clicki-phone] model failed to load', e); loop(); return; }

    const inner = new THREE.Group(); inner.add(gltf.scene);
    let box = new THREE.Box3().setFromObject(inner);
    let sz = box.getSize(new THREE.Vector3());
    if (sz.y < sz.x && sz.y < sz.z) { // model lying flat — stand it up
      gltf.scene.rotation.x = -Math.PI / 2;
      box = new THREE.Box3().setFromObject(inner);
      sz = box.getSize(new THREE.Vector3());
    }
    const k = 2.9 / sz.y; // normalize body height to 2.9 world-units
    inner.scale.setScalar(k);
    box = new THREE.Box3().setFromObject(inner);
    const c = box.getCenter(new THREE.Vector3());
    inner.position.set(-c.x, -c.y, -c.z);
    pivot.add(inner);

    gltf.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const m = o.material;
      if (m.transparent && m.opacity < 0.5) m.opacity = Math.max(m.opacity, 0.35);
      if (m.roughness !== undefined && m.roughness > 0.7) m.roughness = 0.6;
    });

    buildScreen(pivot, sz.x * k * 0.928, sz.y * k * 0.962, (sz.z * k) / 2 + 0.006);
    loop();
  }

  function buildScreen(parent, w, h, z) {
    const cv = document.createElement('canvas');
    cv.width = 620; cv.height = Math.round(620 * (h / w));
    S.cv = cv; S.ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    S.tex = tex;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    plane.name = 'screen'; plane.position.z = z;
    parent.add(plane);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(0, 0));
    draw(0, 0);
  }

  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
  function heart(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.32);
    ctx.bezierCurveTo(x, y - s * 0.22, x - s, y - s * 0.16, x - s, y + s * 0.26);
    ctx.bezierCurveTo(x - s, y + s * 0.72, x, y + s * 0.98, x, y + s * 1.28);
    ctx.bezierCurveTo(x, y + s * 0.98, x + s, y + s * 0.72, x + s, y + s * 0.26);
    ctx.bezierCurveTo(x + s, y - s * 0.16, x, y - s * 0.22, x, y + s * 0.32); ctx.fill();
  }

  /** Draws the phone "screen". Text comes from screens[i] — no numbers, states only. */
  function draw(i, t) {
    const ctx = S.ctx; if (!ctx) return;
    const d = screens[i] || screens[0];
    const W = S.cv.width, H = S.cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save(); rr(ctx, 0, 0, W, H, W * 0.115); ctx.clip();

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, d.mode === 'reel' ? '#2a1c58' : '#141026'); bg.addColorStop(1, '#08070f');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const blob = (x, y, r, col) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
    blob(W * 0.24, H * (0.24 + Math.sin(t * 0.5) * 0.02), W * 0.95, 'rgba(124,58,237,.62)');
    blob(W * 0.86, H * (0.74 + Math.cos(t * 0.42) * 0.02), W * 0.8, 'rgba(22,163,74,.42)');

    ctx.font = "600 22px 'Geist',sans-serif"; ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.textAlign = 'left'; ctx.fillText('9:41', W * 0.11, H * 0.045);
    ctx.textAlign = 'right'; ctx.fillText('◼◼◼', W * 0.89, H * 0.045); ctx.textAlign = 'left';

    if (d.mode === 'reel') {
      ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, W * 0.09, H * 0.075, W * 0.34, 44, 22); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = "700 19px 'JetBrains Mono',monospace"; ctx.fillText(d.badge, W * 0.125, H * 0.075 + 29);
      ctx.font = "600 30px 'Geist',sans-serif"; ctx.fillText(d.handle, W * 0.09, H * 0.62);
      ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = "400 25px 'Geist',sans-serif";
      (d.caption || []).forEach((line, n) => ctx.fillText(line, W * 0.09, H * 0.62 + 40 + n * 34));
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      heart(ctx, W * 0.86, H * 0.44, 22);
      rr(ctx, W * 0.86 - 22, H * 0.52, 44, 38, 12); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(ctx, W * 0.09, H * 0.9, W * 0.82, 6, 3); ctx.fill();
      ctx.fillStyle = '#16a34a'; rr(ctx, W * 0.09, H * 0.9, W * 0.82 * ((t * 0.11) % 1), 6, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = "500 18px 'JetBrains Mono',monospace";
      ctx.fillText(d.brand + ' · ' + d.note, W * 0.09, H * 0.955);
    } else if (d.mode === 'stats') {
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = "500 19px 'JetBrains Mono',monospace"; ctx.fillText(d.kicker, W * 0.1, H * 0.16);
      const bx = W * 0.1, bw = W * 0.8, base = H * 0.62, bh = H * 0.32, gap = 12, cw = (bw - gap * (d.bars.length - 1)) / d.bars.length;
      d.bars.forEach((v, n) => {
        const hh = bh * v * (1 + Math.sin(t * 0.9 + n) * 0.03);
        ctx.fillStyle = n === d.bars.length - 1 ? '#16a34a' : 'rgba(139,92,246,' + (0.45 + n * 0.07) + ')';
        rr(ctx, bx + n * (cw + gap), base - hh, cw, hh, cw * 0.32); ctx.fill();
      });
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = "500 15px 'JetBrains Mono',monospace"; ctx.fillText(d.axis, bx, base + 34);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; rr(ctx, W * 0.1, H * 0.74, W * 0.8, H * 0.15, 26); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = "500 21px 'Geist',sans-serif";
      const words = d.note.split(' ');
      let line = '', ly = H * 0.795, lines = [];
      words.forEach((w) => { const test = (line + ' ' + w).trim(); if (ctx.measureText(test).width > W * 0.7 && line) { lines.push(line); line = w; } else line = test; });
      lines.push(line);
      lines.forEach((l, n) => ctx.fillText(l, W * 0.14, ly + n * 26));
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.06)'; rr(ctx, W * 0.09, H * 0.3, W * 0.82, H * 0.36, 34); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.stroke();
      const cx = W * 0.5, cy = H * 0.4;
      ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(cx, cy, 40 * (1 + Math.sin(t * 2) * 0.04), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#08070f'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 17, cy); ctx.lineTo(cx - 4, cy + 14); ctx.lineTo(cx + 18, cy - 13); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff'; ctx.font = "700 34px 'Unbounded','Geist',sans-serif"; ctx.fillText(d.kicker, cx, H * 0.53);
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = "400 23px 'Geist',sans-serif"; ctx.fillText(d.sub, cx, H * 0.585);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = "500 17px 'JetBrains Mono',monospace"; ctx.fillText(d.foot, cx, H * 0.72);
      ctx.textAlign = 'left';
    }
    ctx.restore();
    if (S.tex) S.tex.needsUpdate = true;
  }

  function loop() { if (S.stopped) return; requestAnimationFrame(loop); step(); }

  function step() {
    S.lastFrameAt = performance.now();
    const now = performance.now() / 1000;
    if (!S.t0) S.t0 = now;
    const t = reduced ? 0 : now - S.t0;
    if (S.dirty) { S.dirty = false; updateBeats(); }
    if (!S.renderer || !S.pivot) return;

    const p = progress();
    const seg = Math.min(keys.length - 2, Math.floor(p * (keys.length - 1)));
    const f = Math.max(0, Math.min(1, p * (keys.length - 1) - seg));
    const e = f * f * (3 - 2 * f);
    const a = keys[seg], b = keys[seg + 1];
    const mix = (u, v) => u + (v - u) * e;

    const world = (kf, i) => {
      if (i === 0 && slot) { // first frame "sits" in the layout slot
        const r = slot.getBoundingClientRect();
        const vw = canvas.clientWidth, vh = canvas.clientHeight;
        if (r.height > 40) return {
          x: ((r.left + r.width / 2) / vw - 0.5) * S.viewW,
          y: -((r.top + r.height / 2) / vh - 0.5) * S.viewH,
          s: ((r.height * 1.06) / vh) * S.viewH / 2.9,
        };
      }
      return { x: (S.narrow ? 0 : kf.x) * (S.viewW / 2) * 0.98, y: kf.y, s: (S.narrow ? 0.8 : 1) * kf.s };
    };
    const A = world(a, seg), B = world(b, seg + 1);
    const sc = mix(A.s, B.s);

    S.mx += (S.px - S.mx) * 0.06; S.my += (S.py - S.my) * 0.06;
    const tx = mix(A.x, B.x);
    S.holder.position.x += (tx - S.holder.position.x) * (S.settled ? 0.12 : 1);
    S.settled = true;
    S.holder.position.y = mix(A.y, B.y) + Math.sin(t * 0.6) * 0.05 * sc;
    S.holder.scale.setScalar(sc);
    S.pivot.rotation.y = mix(a.ry, b.ry) + S.mx * 0.26;
    S.pivot.rotation.x = mix(a.rx, b.rx) + S.my * 0.14 + Math.sin(t * 0.45) * 0.014;
    S.pivot.rotation.z = mix(a.rz, b.rz);
    canvas.style.opacity = (S.narrow && p > 0.08) ? '.45' : '1';

    const mode = p < 0.42 ? 0 : (p < 0.78 ? 1 : 2);
    S.frame++;
    if (S.frame % 4 === 0 || mode !== S.lastMode) { S.lastMode = mode; draw(mode, t); }

    if (canvas.clientWidth !== S.lw || canvas.clientHeight !== S.lh) { S.lw = canvas.clientWidth; S.lh = canvas.clientHeight; resize(); }
    S.renderer.render(S.scene, S.camera);
  }

  boot();

  return {
    destroy() {
      S.stopped = true;
      clearInterval(keepAlive);
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onResize);
      removeEventListener('pointermove', onPointer);
      if (S.renderer) S.renderer.dispose();
    },
  };
}

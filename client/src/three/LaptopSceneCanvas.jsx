import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PresentationControls, useGLTF } from '@react-three/drei';
import { scrollState } from './scrollState.js';

const MODEL_URL = '/macbook.glb';
const damp = (c, t, l, dt) => c + (t - c) * (1 - Math.exp(-l * dt));

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A clean CLICKI campaign dashboard for the laptop screen (no money figures). */
function makeDashboardTexture() {
  const w = 1280;
  const h = 800;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#eef5fc';
  ctx.fillRect(0, 0, w, h);

  // top bar
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, 96);
  ctx.strokeStyle = '#e3ebf3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 96);
  ctx.lineTo(w, 96);
  ctx.stroke();

  // brand
  const lg = ctx.createLinearGradient(40, 28, 80, 68);
  lg.addColorStop(0, '#8b5cf6');
  lg.addColorStop(1, '#6d28d9');
  ctx.fillStyle = lg;
  roundRect(ctx, 40, 28, 40, 40, 12);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 24px Inter, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('C', 60, 49);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0a0d12';
  ctx.font = '700 30px Inter, Arial, sans-serif';
  ctx.fillText('CLICKI', 96, 49);
  ctx.fillStyle = '#535862';
  ctx.font = '500 24px Inter, Arial, sans-serif';
  ctx.fillText('· Дашборд кампании', 220, 50);

  // LIVE pill
  ctx.fillStyle = '#d3f6e3';
  roundRect(ctx, w - 150, 30, 110, 38, 19);
  ctx.fill();
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.arc(w - 128, 49, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '600 22px Inter, Arial, sans-serif';
  ctx.fillText('LIVE', w - 110, 50);

  // section title
  ctx.fillStyle = '#0a0d12';
  ctx.font = '700 34px Inter, Arial, sans-serif';
  ctx.fillText('Органические просмотры', 40, 150);
  ctx.fillStyle = '#535862';
  ctx.font = '500 22px Inter, Arial, sans-serif';
  ctx.fillText('за последние 14 дней', 40, 184);

  // chart card
  const cx = 40;
  const cy = 210;
  const cw = 760;
  const cardH = 540;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cx, cy, cw, cardH, 28);
  ctx.fill();

  // chart geometry
  const padL = 40;
  const padB = 70;
  const innerX = cx + padL;
  const innerW = cw - padL - 40;
  const baseY = cy + cardH - padB;
  const innerH = cardH - 120;
  const n = 14;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const v = 0.12 + t * 0.72 + Math.sin(i * 1.25) * 0.05;
    pts.push([innerX + innerW * t, baseY - innerH * Math.min(1, Math.max(0, v))]);
  }

  // gridlines
  ctx.strokeStyle = '#eef2f7';
  ctx.lineWidth = 2;
  for (let g = 0; g <= 3; g++) {
    const gy = cy + 50 + ((cardH - 130) / 3) * g;
    ctx.beginPath();
    ctx.moveTo(innerX, gy);
    ctx.lineTo(innerX + innerW, gy);
    ctx.stroke();
  }

  // area fill
  const ag = ctx.createLinearGradient(0, cy, 0, baseY);
  ag.addColorStop(0, 'rgba(124,58,237,0.30)');
  ag.addColorStop(1, 'rgba(124,58,237,0.02)');
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], baseY);
  pts.forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.lineTo(pts[n - 1][0], baseY);
  ctx.closePath();
  ctx.fill();

  // line
  ctx.strokeStyle = '#6d28d9';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.stroke();
  // end dot
  ctx.fillStyle = '#6d28d9';
  ctx.beginPath();
  ctx.arc(pts[n - 1][0], pts[n - 1][1], 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(pts[n - 1][0], pts[n - 1][1], 4, 0, Math.PI * 2);
  ctx.fill();

  // stat cards (right column)
  const sx = 840;
  const sw = 400;
  const stats = [
    { label: 'Просмотры', value: '1.2M', delta: '↑ растёт', accent: '#16a34a' },
    { label: 'Авторы в работе', value: '248', delta: 'проверенные', accent: '#7c3aed' },
    { label: 'Платформы', value: '5', delta: 'мультиохват', accent: '#16a34a' },
  ];
  let syc = 210;
  const sh = 168;
  stats.forEach((s) => {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, sx, syc, sw, sh, 28);
    ctx.fill();
    ctx.fillStyle = '#535862';
    ctx.font = '500 24px Inter, Arial, sans-serif';
    ctx.fillText(s.label, sx + 32, syc + 44);
    ctx.fillStyle = '#0a0d12';
    ctx.font = '800 56px Inter, Arial, sans-serif';
    ctx.fillText(s.value, sx + 32, syc + 100);
    ctx.fillStyle = s.accent;
    ctx.font = '600 22px Inter, Arial, sans-serif';
    ctx.fillText(s.delta, sx + 32, syc + 140);
    syc += sh + 18;
  });

  return new THREE.CanvasTexture(cv);
}

/* ---------------- Scroll-driven motion ---------------- */

function ScrollMotion({ children }) {
  const ref = useRef();
  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = Math.min(1, scrollState.y / (window.innerHeight * 0.9 || 800));
    g.rotation.y = damp(g.rotation.y, -0.2 + t * 0.7, 3, dt);
    g.position.y = damp(g.position.y, t * -0.5, 3, dt);
  });
  return <group ref={ref}>{children}</group>;
}

/* ---------------- Model ---------------- */

function LaptopModel({ targetSize = 4.5 }) {
  const { scene } = useGLTF(MODEL_URL);

  const model = useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);

    // Identify the screen = the topmost large, flat panel (the open lid).
    const flats = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const bb = new THREE.Box3().setFromObject(o);
      const s = bb.getSize(new THREE.Vector3());
      const c = bb.getCenter(new THREE.Vector3());
      const d = [s.x, s.y, s.z].sort((a, b) => a - b);
      flats.push({ o, thin: d[0] / (d[2] || 1), area: d[1] * d[2], cy: c.y });
    });
    const maxArea = Math.max(...flats.map((f) => f.area), 0);
    const panels = flats
      .filter((f) => f.thin < 0.35 && f.area >= maxArea * 0.18)
      .sort((a, b) => b.cy - a.cy);
    const screen = panels[0]?.o;

    if (screen) {
      const tex = makeDashboardTexture();
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      screen.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    }

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const wrap = new THREE.Group();
    wrap.add(root);
    wrap.scale.setScalar(targetSize / maxDim);
    return wrap;
  }, [scene, targetSize]);

  return <primitive object={model} />;
}

function LaptopRig({ interactive }) {
  const content = (
    <ScrollMotion>
      <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.5}>
        {/* 3/4 hero pose so the screen reads clearly. */}
        <group rotation={[0.05, -0.5, 0]}>
          <LaptopModel />
        </group>
      </Float>
    </ScrollMotion>
  );

  if (!interactive) return content;
  return (
    <PresentationControls global cursor polar={[-0.3, 0.3]} azimuth={[-0.7, 0.7]} config={{ mass: 1, tension: 120 }}>
      {content}
    </PresentationControls>
  );
}

export default function LaptopSceneCanvas({ interactive = true }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0.4, 10], fov: 38 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, 6, 5]} intensity={1.3} color="#ffffff" />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#cce7ff" />
      <pointLight position={[0, -3, 4]} intensity={0.5} color="#7c3aed" />
      <Suspense fallback={null}>
        <LaptopRig interactive={interactive} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);

import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PresentationControls, useGLTF } from '@react-three/drei';
import { scrollState } from './scrollState.js';

const MODEL_URL = '/iphone.glb';
const damp = (c, t, l, dt) => c + (t - c) * (1 - Math.exp(-l * dt));

/* ---------------- Screen UI (canvas texture) ---------------- */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function actionIcon(ctx, cx, cy, type) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  if (type === 'heart') {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 13);
    ctx.bezierCurveTo(cx - 22, cy - 5, cx - 15, cy - 22, cx, cy - 9);
    ctx.bezierCurveTo(cx + 15, cy - 22, cx + 22, cy - 5, cx, cy + 13);
    ctx.fill();
  } else if (type === 'chat') {
    roundRect(ctx, cx - 16, cy - 14, 32, 24, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy + 8);
    ctx.lineTo(cx - 2, cy + 18);
    ctx.lineTo(cx + 5, cy + 8);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy + 13);
    ctx.lineTo(cx + 17, cy);
    ctx.lineTo(cx - 15, cy - 13);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Draw the CLICKI short-video screen at the phone's real face aspect. */
function makeScreenTexture(variant, aspect) {
  const w = 620;
  const h = Math.round(w * aspect);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const cols = variant === 'green' ? ['#4fbeff', '#9552e0'] : ['#479dff', '#0069e0'];

  // Round the screen corners to match the phone; outside stays transparent.
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  roundRect(ctx, 0, 0, w, h, w * 0.155);
  ctx.clip();

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, cols[0]);
  grad.addColorStop(1, cols[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(w * 0.22, h * 0.28, w * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.72, w * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const og = ctx.createLinearGradient(0, h * 0.55, 0, h);
  og.addColorStop(0, 'rgba(0,0,0,0)');
  og.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = og;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';

  // status bar
  ctx.font = '600 26px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('9:41', 40, h * 0.045);
  ctx.textAlign = 'right';
  ctx.font = '600 22px Inter, Arial, sans-serif';
  ctx.fillText('5G', w - 92, h * 0.045);
  roundRect(ctx, w - 74, h * 0.045 - 9, 38, 18, 4);
  ctx.fill();

  // Dynamic Island
  ctx.fillStyle = '#05070b';
  const iw = w * 0.3;
  roundRect(ctx, w / 2 - iw / 2, h * 0.028, iw, 38, 19);
  ctx.fill();

  // CLICKI pill
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, w / 2 - 96, h * 0.092, 192, 54, 27);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = '700 32px Inter, Arial, sans-serif';
  ctx.fillText('CLICKI', w / 2, h * 0.092 + 28);

  // trending pill (top-left)
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, 36, h * 0.15, 196, 46, 23);
  ctx.fill();
  ctx.fillStyle = '#9bf6bf';
  ctx.beginPath();
  ctx.arc(62, h * 0.15 + 23, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.font = '600 22px Inter, Arial, sans-serif';
  ctx.fillText('В ТРЕНДЕ', 82, h * 0.15 + 24);

  // play button
  const pcy = h * 0.42;
  ctx.beginPath();
  ctx.arc(w / 2, pcy, 70, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.fillStyle = cols[1];
  ctx.beginPath();
  ctx.moveTo(w / 2 - 18, pcy - 34);
  ctx.lineTo(w / 2 - 18, pcy + 34);
  ctx.lineTo(w / 2 + 40, pcy);
  ctx.closePath();
  ctx.fill();

  // right action rail
  const rx = w - 66;
  // avatar + follow badge
  const ay = h * 0.5;
  const ag = ctx.createLinearGradient(rx - 32, ay - 32, rx + 32, ay + 32);
  ag.addColorStop(0, '#ffd1b8');
  ag.addColorStop(1, '#9552e0');
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.arc(rx, ay, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.fillStyle = cols[0];
  ctx.beginPath();
  ctx.arc(rx, ay + 36, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(rx - 6, ay + 36);
  ctx.lineTo(rx + 6, ay + 36);
  ctx.moveTo(rx, ay + 30);
  ctx.lineTo(rx, ay + 42);
  ctx.stroke();

  const rail = [
    { cy: h * 0.6, type: 'heart', label: '128K' },
    { cy: h * 0.69, type: 'chat', label: '2.4K' },
    { cy: h * 0.78, type: 'share', label: '1.1K' },
  ];
  ctx.textAlign = 'center';
  rail.forEach((it) => {
    actionIcon(ctx, rx, it.cy, it.type);
    ctx.fillStyle = '#fff';
    ctx.font = '600 20px Inter, Arial, sans-serif';
    ctx.fillText(it.label, rx, it.cy + 50);
  });
  // music disc
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(rx, h * 0.865, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cols[1];
  ctx.beginPath();
  ctx.arc(rx, h * 0.865, 9, 0, Math.PI * 2);
  ctx.fill();

  // username + verified
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = '700 32px Inter, Arial, sans-serif';
  ctx.fillText('@clicki', 40, h * 0.83);
  const uw = ctx.measureText('@clicki').width;
  const vx = 40 + uw + 24;
  ctx.fillStyle = '#0099ff';
  ctx.beginPath();
  ctx.arc(vx, h * 0.83, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(vx - 7, h * 0.83);
  ctx.lineTo(vx - 2, h * 0.83 + 6);
  ctx.lineTo(vx + 8, h * 0.83 - 6);
  ctx.stroke();

  // caption + hashtags
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.font = '500 26px Inter, Arial, sans-serif';
  ctx.fillText('органика, которая реально залетает', 40, h * 0.878);
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.font = '600 24px Inter, Arial, sans-serif';
  ctx.fillText('#fyp #органика #clicki', 40, h * 0.912);

  // music line
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '500 22px Inter, Arial, sans-serif';
  ctx.fillText('♪  оригинальный звук — CLICKI', 40, h * 0.944);

  // progress bar
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  roundRect(ctx, 40, h * 0.975, w - 80, 5, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  roundRect(ctx, 40, h * 0.975, (w - 80) * 0.42, 5, 3);
  ctx.fill();

  ctx.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ---------------- Scroll-driven motion ---------------- */

function ScrollMotion({ children }) {
  const ref = useRef();
  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = Math.min(1, scrollState.y / (window.innerHeight * 0.9 || 800));
    g.rotation.y = damp(g.rotation.y, -0.2 + t * 0.85, 3, dt);
    g.rotation.z = damp(g.rotation.z, t * -0.15, 3, dt);
    g.position.y = damp(g.position.y, t * -0.6, 3, dt);
    g.position.x = damp(g.position.x, t * 0.3, 3, dt);
  });
  return <group ref={ref}>{children}</group>;
}

/* ---------------- Model + screen ---------------- */

/**
 * Place the UI on the phone's front face (largest face, offset along the
 * thinnest axis), leaving a thin UNIFORM (absolute) bezel on all sides.
 * Returns the plane size + the face aspect so the texture matches 1:1.
 */
function screenPlacement(sizeScaled) {
  const { x, y, z } = sizeScaled;
  const min = Math.min(x, y, z);

  let pos;
  let rot;
  let faceW;
  let faceH;
  if (min === z) {
    faceW = x;
    faceH = y;
    pos = [0, 0, z / 2];
    rot = [0, 0, 0];
  } else if (min === x) {
    faceW = z;
    faceH = y;
    pos = [x / 2, 0, 0];
    rot = [0, Math.PI / 2, 0];
  } else {
    faceW = Math.min(x, z);
    faceH = Math.max(x, z);
    pos = [0, y / 2, 0];
    rot = [-Math.PI / 2, 0, 0];
  }

  const bezel = faceW * 0.035; // thin, uniform on every side
  const w = faceW - bezel * 2;
  const h = faceH - bezel * 2;
  const eps = Math.min(x, y, z) * 0.06; // sit just above the glass
  pos = pos.map((v) => (Math.abs(v) > 1e-6 ? v + Math.sign(v) * eps : v));
  return { pos, rot, w, h, aspect: h / w };
}

function PhoneModel({ variant, targetSize = 3.7 }) {
  const { scene } = useGLTF(MODEL_URL);

  const { model, place, screenTex } = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = targetSize / maxDim;
    const wrap = new THREE.Group();
    wrap.add(root);
    wrap.scale.setScalar(s);

    const sized = size.clone().multiplyScalar(s);
    const pl = screenPlacement(sized);
    return { model: wrap, place: pl, screenTex: makeScreenTexture(variant, pl.aspect) };
  }, [scene, targetSize, variant]);

  return (
    <group>
      <primitive object={model} />
      <mesh position={place.pos} rotation={place.rot}>
        <planeGeometry args={[place.w, place.h]} />
        <meshBasicMaterial map={screenTex} toneMapped={false} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function PhoneRig({ interactive, variant }) {
  const content = (
    <ScrollMotion>
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.45}>
        {/* Flattering 3/4 hero pose — screen clearly readable, a touch of depth. */}
        <group rotation={[0.14, -0.12, 0.05]}>
          <PhoneModel variant={variant} />
        </group>
      </Float>
    </ScrollMotion>
  );

  if (!interactive) return content;
  return (
    <PresentationControls
      global
      cursor
      polar={[-0.4, 0.4]}
      azimuth={[-0.7, 0.7]}
      config={{ mass: 1, tension: 120 }}
    >
      {content}
    </PresentationControls>
  );
}

/** Heavy three.js canvas — imported lazily by DeviceScene so three is code-split. */
export default function DeviceSceneCanvas({ variant = 'violet', interactive = true }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 9.5], fov: 38 }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, 5, 4]} intensity={1.3} color="#ffffff" />
      <directionalLight position={[-3, 2, -4]} intensity={0.5} color="#cce7ff" />
      <pointLight position={[-4, -2, 3]} intensity={0.7} color={variant === 'green' ? '#9552e0' : '#4fbeff'} />
      <Suspense fallback={null}>
        <PhoneRig interactive={interactive} variant={variant} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);

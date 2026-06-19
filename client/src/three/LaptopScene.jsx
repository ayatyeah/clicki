import { Suspense, lazy } from 'react';
import { useShouldRender3D } from './useShouldRender3D.js';

// three.js stays out of the main bundle — fetched only when the laptop renders.
const LaptopSceneCanvas = lazy(() => import('./LaptopSceneCanvas.jsx'));

/**
 * Self-contained 3D laptop (campaign dashboard on screen) for the business hero.
 * Falls back to a static CSS laptop silhouette when 3D is disabled.
 */
export default function LaptopScene({ interactive = true, className = '', screenImage = '' }) {
  const { ready, enabled } = useShouldRender3D();

  if (!ready || !enabled) {
    return <div className={`device-fallback device-fallback--laptop ${className}`} aria-hidden="true" />;
  }

  return (
    <div className={`device3d ${className}`} aria-hidden="true">
      <Suspense fallback={<div className="device-fallback device-fallback--laptop" />}>
        <LaptopSceneCanvas interactive={interactive} screenImage={screenImage} />
      </Suspense>
    </div>
  );
}

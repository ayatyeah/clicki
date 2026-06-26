import { Suspense, lazy } from 'react';
import { useShouldRender3D } from './useShouldRender3D.js';

// three.js stays out of the main bundle - fetched only when a device renders.
const DeviceSceneCanvas = lazy(() => import('./DeviceSceneCanvas.jsx'));

/**
 * Self-contained 3D phone mockup for hero sections.
 * Falls back to a static CSS phone silhouette when 3D is disabled.
 *
 * @param {'violet'|'green'} variant - screen palette
 * @param {boolean} interactive - allow drag-to-tilt (default true)
 */
export default function DeviceScene({ variant = 'violet', interactive = true, className = '', screenImage = '' }) {
  const { ready, enabled } = useShouldRender3D();

  if (!ready || !enabled) {
    return <div className={`device-fallback device-fallback--${variant} ${className}`} aria-hidden="true" />;
  }

  return (
    <div className={`device3d ${className}`} aria-hidden="true">
      <Suspense fallback={<div className={`device-fallback device-fallback--${variant}`} />}>
        <DeviceSceneCanvas variant={variant} interactive={interactive} screenImage={screenImage} />
      </Suspense>
    </div>
  );
}

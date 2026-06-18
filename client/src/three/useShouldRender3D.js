import { useEffect, useState } from 'react';

/**
 * Decides whether (and how heavily) to render WebGL 3D.
 *
 * - `ready`   — true only after first client effect, so the heavy three.js
 *               canvas mounts AFTER the LCP text has painted (protects CWV).
 * - `enabled` — false when the user prefers reduced motion → CSS fallback.
 * - `quality` — 'low' on mobile / low-core devices to cut particle count + DPR.
 */
export function useShouldRender3D() {
  const [state, setState] = useState({ ready: false, enabled: true, quality: 'high' });

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.matchMedia('(max-width: 768px)').matches;
    const cores = navigator.hardwareConcurrency || 4;

    // Heuristic: respect reduced-motion; also bail on very weak devices.
    const weak = cores <= 2;
    const enabled = !reduced && !weak;
    const quality = mobile || cores <= 4 ? 'low' : 'high';

    setState({ ready: true, enabled, quality });
  }, []);

  return state;
}

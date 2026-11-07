/**
 * 弥散背景视差：前景不动，背景层随指针反向小幅平移。
 * 依赖 CSS：html[data-mesh='on'] 与 --mesh-nx / --mesh-ny。
 */
import { useEffect } from 'react';

export function useMeshParallax(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId = 0;

    const applyVars = () => {
      root.style.setProperty('--mesh-nx', currentX.toFixed(4));
      root.style.setProperty('--mesh-ny', currentY.toFixed(4));
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      applyVars();
      rafId = window.requestAnimationFrame(tick);
    };

    const onMove = (event) => {
      const { innerWidth: w, innerHeight: h } = window;
      if (!w || !h) return;
      targetX = (event.clientX / w) * 2 - 1;
      targetY = (event.clientY / h) * 2 - 1;
    };

    applyVars();
    rafId = window.requestAnimationFrame(tick);
    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      root.style.removeProperty('--mesh-nx');
      root.style.removeProperty('--mesh-ny');
    };
  }, [enabled]);
}

import { useEffect } from 'react';

/** Map a viewport pointer to a horizontal depth value in [-1, 1]. */
export function vocalPointerOffset(clientX, width) {
  if (!Number.isFinite(clientX) || !Number.isFinite(width) || width <= 0) return 0;
  return Math.min(1, Math.max(-1, (clientX / width) * 2 - 1));
}

/** Every layer shifts with the pointer. Higher layers use a larger distance. */
export function useVocalDepth(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) return undefined;

    let target = 0;
    let current = 0;
    let frame = 0;

    const tick = () => {
      current += (target - current) * 0.08;
      if (Math.abs(target - current) < 0.0005) current = target;
      node.style.setProperty('--vocal-px', current.toFixed(4));
      frame = current === target ? 0 : window.requestAnimationFrame(tick);
    };

    const onMove = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      target = vocalPointerOffset(event.clientX, window.innerWidth);
      if (!frame) frame = window.requestAnimationFrame(tick);
    };

    const onReduce = () => {
      if (!reduceMotion.matches) return;
      target = 0;
      if (!frame) frame = window.requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    reduceMotion.addEventListener('change', onReduce);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      reduceMotion.removeEventListener('change', onReduce);
      node.style.removeProperty('--vocal-px');
    };
  }, [ref]);
}

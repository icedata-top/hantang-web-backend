import { useEffect } from 'react';

/** Map a viewport pointer to a horizontal depth value in [-1, 1]. */
export function vocalPointerOffset(clientX, width) {
  if (!Number.isFinite(clientX) || !Number.isFinite(width) || width <= 0) return 0;
  return Math.min(1, Math.max(-1, (clientX / width) * 2 - 1));
}

/** Every layer shifts with the pointer. Higher layers use a larger distance. Narrow screens stay still. */
export function useVocalDepth(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = window.matchMedia('(max-width: 680px)');

    let target = 0;
    let current = 0;
    let frame = 0;
    let listening = false;

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

    const sync = () => {
      const enabled = !reduceMotion.matches && !narrow.matches;
      if (enabled === listening) return;
      if (enabled) {
        window.addEventListener('pointermove', onMove, { passive: true });
      } else {
        window.removeEventListener('pointermove', onMove);
        target = 0;
        if (!frame) frame = window.requestAnimationFrame(tick);
      }
      listening = enabled;
    };

    sync();
    reduceMotion.addEventListener('change', sync);
    narrow.addEventListener('change', sync);

    return () => {
      window.cancelAnimationFrame(frame);
      if (listening) window.removeEventListener('pointermove', onMove);
      reduceMotion.removeEventListener('change', sync);
      narrow.removeEventListener('change', sync);
      node.style.removeProperty('--vocal-px');
    };
  }, [ref]);
}

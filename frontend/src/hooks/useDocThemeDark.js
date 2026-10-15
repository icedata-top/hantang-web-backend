import { useEffect, useState } from 'react';

/** 与导航栏一致：`html[data-theme="dark"]` */
export function useDocThemeDark() {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark',
  );

  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setIsDark(el.getAttribute('data-theme') === 'dark');
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  return isDark;
}

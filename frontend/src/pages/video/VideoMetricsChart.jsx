import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import VChart from '@visactor/vchart';
import { useDocThemeDark } from '../../hooks/useDocThemeDark.js';
import { VIDEO_METRICS } from '../../constants/video/metrics.js';
import { buildVideoMetricsChartSpec } from './videoMetricsChart.js';

export default function VideoMetricsChart({ rows, mode }) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const isDark = useDocThemeDark();
  const hostRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let active = true;
    setFailed(false);
    const styles = getComputedStyle(document.documentElement);
    const colors = VIDEO_METRICS.map(({ color }) => styles.getPropertyValue(color).trim());
    const chart = new VChart(buildVideoMetricsChartSpec(rows, colors, language, mode), { dom: host, theme: isDark ? 'dark' : 'light' });
    chart.renderAsync().catch(() => { if (active) setFailed(true); });
    let frame;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { width, height } = host.getBoundingClientRect();
        if (active && width > 0 && height > 0) chart.resize(width, height);
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    return () => {
      active = false;
      observer.disconnect();
      cancelAnimationFrame(frame);
      chart.release();
    };
  }, [rows, mode, isDark, language, attempt]);

  return <div className="video-history-chart-stage">
    <div ref={hostRef} className="video-history-chart" role="img"
      aria-label={t("视频七项指标{{value0}}折线图，缺失数据处断线", { value0: t(mode === 'delta' ? '每日增量' : '累计值') })} />
    {failed && <div className="video-history-chart-failure" role="alert">
      <span>{t("图表绘制失败，请重试。")}</span>
      <Button onClick={() => setAttempt((value) => value + 1)}>{t("重试")}</Button>
    </div>}
  </div>;
}

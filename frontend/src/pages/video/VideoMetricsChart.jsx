import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import VChart from '@visactor/vchart';
import { useDocThemeDark } from '../../hooks/useDocThemeDark.js';
import { VIDEO_METRICS } from '../../constants/video/metrics.js';
import { buildVideoMetricsChartSpec } from './videoMetricsChart.js';

export default function VideoMetricsChart({ rows, mode }) {
  const { i18n } = useTranslation();
  const isZh = String(i18n.language || 'zh').toLowerCase().startsWith('zh');
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
    const chart = new VChart(buildVideoMetricsChartSpec(rows, colors, isZh, mode), { dom: host, theme: isDark ? 'dark' : 'light' });
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
  }, [rows, mode, isDark, isZh, attempt]);

  return <div className="video-history-chart-stage">
    <div ref={hostRef} className="video-history-chart" role="img"
      aria-label={isZh ? `视频七项指标${mode === 'delta' ? '每日增量' : '累计值'}折线图，缺失数据处断线` : `Seven video metrics, ${mode === 'delta' ? 'daily changes' : 'cumulative values'}; missing data creates gaps`} />
    {failed && <div className="video-history-chart-failure" role="alert">
      <span>{isZh ? '图表绘制失败，请重试。' : 'Could not render the chart. Please retry.'}</span>
      <Button onClick={() => setAttempt((value) => value + 1)}>{isZh ? '重试' : 'Retry'}</Button>
    </div>}
  </div>;
}

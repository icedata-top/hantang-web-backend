import { useState } from 'react';
import { DsPagination, DsTable, DsTabs } from '../../components/design-system/DataDisplay.jsx';
import { Token, Value, TypeMetrics } from './SpecTokens.jsx';

export function TabsSample({ t }) {
  const [tab, setTab] = useState('overview');
  return (
    <>
      <DsTabs value={tab} onChange={setTab} label={t("数据视图样本")} items={[
        { key: 'overview', label: t("概览"), children: <div className="spec-tab-metrics"><div><span>{t("累计播放")}</span><strong>128,640</strong></div><div><span>{t("作品数量")}</span><strong>12</strong></div></div> },
        { key: 'details', label: t("数据明细"), children: <div className="spec-tab-copy"><strong>{t("数据明细")}</strong><p>{t("切换视图保留上下文；只替换下方内容。")}</p><p>{t("歌曲播放趋势 · 虚拟歌手周报 · 创作者概览")}</p></div> },
        { key: 'history', label: t("操作记录"), children: <div className="spec-tab-copy"><strong>{t("最近更新")}</strong><p>{t("今天 09:30 · 数据更新完成")}</p><p>{t("昨天 18:20 · 调整统计范围")}</p></div> },
        { key: 'permissions', label: t("权限设置"), disabled: true },
      ]} />
      <p className="spec-footnote"><TypeMetrics size="body" /> · {t("选中字重")} <Value name="font-weight-medium" /> · {t("高度")} <Value name="tabs-height" /> · {t("间距")} <Value name="tabs-gap" /> · {t("下划线")} <Value name="tabs-indicator-size" />。{t("鼠标悬停变色，禁用项不响应。方向键切换，Home / End 跳到首尾，Tab 进入内容。")}</p>
    </>
  );
}

const RECORDS = [
  ['歌曲播放趋势', 'Song view trends', 128640, '10-27'],
  ['虚拟歌手周报', 'Vocal weekly report', 98210, '10-26'],
  ['创作者概览', 'Producer overview', 76100, '10-25'],
  ['新投稿观察', 'New release report', 54320, '10-24'],
  ['热门作品月报', 'Popular works monthly', 32180, '10-23'],
  ['收藏趋势报告', 'Favorite trends', 19420, '10-22'],
  ['互动数据概览', 'Engagement overview', 12600, '10-21'],
  ['季度统计汇总', 'Quarterly summary', 8400, '10-20'],
  ['年度作品回顾', 'Annual review', 4200, '10-19'],
  ['分区数据报告', 'Category report', 1200, '10-18'],
  ['待发布统计', 'Upcoming statistics', 0, '10-17'],
  ['历史数据补录', 'Historical data', null, '10-16'],
].map(([zh, en, views, updated], index) => ({ id: index + 1, zh, en, views, updated }));

export function TableSample({ t }) {
  const [mode, setMode] = useState('data');
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState('desc');
  const [feedback, setFeedback] = useState('');
  const sorted = [...RECORDS].sort((a, b) => {
    if (a.views === null) return 1;
    if (b.views === null) return -1;
    return direction === 'desc' ? b.views - a.views : a.views - b.views;
  });
  const rows = sorted.slice((page - 1) * 5, page * 5);
  const columns = [
    { key: 'name', title: t("名称"), width: '40%', render: (_, row) => <><span className="spec-record-name" title={t(row.zh)}>{t(row.zh)}</span><span className="spec-record-id">DS-{String(row.id).padStart(3, '0')}</span></> },
    { key: 'views', title: t("播放量"), width: '24%', align: 'right', sortable: true, render: (value) => value === null ? '—' : value.toLocaleString('en-US') },
    { key: 'updated', title: t("更新"), width: '20%', render: (value) => <time dateTime={`2026-${value}`} title={`2026-${value}`}>{value}</time> },
    { key: 'action', title: t("操作"), width: '16%', align: 'right', render: (_, row) => <button className="ds-text-button" type="button" aria-label={t("查看{{value0}}", { value0: t(row.zh) })} onClick={() => setFeedback(t("已查看「{{value0}}」，仅作演示。", { value0: t(row.zh) }))}>{t("查看")}</button> },
  ];
  const content = (
    <>
      <DsTable columns={columns} rows={mode === 'empty' ? [] : rows} caption={t("统计报告样本")} loading={mode === 'loading'} sortKey="views" sortDirection={direction} onSort={(_, next) => { setDirection(next); setPage(1); }} />
      <div className="spec-table-pagination"><DsPagination current={page} pageSize={5} total={mode === 'empty' ? 0 : RECORDS.length} onChange={setPage} disabled={mode === 'loading'} label={t("表格分页")} /></div>
      <p className="spec-demo-feedback" role="status">{feedback || t("可点击播放量排序、翻页和行内操作。数据均为演示。")}</p>
    </>
  );
  return (
    <>
      <DsTabs value={mode} onChange={(next) => { setMode(next); setFeedback(''); }} label={t("表格状态")} items={[
        ['data', t("常规")], ['empty', t("空数据")], ['loading', t("加载中")],
      ].map(([key, label]) => ({ key, label, children: key === mode ? content : null }))} />
      <p className="spec-footnote"><TypeMetrics size="body" /> · {t("表头字重")} <Value name="font-weight-medium" /> · {t("最小行高")} <Value name="table-row-height" /> · {t("内边距")} <Value name="table-cell-padding-block" /> × <Value name="table-cell-padding-inline" />。{t("仅横向分隔线；数字右对齐并使用千分位。缺失值显示 —，真实零显示 0；长名称省略，窄屏可横向滚动。")}</p>
    </>
  );
}

export function PaginationSample({ t }) {
  const [page, setPage] = useState(6);
  const [size, setSize] = useState(10);
  const [feedback, setFeedback] = useState('');
  const total = 123;
  return (
    <>
      <p className="spec-demo-label">{t("交互预览")}</p>
      <div className="spec-pagination-live">
        <DsPagination current={page} pageSize={size} total={total} onChange={setPage} pageSizeOptions={[10, 20, 50, 100, 200]} onPageSizeChange={(next) => { setSize(next); setPage(1); }} label={t("交互分页样本")} />
        <p className="spec-pagination-range" role="status">{t("第 {{value0}} 页 · 正在显示 {{value1}}–{{value2}} 条", { value0: page, value1: (page - 1) * size + 1, value2: Math.min(page * size, total) })}</p>
      </div>
      <div className="spec-pagination-states">
        {[
          ['default', t("普通")], ['hover', t("悬停")], ['active', t("当前页")], ['disabled', t("禁用")],
        ].map(([state, label], index) => (
          <div key={state}><button className="ds-page-button" type="button" data-preview-state={state} disabled={state === 'disabled'} aria-label={t("分页{{value0}}状态样本", { value0: label })} onClick={() => setFeedback(t("已体验{{value0}}状态样本。", { value0: label }))}>{index + 1}</button><span>{label}</span></div>
        ))}
      </div>
      <p className="spec-demo-label">{t("整体禁用")}</p>
      <DsPagination current={3} pageSize={10} total={50} onChange={() => {}} disabled label={t("禁用分页样本")} />
      <div className="spec-swatch-grid spec-pagination-colors">
        <div><span>{t("当前页背景")}</span><Token name="pagination-active-bg" /> <code>← --alert-info-bg</code></div>
        <div><span>{t("当前页文字")}</span><Token name="pagination-active-text" /> <code>← --alert-info-text</code></div>
      </div>
      <p className="spec-footnote">{t("页码")} <Value name="pagination-item-size" /> · {t("间距")} <Value name="pagination-gap" /> · {t("圆角")} <Value name="radius-control" /> · {t("描边")} <Value name="pagination-border-width" /> · {t("字号")} <Value name="font-size-body" /> · {t("当前页字重")} <Value name="font-weight-semibold" />。{t("颜色直接引用 Info Alert，悬停使用更淡的 Info 背景。首尾禁用对应箭头，长页码用省略号，修改每页条数回到第 1 页。")}</p>
      <p className="spec-demo-feedback" role="status">{feedback || <>{t("窄容器页码")} <Value name="pagination-item-size-compact" />；{t("键盘聚焦保留 2px 外环。")}</>}</p>
    </>
  );
}

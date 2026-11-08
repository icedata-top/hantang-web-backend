import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Button, DatePicker, Drawer, Empty, Form, Grid, Radio, Segmented, Select, Spin, Tooltip } from 'antd';
import { AppstoreOutlined, FilterOutlined, QuestionCircleOutlined, ReloadOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchVideoList } from '../../services/Video/videoList.api.js';
import { DsPagination, DsTable } from '../../components/design-system/DataDisplay.jsx';
import VideoCard from '../../components/custom/VideoCard/VideoCard.jsx';
import VideoInfo from '../../components/custom/VideoInfo/VideoInfo.jsx';
import ProducerInfo from '../../components/custom/ProducerInfo/ProducerInfo.jsx';
import RelativeTime from '../../components/custom/RelativeTime/RelativeTime.jsx';
import VideoHonor from '../../components/custom/VideoHonor/VideoHonor.jsx';
import { BILIBILI_SUB_PARTITION_ID_TO_NAME, BILIBILI_SUB_PARTITION_IDS_BY_REGION } from '../../constants/bilibili/type.id.js';
import { formatNumber } from '../../utils/formatNumber.js';
import { createDebouncedAction } from '../../utils/debounce.js';
import { parseVideoListQuery, videoListParams } from './videoListQuery.js';
import './VideoList.css';

function useVideos(queryKey) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: '', status: 'loading', data: null });
  const key = `${queryKey}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, status: 'loading', data: null });
    fetchVideoList(JSON.parse(queryKey), { signal: controller.signal }).then(
      data => { if (!controller.signal.aborted) setState({ key, status: 'ready', data }); },
      () => { if (!controller.signal.aborted) setState({ key, status: 'error', data: null }); },
    );
    return () => controller.abort();
  }, [queryKey, key]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { ...(state.key === key ? state : { status: 'loading', data: null }), retry };
}

export default function VideoList() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseVideoListQuery(params), [params]);
  const queryKey = JSON.stringify(query);
  const filterKey = JSON.stringify({ startDate: query.startDate, endDate: query.endDate, honor: query.honor, typeId: query.typeId });
  const [draft, setDraft] = useState(() => JSON.parse(filterKey));
  useEffect(() => { setDraft(JSON.parse(filterKey)); }, [filterKey]);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { md = true } = Grid.useBreakpoint();
  const isMobile = !md;
  const videos = useVideos(queryKey);
  const rows = videos.data?.rows ?? [];
  const viewMode = params.get('layout') === 'cards' ? 'cards' : 'table';
  const total = videos.data?.total ?? 0;

  const updateQuery = useCallback((next, resetPage = true) => {
    const updated = videoListParams({ ...query, ...next, ...(resetPage ? { page: 1 } : {}) });
    if (viewMode === 'cards') updated.set('layout', 'cards');
    setParams(updated);
  }, [query, viewMode, setParams]);
  useEffect(() => {
    if (videos.status === 'ready') {
      const last = Math.max(1, Math.ceil(total / query.pageSize));
      if (query.page > last) updateQuery({ page: last }, false);
    }
  }, [videos.status, total, query.page, query.pageSize, updateQuery]);

  useEffect(() => {
    setPickerOpen(false);
    if (!isMobile) setFilterDrawerOpen(false);
  }, [isMobile]);

  const debouncedQuery = useMemo(() => createDebouncedAction((nextFilter) => {
    const nextQuery = { ...query, ...nextFilter, page: 1 };
    if (JSON.stringify(nextQuery) === queryKey) videos.retry();
    else updateQuery(nextFilter);
    setFilterDrawerOpen(false);
  }), [query, queryKey, updateQuery, videos.retry]);

  useEffect(() => () => debouncedQuery.cancel(), [debouncedQuery]);
  useEffect(() => {
    if (videos.status === 'loading') debouncedQuery.cancel();
  }, [videos.status, debouncedQuery]);

  const setFilter = (next) => {
    debouncedQuery.cancel();
    setDraft(current => ({ ...current, ...next }));
  };
  const resetFilter = () => {
    debouncedQuery.cancel();
    setDraft(JSON.parse(filterKey));
  };
  const queryLoading = videos.status === 'loading';
  const columns = [
    { key: 'title', title: t('歌曲'), render: (title, row) => <div className="video-list-title">
      <VideoInfo aid={row.aid} initialTitle={title || `av${row.aid}`} linkToDetail />
      <span className="video-list-caption">av{row.aid}</span>
    </div> },
    { key: 'userId', title: t('投稿人'), width: '16%', render: id => id ? <ProducerInfo userId={id} /> : '—' },
    { key: 'view', title: t('播放量'), width: 150, align: 'right', sortable: true, render: value => <div className="video-list-views">
      <span>{value == null ? '—' : formatNumber(value, 'comma')}</span><VideoHonor views={value} />
    </div> },
    { key: 'favorite', title: t('收藏量'), width: 108, align: 'right', sortable: true,
      render: value => value == null ? '—' : formatNumber(value, 'comma') },
    { key: 'pubdate', title: t('投稿时间'), width: 150, sortable: true, render: value => <RelativeTime value={value} /> },
  ];
  const partitions = Object.entries(BILIBILI_SUB_PARTITION_IDS_BY_REGION);
  partitions.sort(([a], [b]) => Number(b === '音乐区') - Number(a === '音乐区'));
  const partitionOptions = partitions.map(([region, ids]) => ({ label: t(region), options: ids.map(id => ({ value: id, label: t(BILIBILI_SUB_PARTITION_ID_TO_NAME.get(id)) })) }));

  const filterBlock = <Form layout="vertical" onFinish={() => { if (!queryLoading) debouncedQuery(draft); }}>
    <div className="video-list-filter-grid">
      <Form.Item label={t('投稿日期')} htmlFor="video-list-start-date">
        <DatePicker.RangePicker className="ds-filter-control video-list-dates" variant="borderless"
          data-open={pickerOpen} onOpenChange={setPickerOpen} allowEmpty={[true, true]}
          id={{ start: 'video-list-start-date', end: 'video-list-end-date' }}
          minDate={dayjs('2009-01-01')} maxDate={dayjs('2100-12-31')} format="YYYY-MM-DD"
          placeholder={[t('开始日期'), t('结束日期')]}
          value={draft.startDate || draft.endDate ? [draft.startDate ? dayjs(draft.startDate) : null, draft.endDate ? dayjs(draft.endDate) : null] : null}
          onChange={dates => setFilter({ startDate: dates?.[0]?.format('YYYY-MM-DD') ?? '', endDate: dates?.[1]?.format('YYYY-MM-DD') ?? '' })} />
      </Form.Item>
      <Form.Item label={t('荣誉')}>
        <Radio.Group className="ds-radio-group-vertical" role="radiogroup" aria-label={t('荣誉')} name="video-list-honor" value={draft.honor}
          onChange={event => setFilter({ honor: event.target.value })} options={[
            { value: 'all', label: t('不限') }, { value: 'none', label: t('未达殿堂（<10万）') },
            { value: 'hall', label: t('殿堂（10万–100万）') }, { value: 'legend', label: t('传说（100万–1000万）') }, { value: 'myth', label: t('神话（≥1000万）') },
          ]} />
      </Form.Item>
      <Form.Item label={t('分区限定')}>
        <Select className="ds-filter-control" variant="borderless" aria-label={t('分区限定')} allowClear placeholder={t('全部分区')}
          value={draft.typeId} onChange={value => setFilter({ typeId: value ?? null })} options={partitionOptions} />
      </Form.Item>
    </div>
    <div className="video-list-actions">
      <Button className="ds-button" data-variant="secondary" icon={<ReloadOutlined aria-hidden="true" />} onClick={resetFilter}>{t('重置')}</Button>
      <Button className="ds-button" data-variant="primary" icon={<SearchOutlined aria-hidden="true" />} htmlType="submit"
        loading={queryLoading} disabled={queryLoading} aria-busy={queryLoading}>{t('查询')}</Button>
    </div>
  </Form>;

  return <main className="video-list-page">
    <header className="video-list-heading">
      <div className="video-list-heading-copy">
        <h1>{t('歌曲')}</h1>
        <p className="video-list-summary">
          <Trans i18nKey="video.listIntroduction" components={{ song: <Link className="ds-link" to="/about/songs" /> }} />
          {' '}<span className="video-list-count" aria-live="polite">{videos.status === 'ready' && t('共 {{value0}} 条', { value0: formatNumber(total, 'comma') })}</span>
          <Tooltip classNames={{ root: 'video-list-info-tooltip' }} trigger={['hover', 'focus', 'click']} title={<div className="video-list-info-copy">
            <p>{t('仅展示已发布收录集中未删除、累计收藏大于 100 的投稿，不代表全站全部作品。')}</p>
            {videos.data?.recordDate && <p>{t('统计日期：{{value0}}', { value0: videos.data.recordDate })}</p>}
            <p>{t('累计指标来自该日快照，缺失值显示 —。')}</p>
          </div>}>
            <Button className="ds-text-button video-list-info-trigger" type="text" icon={<QuestionCircleOutlined aria-hidden="true" />} aria-label={t('收录与统计说明')} />
          </Tooltip>
        </p>
      </div>
      <div className="video-list-heading-actions">
        <Link className="ds-link video-list-search-link" to="/uniseek" aria-label={t('查找歌曲、歌手或创作者？前往 Uni Seek →')}>Uni Seek →</Link>
        <div className="video-list-controls">
          {isMobile && <Button className="ds-button" data-variant="secondary" icon={<FilterOutlined aria-hidden="true" />}
            aria-expanded={filterDrawerOpen} aria-controls="video-list-filter-drawer" onClick={() => setFilterDrawerOpen(true)}>{t('筛选条件')}</Button>}
          <Select className="ds-filter-control" variant="borderless" aria-label={t('排序依据')} value={query.sortBy} onChange={sortBy => updateQuery({ sortBy })} options={[
            { value: 'pubdate', label: t('投稿时间') }, { value: 'view', label: t('播放量') }, { value: 'favorite', label: t('收藏量') },
          ]} />
          <Segmented className="ds-segmented" aria-label={t('排序方向')} value={query.order} onChange={order => updateQuery({ order })}
            options={[{ value: 'desc', label: t('降序 ↓') }, { value: 'asc', label: t('升序 ↑') }]} />
          <Segmented className="ds-segmented" aria-label={t('歌曲展示方式')} value={viewMode} onChange={layout => { const next = new URLSearchParams(params); next.set('layout', layout); setParams(next, { replace: true }); }}
            options={[
              { value: 'table', icon: <UnorderedListOutlined aria-hidden="true" />, label: <span className="ds-sr-only">{t('表格模式')}</span>, tooltip: t('表格模式') },
              { value: 'cards', icon: <AppstoreOutlined aria-hidden="true" />, label: <span className="ds-sr-only">{t('卡片模式')}</span>, tooltip: t('卡片模式') },
            ]} />
        </div>
      </div>
    </header>
    <div className="video-list-layout">
    {isMobile ? <Drawer id="video-list-filter-drawer" title={t('筛选条件')} placement="left" width={320}
      open={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)} className="video-list-filter-drawer">
      {filterBlock}
    </Drawer> : <aside className="ds-surface video-list-filters" aria-label={t('歌曲筛选')}>
      <h2>{t('筛选条件')}</h2>
      {filterBlock}
    </aside>}
    <section className="video-list-results" aria-label={t('歌曲列表')} aria-busy={videos.status === 'loading'}>
      {videos.status === 'error' ? <div className="ds-alert video-list-error" data-variant="error" role="alert">
        <span>{t('歌曲列表加载失败，请稍后重试。')}</span><Button className="ds-button" data-variant="secondary" icon={<ReloadOutlined />} onClick={videos.retry}>{t('重试')}</Button>
      </div> : viewMode === 'table' ? <div className="ds-surface video-list-table">
        <DsTable columns={columns} rows={rows.map(row => ({ ...row, id: row.aid }))} caption={t('歌曲列表')}
          loading={videos.status === 'loading'} sortKey={query.sortBy} sortDirection={query.order}
          onSort={(sortBy, order) => updateQuery({ sortBy, order })} emptyText={t('没有符合条件的歌曲，请调整筛选条件。')} />
      </div> : videos.status === 'loading' ? <div className="video-list-state" role="status"><Spin /><span>{t('正在加载歌曲…')}</span></div>
        : rows.length ? <ul className="video-list-grid">{rows.map(video => <li key={video.aid}><VideoCard video={video} showProducer titlePreview showHonor showLike={false} /></li>)}</ul>
          : <div className="video-list-state" role="status"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('没有符合条件的歌曲，请调整筛选条件。')} /></div>}
      <div className="video-list-pagination"><DsPagination current={query.page} pageSize={query.pageSize} total={total}
        disabled={videos.status !== 'ready'} pageSizeOptions={[20, 50, 100]} label={t('歌曲分页')}
        onChange={page => updateQuery({ page }, false)} onPageSizeChange={pageSize => updateQuery({ pageSize })} /></div>
    </section>
    </div>
  </main>;
}

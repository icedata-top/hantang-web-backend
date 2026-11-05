import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, DatePicker, Empty, Form, InputNumber, Segmented, Select, Spin } from 'antd';
import { AppstoreOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons';
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
import { VIDEO_LIST_DEFAULTS, parseVideoListQuery, videoListParams } from './videoListQuery.js';
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
  return { ...(state.key === key ? state : { status: 'loading', data: null }), retry: () => setAttempt(value => value + 1) };
}

export default function VideoList() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseVideoListQuery(params), [params]);
  const queryKey = JSON.stringify(query);
  const [draft, setDraft] = useState(query);
  useEffect(() => { setDraft(JSON.parse(queryKey)); }, [queryKey]);
  const videos = useVideos(queryKey);
  const rows = videos.data?.rows ?? [];
  const viewMode = params.get('layout') === 'cards' ? 'cards' : 'table';
  const total = videos.data?.total ?? 0;

  function updateQuery(next, resetPage = true) {
    const updated = videoListParams({ ...query, ...next, ...(resetPage ? { page: 1 } : {}) });
    if (viewMode === 'cards') updated.set('layout', 'cards');
    setParams(updated);
  }
  useEffect(() => {
    if (videos.status === 'ready') {
      const last = Math.max(1, Math.ceil(total / query.pageSize));
      if (query.page > last) updateQuery({ page: last }, false);
    }
  }, [videos.status, total, query.page, query.pageSize]);
  const setFilter = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const columns = [
    { key: 'title', title: t('歌曲'), render: (title, row) => <div className="video-list-title">
      <VideoInfo aid={row.aid} initialTitle={title || `av${row.aid}`} linkToDetail />
      <span className="video-list-caption">av{row.aid}</span>
    </div> },
    { key: 'userId', title: t('投稿人'), width: '16%', render: id => id ? <ProducerInfo userId={id} /> : '—' },
    { key: 'view', title: t('播放量'), width: 150, align: 'right', sortable: true, render: value => <div className="video-list-views">
      <span>{value == null ? '—' : formatNumber(value, 'comma')}</span><VideoHonor views={value} />
    </div> },
    ...[['favorite', '收藏量'], ['like', '点赞量']].map(([key, title]) => ({ key, title: t(title), width: 108, align: 'right', sortable: true,
      render: value => value == null ? '—' : formatNumber(value, 'comma') })),
    { key: 'pubdate', title: t('投稿时间'), width: 150, sortable: true, render: value => <RelativeTime value={value} /> },
  ];
  const partitions = Object.entries(BILIBILI_SUB_PARTITION_IDS_BY_REGION);
  partitions.sort(([a], [b]) => Number(b === '音乐区') - Number(a === '音乐区'));
  const partitionOptions = partitions.map(([region, ids]) => ({ label: t(region), options: ids.map(id => ({ value: id, label: t(BILIBILI_SUB_PARTITION_ID_TO_NAME.get(id)) })) }));
  const filtersActive = ['startDate', 'endDate', 'honor', 'typeId', 'minView'].some(key => query[key] !== VIDEO_LIST_DEFAULTS[key]);

  return <main className="video-list-page">
    <header className="video-list-heading">
      <div><h1>{t('歌曲')}</h1><p>{t('按投稿时间、播放荣誉和分区浏览已收录的歌曲。')}</p></div>
      <Link className="ds-link" to="/uniseek">{t('查找歌曲、歌手或创作者？前往 Uni Seek →')}</Link>
    </header>
    <section className="ds-surface video-list-filters" aria-label={t('歌曲筛选')}>
      <Form layout="vertical" onFinish={() => updateQuery(draft)}>
        <div className="video-list-filter-grid">
          <Form.Item label={t('投稿日期（北京时间）')} htmlFor="video-list-start-date">
            <DatePicker.RangePicker className="video-list-dates" allowEmpty={[true, true]} id={{ start: 'video-list-start-date', end: 'video-list-end-date' }}
              minDate={dayjs('2009-01-01')} maxDate={dayjs('2100-12-31')}
              placeholder={[t('开始日期'), t('结束日期')]}
              value={draft.startDate || draft.endDate ? [draft.startDate ? dayjs(draft.startDate) : null, draft.endDate ? dayjs(draft.endDate) : null] : null}
              onChange={dates => setDraft(current => ({ ...current, startDate: dates?.[0]?.format('YYYY-MM-DD') ?? '', endDate: dates?.[1]?.format('YYYY-MM-DD') ?? '' }))} />
          </Form.Item>
          <Form.Item label={t('播放荣誉')}>
            <Select aria-label={t('播放荣誉')} value={draft.honor} onChange={value => setFilter('honor', value)} options={[
              { value: 'all', label: t('不限荣誉') }, { value: 'none', label: t('未达殿堂（<10万）') },
              { value: 'hall', label: t('殿堂（10万–100万）') }, { value: 'legend', label: t('传说（100万–1000万）') }, { value: 'myth', label: t('神话（≥1000万）') },
            ]} />
          </Form.Item>
          <Form.Item label={t('分区限定')}>
            <Select aria-label={t('分区限定')} allowClear placeholder={t('全部分区')} value={draft.typeId} onChange={value => setFilter('typeId', value ?? null)}
              options={partitionOptions} />
          </Form.Item>
          <Form.Item label={t('最低播放量')}>
            <InputNumber aria-label={t('最低播放量')} min={0} max={Number.MAX_SAFE_INTEGER} precision={0} step={10000} placeholder={t('不限')}
              value={draft.minView} onChange={value => setFilter('minView', value)} />
          </Form.Item>
        </div>
        <div className="video-list-filter-footer">
          <span className="video-list-caption">{t('荣誉按当前快照的最高等级划分；上限不包含在内。')}</span>
          <div className="video-list-actions">
            <Button className="ds-button" data-variant="secondary" onClick={() => { setDraft({ ...VIDEO_LIST_DEFAULTS }); updateQuery(VIDEO_LIST_DEFAULTS); }}>{t('重置')}</Button>
            <Button className="ds-button" data-variant="primary" htmlType="submit">{t('应用筛选')}</Button>
          </div>
        </div>
      </Form>
    </section>

    <section className="video-list-results" aria-label={t('歌曲列表')} aria-busy={videos.status === 'loading'}>
      <div className="video-list-toolbar">
        <h2>{filtersActive ? t('筛选结果') : t('全部歌曲')}{videos.status === 'ready' && <span>{t('共 {{value0}} 条', { value0: formatNumber(total, 'comma') })}</span>}</h2>
        <div className="video-list-controls">
          <Select aria-label={t('排序依据')} value={query.sortBy} onChange={sortBy => updateQuery({ sortBy })} options={[
            { value: 'pubdate', label: t('投稿时间') }, { value: 'view', label: t('播放量') }, { value: 'favorite', label: t('收藏量') }, { value: 'like', label: t('点赞量') },
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
      <p className="video-list-scope">{t('仅展示已发布收录集中未删除、累计收藏大于 100 的投稿，不代表全站全部作品。')}
        {videos.data?.recordDate && <> {t('统计日期：{{value0}}', { value0: videos.data.recordDate })}</>}
        {' '}{t('累计指标来自该日快照，缺失值显示 —。')}</p>
      {videos.status === 'error' ? <div className="ds-alert video-list-error" data-variant="error" role="alert">
        <span>{t('歌曲列表加载失败，请稍后重试。')}</span><Button className="ds-button" data-variant="secondary" icon={<ReloadOutlined />} onClick={videos.retry}>{t('重试')}</Button>
      </div> : viewMode === 'table' ? <div className="ds-surface video-list-table">
        <DsTable columns={columns} rows={rows.map(row => ({ ...row, id: row.aid }))} caption={t('歌曲列表')}
          loading={videos.status === 'loading'} sortKey={query.sortBy} sortDirection={query.order}
          onSort={(sortBy, order) => updateQuery({ sortBy, order })} emptyText={t('没有符合条件的歌曲，请调整筛选条件。')} />
      </div> : videos.status === 'loading' ? <div className="video-list-state" role="status"><Spin /><span>{t('正在加载歌曲…')}</span></div>
        : rows.length ? <ul className="video-list-grid">{rows.map(video => <li key={video.aid}><VideoCard video={video} showProducer titlePreview showHonor /></li>)}</ul>
          : <div className="video-list-state" role="status"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('没有符合条件的歌曲，请调整筛选条件。')} /></div>}
      <div className="video-list-pagination"><DsPagination current={query.page} pageSize={query.pageSize} total={total}
        disabled={videos.status !== 'ready'} pageSizeOptions={[20, 50, 100]} label={t('歌曲分页')}
        onChange={page => updateQuery({ page }, false)} onPageSizeChange={pageSize => updateQuery({ pageSize })} /></div>
    </section>
  </main>;
}

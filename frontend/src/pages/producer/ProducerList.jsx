import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Button, Empty, Form, InputNumber, Segmented, Select, Spin, Tooltip } from 'antd';
import { AppstoreOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons';
import ProducerInfo from '../../components/custom/ProducerInfo/ProducerInfo.jsx';
import { DsPagination, DsTable } from '../../components/design-system/DataDisplay.jsx';
import { fetchProducerList } from '../../services/Producer/producerList.api.js';
import { formatNumber } from '../../utils/formatNumber.js';
import { PRODUCER_LIST_DEFAULTS, parseProducerListQuery, producerListParams } from './producerListQuery.js';
import './ProducerList.css';

function useProducers(queryKey) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: '', status: 'loading', data: null });
  const key = `${queryKey}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, status: 'loading', data: null });
    fetchProducerList(JSON.parse(queryKey), { signal: controller.signal }).then(
      data => { if (!controller.signal.aborted) setState({ key, status: 'ready', data }); },
      () => { if (!controller.signal.aborted) setState({ key, status: 'error', data: null }); },
    );
    return () => controller.abort();
  }, [queryKey, key]);
  return { ...(state.key === key ? state : { status: 'loading', data: null }), retry: () => setAttempt(value => value + 1) };
}

const counter = value => value == null ? '—' : formatNumber(value, 'comma');

function ProducerIdentity({ producer, card = false }) {
  const { t } = useTranslation();
  const sign = producer.sign?.trim();
  return <div className={`producer-list-identity${card ? ' producer-list-identity--card' : ''}`}>
    <ProducerInfo userId={producer.userId} initialProducer={producer} showAvatar linkToDetail />
    {card && <span className="producer-list-caption">UID {producer.userId}</span>}
    <Tooltip title={sign || undefined} trigger={['hover', 'focus']}>
      <p className="producer-list-sign" tabIndex={sign ? 0 : undefined}>{sign || t('暂无个人简介')}</p>
    </Tooltip>
  </div>;
}

export default function ProducerList() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseProducerListQuery(params), [params]);
  const queryKey = JSON.stringify(query);
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(JSON.parse(queryKey)), [queryKey]);
  const producers = useProducers(queryKey);
  const rows = producers.data?.rows ?? [];
  const total = producers.data?.total ?? 0;
  const viewMode = params.get('layout') === 'cards' ? 'cards' : 'table';
  function updateQuery(next, resetPage = true) {
    const updated = producerListParams({ ...query, ...next, ...(resetPage ? { page: 1 } : {}) });
    if (viewMode === 'cards') updated.set('layout', 'cards');
    setParams(updated);
  }
  useEffect(() => {
    if (producers.status !== 'ready') return;
    const last = Math.max(1, Math.ceil(total / query.pageSize));
    if (query.page > last) updateQuery({ page: last }, false);
  }, [producers.status, total, query.page, query.pageSize]);
  const columns = [
    { key: 'name', title: t('创作者'), render: (_value, row) => <ProducerIdentity producer={row} /> },
    { key: 'userId', title: 'UID', width: 160, sortable: true, render: value => <span className="producer-list-uid">{value}</span> },
    { key: 'fans', title: t('粉丝'), width: 136, align: 'right', sortable: true, render: counter },
    { key: 'videoCount', title: t('收录投稿'), width: 136, align: 'right', sortable: true, render: counter },
    { key: 'officialTitle', title: t('认证头衔'), width: '23%', render: value => value?.trim()
      ? <span className="ds-chip" data-variant="orange">{value}</span> : '—' },
  ];
  const filtered = query.minFans != null || query.minVideos != null;
  return <main className="producer-list-page">
    <header className="producer-list-heading">
      <div><h1>{t('创作者')}</h1><p><Trans i18nKey="producer.listIntroduction" components={{ creator: <Link className="ds-link" to="/about/creators" /> }} /></p></div>
      <Link className="ds-link" to="/uniseek">{t('查找创作者？前往 Uni Seek →')}</Link>
    </header>
    <section className="ds-surface producer-list-filters" aria-label={t('创作者筛选')}>
      <Form layout="vertical" onFinish={() => updateQuery({ minFans: draft.minFans, minVideos: draft.minVideos })}>
        <div className="producer-list-filter-grid">
          <Form.Item label={t('最低粉丝数')}>
            <InputNumber aria-label={t('最低粉丝数')} min={0} max={Number.MAX_SAFE_INTEGER} precision={0} step={1000}
              placeholder={t('不限')} value={draft.minFans} onChange={value => setDraft(current => ({ ...current, minFans: value }))} />
          </Form.Item>
          <Form.Item label={t('最低收录投稿数')}>
            <InputNumber aria-label={t('最低收录投稿数')} min={0} max={2147483647} precision={0}
              placeholder={t('不限')} value={draft.minVideos} onChange={value => setDraft(current => ({ ...current, minVideos: value }))} />
          </Form.Item>
        </div>
        <div className="producer-list-actions">
          <Button className="ds-button" data-variant="secondary" onClick={() => { setDraft({ ...PRODUCER_LIST_DEFAULTS }); updateQuery(PRODUCER_LIST_DEFAULTS); }}>{t('重置')}</Button>
          <Button className="ds-button" data-variant="primary" htmlType="submit">{t('应用筛选')}</Button>
        </div>
      </Form>
    </section>
    <section aria-label={t('创作者列表')} aria-busy={producers.status === 'loading'}>
      <div className="producer-list-toolbar">
        <h2>{filtered ? t('筛选结果') : t('全部创作者')}{producers.status === 'ready' && <span>{t('共 {{value0}} 条', { value0: counter(total) })}</span>}</h2>
        <div className="producer-list-controls">
          <Select aria-label={t('排序依据')} value={query.sortBy} onChange={sortBy => updateQuery({ sortBy })} options={[
            { value: 'fans', label: t('粉丝') }, { value: 'videoCount', label: t('收录投稿') }, { value: 'userId', label: 'UID' },
          ]} />
          <Segmented className="ds-segmented" aria-label={t('排序方向')} value={query.order} onChange={order => updateQuery({ order })}
            options={[{ value: 'desc', label: t('降序 ↓') }, { value: 'asc', label: t('升序 ↑') }]} />
          <Segmented className="ds-segmented" aria-label={t('创作者展示方式')} value={viewMode}
            onChange={layout => { const next = new URLSearchParams(params); next.set('layout', layout); setParams(next, { replace: true }); }}
            options={[
              { value: 'table', icon: <UnorderedListOutlined aria-hidden="true" />, label: <span className="ds-sr-only">{t('表格模式')}</span>, tooltip: t('表格模式') },
              { value: 'cards', icon: <AppstoreOutlined aria-hidden="true" />, label: <span className="ds-sr-only">{t('卡片模式')}</span>, tooltip: t('卡片模式') },
            ]} />
        </div>
      </div>
      <p className="producer-list-scope">{t('展示有收录投稿和头像的创作者；收录投稿数并非账号的全部投稿数，缺失资料显示 —。')}</p>
      {producers.status === 'error' ? <div className="ds-alert producer-list-error" data-variant="error" role="alert">
        <span>{t('创作者列表加载失败，请稍后重试。')}</span><Button className="ds-button" data-variant="secondary" icon={<ReloadOutlined />} onClick={producers.retry}>{t('重试')}</Button>
      </div> : viewMode === 'table' ? <div className="ds-surface producer-list-table">
        <DsTable columns={columns} rows={rows.map(row => ({ ...row, id: row.userId }))} caption={t('创作者列表')}
          loading={producers.status === 'loading'} sortKey={query.sortBy} sortDirection={query.order}
          onSort={(sortBy, order) => updateQuery({ sortBy, order })} emptyText={t('没有符合条件的创作者，请调整筛选条件。')} />
      </div> : producers.status === 'loading' ? <div className="producer-list-state" role="status"><Spin /><span>{t('正在加载创作者…')}</span></div>
        : rows.length ? <ul className="producer-list-grid">{rows.map(producer => <li key={producer.userId}>
          <article className="ds-surface producer-list-card">
            <ProducerIdentity producer={producer} card />
            {producer.officialTitle?.trim() && <span className="ds-chip" data-variant="orange">{producer.officialTitle}</span>}
            <dl className="producer-list-stats">
              <div><dt>{t('粉丝')}</dt><dd>{counter(producer.fans)}</dd></div>
              <div><dt>{t('收录投稿')}</dt><dd>{counter(producer.videoCount)}</dd></div>
            </dl>
          </article>
        </li>)}</ul> : <div className="producer-list-state" role="status"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('没有符合条件的创作者，请调整筛选条件。')} /></div>}
      <div className="producer-list-pagination"><DsPagination current={query.page} pageSize={query.pageSize} total={total}
        disabled={producers.status !== 'ready'} pageSizeOptions={[20, 50, 100]} label={t('创作者分页')}
        onChange={page => updateQuery({ page }, false)} onPageSizeChange={pageSize => updateQuery({ pageSize })} /></div>
    </section>
  </main>;
}

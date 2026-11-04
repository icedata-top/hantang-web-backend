import { useTranslation } from 'react-i18next';
import { Button, Empty, Segmented, Spin, Tooltip } from 'antd';
import { AppstoreOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { DsPagination, DsTable } from '../../components/design-system/DataDisplay.jsx';
import ProducerInfo from '../../components/custom/ProducerInfo/ProducerInfo.jsx';
import RelativeTime from '../../components/custom/RelativeTime/RelativeTime.jsx';
import VideoCard from '../../components/custom/VideoCard/VideoCard.jsx';
import { formatVideoText } from '../video/videoDetailFormat.js';
import { formatNumber } from '../../utils/formatNumber.js';

/** Both layouts render the same server page. Layout never changes query or pagination. */
export default function ProducerVideos({ videos, query, onQueryChange, onPageChange, viewMode, onViewModeChange }) {
  const { t } = useTranslation();

  const rows = videos.data?.rows ?? [];
  const emptyText = query.role === 'staff' ? t("暂无收录的参与投稿") : t("暂无收录的第一作者投稿");
  const columns = [
    { key: 'title', title: t("视频"), render: (value, row) => {
      const title = formatVideoText(value) || `av${row.aid}`;
      const hanging = /^[【（《〈「『〔［｛〖]/u.test(title.trimStart());
      return <div className={`producer-video-title${hanging ? ' producer-video-title--hanging' : ''}`}>
        <Link className="ds-link" to={`/videos/${row.aid}`} title={title}>{title}</Link>
        <span className="producer-detail-caption">av{row.aid}</span>
      </div>;
    } },
    { key: 'userId', title: t("投稿人"), width: 200, render: (value) => value ? <ProducerInfo userId={value} showAvatar={query.role === 'staff'} /> : '—' },
    { key: 'view', title: t("播放量"), width: 130, align: 'right', sortable: true, render: (value, row) => <Tooltip title={row.recordDate ? t("统计日期：{{value0}}", { value0: row.recordDate }) : t("暂无日快照")}>
      <span>{value == null ? '—' : formatNumber(value, 'comma')}</span>
    </Tooltip> },
    { key: 'pubdate', title: t("投稿时间"), width: 160, sortable: true, render: (value) => <RelativeTime value={value} /> },
  ];

  return <section className="ds-surface producer-detail-videos" aria-labelledby="producer-detail-videos-title">
    <div className="producer-detail-toolbar">
      <h2 id="producer-detail-videos-title">{t("投稿")}</h2>
      <Segmented className="ds-segmented producer-detail-role" aria-label={t("作者身份")} value={query.role} onChange={(role) => onQueryChange({ role })}
        options={[{ value: 'uploader', label: t("第一作者") }, { value: 'staff', label: t("参与作者") }]} />
      <Segmented className="ds-segmented producer-detail-view-mode" aria-label={t("投稿展示方式")} value={viewMode} onChange={onViewModeChange}
        options={[
          { value: 'list', icon: <UnorderedListOutlined aria-hidden="true" />, label: <span className="ds-sr-only">{t("列表模式")}</span>, tooltip: t("列表模式") },
          { value: 'cards', icon: <AppstoreOutlined aria-hidden="true" />, label: <span className="ds-sr-only">{t("卡片模式")}</span>, tooltip: t("卡片模式") },
        ]} />
      <div className="producer-detail-sort">
        <div className="producer-detail-sort-field"><span>{t("排序")}</span><Segmented
          aria-label={t("排序依据")} value={query.sortBy} onChange={(sortBy) => onQueryChange({ sortBy })}
          options={[{ value: 'pubdate', label: t("投稿时间") }, { value: 'view', label: t("播放量") }]} /></div>
        <Segmented aria-label={t("排序方向")} value={query.order} onChange={(order) => onQueryChange({ order })}
          options={[{ value: 'desc', label: t("降序 ↓") }, { value: 'asc', label: t("升序 ↑") }]} />
      </div>
    </div>
    <p className="producer-detail-list-hint">{t("仅展示冰数据已收录的投稿。播放量为各视频最新一次收录的累计值。")}</p>
    {videos.status === 'error' || videos.status === 'missing' ? <div className="ds-alert producer-detail-error" data-variant="error" role="alert">
      <span>{t("投稿列表加载失败，请稍后重试。")}</span>
      <Button className="ds-button" data-variant="secondary" onClick={videos.retry} icon={<ReloadOutlined />}>{t("重试")}</Button>
    </div> : viewMode === 'list' ? <DsTable columns={columns} rows={rows.map((row) => ({ ...row, id: row.aid }))}
      caption={t("创作者投稿列表")} loading={videos.status === 'loading'} sortKey={query.sortBy} sortDirection={query.order}
      onSort={(sortBy, order) => onQueryChange({ sortBy, order })} emptyText={emptyText} />
      : videos.status === 'loading' ? <div className="producer-videos-state" role="status" aria-busy="true"><Spin /><span>{t("正在加载投稿…")}</span></div>
        : rows.length ? <ul className="producer-videos-grid" aria-label={t("创作者投稿卡片")}>
          {rows.map((video) => <li key={video.aid}><VideoCard video={video} showProducer={query.role === 'staff'} /></li>)}
        </ul> : <div className="producer-videos-state" role="status"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} /></div>}
    <div className="producer-detail-pagination"><DsPagination current={query.page} pageSize={query.pageSize} total={videos.data?.total ?? 0}
      disabled={videos.status !== 'ready'} pageSizeOptions={[10, 20, 50, 100]}
      onChange={onPageChange} onPageSizeChange={(pageSize) => onQueryChange({ pageSize })} /></div>
  </section>;
}

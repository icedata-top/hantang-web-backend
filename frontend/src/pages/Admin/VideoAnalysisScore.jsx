import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Collapse, Select } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { DsPagination, DsTable } from '../../components/design-system/DataDisplay.jsx';
import VideoInfo from '../../components/custom/VideoInfo/VideoInfo.jsx';
import { fetchVideoAnalysisScore, videoAnalysisDownloadUrl } from '../../services/Admin/videoAnalysis.api.js';
import { filterScoreEntries, formatScoreAccuracy, SCORE_CLASSES } from './videoAnalysisScoreModel.js';

export default function VideoAnalysisScore({ evaluation, canScore, onRescore }) {
  const { t } = useTranslation();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('errors');
  const [page, setPage] = useState(1);
  const completed = evaluation?.status === 'completed';
  const summary = evaluation?.summary;
  const filtered = filterScoreEntries(report?.entries ?? [], filter);
  const pageRows = filtered.slice((page - 1) * 20, page * 20);
  async function loadDetails() {
    if (report || loading) return;
    setLoading(true); setError(false);
    try { setReport(await fetchVideoAnalysisScore()); }
    catch { setError(true); }
    finally { setLoading(false); }
  }
  const metric = (key, value) => <div><dt>{t(key)}</dt><dd>{value ?? '—'}</dd></div>;
  const classColumns = [
    { key: 'id', title: t('score.category'), render: value => t(`score.class.${value}`) },
    { key: 'scorable_count', title: t('score.scorable') },
    { key: 'correct_count', title: t('score.correct') },
    { key: 'incorrect_count', title: t('score.incorrect') },
    { key: 'accuracy', title: t('score.accuracy'), render: formatScoreAccuracy },
  ];
  const labelText = output => output ? `${t(`review.value.${output.is_song}`)} / ${t(`review.value.${output.is_virtual_singer}`)}` : t('score.missing');
  const detailColumns = [
    { key: 'title', title: t('review.video'), render: (value, entry) => <VideoInfo aid={entry.aid} initialTitle={value} className="review-video-title" /> },
    { key: 'reference', title: t('score.referenceLabels'), render: labelText },
    { key: 'prediction', title: t('score.predictionLabels'), render: labelText },
    { key: 'reason', title: t('score.judgment'), render: value => t(`score.reason.${value}`) },
  ];
  return <div className="review-execution-summary review-score" aria-labelledby="qwen-score-title">
    <div className="review-execution-heading">
      <h3 id="qwen-score-title">{t('score.title')}</h3>
      {canScore && <Button className="ds-button" data-variant="secondary" icon={<ReloadOutlined />} onClick={onRescore}>
        {t(completed ? 'score.rescore' : 'score.start')}
      </Button>}
      {completed && <Button className="ds-button" data-variant="secondary" icon={<DownloadOutlined />} href={videoAnalysisDownloadUrl('score')}>{t('score.download')}</Button>}
    </div>
    {evaluation?.status === 'scoring' && <p role="status">{t('score.scoring')}</p>}
    {evaluation?.status === 'failed' && <Alert className="ds-alert review-notice" data-variant="warning" type="warning" showIcon
      title={t('score.failed', { code: evaluation.error })} />}
    {!completed && evaluation?.status !== 'scoring' && evaluation?.status !== 'failed' && <p className="review-help">{t('score.notScored')}</p>}
    {completed && <>
      <dl className="review-execution-stats review-execution-primary">
        {metric('score.totalScore', `${summary.correct_count} / ${summary.scorable_count}`)}
        {metric('score.accuracy', formatScoreAccuracy(summary.accuracy))}
        {metric('score.unscorable', summary.unscorable_count)}
      </dl>
      <p className="review-help">{t('score.rules')}</p>
      <p className="review-help">{t('score.missingHint', { count: summary.missing_prediction_count })}</p>
      {summary.prompt_example_count > 0 && <p className="review-help">{t('score.promptExamples', { count: summary.prompt_example_count })}</p>}
      <DsTable caption={t('score.classScores')} columns={classColumns}
        rows={SCORE_CLASSES.map(id => ({ id, ...summary.classes[id] }))} />
      <Collapse ghost className="review-execution-details" onChange={keys => { if (keys.includes('entries')) loadDetails(); }} items={[{
        key: 'entries', label: t('score.details'), children: <>
          <label className="review-concurrency">
            <span>{t('score.filter')}</span>
            <Select className="ds-filter-control" variant="borderless" value={filter} onChange={value => { setFilter(value); setPage(1); }}
              options={['errors', 'unscorable', 'all'].map(value => ({ value, label: t(`score.filter.${value}`) }))} />
          </label>
          {error && <Alert className="ds-alert review-notice" data-variant="error" type="error" title={t('score.loadFailed')}
            action={<Button className="ds-button" data-variant="secondary" onClick={loadDetails}>{t('analysis.refresh')}</Button>} />}
          <p className="review-help">{t('score.labelOrder')}</p>
          <DsTable caption={t('score.details')} columns={detailColumns} rows={pageRows.map(entry => ({ ...entry, id: entry.aid }))}
            loading={loading} emptyText={t('score.noMatches')} />
          <DsPagination current={page} pageSize={20} total={filtered.length} onChange={setPage} label={t('score.details')} />
        </>,
      }]} />
      <p className="review-help">{t('score.version', { version: evaluation.rules_version, sha: evaluation.reference?.sha256?.slice(0, 12) ?? '—' })}</p>
    </>}
  </div>;
}

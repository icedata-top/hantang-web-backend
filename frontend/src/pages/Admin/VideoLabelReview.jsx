import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Checkbox, Drawer, Empty, Input, Modal, Segmented, Select, Skeleton, Tag, Tooltip, Upload, message } from 'antd';
import { CheckOutlined, DownloadOutlined, EditOutlined, ExportOutlined, InfoCircleOutlined, LeftOutlined, ReloadOutlined, RightOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import VideoInfo from '../../components/custom/VideoInfo/VideoInfo.jsx';
import { DsPagination, DsTable } from '../../components/design-system/DataDisplay.jsx';
import { COMMON_LANGUAGES, MAX_REVIEW_FILE_BYTES, SONG_VALUES, VOICE_VALUES, acceptReviewDefaults, applyReviewCorrection, changeReviewLanguages, filterReviewEntries, parseReviewFile, reviewExportName, serializeReviewReport, validateReviewReport } from './videoReviewModel.js';
import { readReviewDraft, saveReviewDraft } from './videoReviewStorage.js';
import VideoAnalysisPanel from './VideoAnalysisPanel.jsx';
import './VideoLabelReview.css';

const REFERENCE_FILE_NAME = 'reference_answers.reviewed-final.json';
const loadReference = async () => validateReviewReport((await import('../../../../script/uniseek/reference_answers.reviewed-final.json')).default);
const adoptWorkspace = workspace => ({ ...workspace, report: acceptReviewDefaults(workspace.report),
  correctedAids: Array.isArray(workspace.correctedAids) ? workspace.correctedAids : [] });

export default function VideoLabelReview() {
  const { t } = useTranslation();
  const [notify, notificationHolder] = message.useMessage();
  const [modal, modalHolder] = Modal.useModal();
  const [workspace, setWorkspace] = useState(null);
  const [selectedAid, setSelectedAid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState('saving');
  const [query, setQuery] = useState('');
  const [songScope, setSongScope] = useState('all');
  const [uncertainOnly, setUncertainOnly] = useState(false);
  const [correctedOnly, setCorrectedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let draft = null;
      try { draft = await readReviewDraft(); }
      catch { if (!cancelled) setSaveState('failed'); }
      try {
        const next = draft ? { ...draft, report: validateReviewReport(draft.report) }
          : { report: await loadReference(), fileName: REFERENCE_FILE_NAME, needsExport: false };
        if (cancelled) return;
        setWorkspace(adoptWorkspace(next));
      } catch { if (!cancelled) setLoadError(draft ? 'review.invalidDraft' : 'review.loadFailed'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!workspace) return;
    let current = true;
    setSaveState('saving');
    // Start every write immediately; IndexedDB serializes the transactions, including when leaving this page.
    saveReviewDraft(workspace).then(() => { if (current) setSaveState('saved'); })
      .catch(() => { if (current) setSaveState('failed'); });
    return () => { current = false; };
  }, [workspace]);

  useEffect(() => {
    if (!workspace?.needsExport || saveState === 'saved') return;
    const preventLoss = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [workspace?.needsExport, saveState]);

  const report = workspace?.report;
  const correctedAids = workspace?.correctedAids;
  const filtered = useMemo(() => report ? filterReviewEntries(report, { query, songScope, uncertainOnly, correctedOnly, correctedAids }) : [], [report, query, songScope, uncertainOnly, correctedOnly, correctedAids]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const pageEntries = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const active = report?.results.find(entry => entry.aid === selectedAid);
  const activeIndex = active ? filtered.findIndex(entry => entry.aid === active.aid) : -1;
  const languageOptions = useMemo(() => {
    const values = new Set(COMMON_LANGUAGES);
    report?.results.forEach(entry => entry.output.languages.forEach(lang => values.add(lang)));
    return [...values].map(value => ({ value, label: t(`review.language.${value}`, { defaultValue: value }) }));
  }, [report, t]);

  function selectEntry(aid, entries = filtered) {
    setSelectedAid(aid);
    const index = entries.findIndex(entry => entry.aid === aid);
    if (index >= 0) setPage(Math.floor(index / pageSize) + 1);
  }

  function edit(change) {
    setWorkspace(current => ({ ...current, report: applyReviewCorrection(current.report, active.aid, change),
      correctedAids: [...new Set([...current.correctedAids, active.aid])], needsExport: true }));
  }

  function replaceWorkspace(next) {
    const apply = () => {
      setWorkspace(adoptWorkspace(next));
      setSelectedAid(null);
      setQuery(''); setSongScope('all'); setUncertainOnly(false); setCorrectedOnly(false); setPage(1); setLoadError('');
    };
    if (workspace?.needsExport) {
      modal.confirm({ title: t('review.replaceTitle'), content: t('review.replaceBody'), okText: t('review.replace'), cancelText: t('review.keep'), onOk: apply });
    } else apply();
  }

  async function importFile(file) {
    if (file.size > MAX_REVIEW_FILE_BYTES) { notify.error(t('review.tooLarge')); return; }
    setBusy(true);
    try {
      const next = parseReviewFile(await file.text());
      replaceWorkspace({ report: next, fileName: file.name, needsExport: false });
    } catch { notify.error(t('review.invalidFile')); }
    finally { setBusy(false); }
  }

  async function resetReference() {
    setBusy(true);
    try { replaceWorkspace({ report: await loadReference(), fileName: REFERENCE_FILE_NAME, needsExport: false }); }
    catch { notify.error(t('review.loadFailed')); }
    finally { setBusy(false); }
  }

  function exportFile() {
    try {
      const blob = new Blob([serializeReviewReport(report)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = reviewExportName(workspace.fileName);
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setWorkspace(current => ({ ...current, needsExport: false }));
      notify.success(t('review.downloadStarted'));
    } catch { notify.error(t('review.exportFailed')); }
  }

  const resetFilters = () => { setQuery(''); setSongScope('all'); setUncertainOnly(false); setCorrectedOnly(false); setPage(1); };
  const valueTag = value => <Tag className={`ds-chip${value === '不确定' ? ' ds-status-tag' : ''}`} data-health={value === '不确定' ? 'warning' : undefined}>{t(`review.value.${value}`)}</Tag>;
  const languages = entry => <div className="review-result-tags">{entry.output.languages.map(lang => <Tag key={lang}
    className={`ds-chip${lang === '未知语言' ? ' ds-status-tag' : ''}`} data-health={lang === '未知语言' ? 'warning' : undefined}>{t(`review.language.${lang}`, { defaultValue: lang })}</Tag>)}</div>;
  const videoTitle = entry => <div className="review-row-video">
    <VideoInfo aid={entry.aid} initialTitle={entry.input.title} className="review-video-title" />
    <div className="review-row-meta"><span>av{entry.aid}</span>
      {correctedAids?.includes(entry.aid) && <Tag className="ds-chip">{t('review.corrected')}</Tag>}
      {entry.review.note && <Tooltip title={entry.review.note} trigger={['hover', 'focus', 'click']}>
        <Button type="text" size="small" icon={<InfoCircleOutlined />} aria-label={t('review.note')} />
      </Tooltip>}
    </div>
  </div>;
  const editButton = entry => <Button className="ds-button" data-variant="secondary" size="small" icon={<EditOutlined />}
    disabled={busy} onClick={() => selectEntry(entry.aid)} aria-label={t('review.editVideo', { title: entry.input.title || `av${entry.aid}` })}>{t('review.edit')}</Button>;
  const columns = [
    { key: 'video', title: t('review.video'), render: (_, entry) => videoTitle(entry) },
    { key: 'song', title: t('review.song'), width: '100px', render: (_, entry) => valueTag(entry.output.is_song) },
    { key: 'voice', title: t('review.voice'), width: '130px', render: (_, entry) => valueTag(entry.output.is_virtual_singer) },
    { key: 'languages', title: t('review.languageColumn'), width: '180px', render: (_, entry) => languages(entry) },
    { key: 'edit', title: t('review.actions'), width: '100px', render: (_, entry) => editButton(entry) },
  ];
  return <main className="admin-page review-page">
    {notificationHolder}{modalHolder}
    <p className="review-crumb">{t('管理配置')} / {t('内容')}</p>
    <h1>{t('视频标注复核')}</h1>
    <p className="admin-lead">{t('review.lead')}</p>
    <VideoAnalysisPanel />
    <section className="review-toolbar ds-surface" aria-label={t('review.files')}>
      <div className="review-file-actions">
        <Upload accept=".json,application/json" maxCount={1} showUploadList={false} disabled={loading || busy}
          beforeUpload={file => { void importFile(file); return Upload.LIST_IGNORE; }}>
          <Button className="ds-button" data-variant="secondary" icon={<UploadOutlined />} disabled={loading || busy}>{t('review.import')}</Button>
        </Upload>
        <Button className="ds-button" data-variant="normal" icon={<ReloadOutlined />} disabled={loading || busy} onClick={resetReference}>{t('review.loadReference')}</Button>
        <Button className="ds-button" data-variant="primary" icon={<DownloadOutlined />} disabled={!report || busy} onClick={exportFile}>{t('review.export')}</Button>
      </div>
      {report && <div className="review-progress" role="status">
        <strong>{t('review.overview', { total: report.results.length, count: correctedAids.length })}</strong>
        <span>{t(`review.save.${saveState}`)}</span>
        {workspace.needsExport && <Tag className="ds-chip">{t('review.needsExport')}</Tag>}
      </div>}
      <p className="review-help">{workspace?.fileName && <span>{workspace.fileName} · </span>}{t('review.saveHint')}</p>
    </section>
    {loading && <Skeleton active paragraph={{ rows: 6 }} />}
    {loadError && <Alert className="ds-alert" data-variant="error" type="error" showIcon title={t(loadError)} />}
    {report && <>
      {saveState === 'failed' && <Alert className="ds-alert review-notice" data-variant="warning" type="warning" showIcon title={t('review.storageFailed')} />}
      {report.processed_count < report.selected_count && <Alert className="ds-alert review-notice" data-variant="info" type="info" showIcon title={t('review.partial', { done: report.processed_count, total: report.selected_count })} />}
      <section className="review-filters ds-surface" aria-label={t('review.filters')}>
        <Input className="ds-filter-control review-search" variant="borderless" prefix={<SearchOutlined />} allowClear value={query}
          aria-label={t('review.search')} placeholder={t('review.search')} onChange={event => { setQuery(event.target.value); setPage(1); setSelectedAid(null); }} />
        <div className="review-scope-filter">
          <span id="review-song-scope-label">{t('review.songScope')}</span>
          <Select className="ds-filter-control review-scope-control" variant="borderless" value={songScope} aria-labelledby="review-song-scope-label" aria-describedby="review-song-scope-hint"
            options={['all', 'virtual-song', 'other'].map(value => ({ value, label: t(`review.songScope.${value}`) }))}
            onChange={value => { setSongScope(value); setPage(1); setSelectedAid(null); }} />
        </div>
        <Checkbox checked={uncertainOnly} onChange={event => { setUncertainOnly(event.target.checked); setPage(1); }}>{t('review.uncertainOnly')}</Checkbox>
        <Checkbox checked={correctedOnly} onChange={event => { setCorrectedOnly(event.target.checked); setPage(1); }}>{t('review.correctedOnly')}</Checkbox>
        <p id="review-song-scope-hint" className="review-help review-scope-hint">{t('review.songScopeHint')}</p>
      </section>
        <section className="review-results ds-surface" aria-label={t('review.queue')}>
          <h2>{t('review.queueCount', { count: filtered.length })}</h2>
          <div className="review-desktop-list">
            {filtered.length > 0 && <DsTable caption={t('review.queue')} columns={columns} rows={pageEntries.map(entry => ({ ...entry, id: entry.aid }))} emptyText={t('review.noMatches')} />}
          </div>
          <div className="review-mobile-list">
            {pageEntries.map(entry => <article className="review-result-card" key={entry.aid}>
              {videoTitle(entry)}
              <dl className="review-card-judgments">
                <div><dt>{t('review.song')}</dt><dd>{valueTag(entry.output.is_song)}</dd></div>
                <div><dt>{t('review.voice')}</dt><dd>{valueTag(entry.output.is_virtual_singer)}</dd></div>
                <div><dt>{t('review.languageColumn')}</dt><dd>{languages(entry)}</dd></div>
              </dl>
              {editButton(entry)}
            </article>)}
          </div>
          {!filtered.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('review.noMatches')}>
            <Button className="ds-button" data-variant="secondary" onClick={resetFilters}>{t('review.showAll')}</Button>
          </Empty>}
          <DsPagination current={currentPage} pageSize={pageSize} total={filtered.length} label={t('review.queue')}
            pageSizeOptions={[20, 50, 100, 1000]} onPageSizeChange={value => { setPageSize(value); setPage(1); }} onChange={setPage} />
        </section>
        <Drawer className="review-drawer" title={t('review.edit')} open={Boolean(active)} size="min(680px, 100vw)" onClose={() => setSelectedAid(null)}
          footer={active && <div className="review-editor-actions">
            <Button className="ds-button" data-variant="secondary" icon={<LeftOutlined />} disabled={busy || activeIndex <= 0} onClick={() => selectEntry(filtered[activeIndex - 1].aid)}>{t('review.previous')}</Button>
            <Button className="ds-button" data-variant="secondary" icon={<RightOutlined />} disabled={busy || activeIndex >= filtered.length - 1} onClick={() => selectEntry(filtered[activeIndex + 1].aid)}>{t('review.next')}</Button>
            <Button className="ds-button" data-variant="primary" icon={<CheckOutlined />} onClick={() => setSelectedAid(null)}>{t('review.done')}</Button>
          </div>}>
        {active && <section className="review-editor" aria-labelledby="review-video-title" key={active.aid}>
          <div className="review-editor-top"><span>{activeIndex < 0 ? t('review.outsideFilter') : t('review.position', { current: activeIndex + 1, total: filtered.length })}</span>
            <Tag className="ds-chip">{t(`review.status.${active.review.status}`)}</Tag></div>
          <h2 id="review-video-title"><VideoInfo aid={active.aid} initialTitle={active.input.title} className="review-video-title" /></h2>
          <div className="review-video-links"><span>av{active.aid}</span>
            <a href={`https://www.bilibili.com/video/av${active.aid}`} target="_blank" rel="noopener noreferrer">{t('review.watch')} <ExportOutlined /></a></div>
          <div className="review-tags">{active.input.tag_new?.map((tag, index) => <Tag className="ds-chip" key={`${index}-${tag}`}>{tag}</Tag>)}</div>
          <details className="review-description"><summary>{t('review.description')}</summary><p>{active.input.description || t('review.noDescription')}</p></details>
          <fieldset className="review-field"><legend>{t('review.song')}</legend>
            <Segmented className="ds-segmented" disabled={busy} value={active.output.is_song} aria-label={t('review.song')}
              options={SONG_VALUES.map(value => ({ value, label: t(`review.value.${value}`) }))}
              onChange={value => edit({ output: { ...active.output, is_song: value } })} />
            <p className="review-help">{t('review.songHint')}</p>
          </fieldset>
          <fieldset className="review-field"><legend>{t('review.voice')}</legend>
            <Segmented className="ds-segmented" disabled={busy} value={active.output.is_virtual_singer} aria-label={t('review.voice')}
              options={VOICE_VALUES.map(value => ({ value, label: t(`review.value.${value}`) }))}
              onChange={value => edit({ output: { ...active.output, is_virtual_singer: value } })} />
            <p className="review-help">{t('review.voiceHint')}</p>
          </fieldset>
          <div className="review-field"><label htmlFor="review-language">{t('review.languages')}</label>
            <Select id="review-language" className="ds-filter-control review-languages" variant="borderless" mode="multiple" allowClear disabled={busy}
              value={active.output.languages} options={languageOptions} optionFilterProp="label" aria-describedby="review-language-hint"
              onChange={values => edit({ output: { ...active.output, languages: changeReviewLanguages(active.output.languages, values) } })} />
            <p id="review-language-hint" className="review-help">{t('review.languageHint')}</p>
          </div>
          <div className="review-field"><label htmlFor="review-note">{t('review.note')}</label>
            <Input.TextArea id="review-note" className="ds-filter-control" variant="borderless" autoSize={{ minRows: 2, maxRows: 8 }} disabled={busy}
              value={active.review.note} onChange={event => edit({ note: event.target.value })} />
          </div>
          <p className="review-help">{t('review.confirmHint')}</p>
        </section>}
        </Drawer>
    </>}
  </main>;
}

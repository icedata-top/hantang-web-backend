import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Masonry, Spin } from 'antd';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMeshParallax } from '../../hooks/useMeshParallax.js';
import * as searchApi from '../../services/UniSeek/uniseek.api.js';
import { createUniSeekSession } from '../../services/UniSeek/uniseekSession.js';
import UniSeekFilter from './components/UniSeekFilter.jsx';
import UniSeekItem from './components/UniSeekItem.jsx';
import './UniSeek.css';

/** 滚动多少像素后毛玻璃卡片完全显现 */
const FILTER_GLASS_SCROLL_RANGE = 88;

/**
 * 将页面滚动映射为搜索条毛玻璃显现进度 [0, 1]，写入 CSS 变量避免逐帧 setState。
 * @param {React.RefObject<HTMLElement | null>} targetRef
 */
function useFilterGlassOnScroll(targetRef) {
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return undefined;

    let rafId = 0;

    const apply = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const t = Math.min(1, Math.max(0, y / FILTER_GLASS_SCROLL_RANGE));
      // ease-out：前段更快露出一点轮廓，后段收缓到满不透明
      const glass = 1 - (1 - t) ** 2.15;
      el.style.setProperty('--uniseek-glass', glass.toFixed(4));
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      el.style.removeProperty('--uniseek-glass');
    };
  }, [targetRef]);
}

const emptyResults = () => ({ list: [], pending: [], errors: {}, nextPage: null,
  loadingMore: false, moreError: null, videoLimit: 1000 });
const sourceLabels = {
  videos: ['歌曲', 'Songs'], producers: ['UP 主', 'Creators'],
  videoId: ['编号对应的歌曲', 'Video ID'], producerId: ['UID 对应的 UP 主', 'Creator UID'],
};

export default function UniSeek() {
  const { t } = useTranslation();

  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState(emptyResults);
  const { list, pending, errors, nextPage, loadingMore, moreError, videoLimit } = results;
  const loading = pending.length > 0;
  const hasErrors = Object.keys(errors).length > 0 || Boolean(moreError);
  const [retry, setRetry] = useState(0);
  const searchRef = useRef(null);
  const sentinelRef = useRef(null);
  const activeKeyword = (searchParams.get('keyword') ?? '').trim();
  const hasSearched = Boolean(activeKeyword);
  const filterShellRef = useRef(null);

  useMeshParallax(true);
  useFilterGlassOnScroll(filterShellRef);

  const items = useMemo(
    () =>
      list.map((item) => ({
        key: `${item.type}-${item.id}`,
        data: item,
      })),
    [list],
  );

  useEffect(() => {
    setKeyword(activeKeyword);
    setResults(emptyResults());
    if (!activeKeyword) { searchRef.current = null; return undefined; }
    const session = createUniSeekSession(activeKeyword, searchApi, setResults);
    searchRef.current = session;
    session.start();
    return () => { session.dispose(); if (searchRef.current === session) searchRef.current = null; };
  }, [activeKeyword, retry]);

  const waitingForVideos = pending.includes('videos');
  useEffect(() => {
    if (!nextPage || waitingForVideos || loadingMore || moreError || !sentinelRef.current
      || !globalThis.IntersectionObserver) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) searchRef.current?.loadMore();
    }, { rootMargin: '500px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [nextPage, waitingForVideos, loadingMore, moreError]);

  const handleSearch = (nextKeyword) => {
    const keywordTrimmed = (nextKeyword ?? '').trim();
    setKeyword(keywordTrimmed);
    if (keywordTrimmed === activeKeyword) setRetry((value) => value + 1);
    else setSearchParams(keywordTrimmed ? { keyword: keywordTrimmed } : {});
  };

  return (
    <div className="uniseek-page">
      <div className="uniseek-filter-sticky">
        <div className="uniseek-filter-shell" ref={filterShellRef}>
          <UniSeekFilter
            keyword={keyword}
            loading={loading}
            onKeywordChange={setKeyword}
            onSearch={handleSearch}
          />
        </div>
      </div>

      <div className="uniseek-result-wrap">
        {hasSearched ? (
          <div className="uniseek-result-meta" aria-live="polite">
            {items.length ? (
              <p className="uniseek-result-count">
                <Trans i18nKey="search.loaded" count={items.length} components={{ count: <em /> }} />
              </p>
            ) : (
              <p className="uniseek-result-count uniseek-result-count--empty">
                {loading ? t("正在搜索…") : hasErrors ? t("部分结果暂未加载，请重试") : t("未找到匹配结果")}
              </p>
            )}
          </div>
        ) : null}

        <div className="uniseek-results">
          {items.length ? (
            <Masonry
              columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}
              gutter={[14, 14]}
              items={items}
              itemRender={(item) => (
                <UniSeekItem item={item.data} keyword={activeKeyword} />
              )}
            />
          ) : !loading ? (
            <div className="uniseek-empty">
              <Empty
                description={
                  hasErrors ? t("部分结果暂未加载，请重试") : hasSearched ? t('换个关键词试试吧') : t('搜索一首歌、一位虚拟歌手或一位创作者')
                }
              />
            </div>
          ) : null}
        </div>
        {Object.keys(errors).length > 0 ? (
          <div className="uniseek-source-errors" role="status">
            {Object.keys(errors).map(source => <div key={source}>
              <span>{t((sourceLabels[source])[0])}{t("加载失败")}</span>
              <Button className="ds-button" data-variant="secondary"
                onClick={() => searchRef.current?.retry(source)}>{t("重试")}</Button>
            </div>)}
          </div>
        ) : null}
        <div ref={sentinelRef} className="uniseek-load-more" aria-live="polite" aria-busy={loading || loadingMore}>
          {loading || loadingMore ? <><Spin size="small" /><span>{t("正在加载更多结果…")}</span></> : null}
          {!waitingForVideos && !loadingMore && nextPage ? (
            <Button className="ds-button" data-variant="secondary" onClick={() => searchRef.current?.loadMore()}>
              {moreError ? t("重试加载歌曲") : t("加载更多歌曲")}
            </Button>
          ) : null}
          {!loading && !loadingMore && !hasErrors && !nextPage && items.length > 0 ? (
            <span>{items.filter(({ data }) => data.type === 'video').length >= videoLimit
              ? t("Beta 最多展示 1,000 首歌曲，请缩小关键词范围")
              : t("本次结果已加载完毕")}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

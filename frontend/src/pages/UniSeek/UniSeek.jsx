import { useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Masonry, Spin, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMeshParallax } from '../../hooks/useMeshParallax.js';
import { ApiError } from '../../services/http/client.js';
import { seek } from '../../services/UniSeek/uniseek.api.js';
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

export default function UniSeek() {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
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

  const runSearch = (nextKeyword) => {
    const trimmed = (nextKeyword ?? '').trim();
    if (!trimmed) {
      setList([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    seek({ keyword: trimmed })
      .then((data) => {
        setList(data?.list ?? []);
      })
      .catch((err) => {
        setList([]);
        if (err instanceof ApiError) {
          message.error(`[${err.code}] ${err.message}`);
          return;
        }
        message.error(err?.message || '搜索失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const q = (searchParams.get('keyword') ?? '').trim();
    setKeyword(q);
    if (q) runSearch(q);
    else {
      setList([]);
      setHasSearched(false);
    }
  }, [searchParams]);

  const handleSearch = (nextKeyword) => {
    const keywordTrimmed = (nextKeyword ?? '').trim();
    setKeyword(keywordTrimmed);
    setSearchParams(keywordTrimmed ? { keyword: keywordTrimmed } : {});
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
        {hasSearched && !loading ? (
          <div className="uniseek-result-meta" aria-live="polite">
            {items.length ? (
              <p className="uniseek-result-count">
                {isZh ? (
                  <>
                    找到 <em>{items.length}</em> 条结果
                  </>
                ) : (
                  <>
                    Found <em>{items.length}</em> {items.length === 1 ? 'result' : 'results'}
                  </>
                )}
              </p>
            ) : (
              <p className="uniseek-result-count uniseek-result-count--empty">
                {t('未找到匹配结果', 'No matching results')}
              </p>
            )}
          </div>
        ) : null}

        <Spin spinning={loading}>
          {items.length ? (
            <Masonry
              columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}
              gutter={[14, 14]}
              items={items}
              itemRender={(item) => (
                <UniSeekItem item={item.data} keyword={(searchParams.get('keyword') ?? '').trim()} />
              )}
            />
          ) : (
            <div className="uniseek-empty">
              <Empty
                description={
                  hasSearched ? '换个关键词试试吧' : '搜索一首歌、一位虚拟歌手或一位创作者'
                }
              />
            </div>
          )}
        </Spin>
      </div>
    </div>
  );
}

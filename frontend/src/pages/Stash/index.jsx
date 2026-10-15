import { ExportOutlined, LinkOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Drawer, FloatButton, Input } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BOOKMARK_GROUPS, getFaviconUrl, STASH_META } from './bookmarks.js';
import {
  buildTocFromGroups,
  countBookmarkLinks,
  filterBookmarkGroups,
} from './stashSearch.js';
import './index.css';

const TOC_BREAKPOINT = 1080;
const SCROLL_OFFSET = 88;

function groupAnchorId(groupId) {
  return `stash-${groupId}`;
}

function sectionAnchorId(groupId, sectionId) {
  return `stash-${groupId}-${sectionId}`;
}

function buildTocEntries() {
  return buildTocFromGroups(BOOKMARK_GROUPS);
}

function StashFavicon({ url }) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = getFaviconUrl(url);

  if (!faviconUrl || failed) {
    return <LinkOutlined />;
  }

  return (
    <img
      className="stash-favicon"
      src={faviconUrl}
      alt=""
      width={18}
      height={18}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function StashLinkCard({ link, t }) {
  const desc = t(link.descZh, link.descEn);
  const note = link.noteZh || link.noteEn ? t(link.noteZh, link.noteEn) : '';

  return (
    <li key={link.url}>
      <a className="stash-card app-card-surface" href={link.url} target="_blank" rel="noreferrer">
        <span className="stash-card-icon" aria-hidden>
          <StashFavicon url={link.url} />
        </span>
        <span className="stash-card-main">
          <span className="stash-card-name">{link.name}</span>
          {desc && <span className="stash-card-desc">{desc}</span>}
          {note && <span className="stash-card-note">{note}</span>}
        </span>
        <span className="stash-card-go" aria-hidden>
          <ExportOutlined />
        </span>
      </a>
    </li>
  );
}

function StashLinkGrid({ links, t }) {
  return (
    <ul className="stash-grid">
      {links.map((link) => (
        <StashLinkCard key={link.url} link={link} t={t} />
      ))}
    </ul>
  );
}

function StashTocNav({ entries, activeId, onNavigate, t }) {
  return (
    <nav className="stash-toc-nav" aria-label={t('目录', 'Contents')}>
      <p className="stash-toc-heading">{t('目录', 'Contents')}</p>
      <ul className="stash-toc-list">
        {entries.map((group) => (
          <li key={group.id} className="stash-toc-item">
            <a
              href={`#${group.anchorId}`}
              className={`stash-toc-link${activeId === group.anchorId ? ' is-active' : ''}`}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(group.anchorId);
              }}
            >
              {t(group.titleZh, group.titleEn)}
            </a>
            {group.children?.length ? (
              <ul className="stash-toc-sublist">
                {group.children.map((section) => (
                  <li key={section.id} className="stash-toc-subitem">
                    <a
                      href={`#${section.anchorId}`}
                      className={`stash-toc-sublink${activeId === section.anchorId ? ' is-active' : ''}`}
                      onClick={(event) => {
                        event.preventDefault();
                        onNavigate(section.anchorId);
                      }}
                    >
                      {t(section.titleZh, section.titleEn)}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function Stash() {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);

  const tocEntries = useMemo(() => buildTocEntries(), []);
  const anchorIds = useMemo(
    () =>
      tocEntries.flatMap((group) => [
        group.anchorId,
        ...(group.children?.map((section) => section.anchorId) ?? []),
      ]),
    [tocEntries],
  );

  const [activeId, setActiveId] = useState(anchorIds[0] ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= TOC_BREAKPOINT : true,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isSearching = searchQuery.trim().length > 0;

  const visibleGroups = useMemo(
    () => filterBookmarkGroups(BOOKMARK_GROUPS, searchQuery, isZh),
    [searchQuery, isZh],
  );

  const visibleTocEntries = useMemo(
    () => (isSearching ? buildTocFromGroups(visibleGroups) : tocEntries),
    [isSearching, visibleGroups, tocEntries],
  );

  const visibleAnchorIds = useMemo(
    () =>
      visibleTocEntries.flatMap((group) => [
        group.anchorId,
        ...(group.children?.map((section) => section.anchorId) ?? []),
      ]),
    [visibleTocEntries],
  );

  const resultCount = useMemo(() => countBookmarkLinks(visibleGroups), [visibleGroups]);

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${TOC_BREAKPOINT}px)`);
    const sync = () => setIsWide(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (isSearching) return undefined;

    const elements = anchorIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!elements.length) return undefined;

    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((record) => record.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        root: null,
        rootMargin: `-${SCROLL_OFFSET}px 0px -55% 0px`,
        threshold: [0, 0.1, 0.25, 0.5, 1],
      },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [anchorIds, isSearching]);

  useEffect(() => {
    if (isSearching && visibleAnchorIds[0]) {
      setActiveId(visibleAnchorIds[0]);
    }
  }, [isSearching, visibleAnchorIds]);

  const navigateToAnchor = (anchorId) => {
    const element = document.getElementById(anchorId);
    if (!element) return;

    const top = element.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET + 4;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveId(anchorId);
    setDrawerOpen(false);
  };

  const tocNav = (
    <StashTocNav
      entries={visibleTocEntries}
      activeId={activeId}
      onNavigate={navigateToAnchor}
      t={t}
    />
  );

  return (
    <main className="stash-page">
      <div className="stash-layout">
        <div className="stash-main">
          <header className="stash-header">
            <span className="stash-eyebrow">{t('收藏夹', 'Bookmarks')}</span>
            <h1 className="stash-title">{t(STASH_META.titleZh, STASH_META.titleEn)}</h1>
            <div className="stash-search-wrap">
              <Input
                className="stash-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                allowClear
                prefix={<SearchOutlined aria-hidden />}
                placeholder={t('搜索站点名称或摘要…', 'Search by name or description…')}
                aria-label={t('搜索收藏站点', 'Search bookmarks')}
              />
              {isSearching ? (
                <p className="stash-search-meta" aria-live="polite">
                  {resultCount > 0
                    ? t(`找到 ${resultCount} 个站点`, `${resultCount} site(s) found`)
                    : t('无匹配站点', 'No matching sites')}
                </p>
              ) : null}
            </div>
          </header>

          <div className="stash-body">
            {visibleGroups.length === 0 ? (
              <p className="stash-empty">{t('无匹配站点，请换个关键词试试', 'No results. Try another keyword.')}</p>
            ) : (
              visibleGroups.map((group) => (
              <section
                key={group.id}
                id={groupAnchorId(group.id)}
                className="stash-group stash-anchor"
                aria-label={t(group.titleZh, group.titleEn)}
              >
                <h2 className="stash-group-title">{t(group.titleZh, group.titleEn)}</h2>

                {group.sections ? (
                  <div className="stash-subgroups">
                    {group.sections.map((section) => (
                      <div
                        key={section.id}
                        id={sectionAnchorId(group.id, section.id)}
                        className="stash-subgroup stash-anchor"
                      >
                        <h3 className="stash-subgroup-title">{t(section.titleZh, section.titleEn)}</h3>
                        <StashLinkGrid links={section.links} t={t} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <StashLinkGrid links={group.links} t={t} />
                )}
              </section>
              ))
            )}
          </div>
        </div>

        {isWide ? <aside className="stash-toc-aside">{tocNav}</aside> : null}
      </div>

      {!isWide ? (
        <>
          <FloatButton
            className="stash-toc-float"
            type="primary"
            icon={<UnorderedListOutlined />}
            tooltip={t('目录', 'Contents')}
            aria-label={t('打开目录', 'Open table of contents')}
            onClick={() => setDrawerOpen(true)}
          />
          <Drawer
            title={t('目录', 'Contents')}
            placement="right"
            width={280}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            className="stash-toc-drawer"
            destroyOnClose={false}
          >
            {tocNav}
          </Drawer>
        </>
      ) : null}
    </main>
  );
}

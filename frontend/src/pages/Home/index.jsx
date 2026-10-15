import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Input, Spin, Statistic, message } from 'antd';
import { useMeshParallax } from '../../hooks/useMeshParallax.js';
import { ApiError } from '../../services/http/client.js';
import { fetchHomeOverview, mapHomeDataToStats } from '../../services/Home/home.api.js';
import './index.css';

const { Search } = Input;

/** 可跳转的统计项 → 路由与按钮文案（记录跨度除外） */
const STAT_LINKS = {
  songs: { path: '/videos', labelZh: '查看歌曲', labelEn: 'View songs' },
  artists: { path: '/vocals', labelZh: '查看歌手', labelEn: 'View vocals' },
  creators: { path: '/producers', labelZh: '查看创作者', labelEn: 'View producers' },
};

export default function Home() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);

  useMeshParallax(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    fetchHomeOverview()
      .then((data) => {
        if (cancelled) return;
        setStats(data ? mapHomeDataToStats(data) : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setStats([]);
        if (err instanceof ApiError) {
          message.error(`[${err.code}] ${err.message}`);
          return;
        }
        message.error(err?.message || '请求失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = (rawValue) => {
    const keyword = (rawValue ?? '').trim();
    if (!keyword) return;
    navigate(`/uniseek?keyword=${encodeURIComponent(keyword)}`);
  };

  return (
    <div className="home-page">
      <section className="home-hero">
        <img
          className="home-logo"
          src="/png/icedata_logo_512x.png"
          alt={t('冰数据', 'icedata')}
        />

        <div className="home-search">
          <Search
            placeholder={t('搜索一首歌，一位虚拟歌手，或一位创作者', 'Search a Song, a Vocal, or a Producer')}
            enterButton={t('搜索', 'Search')}
            size="large"
            className="home-search-input"
            onSearch={handleSearch}
          />
        </div>
      </section>

      <section className="home-stats-scroll" aria-label={t('数据概览', 'Data Overview')}>
        <Spin spinning={loading}>
          <div className="home-stats-row">
            {stats.map((item) => {
              const localized = {
                songs: { title: t('收录歌曲', 'Songs Indexed'), suffix: t('首', '') },
                artists: { title: t('收录歌手', 'Vocals Indexed'), suffix: t('位', '') },
                creators: { title: t('收录创作者', 'Producers Indexed'), suffix: t('位', '') },
                spanDays: { title: t('记录跨度', 'Timespan'), suffix: t('日', 'days') },
              }[item.key] ?? { title: item.title, suffix: item.suffix };
              const link = STAT_LINKS[item.key];

              return (
                <div
                  key={item.key}
                  className={`home-stat-item${link ? ' home-stat-item--interactive' : ''}`}
                >
                  <Statistic
                    title={localized.title}
                    value={item.value}
                    suffix={localized.suffix}
                    valueStyle={{ color: 'var(--text)' }}
                  />
                  {link ? (
                    <Link to={link.path} className="home-stat-action">
                      {t(link.labelZh, link.labelEn)}
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Spin>
      </section>

      <footer className="home-footer">
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noreferrer"
          className="home-footer-link"
        >
          苏ICP备2022012035
        </a>
        <span className="home-footer-sep">｜</span>
        <span className="home-footer-text">{t('Copyright 2026', 'Copyright 2026')}</span>
        <span className="home-footer-sep">｜</span>
        <Link to="/about" className="home-footer-link">
          {t('关于冰数据', 'About icedata')}
        </Link>
      </footer>
    </div>
  );
}

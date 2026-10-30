import { cloneElement, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, Drawer, Menu } from 'antd';
import { MenuOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { getMenuKeyFromPathname, MENU_KEY_TO_PATH } from '../routes/menuPaths.js';
import './IcedataNavbar.css';
import { ADMIN_ENABLED } from '../config/runtimeEnv.js';

/** 此宽度及以下：导航改为右上角选项按钮，菜单放进右侧抽屉 */
const NARROW_NAV_QUERY = '(max-width: 767px)';

function useNarrowNav() {
  const [isNarrow, setIsNarrow] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(NARROW_NAV_QUERY).matches : false
  ));

  useEffect(() => {
    const media = window.matchMedia(NARROW_NAV_QUERY);
    const sync = () => setIsNarrow(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return isNarrow;
}

export default function IcedataNavbar() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isNarrow = useNarrowNav();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);

  const menuItems = [
    { key: 'home', label: t('首页', 'Home') },
    { key: 'overview', label: t('总览', 'Overview') },
    { key: 'videos', label: t('歌曲', 'Songs') },
    { key: 'vocals', label: t('虚拟歌手', 'Vocals') },
    { key: 'producers', label: t('创作者', 'Producers') },
    {
      key: 'links',
      label: t('友情链接', 'Links'),
      children: [
        {
          key: 'link_tdd',
          label: (
            <a href="https://tdd.bunnyxt.com/" target="_blank" rel="noreferrer">
              {t('天钿 Daily', 'Tiandian Daily')}
            </a>
          ),
        },
        {
          key: 'link_cvse',
          label: (
            <a href="https://cvse.cc/" target="_blank" rel="noreferrer">
              CVSE+
            </a>
          ),
        },
        {
          key: 'link_vsqx',
          label: (
            <a href="https://www.vsqx.top/" target="_blank" rel="noreferrer">
              {t('VSQX分享平台', 'VSQX Platform')}
            </a>
          ),
        },
        {
          key: 'link_hjy',
          label: (
            <a href="https://www.huajianyou.com/" target="_blank" rel="noreferrer">
              {t('花间游', 'Huajianyou')}
            </a>
          ),
        },
        {
          key: 'link_vcpedia',
          label: (
            <a href="https://www.vcpedia.cn/" target="_blank" rel="noreferrer">
              VCpedia.cn
            </a>
          ),
        },
      ],
    },
    { key: 'about', label: t('关于', 'About') },
    ...(ADMIN_ENABLED ? [{ key: 'admin', label: t('管理配置', 'Administration') }] : []),
  ];

  const selectedKeys = useMemo(() => {
    const key = getMenuKeyFromPathname(location.pathname);
    return key ? [key] : [];
  }, [location.pathname]);

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    setIsDark(currentTheme === 'dark');
  }, []);

  useEffect(() => {
    if (!isNarrow) setDrawerOpen(false);
  }, [isNarrow]);

  function handleThemeToggle() {
    const nextIsDark = !isDark;
    setIsDark(nextIsDark);

    if (nextIsDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      return;
    }

    document.documentElement.removeAttribute('data-theme');
  }

  function handleLanguageToggle() {
    i18n.changeLanguage(isZh ? 'en' : 'zh');
  }

  function handleDrawerNavigate(key) {
    const path = MENU_KEY_TO_PATH[key];
    if (!path) return;
    setDrawerOpen(false);
    navigate(path);
  }

  return (
    <header className="icedata-navbar-wrap">
      <Card className="icedata-navbar-card ds-surface" variant="borderless" styles={{ body: { padding: '0 16px' } }}>
        <div className="icedata-navbar-inner">
          <Link to="/" className="icedata-navbar-logo-link" aria-label="冰数据首页">
            <img
              className="icedata-navbar-logo"
              src="/png/icedata_logo_with_name_512x.png"
              alt="冰数据"
            />
          </Link>
          {isNarrow ? (
            <button
              type="button"
              className="ds-button icedata-nav-options"
              data-variant="normal"
              onClick={() => setDrawerOpen(true)}
              aria-label={t('选项', 'Options')}
              aria-expanded={drawerOpen}
              aria-controls="icedata-nav-drawer"
              title={t('选项', 'Options')}
            >
              <MenuOutlined />
            </button>
          ) : (
            <>
              <div className="icedata-navbar-menu-wrap">
                <Menu
                  mode="horizontal"
                  selectedKeys={selectedKeys}
                  items={menuItems}
                  overflowedIndicator={<span className="icedata-menu-overflow-icon">...</span>}
                  className="icedata-navbar-menu"
                  onClick={({ key }) => {
                    if (String(key).startsWith('link_')) return;
                    const path = MENU_KEY_TO_PATH[key];
                    if (path) navigate(path);
                  }}
                />
              </div>
              <button
                type="button"
                className="ds-button icedata-lang-toggle"
                data-variant="normal"
                onClick={handleLanguageToggle}
                aria-label={isZh ? t('切换到英文', 'Switch to English') : t('切换到中文', 'Switch to Chinese')}
                title={isZh ? t('英文模式', 'English Mode') : t('中文模式', 'Chinese Mode')}
              >
                {isZh ? 'En' : '中'}
              </button>
              <button
                type="button"
                className="ds-button icedata-theme-toggle"
                data-variant="normal"
                onClick={handleThemeToggle}
                aria-label={isDark ? t('切换到日间模式', 'Switch to Light Mode') : t('切换到夜间模式', 'Switch to Dark Mode')}
                title={isDark ? t('日间模式', 'Light Mode') : t('夜间模式', 'Dark Mode')}
              >{isDark ? <SunOutlined /> : <MoonOutlined />}</button>
            </>
          )}
        </div>
      </Card>
      {isNarrow && (
        <Drawer
          id="icedata-nav-drawer"
          rootClassName="icedata-nav-drawer-root"
          className="icedata-nav-drawer"
          title={t('选项', 'Options')}
          placement="right"
          size={320}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          destroyOnHidden={false}
          footer={(
            <div className="icedata-nav-drawer-actions">
              <button
                type="button"
                className="ds-button icedata-lang-toggle"
                data-variant="normal"
                onClick={handleLanguageToggle}
                aria-label={isZh ? t('切换到英文', 'Switch to English') : t('切换到中文', 'Switch to Chinese')}
                title={isZh ? t('英文模式', 'English Mode') : t('中文模式', 'Chinese Mode')}
              >
                {isZh ? 'En' : '中'}
              </button>
              <button
                type="button"
                className="ds-button icedata-theme-toggle"
                data-variant="normal"
                onClick={handleThemeToggle}
                aria-label={isDark ? t('切换到日间模式', 'Switch to Light Mode') : t('切换到夜间模式', 'Switch to Dark Mode')}
                title={isDark ? t('日间模式', 'Light Mode') : t('夜间模式', 'Dark Mode')}
              >{isDark ? <SunOutlined /> : <MoonOutlined />}</button>
            </div>
          )}
          styles={{
            section: { background: 'var(--navbar-bg)', color: 'var(--text)' },
            header: { background: 'transparent', borderBottom: '1px solid var(--border)' },
            body: { background: 'transparent', padding: '8px 12px 20px' },
            footer: { background: 'transparent', borderTop: 'none', padding: '12px 16px 16px' },
            title: { color: 'var(--text)' },
          }}
        >
          <nav className="icedata-nav-drawer-nav" aria-label={t('选项', 'Options')}>
            <ul className="icedata-nav-drawer-list">
              {menuItems.map((item) => {
                if (item.children) {
                  return (
                    <li key={item.key}>
                      <div className="icedata-nav-drawer-label">{item.label}</div>
                      <ul className="icedata-nav-drawer-list">
                        {item.children.map((child) => (
                          <li key={child.key}>
                            {cloneElement(child.label, {
                              className: 'icedata-nav-drawer-link',
                              onClick: () => setDrawerOpen(false),
                            })}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                }

                const selected = selectedKeys.includes(item.key);
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={selected ? 'icedata-nav-drawer-item is-active' : 'icedata-nav-drawer-item'}
                      aria-current={selected ? 'page' : undefined}
                      onClick={() => handleDrawerNavigate(item.key)}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Drawer>
      )}
    </header>
  );
}

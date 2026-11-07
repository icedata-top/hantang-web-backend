import { LANGUAGE_OPTIONS, getLanguageSettings } from '../locales/languages.js';
import { cloneElement, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Drawer, Dropdown, Menu, Segmented } from 'antd';
import { CheckOutlined, DownOutlined, MenuOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
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
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const isNarrow = useNarrowNav();
  const selectedLanguage = getLanguageSettings(i18n.language);

  const menuItems = [
    { key: 'home', label: t("首页") },
    { key: 'overview', label: t("总览") },
    { key: 'videos', label: t("歌曲") },
    { key: 'vocals', label: t("虚拟歌手") },
    { key: 'producers', label: t("创作者") },
    {
      key: 'links',
      label: t("友情链接"),
      children: [
        {
          key: 'link_tdd',
          label: (
            <a href="https://tdd.bunnyxt.com/" target="_blank" rel="noreferrer">
              {t("天钿 Daily")}
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
              {t("VSQX分享平台")}
            </a>
          ),
        },
        {
          key: 'link_hjy',
          label: (
            <a href="https://www.huajianyou.com/" target="_blank" rel="noreferrer">
              {t("花间游")}
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
    { key: 'about', label: t("关于") },
    ...(ADMIN_ENABLED ? [{ key: 'admin', label: t("管理配置") }] : []),
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
    else setLanguageMenuOpen(false);
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

  function handleLanguageChange(language) {
    if (!LANGUAGE_OPTIONS.some(option => option.value === language)) return;
    setLanguageMenuOpen(false);
    if (language !== selectedLanguage.value) i18n.changeLanguage(language);
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
          <Link to="/" className="icedata-navbar-logo-link" aria-label={t('冰数据首页')}>
            <img
              className="icedata-navbar-logo"
              src="/png/icedata_logo_with_name_512x.png"
              alt={t('冰数据')}
            />
          </Link>
          {isNarrow ? (
            <button
              type="button"
              className="ds-button icedata-nav-options"
              data-variant="normal"
              onClick={() => setDrawerOpen(true)}
              aria-label={t("选项")}
              aria-expanded={drawerOpen}
              aria-controls="icedata-nav-drawer"
              title={t("选项")}
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
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                autoFocus
                open={languageMenuOpen}
                onOpenChange={setLanguageMenuOpen}
                classNames={{ root: 'icedata-language-dropdown' }}
                menu={{
                  id: 'icedata-language-menu',
                  'aria-label': t('选择语言'),
                  lang: selectedLanguage.lang,
                  selectable: true,
                  selectedKeys: [selectedLanguage.value],
                  items: LANGUAGE_OPTIONS.map(({ value, label, lang }) => ({
                    key: value,
                    label: <span className="icedata-language-menu-label" lang={lang}>
                      <span>{label}</span>
                      {value === selectedLanguage.value ? <CheckOutlined aria-hidden="true" /> : null}
                    </span>,
                  })),
                  onClick: ({ key }) => handleLanguageChange(key),
                }}
              >
                <Button
                  type="text"
                  className="ds-button icedata-language-trigger"
                  data-variant="normal"
                  lang={selectedLanguage.lang}
                  aria-label={`${t('选择语言')}: ${selectedLanguage.label}`}
                  aria-haspopup="menu"
                  aria-expanded={languageMenuOpen}
                  aria-controls={languageMenuOpen ? 'icedata-language-menu' : undefined}
                  title={t('选择语言')}
                >
                  <span lang={selectedLanguage.lang}>{selectedLanguage.label}</span>
                  <DownOutlined aria-hidden="true" />
                </Button>
              </Dropdown>
              <button
                type="button"
                className="ds-button icedata-theme-toggle"
                data-variant="normal"
                onClick={handleThemeToggle}
                aria-label={isDark ? t("切换到日间模式") : t("切换到夜间模式")}
                title={isDark ? t("日间模式") : t("夜间模式")}
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
          title={t("选项")}
          placement="right"
          size={320}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          destroyOnHidden={false}
          footer={(
            <div className="icedata-nav-drawer-actions">
              <div className="icedata-nav-language-control" lang={selectedLanguage.lang}>
                <span id="icedata-language-label" className="icedata-nav-language-label">{t('语言')}</span>
                <Segmented
                  className="ds-segmented icedata-language-segmented"
                  block
                  aria-labelledby="icedata-language-label"
                  value={selectedLanguage.value}
                  onChange={handleLanguageChange}
                  options={LANGUAGE_OPTIONS.map(({ value, label, lang }) => ({
                    value, label: <span lang={lang}>{label}</span>,
                  }))}
                />
              </div>
              <button
                type="button"
                className="ds-button icedata-theme-toggle"
                data-variant="normal"
                onClick={handleThemeToggle}
                aria-label={isDark ? t("切换到日间模式") : t("切换到夜间模式")}
                title={isDark ? t("日间模式") : t("夜间模式")}
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
          <nav className="icedata-nav-drawer-nav" aria-label={t("选项")}>
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

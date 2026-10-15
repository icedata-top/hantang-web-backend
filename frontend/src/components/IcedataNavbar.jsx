import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Menu } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { getMenuKeyFromPathname, MENU_KEY_TO_PATH } from '../routes/menuPaths.js';
import './IcedataNavbar.css';

export default function IcedataNavbar() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(false);
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
  ];

  const selectedKeys = useMemo(() => {
    const key = getMenuKeyFromPathname(location.pathname);
    return key ? [key] : [];
  }, [location.pathname]);

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    setIsDark(currentTheme === 'dark');
  }, []);

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

  return (
    <header className="icedata-navbar-wrap">
      <Card className="icedata-navbar-card" bodyStyle={{ padding: '0 16px' }}>
        <div className="icedata-navbar-inner">
          <Link to="/" className="icedata-navbar-logo-link" aria-label="冰数据首页">
            <img
              className="icedata-navbar-logo"
              src="/png/icedata_logo_with_name_512x.png"
              alt="冰数据"
            />
          </Link>
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
          <Button
            className="icedata-lang-toggle"
            onClick={handleLanguageToggle}
            shape="circle"
            aria-label={isZh ? t('切换到英文', 'Switch to English') : t('切换到中文', 'Switch to Chinese')}
            title={isZh ? t('英文模式', 'English Mode') : t('中文模式', 'Chinese Mode')}
          >
            {isZh ? 'En' : '中'}
          </Button>
          <Button
            className="icedata-theme-toggle"
            onClick={handleThemeToggle}
            shape="circle"
            icon={isDark ? <SunOutlined /> : <MoonOutlined />}
            aria-label={isDark ? t('切换到日间模式', 'Switch to Light Mode') : t('切换到夜间模式', 'Switch to Dark Mode')}
            title={isDark ? t('日间模式', 'Light Mode') : t('夜间模式', 'Dark Mode')}
          />
        </div>
      </Card>
    </header>
  );
}

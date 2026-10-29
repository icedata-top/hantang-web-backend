import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Menu, Result } from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  FormOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { CURRENT_APP_ENV, getApiBaseUrl } from '../../config/runtimeEnv.js';
import DesignSpec from './DesignSpec.jsx';
import DesignComponents from './DesignComponents.jsx';
import {
  ADMIN_NAV,
  adminRootGroupKeys,
  buildAdminMenuItems,
  findAdminLeaf,
  findAdminLeafByKey,
} from './adminNav.js';
import './index.css';

const TOP_ICONS = {
  runtime: <SettingOutlined />,
  data: <DatabaseOutlined />,
  content: <FormOutlined />,
  observe: <BarChartOutlined />,
  design: <AppstoreOutlined />,
};

const CONSTRUCTION_ILLUSTRATION = '/svg/undraw_code-contribution_8k0x.svg';

function useZhCopy() {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);
  return { isZh, t };
}

function AdminRuntime() {
  const { t } = useZhCopy();

  return (
    <main className="admin-page">
      <h1>{t('运行环境', 'Runtime')}</h1>
      <p className="admin-lead">
        {t(
          '查看当前系统的运行配置。设计分组可查看视觉规范，其余栏目仍在规划中。',
          'View the current system configuration. Visual specifications are available under Design; the other sections are still planned.',
        )}
      </p>
      <section className="admin-panel ds-surface" aria-labelledby="admin-environment-title">
        <h2 id="admin-environment-title">{t('当前配置', 'Current configuration')}</h2>
        <dl className="admin-config-list">
          <div><dt>{t('当前环境', 'Environment')}</dt><dd>{CURRENT_APP_ENV}</dd></div>
          <div><dt>{t('API 地址', 'API base URL')}</dt><dd>{getApiBaseUrl() || t('MOCK（不请求后端）', 'MOCK (no backend requests)')}</dd></div>
          <div><dt>{t('管理入口', 'Admin entry')}</dt><dd>{t('已启用', 'Enabled')}</dd></div>
        </dl>
        <p className="admin-panel-note">
          {t(
            '配置由部署环境提供，修改后需重新启动开发服务器或重新构建部署。',
            'Configuration is supplied by the deployment environment. Restart the development server or rebuild and deploy after changes.',
          )}
        </p>
      </section>
    </main>
  );
}

function AdminPlaceholder({ leaf }) {
  const { t } = useZhCopy();
  const crumb = [...leaf.ancestors, leaf].map((node) => t(node.zh, node.en)).join(' / ');
  const points = t(leaf.pointsZh, leaf.pointsEn);

  return (
    <main className="admin-section page-result" aria-labelledby="admin-section-title">
      <p className="admin-crumb">{crumb}</p>
      <Result
        icon={<img className="page-result-illustration" src={CONSTRUCTION_ILLUSTRATION} alt="" decoding="async" />}
        title={<h1 id="admin-section-title" className="admin-section-title">{t(leaf.zh, leaf.en)}</h1>}
        subTitle={t(`施工中。${leaf.summaryZh}`, `Under construction. ${leaf.summaryEn}`)}
      />
      <section className="admin-placeholder-note" aria-label={t('计划内容', 'Planned contents')}>
        <h2>{t('计划包含', 'Planned contents')}</h2>
        <ul>
          {points.map((point) => <li key={point}>{point}</li>)}
        </ul>
      </section>
    </main>
  );
}

function AdminMissing() {
  const { t } = useZhCopy();
  const navigate = useNavigate();

  return (
    <main className="admin-section page-result">
      <Result
        icon={<img className="page-result-illustration" src="/svg/undraw_page-not-found_6wni.svg" alt="" decoding="async" />}
        title={t('页面不存在', 'Page Not Found')}
        subTitle={t('管理目录中没有这个地址。', 'This address is not in the administration menu.')}
        extra={(
          <Button type="primary" onClick={() => navigate('/admin')}>
            {t('返回运行环境', 'Back to runtime')}
          </Button>
        )}
      />
    </main>
  );
}

export default function Admin() {
  const { isZh, t } = useZhCopy();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const leaf = findAdminLeaf(pathname);
  const [openKeys, setOpenKeys] = useState(() => {
    const ancestors = leaf?.ancestors.map((node) => node.key) ?? [];
    return [...new Set([...adminRootGroupKeys(), ...ancestors])];
  });

  useEffect(() => {
    if (!leaf) return;
    const ancestors = leaf.ancestors.map((node) => node.key);
    setOpenKeys((current) => [...new Set([...current, ...ancestors])]);
  }, [leaf]);

  const items = useMemo(
    () => buildAdminMenuItems(ADMIN_NAV, t, TOP_ICONS),
    [isZh, t],
  );

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar ds-surface" aria-label={t('管理目录', 'Administration menu')}>
        <div className="admin-sidebar-heading">
          <p className="admin-sidebar-title">{t('管理配置', 'Administration')}</p>
        </div>
        <Menu
          mode="inline"
          className="admin-side-menu"
          items={items}
          selectedKeys={leaf ? [leaf.key] : []}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          onClick={({ key }) => {
            const target = findAdminLeafByKey(key);
            if (target) navigate(target.path);
          }}
        />
      </aside>
      <div className="admin-main">
        {leaf?.key === 'runtime' ? <AdminRuntime /> : null}
        {leaf?.key === 'spec' ? <DesignSpec /> : null}
        {leaf?.key === 'components' ? <DesignComponents /> : null}
        {leaf && !['runtime', 'spec', 'components'].includes(leaf.key) ? <AdminPlaceholder leaf={leaf} /> : null}
        {!leaf ? <AdminMissing /> : null}
      </div>
    </div>
  );
}

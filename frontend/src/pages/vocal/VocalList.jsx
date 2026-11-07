import { useState } from 'react';
import { Alert, Empty, Input } from 'antd';
import { CloseOutlined, InfoCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import catalog from '../../constants/vocal/vocal-frontend-info.json';
import { normalizeVocalImagePath } from './vocalProfile.js';
import './VocalList.css';

export default function VocalList() {
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  const keyword = search.trim().toLocaleLowerCase();
  const groups = catalog.group_list.map((group) => ({
    ...group,
    vocals: catalog.vocal_list.filter((vocal) => vocal.group_id === group.id
      && [vocal.name, group.name, group.short_name].some((value) => value?.toLocaleLowerCase().includes(keyword))),
  })).filter((group) => group.vocals.length > 0);
  const count = groups.reduce((total, group) => total + group.vocals.length, 0);

  return (
    <main className="vocal-list">
      <header className="vocal-list-header">
        <h1>{t("虚拟歌手")}</h1>
        <Input
          className="vocal-list-search"
          prefix={<SearchOutlined aria-hidden />}
          placeholder={t("搜索歌手或组织")}
          aria-label={t("搜索歌手或组织")}
          allowClear
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </header>
      <Alert
        className="ds-alert vocal-list-notice"
        data-variant="info"
        type="info"
        showIcon
        icon={<InfoCircleOutlined aria-hidden="true" />}
        closable={{ closeIcon: <CloseOutlined aria-hidden="true" />, 'aria-label': t('vocal.dismissCatalogNotice') }}
        title={<Trans i18nKey="vocal.catalogNotice" components={{
          vocal: <Link className="ds-link" to="/about/virtual-singers" />,
          about: <Link className="ds-link" to="/about" />,
        }} />}
      />
      <p className="vocal-list-count" role="status">
        {t("共 {{value0}} 位歌手", { value0: count })}
      </p>
      {groups.length ? groups.map((group) => (
        <section className="vocal-list-group" key={group.id} aria-labelledby={`vocal-group-${group.id}`}>
          <h2 id={`vocal-group-${group.id}`} title={group.name}>{group.short_name || group.name}</h2>
          <ul className="vocal-list-grid">
            {group.vocals.map((vocal) => (
              <li key={vocal.id}>
                <Link className="vocal-list-card" to={`/vocals/${vocal.id}`}>
                  <img src={normalizeVocalImagePath(vocal.image_path)} alt="" loading="lazy" />
                  <span>{vocal.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )) : <Empty description={t("没有找到匹配的歌手，试试其他关键词")} />}
    </main>
  );
}

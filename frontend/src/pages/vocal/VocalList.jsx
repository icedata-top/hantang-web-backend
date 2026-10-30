import { useState } from 'react';
import { Empty, Input } from 'antd';
import { InfoCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import catalog from '../../constants/vocal/vocal-frontend-info.json';
import { normalizeVocalImagePath } from './vocalProfile.js';
import './VocalList.css';

export default function VocalList() {
  const { i18n } = useTranslation();
  const isZh = String(i18n.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);
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
        <h1>{t('虚拟歌手', 'Virtual singers')}</h1>
        <Input
          className="vocal-list-search"
          prefix={<SearchOutlined aria-hidden />}
          placeholder={t('搜索歌手或组织', 'Search singers or organizations')}
          aria-label={t('搜索歌手或组织', 'Search singers or organizations')}
          allowClear
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </header>
      <div className="ds-alert vocal-list-notice" data-variant="info">
        <InfoCircleOutlined aria-hidden="true" />
        <p>
          {isZh ? <>当前展示的仅为部分虚拟歌手，本站正在不断补全。如果您希望收录某位虚拟歌手，可以通过<Link className="ds-link" to="/about">关于</Link>联系冰数据。</>
            : <>Only some virtual singers are shown, and the catalog is still being completed. To request a singer, contact icedata via <Link className="ds-link" to="/about">About</Link>.</>}
        </p>
      </div>
      <p className="vocal-list-count" role="status">
        {t(`共 ${count} 位歌手`, `${count} singers`)}
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
      )) : <Empty description={t('没有找到匹配的歌手，试试其他关键词', 'No matching singers. Try another keyword.')} />}
    </main>
  );
}

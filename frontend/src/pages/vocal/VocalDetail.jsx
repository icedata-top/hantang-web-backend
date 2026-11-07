import { Fragment, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Button, Result, Tag } from 'antd';
import { ArrowLeftOutlined, ExportOutlined, PictureOutlined } from '@ant-design/icons';
import catalog from '../../constants/vocal/vocal-frontend-info.json';
import { fanColorInk, formatVocalBirthday, getVocalArtworkSource, resolveVocalProfile, vocalExternalUrl } from './vocalProfile.js';
import { useVocalDepth } from './useVocalDepth.js';
import './VocalDetail.css';

function VocalBackdrop() {
  const patternId = `vocal-hatch-${useId().replace(/:/g, '')}`;
  return <svg className="vocal-hero-pattern" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs>
      <pattern id={patternId} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <path className="vocal-pattern-line" d="M 0 0 V 10" />
      </pattern>
      <pattern id={`${patternId}-secondary`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <path className="vocal-pattern-line vocal-pattern-line--secondary" d="M 0 0 V 10" />
      </pattern>
    </defs>
    <polygon className="vocal-pattern-square" points="65,95 840,35 1030,650 255,710" fill={`url(#${patternId})`} />
    <circle className="vocal-pattern-circle" cx="980" cy="630" r="140" fill={`url(#${patternId}-secondary)`} />
  </svg>;
}

function VocalArtwork({ profile, t }) {
  const [failed, setFailed] = useState(false);
  const { vocal, imageSrc } = profile;
  return <figure className="vocal-artwork">
    <div className="vocal-artwork-frame">
      {imageSrc && !failed ? <img className="vocal-artwork-image" src={imageSrc} alt={t("{{value0}}的角色立绘", { value0: vocal.name })}
        decoding="async" fetchpriority="high" onError={() => setFailed(true)} />
        : <div className="vocal-artwork-missing" role="img" aria-label={t("角色立绘暂缺")}>
          <PictureOutlined aria-hidden="true" /><span>{t("立绘暂缺")}</span>
        </div>}
    </div>
  </figure>;
}

function VocalLinks({ profile, t }) {
  const { vocal, group } = profile;
  const imageSourceUrl = vocalExternalUrl(vocal.image_source_url);
  const imageSourceName = getVocalArtworkSource(imageSourceUrl);
  const copyrightUrl = vocalExternalUrl(group?.copyright_website);
  const actions = [
    ['official', vocalExternalUrl(group?.official_website), t("官方")],
    ['source', imageSourceUrl, imageSourceName ? t("立绘来源：{{value0}}", { value0: imageSourceName }) : t("立绘来源")],
    ['license', copyrightUrl && copyrightUrl !== imageSourceUrl ? copyrightUrl : null, t("授权许可")],
  ].filter(([, url]) => url);
  if (actions.length === 0) return null;
  return <div className="vocal-detail-links">
    {actions.map(([key, url, label]) => <Button key={key} type="text" className="ds-button" data-variant="normal" href={url}
      target="_blank" rel="noopener noreferrer" icon={<ExportOutlined aria-hidden="true" />}>{label}</Button>)}
  </div>;
}

export function VocalDetailView({ profile }) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;

  const { vocal, group, collectionName } = profile;
  const persona = vocal.official_persona ?? {};
  const birthday = formatVocalBirthday(persona.birthday, language);
  const zodiac = ({ 处女座: t("处女座") })[persona.zodiac] || persona.zodiac;
  const origin = ({ 日本: t("日本") })[persona.origin] || persona.origin;
  const supportColors = (vocal.support_color_list ?? []).filter((color) => /^#[\da-f]{6}$/i.test(color));
  const fields = [
    ['birthday', t("生日"), birthday],
    ['zodiac', t("星座"), zodiac],
    ['height', t("身高"), persona.height != null ? `${persona.height} cm` : null],
    ['cv', t("声源"), persona.cv],
    ['creator', t("形象设计"), persona.creator],
    ['weight', t("体重"), persona.weight != null ? `${persona.weight} kg` : null],
    ['origin', t("出身地区"), origin],
    ['representative', t("代表物"), persona.representative],
  ].filter(([, , value]) => value != null && value !== '');
  const license = typeof vocal.license === 'string' && vocal.license.trim() ? vocal.license.trim() : null;
  const rightsText = group?.name ? t("{{value0}} 保留所有权利。", { value0: group.name }) : null;

  // Fan colors are profile data, used only for the swatches and geometric artwork texture.
  const heroRef = useRef(null);
  useVocalDepth(heroRef);
  const fanColorStyle = supportColors.length > 0 ? {
    '--vocal-fan-color': supportColors[0],
    '--vocal-fan-color-secondary': supportColors[1] ?? supportColors[0],
  } : undefined;

  return <main className="vocal-detail-page" data-vocal-accent={profile.accent} style={fanColorStyle} aria-labelledby="vocal-detail-name">
    <nav className="vocal-detail-breadcrumb" aria-label={t("面包屑")}>
      <Link className="ds-link" to="/vocals"><ArrowLeftOutlined /> {t("虚拟歌手")}</Link>
      <span aria-hidden="true">/</span><span>{vocal.name}</span>
    </nav>

    <section ref={heroRef} className="vocal-hero" aria-label={t("角色档案")}>
      <VocalBackdrop />
      <header className="vocal-hero-intro">
        <h1 id="vocal-detail-name">{vocal.name}</h1>
        {collectionName && <p className="vocal-hero-collection">{collectionName}</p>}
        {(persona.age != null || (persona.highlight_list ?? []).length > 0) && <div className="vocal-hero-tags">
          {persona.age != null && <Tag variant="filled" className="vocal-profile-tag">{t("{{value0}}岁", { value0: persona.age })}</Tag>}
          {(persona.highlight_list ?? []).map((trait) => <Tag variant="filled" className="vocal-profile-tag" key={trait}>{trait}</Tag>)}
        </div>}
      </header>

      <VocalArtwork key={vocal.id} profile={profile} t={t} />

      <section className="vocal-hero-info" aria-label={t("角色资料")}>
        {fields.length > 0 ? <dl className="vocal-profile-facts">
          {fields.map(([key, label, value]) => <Fragment key={key}><dt>{label}</dt><dd>{value}</dd></Fragment>)}
        </dl>
          : <p className="vocal-profile-caption">{t("角色设定资料暂缺")}</p>}
        {persona.personality && <p className="vocal-profile-note">{persona.personality}</p>}
        {persona.appearance && <p className="vocal-profile-note">{persona.appearance}</p>}
        {supportColors.length > 0 && <div className="vocal-support-colors">
          {supportColors.map((color) => <span className="vocal-support-mark" key={color} style={{ '--vocal-swatch-color': color, '--vocal-swatch-ink': fanColorInk(color) }}>
            <span className="vocal-support-corner" aria-hidden="true" />
            <span className="vocal-support-corner" aria-hidden="true" />
            <span className="vocal-support-corner" aria-hidden="true" />
            <span className="vocal-support-corner" aria-hidden="true" />
            <span className="vocal-support-swatch"><code>{color.toUpperCase()}</code></span>
          </span>)}
        </div>}
        {rightsText && <p className="vocal-detail-rights">{rightsText}</p>}
        {license && <p className="vocal-detail-license">{license}</p>}
        <VocalLinks profile={profile} t={t} />
      </section>
    </section>
  </main>;
}

export default function VocalDetail() {
  const { vocalId } = useParams();
  const { t } = useTranslation();

  const profile = resolveVocalProfile(vocalId, catalog);
  if (profile.status !== 'ready') return <main className="page-result"><Result status={profile.status === 'invalid' ? 'warning' : '404'}
    title={profile.status === 'invalid' ? (t("虚拟歌手ID不合法")) : (t("暂未收录这位虚拟歌手"))}
    subTitle={t("可先查看赤羽的角色资料。")}
    extra={<Link className="ds-button" data-variant="primary" to="/vocals/304">{t("认识赤羽")}</Link>} /></main>;
  return <VocalDetailView key={vocalId} profile={profile} />;
}

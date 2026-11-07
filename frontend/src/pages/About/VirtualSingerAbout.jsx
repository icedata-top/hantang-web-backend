import { AudioOutlined, ExportOutlined, StopOutlined, UserOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Breadcrumb } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import './VirtualSingerAbout.css';

const CC_LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';
const VCPEDIA_URL = 'https://vcpedia.cn/%E8%99%9A%E6%8B%9F%E6%AD%8C%E6%89%8B';
const VOCAWIKI_URL = 'https://voca.wiki/%E8%99%9A%E6%8B%9F%E6%AD%8C%E6%89%8B';

// 引文及协议采用用户提供的版本；不以检索缓存中的其他版本替换，也不补造榜单稿件链接。
const SOURCES = [
  {
    id: 'vcpedia',
    name: 'VCPedia',
    href: VCPEDIA_URL,
    ccLicensed: true,
    quote: <p>
      虚拟歌手可被视为虚拟偶像的一类，但其独特之处在于其歌声不是由人类直接唱出、而是完全通过软件合成的，这类软件也被称为虚拟歌手声音合成<strong>引擎</strong>。虚拟歌手一般拥有自己的<strong>声库</strong>，声库内容大多是某种语言中全部可供组合的音节片段，一位虚拟歌手的声音完全来源于对应的声库。声库通常需要由真人预先录制，这些人就是虚拟歌手的<strong>CV</strong>，又名<strong>声源</strong>或<strong>音源</strong>，不过也存在没有CV的虚拟歌手（例如<a className="ds-link" href="https://voca.wiki/%E8%B6%B3%E7%AB%8B%E9%9B%B6" target="_blank" rel="noopener noreferrer">足立零</a>等）。想要制作一首由虚拟歌手演唱的歌曲，需要创作者花费时间在软件内使用声库<strong>调教</strong>对应虚拟歌手，这也包括人工智能歌手在内。
    </p>,
  },
  {
    id: 'vocawiki',
    name: 'Vocawiki',
    href: VOCAWIKI_URL,
    ccLicensed: true,
    quote: <>
      <p>“虚拟歌手”一词在社会上存在不同的含义。从字面意思上来说，“虚拟歌手”就是“虚拟”的“歌手”。这个词汇大约出现于1990年代后期，意思是使用信息技术制作而成的，没有实体的歌手。在这个大的概念之下，存在多种不同类型的虚拟歌手，歌势VTuber可以称为虚拟歌手，唱歌的AI数字人可以称为AI虚拟歌手<sup>[2]</sup>。虚拟歌手属于虚拟偶像，但虚拟偶像并不一定是虚拟歌手。</p>
      <p>在术力口圈子内，以及本站，虚拟歌手的定义是能够通过歌声合成软件来演唱歌曲的声库软件及其虚拟形象。但是即使是在术力口圈内，也存在着“什么才是歌声合成软件”之类的问题，所以虚拟歌手的涵盖范围仍然存在着一定的模糊地带。</p>
      <p>初音未来等角色传入中文圈之后，首先流行的称呼是“虚拟歌姬”，这一称呼可能是受到“电子の歌姬”等日语称呼的影响。后来因为注意到歌姬是对女性歌手的称呼，逐渐改为中性的“虚拟歌手”<sup>[2]</sup>。有时候也把男性虚拟歌手称作“虚拟歌基”，但不太常见。</p>
    </>,
  },
  {
    id: 'weekly-chart',
    name: '周刊虚拟歌手中文曲排行榜',
    nameLang: 'zh-CN',
    href: 'https://space.bilibili.com/156489',
    ccLicensed: false,
    profileLink: true,
    quote: <p>「虚拟歌手」意指正式发行的「歌声合成软件」中，使用的独立声音资料库。并且「虚拟歌手」声库须明确指向「非自然人形象」，不与自然人在运营形象上有同质关联。</p>,
  },
];

const EXCLUSIONS = [
  { id: 'human', Icon: UserOutlined },
  { id: 'vtuber', Icon: VideoCameraOutlined },
  { id: 'svc', Icon: AudioOutlined },
];

function ExternalLink({ href, children, className = '', ...props }) {
  return <a className={`ds-link ${className}`.trim()} href={href} target="_blank" rel="noopener noreferrer" {...props}>
    {children}<ExportOutlined className="vocal-about-external-icon" aria-hidden="true" />
  </a>;
}

export default function VirtualSingerAbout() {
  const { t } = useTranslation();

  return (
    <main className="vocal-about-page">
      <Breadcrumb className="vocal-about-breadcrumb" items={[
        { title: <Link className="ds-link" to="/about">{t('关于冰数据')}</Link> },
        { title: t('虚拟歌手') },
      ]} />

      <header className="vocal-about-header">
        <h1>{t('about.vocal.title')}</h1>
        <p>{t('about.vocal.introduction')}</p>
      </header>

      <section className="vocal-about-scope" aria-labelledby="vocal-about-scope-title">
        <div className="vocal-about-section-heading">
          <h2 id="vocal-about-scope-title">{t('about.vocal.scopeTitle')}</h2>
          <p>{t('about.vocal.scopeIntroduction')}</p>
        </div>
        <ul className="vocal-about-exclusions">
          {EXCLUSIONS.map(({ id, Icon }) => (
            <li key={id} className="vocal-about-exclusion">
              <span className="vocal-about-symbol" aria-hidden="true">
                <Icon className="vocal-about-subject-icon" />
                <StopOutlined className="vocal-about-stop-icon" />
              </span>
              <div>
                <h3>{t(`about.vocal.exclude.${id}.title`)}</h3>
                <p>{t(`about.vocal.exclude.${id}.description`)}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="vocal-about-scope-note">{t('about.vocal.scopeNote')}</p>
      </section>

      <div className="vocal-about-references">
        {SOURCES.map((source, index) => (
          <article className="vocal-about-source" key={source.id} aria-labelledby={`vocal-about-${source.id}`}>
            <header className="vocal-about-source-heading">
              <span className="vocal-about-source-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <h2 id={`vocal-about-${source.id}`} lang={source.nameLang}>{source.name}</h2>
            </header>
            <figure className="vocal-about-quotation">
              <blockquote lang="zh-CN" cite={source.href}>{source.quote}</blockquote>
              <figcaption className="vocal-about-attribution">
                <p><span>{t('about.vocal.sourceLabel')}</span><cite lang={source.nameLang}>{source.name}</cite><ExternalLink href={source.href}>{t(source.profileLink ? 'about.vocal.profileLink' : 'about.vocal.articleLink')}</ExternalLink></p>
                <p>
                  <span>{t('about.vocal.licenseLabel')}</span>
                  {source.ccLicensed ? <ExternalLink href={CC_LICENSE_URL}>CC BY-NC-SA 4.0</ExternalLink> : <span>{t('about.vocal.noCcLicense')}</span>}
                </p>
              </figcaption>
            </figure>
          </article>
        ))}
      </div>

      <footer className="vocal-about-footer"><Link className="ds-link" to="/about">{t('about.vocal.backToAbout')}</Link></footer>
    </main>
  );
}

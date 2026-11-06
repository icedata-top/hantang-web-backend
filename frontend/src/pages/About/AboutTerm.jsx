import { Breadcrumb } from 'antd';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import './AboutTerm.css';

const TOPICS = {
  songs: { label: '歌曲', paragraphs: ['introduction', 'exclusions', 'submissions', 'coverage'] },
  creators: { label: '创作者', paragraphs: ['introduction', 'definition', 'participation', 'subjects', 'coverage'] },
};

export default function AboutTerm({ topic }) {
  const { t } = useTranslation();
  const { label, paragraphs } = TOPICS[topic];
  const links = {
    vocal: <Link className="ds-link" to="/about/virtual-singers" />,
    song: <Link className="ds-link" to="/about/songs" />,
    creator: <Link className="ds-link" to="/about/creators" />,
  };

  return <main className="about-term-page">
    <Breadcrumb className="about-term-breadcrumb" items={[
      { title: <Link className="ds-link" to="/about">{t('关于冰数据')}</Link> },
      { title: t(label) },
    ]} />
    <article>
      <h1>{t(label)}</h1>
      <div className="about-term-prose">
        {paragraphs.map(paragraph => <p key={paragraph}>
          <Trans i18nKey={`about.${topic}.${paragraph}`} components={links} />
        </p>)}
      </div>
    </article>
    <footer className="about-term-footer"><Link className="ds-link" to="/about">{t('about.backToAbout')}</Link></footer>
  </main>;
}

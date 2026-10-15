import { GithubOutlined, GlobalOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useMeshParallax } from '../../hooks/useMeshParallax.js';
import './index.css';

export default function About() {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);

  useMeshParallax(true);

  return (
    <main className="about-page">
      <h1 className="about-sr-only">{t('关于冰数据', 'About icedata')}</h1>
      <div className="about-hero">
        <div className="about-hero-inner">
          <figure className="about-hero-figure">
            <img
              className="about-illustration"
              src="/svg/undraw_team-collaboration_phnf.svg"
              alt=""
              decoding="async"
            />
          </figure>
        </div>
      </div>

      <div className="about-content">
        <section className="about-section" aria-label={t('简介', 'Introduction')}>
          <span className="about-eyebrow">icedata</span>
          <div className="about-prose">
            <p>
              {t(
                '冰数据是一支面向虚拟歌手社群的',
                'icedata is an ',
              )}
              <strong>{t('非官方', 'unofficial')}</strong>
              {t(
                '数据中台协作体。我们以自动化采集与结构化存储为基础，围绕投稿数据做分析与呈现，帮助社群更清晰地理解内容生态与传播脉络。',
                ' data collaboration group for the virtual vocal community. We build on automated collection and structured storage, then analyze and present submission data to make the content ecosystem easier to understand.',
              )}
            </p>
            <p>
              {t(
                '社区中常提到，icedata 的精神可以上溯至 2013 年前后出现的 ',
                'The community often traces the spirit of icedata back to early explorations around 2013, such as ',
              )}
              <strong>iceorange</strong>
              {t(
                ' 等早期探索；若以当前组织形态与公开协作节奏来界定，更常把 ',
                '. If we define it by the current organizational form and public collaboration rhythm, ',
              )}
              <strong>{t('2019 年 2 月 22 日', 'Feb 22, 2019')}</strong>
              {t(
                ' 视为冰数据成立的重要时间节点。以上仅供溯源参考，具体以组织公开说明为准。',
                ' is commonly regarded as a key milestone. This is for historical reference only; please follow official statements.',
              )}
            </p>
          </div>
        </section>

        <div className="about-stack">
          <section className="about-section" aria-label={t('我们做什么', 'What We Do')}>
            <p className="about-section-text">
              {t(
                '组织持续汇聚、清洗与分析虚拟歌手相关的投稿数据，并通过 Web 应用、ChatBI 智能对话与数据可视化视频等形式，把数据洞察交付给创作者与爱好者。技术路线在演进，目标不变：让公开可得的投稿数据更容易被理解与使用。',
                'We continuously collect, clean, and analyze virtual vocal submission data, then deliver insights via web apps, ChatBI conversations, and data-visualization videos. Our tech stack evolves, but the goal stays the same: make public submission data easier to understand and use.',
              )}
            </p>
          </section>

          <section className="about-section" aria-label={t('找到我们', 'Find Us')}>
            <ul className="about-contact-row">
              <li>
                <a
                  className="about-contact-item"
                  href="https://www.icedata.top/"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="about-contact-icon" aria-hidden>
                    <GlobalOutlined />
                  </span>
                  <span className="about-contact-label">{t('官方站点', 'Official Site')}</span>
                  <span className="about-contact-meta">www.icedata.top</span>
                </a>
              </li>
              <li>
                <a
                  className="about-contact-item"
                  href="https://github.com/icedata-top"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="about-contact-icon" aria-hidden>
                    <GithubOutlined />
                  </span>
                  <span className="about-contact-label">GitHub</span>
                  <span className="about-contact-meta">icedata-top</span>
                </a>
              </li>
              <li>
                <div
                  className="about-contact-item about-contact-item-static"
                  title={t('可在飞书中通过组织代码搜索加入', 'Join via the Feishu organization code')}
                >
                  <span className="about-contact-icon" aria-hidden>
                    <TeamOutlined />
                  </span>
                  <span className="about-contact-label">{t('飞书组织', 'Feishu Organization')}</span>
                  <code className="about-contact-code">FE0KZ09A1ZE</code>
                </div>
              </li>
            </ul>
          </section>

          <section className="about-section" aria-label={t('技术与素材', 'Tech & Assets')}>
            <p className="about-section-text">
              {t('本前端使用 ', 'This frontend uses ')}
              <strong>Ant Design</strong>
              {t('；数据可视化计划采用 ', '; data visualization is planned with ')}
              <strong>VChart</strong>
              {t('。部分插图来自 ', '. Some illustrations come from ')}
              <strong>unDraw</strong>
              {t('（开源插图，可按许可使用与再创作）。', ' (open-source illustrations usable under their license).')}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

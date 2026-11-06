import { GithubOutlined, GlobalOutlined, TeamOutlined } from '@ant-design/icons';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMeshParallax } from '../../hooks/useMeshParallax.js';
import './index.css';

export default function About() {
  const { t } = useTranslation();

  useMeshParallax(true);

  return (
    <main className="about-page">
      <h1 className="about-sr-only">{t("关于冰数据")}</h1>
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
        <section className="about-section" aria-label={t("简介")}>
          <span className="about-eyebrow">icedata</span>
          <div className="about-prose">
            <p>
              <Trans
                i18nKey="about.introduction"
                components={{
                  vocal: <Link className="ds-link" to="/about/virtual-singers" />,
                  strong: <strong />,
                }}
              />
            </p>
            <p>
              {t("社区中常提到，icedata 的精神可以上溯至 2013 年前后出现的 ")}
              <strong>iceorange</strong>
              {t(" 等早期探索；若以当前组织形态与公开协作节奏来界定，更常把 ")}
              <strong>{t("2019 年 2 月 22 日")}</strong>
              {t(" 视为冰数据成立的重要时间节点。以上仅供溯源参考，具体以组织公开说明为准。")}
            </p>
          </div>
        </section>

        <div className="about-stack">
          <section className="about-section" aria-label={t("我们做什么")}>
            <p className="about-section-text">
              {t("组织持续汇聚、清洗与分析虚拟歌手相关的投稿数据，并通过 Web 应用、ChatBI 智能对话与数据可视化视频等形式，把数据洞察交付给创作者与爱好者。技术路线在演进，目标不变：让公开可得的投稿数据更容易被理解与使用。")}
            </p>
          </section>

          <section className="about-section" aria-label={t("找到我们")}>
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
                  <span className="about-contact-label">{t("官方站点")}</span>
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
                  title={t("可在飞书中通过组织代码搜索加入")}
                >
                  <span className="about-contact-icon" aria-hidden>
                    <TeamOutlined />
                  </span>
                  <span className="about-contact-label">{t("飞书组织")}</span>
                  <code className="about-contact-code">FE0KZ09A1ZE</code>
                </div>
              </li>
            </ul>
          </section>

          <section className="about-section" aria-label={t("技术与素材")}>
            <div className="about-prose">
              <p>
                <Trans i18nKey="about.frontendStack" components={{ strong: <strong /> }} />
              </p>
              <p>
                <Trans i18nKey="about.backendStack" components={{ strong: <strong /> }} />
              </p>
              <p>
                <Trans i18nKey="about.modelAssist" components={{ strong: <strong /> }} />
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

import { Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function VideoResult({ reason }) {
  const { t } = useTranslation();

  const invalid = reason === 'invalid';

  return (
    <main className="page-result" aria-labelledby="video-result-title">
      <Result
        status="info"
        icon={<img className="page-result-illustration" src="/svg/undraw_page-not-found_6wni.svg" alt="" decoding="async" />}
        title={<span id="video-result-title">{invalid ? t("你输入的ID不合法") : t("未找到视频")}</span>}
        subTitle={invalid ? t("请输入不带 av 前缀的纯数字AV号，或完整的BV号（以 BV 开头，后续字符区分大小写）。") : t("你输入的ID，在哔哩哔哩不存在或者冰数据未收录。")}
        extra={<Link className="ds-button" data-variant="primary" to="/">{t("返回首页")}</Link>}
      />
    </main>
  );
}

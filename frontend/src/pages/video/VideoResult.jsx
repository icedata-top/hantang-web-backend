import { Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function VideoResult({ reason }) {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);
  const invalid = reason === 'invalid';

  return (
    <main className="page-result" aria-labelledby="video-result-title">
      <Result
        status="info"
        icon={<img className="page-result-illustration" src="/svg/undraw_page-not-found_6wni.svg" alt="" decoding="async" />}
        title={<span id="video-result-title">{invalid ? t('你输入的ID不合法', 'Invalid video ID') : t('未找到视频', 'Video not found')}</span>}
        subTitle={invalid ? t(
          '请输入不带 av 前缀的纯数字AV号，或完整的BV号（以 BV 开头，后续字符区分大小写）。',
          'Enter a numeric AV ID without the av prefix, or a complete BV ID starting with BV. BV IDs are case-sensitive.',
        ) : t(
          '你输入的ID，在哔哩哔哩不存在或者冰数据未收录。',
          'This video does not exist on Bilibili or has not been indexed by icedata.',
        )}
        extra={<Link className="ds-button" data-variant="primary" to="/">{t('返回首页', 'Back to Home')}</Link>}
      />
    </main>
  );
}

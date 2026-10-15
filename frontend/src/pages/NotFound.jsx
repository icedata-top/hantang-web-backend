import { Button, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);

  return (
    <main className="page-result">
      <Result
        status="info"
        icon={
          <img
            className="page-result-illustration"
            src="/svg/undraw_page-not-found_6wni.svg"
            alt=""
            decoding="async"
          />
        }
        title={t('页面不存在', 'Page Not Found')}
        subTitle={t(
          '您访问的地址无效，或该页面已被移除。请检查链接是否正确。',
          'The address you visited is invalid, or the page has been removed. Please check the link and try again.',
        )}
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            {t('返回首页', 'Back to Home')}
          </Button>
        }
      />
    </main>
  );
}

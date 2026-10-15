import { Button, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function UnderDevelopment() {
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
            src="/svg/undraw_code-contribution_8k0x.svg"
            alt=""
            decoding="async"
          />
        }
        title={t('功能开发中', 'Under Development')}
        subTitle={t(
          '该页面尚在建设，内容将在后续版本开放。',
          'This page is under construction and will be available in a future release.',
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

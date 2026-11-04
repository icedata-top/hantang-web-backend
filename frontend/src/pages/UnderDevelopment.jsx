import { Button, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function UnderDevelopment() {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
        title={t("功能开发中")}
        subTitle={t("该页面尚在建设，内容将在后续版本开放。")}
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            {t("返回首页")}
          </Button>
        }
      />
    </main>
  );
}

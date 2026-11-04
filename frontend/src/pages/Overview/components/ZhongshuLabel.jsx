import { useTranslation } from 'react-i18next';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import './ZhongshuLabel.css';

export default function ZhongshuLabel({ children, focusable = true }) {
  const { t } = useTranslation();

  const description = <div className="overview-zhongshu-tooltip">
    <p>{t('overview.zhongshuMeaning')}</p>
    <p>{t('overview.zhongshuSample')}</p>
  </div>;

  return (
    <Tooltip title={description} trigger={['hover', 'focus']}>
      <span className="overview-zhongshu-label" tabIndex={focusable ? 0 : undefined}>
        {children}<QuestionCircleOutlined aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

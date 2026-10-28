import { useTranslation } from 'react-i18next';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import './ZhongshuLabel.css';

export default function ZhongshuLabel({ children, focusable = true }) {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const description = isZh
    ? '综合参考播放量、收藏量，并经人工筛选，选取 50 个具有代表性的视频作为观测对象。名单保持相对固定，可按需调整。'
    : 'A semi-fixed set of 50 representative videos selected based on view and favorite counts, with manual curation. The selection stays relatively stable and may be adjusted as needed.';

  return (
    <Tooltip title={description} trigger={['hover', 'focus']}>
      <span className="overview-zhongshu-label" tabIndex={focusable ? 0 : undefined}>
        {children}<QuestionCircleOutlined aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

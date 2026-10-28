import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import NotFound from '../NotFound.jsx';

export default function ProducerDetail() {
  const { userId } = useParams();
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');

  if (!/^[1-9]\d*$/.test(userId ?? '')) {
    return <NotFound />;
  }

  return (
    <main className="producer-detail-page">
      <h1 className="ds-sr-only">{isZh ? '创作者详情' : 'Producer Details'}</h1>
    </main>
  );
}

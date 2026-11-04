import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enGB from 'antd/locale/en_GB';
import jaJP from 'antd/locale/ja_JP';
import { useTranslation } from 'react-i18next';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/ja';
import { normalizeLanguage } from '../locales/languages.js';

const COMPONENT_LOCALES = { zh: zhCN, en: enGB, ja: jaJP };
const LOCALE_THEME = { token: { fontFamily: 'var(--font-family-sans)' } };

export default function LocaleProvider({ children }) {
  const { i18n } = useTranslation();
  return <ConfigProvider locale={COMPONENT_LOCALES[normalizeLanguage(i18n.language)]} theme={LOCALE_THEME}>{children}</ConfigProvider>;
}

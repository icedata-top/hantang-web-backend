import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enGB from 'antd/locale/en_GB';
import jaJP from 'antd/locale/ja_JP';
import { useTranslation } from 'react-i18next';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/ja';
import { normalizeLanguage } from '../locales/languages.js';

const COMPONENT_LOCALES = { zh: zhCN, en: enGB, ja: jaJP };
// Ant Design emits CSS variables so existing [data-theme] containers can supply
// the same project colors to controls and their popups without a second palette.
const COMPONENT_THEME = { cssVar: { key: 'icedata-antd' }, token: { fontFamily: 'var(--font-family-sans)' } };

function getPopupContainer(trigger) {
  const themeContainer = trigger?.closest('[data-theme]');
  return themeContainer && themeContainer !== document.documentElement ? themeContainer : document.body;
}

export default function LocaleProvider({ children }) {
  const { i18n } = useTranslation();
  return <ConfigProvider locale={COMPONENT_LOCALES[normalizeLanguage(i18n.language)]} theme={COMPONENT_THEME} getPopupContainer={getPopupContainer}>{children}</ConfigProvider>;
}

export const LANGUAGE_OPTIONS = Object.freeze([
  { value: 'zh', label: '中文', lang: 'zh-CN', dateLocale: 'zh-cn', numberFormat: 'zh', timeLabelWidth: '7em' },
  { value: 'en', label: 'English', lang: 'en-GB', dateLocale: 'en', numberFormat: 'en', timeLabelWidth: '10em' },
  { value: 'ja', label: '日本語', lang: 'ja-JP', dateLocale: 'ja', numberFormat: 'ja', timeLabelWidth: '9em' },
]);

/** Accept regional language codes; unsupported languages use the default language. */
export function normalizeLanguage(language = 'zh') {
  const code = String(language).toLowerCase().split(/[-_]/)[0];
  return LANGUAGE_OPTIONS.find(({ value }) => value === code)?.value ?? 'zh';
}

export function getLanguageSettings(language) {
  return LANGUAGE_OPTIONS.find(({ value }) => value === normalizeLanguage(language));
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Trans } from 'react-i18next';
import i18n, { getTranslator } from '../src/i18n.js';
import zh from '../src/locales/zh.js';
import en from '../src/locales/en.js';
import ja from '../src/locales/ja.js';
import { LANGUAGE_OPTIONS, getLanguageSettings, normalizeLanguage } from '../src/locales/languages.js';
import { formatNumber } from '../src/utils/formatNumber.js';
import { getDateRangePresets } from '../src/utils/metricsDateRange.js';
import { getRelativeTimeDetails } from '../src/components/custom/RelativeTime/relativeTime.js';
import { buildVideoMetricsChartSpec } from '../src/pages/video/videoMetricsChart.js';
import { getLinkMatchScore } from '../src/pages/Stash/stashSearch.js';
import { formatVocalBirthday } from '../src/pages/vocal/vocalProfile.js';

test('all language resources contain the same keys and interpolation parameters', () => {
  const keys = Object.keys(zh).sort();
  const parameters = (value) => [...value.matchAll(/{{\s*([^}]+)\s*}}/g)].map((match) => match[1]).sort();
  for (const resources of [en, ja]) {
    assert.deepEqual(Object.keys(resources).sort(), keys);
    for (const key of keys) {
      assert.equal(typeof resources[key], 'string', key);
      assert.deepEqual(parameters(resources[key]), parameters(zh[key]), key);
      assert.ok(resources[key].length || ['首', '位'].includes(key), key);
    }
  }
});

test('regional languages normalize, the document language updates, and fixed translators stay bound', async () => {
  assert.deepEqual(LANGUAGE_OPTIONS.map(({ value }) => value), ['zh', 'en', 'ja']);
  assert.equal(normalizeLanguage('JA_jp'), 'ja');
  assert.equal(normalizeLanguage('en-GB'), 'en');
  assert.equal(normalizeLanguage('fr'), 'zh');
  const previousDocument = globalThis.document;
  globalThis.document = { documentElement: {} };
  const translateChinese = getTranslator('zh');
  try {
    for (const [language, expected] of [['zh-CN', '首页'], ['en-GB', 'Home'], ['ja-JP', 'ホーム']]) {
      await i18n.changeLanguage(language);
      assert.equal(i18n.t('首页'), expected);
      assert.equal(document.documentElement.lang, getLanguageSettings(language).lang);
      assert.equal(translateChinese('首页'), '首页');
    }
    assert.equal(getTranslator('en')('首'), '');
    assert.equal(getTranslator('ja')('创作者 {{value0}}', { value0: '123456' }), 'クリエイター 123456');
  } finally {
    globalThis.document = previousDocument;
    await i18n.changeLanguage('zh');
  }
});

test('rich text keeps emphasis and links while translating whole sentences and English plurals', () => {
  const render = (language, count) => renderToStaticMarkup(createElement(Trans, {
    t: getTranslator(language), i18nKey: 'search.loaded', count,
    components: { count: createElement('em') },
  }));
  assert.equal(render('zh', 2), '已加载 <em>2</em> 条结果');
  assert.equal(render('en', 1), 'Loaded <em>1</em> result');
  assert.equal(render('en', 2), 'Loaded <em>2</em> results');
  assert.equal(render('ja', 2), '<em>2</em> 件の結果を読み込みました');
  const notice = renderToStaticMarkup(createElement(Trans, {
    t: getTranslator('ja'), i18nKey: 'vocal.catalogNotice',
    components: { about: createElement('a', { href: '/about' }) },
  }));
  assert.match(notice, /<a href="\/about">このサイトについて<\/a>/);
});

test('Japanese number units, birthdays, and date presets do not fall into English formatting', () => {
  assert.equal(formatNumber(123000000, 'zh'), '1.23亿');
  assert.equal(formatNumber(123000000, 'en'), '123M');
  assert.equal(formatNumber(123000000, 'ja'), '1.23億');
  assert.equal(formatNumber(-1230000000000, 'ja'), '-1.23兆');
  assert.equal(formatNumber(0, 'ja'), '0');
  assert.equal(formatVocalBirthday('11-26', 'ja-JP'), '11月26日');
  assert.equal(formatVocalBirthday('11-26', 'en'), 'November 26');
  const presets = ['zh', 'en', 'ja'].map((language) => getDateRangePresets(language));
  assert.deepEqual(presets.map((items) => items[0].label), ['最近7天', 'Last 7 days', '過去7日間']);
  for (let index = 0; index < 3; index += 1) {
    const ranges = presets.map((items) => items[index].value().map((date) => date.format('YYYY-MM-DD')));
    assert.deepEqual(ranges[1], ranges[0]);
    assert.deepEqual(ranges[2], ranges[0]);
  }
});

test('Japanese relative time preserves the Beijing clock and past/future boundaries', () => {
  const now = Date.UTC(2026, 9, 29, 4);
  const details = (offset) => getRelativeTimeDetails((now + offset) / 1000, now, 'ja-JP');
  assert.equal(details(-60000).relative, 'たった今');
  assert.equal(details(60000).relative, 'まもなく');
  assert.equal(details(-25 * 60000).relative, '25分前');
  assert.equal(details(25 * 60000).relative, '25分後');
  assert.equal(details(-2 * 86400000).relative, '一昨日 12:00');
  assert.equal(details(2 * 86400000).relative, '明後日 12:00');
  assert.equal(details(-25 * 3600000).distance, '1日1時間');
  assert.equal(details(25 * 3600000).absoluteDiff, '2026-10-30 13:00（1日後）');
});

test('chart legends and missing metrics translate together, and bookmark searches match visible descriptions', () => {
  const rows = [{ date: '2026-10-29', indicators: { view: 123, favorite: null } }];
  const spec = buildVideoMetricsChartSpec(rows, [], 'ja', 'delta');
  assert.equal(spec.data[0].values[0].series, '再生数');
  assert.equal(spec.data[0].values[1].value, null);
  assert.equal(spec.axes[1].title.text, '日次増分');
  const tooltip = spec.tooltip.dimension.content([{ value: rows[0].date }]);
  assert.equal(tooltip[1].key, 'お気に入り数');
  assert.equal(tooltip[1].value, 'データなし');
  const link = { name: 'Vite', descZh: '前端构建工具', descEn: 'Frontend build tool' };
  assert.equal(getLinkMatchScore(link, 'ビルド', 'ja'), 1);
  assert.equal(getLinkMatchScore(link, 'build', 'en'), 1);
  assert.equal(getLinkMatchScore(link, '构建', 'zh'), 1);
  assert.equal(getLinkMatchScore(link, 'vite', 'ja'), 2);
});

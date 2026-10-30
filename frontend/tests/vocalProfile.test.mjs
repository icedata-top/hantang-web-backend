import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { formatVocalBirthday, getVocalArtworkSource, normalizeVocalImagePath, resolveVocalProfile, vocalExternalUrl } from '../src/pages/vocal/vocalProfile.js';

const catalog = JSON.parse(readFileSync(new URL('../src/constants/vocal/vocal-frontend-info.json', import.meta.url), 'utf8'));

test('赤羽 resolves by the stable frontend ID with the existing transparent illustration', () => {
  const profile = resolveVocalProfile('304', catalog);
  assert.equal(profile.status, 'ready');
  assert.equal(profile.vocal.name, '赤羽');
  assert.equal(profile.group.id, 3);
  assert.equal(profile.collectionName, '五维介质');
  assert.equal(profile.imageSrc, '/vocals/chiyu.png');
  assert.equal(profile.accent, 'red');
});

test('all catalog profiles resolve and every configured image maps to an existing public asset', () => {
  for (const vocal of catalog.vocal_list) {
    const profile = resolveVocalProfile(String(vocal.id), catalog);
    assert.equal(profile.status, 'ready');
    if (vocal.image_path) {
      assert.ok(profile.imageSrc, vocal.name);
      assert.ok(existsSync(new URL(`../public${profile.imageSrc}`, import.meta.url)), vocal.name);
    } else {
      assert.equal(profile.imageSrc, null, vocal.name);
    }
  }
  assert.equal(resolveVocalProfile('101', catalog).imageSrc, null);
  assert.equal(resolveVocalProfile('307', catalog).vocal.name, '牧心');
});

test('unknown IDs are distinct from malformed IDs and absent groups stay absent', () => {
  assert.equal(resolveVocalProfile('999999', catalog).status, 'missing');
  for (const id of [null, undefined, 0, -1, '0304', '304x', '赤羽', ' 304', '3.04', {}, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(resolveVocalProfile(id, catalog).status, 'invalid', String(id));
  }
  const profile = resolveVocalProfile('1', { vocal_list: [{ id: 1, group_id: 999 }], group_list: [] });
  assert.equal(profile.status, 'ready');
  assert.equal(profile.group, null);
  assert.equal(profile.collectionName, '');
  assert.equal(profile.imageSrc, null);
});

test('public image paths normalize without allowing external or traversing asset paths', () => {
  assert.equal(normalizeVocalImagePath('/public/vocals/chiyu.png'), '/vocals/chiyu.png');
  assert.equal(normalizeVocalImagePath('/vocals/xinhua.webp'), '/vocals/xinhua.webp');
  for (const value of ['', null, 'https://example.test/image.png', '/public/vocals/../image.png', '/vocals/a.svg', '//example.test/a.png']) {
    assert.equal(normalizeVocalImagePath(value), null);
  }
});

test('recurring birthdays validate the date without inventing a birth year', () => {
  assert.equal(formatVocalBirthday('11-26'), '11月26日');
  assert.equal(formatVocalBirthday('11-26', false), 'November 26');
  assert.equal(formatVocalBirthday('02-29'), '2月29日');
  for (const value of [null, '', '2026-11-26', '2-01', '02-30', '00-12', '13-01', '04-31']) {
    assert.equal(formatVocalBirthday(value), null);
  }
});

test('profile links allow web sources and reject executable or relative URLs', () => {
  assert.equal(vocalExternalUrl('https://quadimension.booth.pm/items/2256836'), 'https://quadimension.booth.pm/items/2256836');
  for (const value of ['', null, 'javascript:alert(1)', 'data:text/plain,hello', '/relative']) {
    assert.equal(vocalExternalUrl(value), null);
  }
});

test('artwork platforms match real domains and subdomains rather than lookalike hosts', () => {
  for (const [url, expected] of [
    ['https://www.bilibili.com/opus/654807192100143129', 'Bilibili'],
    ['https://bilibili.com/', 'Bilibili'],
    ['https://quadimension.booth.pm/items/2256836', 'Booth'],
    ['https://booth.pm/', 'Booth'],
    ['https://vcpedia.cn/index.php?curid=56621', 'VCPeida'],
    ['https://WWW.VCPEDIA.CN/', 'VCPeida'],
    ['https://bilibili.com.example.test/', null],
    ['https://notbooth.pm/', null],
    ['https://vcpedia.cn@example.test/', null],
    ['javascript:alert(1)', null],
    ['/relative', null],
    [null, null],
  ]) assert.equal(getVocalArtworkSource(url), expected, String(url));
  for (const vocal of catalog.vocal_list) {
    if (vocal.image_source_url) assert.ok(getVocalArtworkSource(vocal.image_source_url), vocal.name);
  }
});

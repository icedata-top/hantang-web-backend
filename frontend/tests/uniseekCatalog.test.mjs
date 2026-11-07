import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { normalizeVocalImagePath } from '../src/pages/vocal/vocalProfile.js';

test('search vocals retain frontend IDs and use shipped artwork without inventing song totals', () => {
  const search = JSON.parse(readFileSync(new URL('../src/constants/vocal/vocal-search-info.json', import.meta.url)));
  const profiles = JSON.parse(readFileSync(new URL('../src/constants/vocal/vocal-frontend-info.json', import.meta.url)));
  assert.equal(search.length, profiles.vocal_list.length);
  for (const vocal of search) {
    const profile = profiles.vocal_list.find(entry => String(entry.id) === vocal.id);
    assert.equal(vocal.name, profile.name);
    assert.equal(vocal.image, normalizeVocalImagePath(profile.image_path));
    assert.ok(existsSync(new URL(`../public${vocal.image}`, import.meta.url)));
    assert.equal(Object.hasOwn(vocal, 'songCount'), false);
  }
});

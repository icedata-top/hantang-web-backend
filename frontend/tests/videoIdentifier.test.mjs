import assert from 'node:assert/strict';
import test from 'node:test';
import { parseVideoIdentifier } from '../src/pages/video/videoIdentifier.js';

test('converts known BV IDs, including large aids, to exact decimal strings', () => {
  const examples = [
    ['BV1K4411A7Yc', '57785834'],
    ['BV1Qs411k7Qv', '6009789'],
    ['BV1XfKAzwEi3', '114714449413822'],
    ['BV1LXKAzKEpP', '114714516390983'],
    ['BV15XKAzKER2', '114714516393596'],
    ['BV18xKAz9E7k', '114714801607676'],
    ['BV1roKwzCEm9', '114714851938267'],
    ['BV16J4m147St', '1250263852'],
    ['BV1zK4y1q7yf', '881414260'],
    ['BV1L7421T7B6', '1650146742'],
    ['BV1rB42167Vg', '1350120063'],
    ['BV1Yk4y1X7tj', '750868301'],
    ['BV1Ypn9eJEKR', '113054142433458'],
    ['BV1uV411X7Dk', '411334292'],
    ['BV1tT421Y7fV', '1706029576'],
    ['BV16W421c7ic', '1851691384'],
    ['BV1KH4y1j7Rg', '1051353039'],
  ];
  for (const [bvid, aid] of examples) {
    assert.deepEqual(parseVideoIdentifier(bvid), { status: 'valid', aid }, bvid);
  }
});

test('keeps numeric aids as strings without losing 64-bit precision', () => {
  for (const aid of ['1', '6009789', '114714449413822', '9007199254740993', '9223372036854775807']) {
    assert.deepEqual(parseVideoIdentifier(aid), { status: 'valid', aid });
  }
});

test('rejects inputs outside the supported AV and BV formats', () => {
  const identifiers = [
    undefined, null, 6009789, '', 'av6009789', 'AV6009789', '0', '06009789',
    '-1', '1.0', '1e3', ' 6009789', '6009789 ', '6009789\n', '世末歌者',
    'bv1Qs411k7Qv', 'BV2Qs411k7Qv', 'BV1Qs411k7Q', 'BV1Qs411k7Qvv',
    'BV1Qs411k7Q0', 'BV1Qs411k7QI', 'BV1Qs411k7QO', 'BV1Qs411k7Ql',
    'BV1Qs411k7Q/', 'BV1Qs411k7Q你', 'BV1Qs411k7Qv\n',
  ];
  for (const identifier of identifiers) {
    assert.deepEqual(parseVideoIdentifier(identifier), { status: 'invalid' }, String(identifier));
  }
});

test('keeps well-formed IDs outside the positive API range in the unavailable state', () => {
  for (const identifier of ['9223372036854775808', '9'.repeat(100), 'BV1xx411c7mX']) {
    assert.deepEqual(parseVideoIdentifier(identifier), { status: 'unavailable' });
  }
});

test('accepts structurally valid IDs without claiming they exist or are indexed', () => {
  assert.equal(parseVideoIdentifier('BV1zzzzzzzzz').status, 'valid');
  assert.deepEqual(parseVideoIdentifier('999999999'), { status: 'valid', aid: '999999999' });
});

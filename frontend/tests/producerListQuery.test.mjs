import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProducerListQuery, producerListParams, PRODUCER_LIST_DEFAULTS } from '../src/pages/producer/producerListQuery.js';

test('creator browsing round-trips filters, sort and pagination independently of its display mode', () => {
  const query = { minFans: 10000, minVideos: 5, sortBy: 'videoCount', order: 'asc', page: 3, pageSize: 50 };
  const params = producerListParams({ ...query, layout: 'cards', keyword: 'COPY' });
  assert.equal(params.has('layout'), false);
  assert.equal(params.has('keyword'), false);
  params.set('layout', 'cards');
  assert.deepEqual(parseProducerListQuery(params), query);
  params.set('layout', 'table');
  assert.deepEqual(parseProducerListQuery(params), query);
});

test('invalid or unsafe URL values cannot become list filters or SQL sort identifiers', () => {
  const params = new URLSearchParams('minFans=-1&minVideos=2147483648&sortBy=DROP&order=DROP&page=0&pageSize=101');
  assert.deepEqual(parseProducerListQuery(params), PRODUCER_LIST_DEFAULTS);
  for (const raw of ['9007199254740992', '1.5', '01', 'Infinity']) {
    assert.equal(parseProducerListQuery(new URLSearchParams({ minFans: raw })).minFans, null);
  }
  const zero = parseProducerListQuery(new URLSearchParams('minFans=0&minVideos=0&sortBy=userId'));
  assert.equal(zero.minFans, 0);
  assert.equal(zero.minVideos, 0);
  assert.equal(zero.sortBy, 'userId');
});

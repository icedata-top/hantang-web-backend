import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GATE_CROSSING_ALL_LEVEL,
  GATE_CROSSING_LEVELS,
  GATE_CROSSING_PAGE_SIZE,
  buildGateCrossingLevelOptions,
  classifyGateCrossingLevel,
  countGateCrossings,
  filterGateCrossings,
  getGateCrossingDelta,
  paginateGateCrossings,
} from '../src/constants/video/gateCrossings.js';

const row = (gateValue, extra = {}) => ({ gateValue, previousView: null, currentView: null, crossedAt: null, ...extra });

test('each value belongs to its coarsest exactly-divisible unit, from 1e8 down to 1e3', () => {
  const examples = [
    [null, null], [undefined, null], [0, null], [999, null], [-1000, null],
    [1_000, 'thousand'], [9_000, 'thousand'], [193_000, 'thousand'], [999_000, 'thousand'],
    [10_000, 'tenThousand'], [90_000, 'tenThousand'], [1_930_000, 'tenThousand'],
    [100_000, 'hundredThousand'], [900_000, 'hundredThousand'], [1_100_000, 'hundredThousand'],
    [1_000_000, 'million'], [2_000_000, 'million'], [9_000_000, 'million'], [14_000_000, 'million'],
    [10_000_000, 'tenMillion'], [90_000_000, 'tenMillion'],
    [100_000_000, 'hundredMillion'], [200_000_000, 'hundredMillion'],
    [1_930_001, null], [100_001, null], [999_999_999_999, null], [100_000_000_000, 'hundredMillion'],
  ];
  for (const [gateValue, expected] of examples) {
    assert.equal(classifyGateCrossingLevel(gateValue)?.id ?? null, expected, String(gateValue));
  }
  assert.deepEqual(GATE_CROSSING_LEVELS.map(({ id }) => id), [
    'thousand', 'tenThousand', 'hundredThousand', 'million', 'tenMillion', 'hundredMillion',
  ]);
});

test('only non-negative safe integers are classified', () => {
  for (const value of ['1000', ' 1000 ', 1000.5, NaN, Infinity, -Infinity, {}, [], true]) {
    assert.equal(classifyGateCrossingLevel(value), null, String(value));
  }
  assert.equal(classifyGateCrossingLevel(1000)?.id, 'thousand');
});

test('counts are disjoint per level and unclassified rows only appear in the total', () => {
  const rows = [
    row(1_000), row(9_000), row(193_000), row(10_000), row(100_000),
    row(1_000_000), row(1_930_000), row(2_000_000), row(10_000_000), row(100_000_000),
    row(500), row(null),
  ];
  assert.deepEqual(countGateCrossings(rows), {
    all: 12,
    thousand: 3,
    tenThousand: 2,
    hundredThousand: 1,
    million: 2,
    tenMillion: 1,
    hundredMillion: 1,
  });
  const levelSum = Object.entries(countGateCrossings(rows))
    .filter(([id]) => id !== 'all')
    .reduce((sum, [, count]) => sum + count, 0);
  assert.equal(levelSum, 10);
  assert.deepEqual(countGateCrossings([]), {
    all: 0, thousand: 0, tenThousand: 0, hundredThousand: 0, million: 0, tenMillion: 0, hundredMillion: 0,
  });
  assert.deepEqual(countGateCrossings(undefined).all, 0);
});

test('the documented real sample puts 1,930,000 in ten-thousands and 2,000,000 in millions', () => {
  const rows = [row(1_930_000), row(2_000_000)];
  assert.deepEqual(rows.map(({ gateValue }) => classifyGateCrossingLevel(gateValue).id), ['tenThousand', 'million']);
  assert.equal(countGateCrossings(rows).million, 1);
  assert.equal(countGateCrossings(rows).tenThousand, 1);
  assert.equal(countGateCrossings(rows).all, 2);
});

test('filtering is pure front-end selection and keeps order without mutating the source', () => {
  const rows = [row(100_000), row(1_000), row(5_000), row(10_000), row(1_930_000)];
  const source = [...rows];
  assert.deepEqual(filterGateCrossings(rows, GATE_CROSSING_ALL_LEVEL.id), source);
  assert.deepEqual(filterGateCrossings(rows, 'thousand').map(({ gateValue }) => gateValue), [1_000, 5_000]);
  assert.deepEqual(filterGateCrossings(rows, 'tenThousand').map(({ gateValue }) => gateValue), [10_000, 1_930_000]);
  assert.deepEqual(filterGateCrossings(rows, 'hundredThousand').map(({ gateValue }) => gateValue), [100_000]);
  assert.deepEqual(filterGateCrossings(rows, 'hundredMillion'), []);
  assert.deepEqual(filterGateCrossings(rows, null), source);
  assert.deepEqual(filterGateCrossings(undefined, 'thousand'), []);
  assert.deepEqual(rows, source);
});

test('level options show per-level counts and disable levels without rows', () => {
  const options = buildGateCrossingLevelOptions([row(1_000), row(1_000_000), row(500)]);
  assert.deepEqual(options.map(({ level, count, disabled }) => [level.id, count, disabled]), [
    ['all', 3, false],
    ['thousand', 1, false],
    ['tenThousand', 0, true],
    ['hundredThousand', 0, true],
    ['million', 1, false],
    ['tenMillion', 0, true],
    ['hundredMillion', 0, true],
  ]);
  assert.equal(options[0].level.label, '全部');
});

test('delta keeps real zero and negative corrections but stays null when either side is missing', () => {
  assert.equal(getGateCrossingDelta({ previousView: 1_000, currentView: 1_930 }), 930);
  assert.equal(getGateCrossingDelta({ previousView: 1_000, currentView: 1_000 }), 0);
  assert.equal(getGateCrossingDelta({ previousView: 2_000, currentView: 1_930 }), -70);
  assert.equal(getGateCrossingDelta({ previousView: null, currentView: 1_930 }), null);
  assert.equal(getGateCrossingDelta({ previousView: 1_000, currentView: null }), null);
  assert.equal(getGateCrossingDelta({ previousView: undefined, currentView: undefined }), null);
  assert.equal(getGateCrossingDelta({ previousView: 1_000, currentView: Number.NaN }), null);
  assert.equal(getGateCrossingDelta({ previousView: 0, currentView: 0 }), 0);
  assert.equal(getGateCrossingDelta({}), null);
});

test('pagination shows ten rows per page and clamps out-of-range page numbers', () => {
  assert.equal(GATE_CROSSING_PAGE_SIZE, 10);
  const rows = Array.from({ length: 25 }, (_, index) => row((index + 1) * 1_000));
  const first = paginateGateCrossings(rows);
  assert.equal(first.page, 1);
  assert.equal(first.pageCount, 3);
  assert.equal(first.total, 25);
  assert.deepEqual(first.rows.map(({ gateValue }) => gateValue), rows.slice(0, 10).map(({ gateValue }) => gateValue));
  const last = paginateGateCrossings(rows, 3);
  assert.equal(last.rows.length, 5);
  assert.equal(last.page, 3);
  assert.equal(paginateGateCrossings(rows, 99).page, 3);
  assert.equal(paginateGateCrossings(rows, 0).page, 1);
  assert.deepEqual(paginateGateCrossings([], 4), { rows: [], page: 1, pageCount: 1, total: 0 });
  assert.equal(paginateGateCrossings(rows, 2, 20).pageCount, 2);
});

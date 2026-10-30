import assert from 'node:assert/strict';
import test from 'node:test';
import { vocalPointerOffset } from '../src/pages/vocal/useVocalDepth.js';

test('vocal depth follows the pointer horizontally and stays within one step of center', () => {
  assert.equal(vocalPointerOffset(0, 1000), -1);
  assert.equal(vocalPointerOffset(500, 1000), 0);
  assert.equal(vocalPointerOffset(1000, 1000), 1);
  assert.equal(vocalPointerOffset(-40, 1000), -1);
  assert.equal(vocalPointerOffset(1400, 1000), 1);
  assert.equal(vocalPointerOffset(10, 0), 0);
  assert.equal(vocalPointerOffset(Number.NaN, 1000), 0);
});

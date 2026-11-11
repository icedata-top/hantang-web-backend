import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PROCESSING_SOURCES, PROCESSING_TODOS, processingJobMode, processingRunHealth, processingRunLabel } from '../src/pages/Admin/processingModel.js';
import { getTranslator } from '../src/i18n.js';

test('planned classification work is separate from live sources and makes no monitoring requests', () => {
  assert.deepEqual(PROCESSING_SOURCES, ['search', 'aggregation', 'scheduler']);
  assert.deepEqual(PROCESSING_TODOS, ['videoLabels', 'creatorLabels']);
  assert.ok(PROCESSING_TODOS.every(id => !PROCESSING_SOURCES.includes(id)));
  for (const language of ['zh', 'en', 'ja']) {
    const t = getTranslator(language);
    for (const id of PROCESSING_TODOS) {
      for (const key of [`processing.title.${id}`, `processing.flow.${id}`, `processing.plan.${id}`]) assert.notEqual(t(key), key);
    }
  }
});

test('scheduler engine never implies a full-refresh strategy, and unknown jobs remain unknown', () => {
  const expected = [{ name: 'full', mode: 'full' }, { name: 'daily', mode: 'by_day' }, { name: 'java-delta', mode: 'incremental' }];
  assert.equal(processingJobMode('full', expected), 'full');
  assert.equal(processingJobMode('daily', expected), 'by_day');
  assert.equal(processingJobMode('java-delta', expected), 'incremental');
  assert.equal(processingJobMode('cron-other', expected), 'unknown');
});

test('enabled jobs without observed success never become healthy and unfamiliar run states remain explicit', () => {
  assert.equal(processingRunHealth({ active: true, lastStatus: null }), 'gaps');
  assert.equal(processingRunHealth({ active: true, lastStatus: 'succeeded' }), 'healthy');
  assert.equal(processingRunHealth({ active: false, lastStatus: 'succeeded' }), 'gaps');
  assert.equal(processingRunHealth({ active: true, lastStatus: 'failed' }), 'unavailable');
  assert.equal(processingRunHealth({ active: true, lastStatus: 'running' }), 'loading');
  assert.equal(processingRunLabel({ active: true, lastStatus: 'future-state' }), 'run.unknown');
  assert.equal(processingRunLabel({ active: true, lastStatus: null }), 'noRun');
});

test('backend notes and task states all have localized copy', () => {
  const service = readFileSync(new URL('../../src/main/java/com/hantang/web/service/DataProcessingService.java', import.meta.url), 'utf8');
  const notes = [...service.matchAll(/notes\.add\("([a-z_]+)"\)/g)].map(match => match[1]);
  notes.push('result_missing', 'result_forbidden', 'control_forbidden', 'control_missing', 'cron_missing', 'cron_forbidden');
  for (const language of ['zh', 'en', 'ja']) {
    const t = getTranslator(language);
    for (const note of notes) assert.notEqual(t(`processing.note.${note}`), `processing.note.${note}`);
  }
});

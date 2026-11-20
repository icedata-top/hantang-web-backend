import assert from 'node:assert/strict';
import test from 'node:test';
import { analysisProgress } from '../src/pages/Admin/videoAnalysisModel.js';
import { clampLabelingCount, labelingAvailability, labelingOverviewRequestError, overallLabelingPercent, validLabelingCount } from '../src/pages/Admin/videoLabelingModel.js';
const overview = { available:true,total_count:200000,labeled_count:10000,unlabeled_count:190000,manual_count:1000 };
test('HTTP access, missing endpoint and network errors do not claim the database is disconnected',()=>{
  assert.equal(labelingOverviewRequestError({code:403}),'LOCAL_ACCESS_REQUIRED');
  assert.equal(labelingOverviewRequestError({code:404}),'LABELING_API_NOT_FOUND');
  assert.equal(labelingOverviewRequestError(new TypeError('Failed to fetch')),'OVERVIEW_UNAVAILABLE');
  assert.equal(labelingOverviewRequestError({code:500}),'OVERVIEW_UNAVAILABLE');
});
test('incremental availability shrinks after 10k then 20k labels while overwrite preserves manual labels',()=>{
  assert.equal(labelingAvailability(overview,'incremental'),190000);
  assert.equal(labelingAvailability(overview,'overwrite'),199000);
  assert.equal(labelingAvailability({...overview,labeled_count:30000,unlabeled_count:170000},'incremental'),170000);
  assert.equal(labelingAvailability({available:false},'incremental'),null);
});
test('operator must choose a valid bounded count and empty or unknown ranges never submit',()=>{
  assert.equal(validLabelingCount(20000,190000),true);
  for(const value of [0,null,-1,1.5,200001]) assert.equal(validLabelingCount(value,200000),false);
  assert.equal(validLabelingCount(1000,null),false);
  assert.equal(validLabelingCount(1000,999),false);
  assert.equal(clampLabelingCount(10000,231),231);
  assert.equal(clampLabelingCount(10000,0),0);
  assert.equal(clampLabelingCount(null,20000),10000);
});
test('overall coverage uses the current candidate set and never rounds unfinished work to 100%',()=>{
  assert.equal(overallLabelingPercent(overview),5);
  assert.equal(overallLabelingPercent({...overview,labeled_count:199999}),99.9);
  assert.equal(overallLabelingPercent({...overview,labeled_count:200000}),100);
  assert.equal(overallLabelingPercent({available:true,total_count:0,labeled_count:0}),0);
  assert.equal(overallLabelingPercent(null),null);
});
test('protected conflicts finish without claiming new successful database writes',()=>{
  const now=Date.now();
  const result=analysisProgress({active:false,status:'completed',selected_count:20,elapsed_ms:1000,
    summary:{succeeded_count:18,failed_count:0,skipped_count:2},snapshot_at:new Date(now).toISOString()},now);
  assert.equal(result.percent,100);assert.equal(result.succeeded,18);assert.equal(result.skipped,2);assert.equal(result.remaining,0);
});

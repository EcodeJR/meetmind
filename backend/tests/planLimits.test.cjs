const test = require('node:test');
const assert = require('node:assert/strict');
const { FREE_PLAN_LIMITS, PRO_PLAN_LIMITS } = require('../dist/utils/constants.js');

test('free plan limits are intentionally bounded', () => {
  assert.equal(FREE_PLAN_LIMITS.meetingsPerMonth, 5);
  assert.equal(FREE_PLAN_LIMITS.maxRecordingSeconds, 30 * 60);
  assert.equal(FREE_PLAN_LIMITS.transcriptRetentionDays, 7);
});

test('pro plan limits remain unrestricted', () => {
  assert.equal(PRO_PLAN_LIMITS.meetingsPerMonth, Infinity);
  assert.equal(PRO_PLAN_LIMITS.maxRecordingSeconds, Infinity);
  assert.equal(PRO_PLAN_LIMITS.transcriptRetentionDays, Infinity);
});

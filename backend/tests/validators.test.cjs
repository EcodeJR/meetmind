const test = require('node:test');
const assert = require('node:assert/strict');
const {
  meetingProcessSchema,
  searchSchema,
  updateMeetingSchema,
} = require('../dist/utils/validators.js');

test('meeting processing validation does not impose the free-plan recording cap', () => {
  const parsed = meetingProcessSchema.safeParse({
    audioUrl: 'https://cdn.example.com/recording.m4a',
    durationSeconds: 31 * 60,
  });

  assert.equal(parsed.success, true);
});

test('meeting update validation bounds untrusted text payloads', () => {
  assert.equal(
    updateMeetingSchema.safeParse({ rawTranscript: 'a'.repeat(100001) }).success,
    false,
  );
  assert.equal(
    updateMeetingSchema.safeParse({ actionItems: Array(101).fill('Follow up') }).success,
    false,
  );
  assert.equal(
    updateMeetingSchema.safeParse({ summary: 'Concise summary' }).success,
    true,
  );
});

test('search validation applies safe pagination defaults', () => {
  const parsed = searchSchema.parse({ q: 'quarterly planning' });
  assert.equal(parsed.page, 1);
  assert.equal(parsed.limit, 10);
  assert.throws(() => searchSchema.parse({ q: '' }));
});

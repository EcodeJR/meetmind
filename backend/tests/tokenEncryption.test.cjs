const test = require('node:test');
const assert = require('node:assert/strict');
const { encryptIntegrationToken, decryptIntegrationToken } = require('../dist/services/tokenEncryptionService.js');

test('integration tokens are encrypted and recoverable with the configured key', () => {
  const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = 'a'.repeat(64);
  try {
    const plaintext = 'provider-access-token-that-must-not-be-stored-as-plain-text';
    const encrypted = encryptIntegrationToken(plaintext);
    assert.notEqual(encrypted, plaintext);
    assert.equal(decryptIntegrationToken(encrypted), plaintext);
  } finally {
    if (previous === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = previous;
  }
});

test('integration token encryption rejects an unsafe key configuration', () => {
  const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = 'unsafe';
  try {
    assert.throws(() => encryptIntegrationToken('token'), /64-character hexadecimal key/);
  } finally {
    if (previous === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = previous;
  }
});

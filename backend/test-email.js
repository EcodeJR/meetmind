require('dotenv').config();
const path = require('path');

// Import the compiled email service
const emailService = require(path.join(__dirname, 'dist', 'services', 'emailService.js'));
const logger = console;

(async () => {
  try {
    logger.log('[TEST] Starting email service test');

    const to = process.env.TEST_EMAIL || process.env.GMAIL_USER;
    if (!to) {
      logger.error('[TEST] No TEST_EMAIL or GMAIL_USER set in environment. Aborting.');
      process.exit(1);
    }

    // Call sendWelcomeEmail with a simple name
    const result = await emailService.sendWelcomeEmail(to, 'Test User');
    logger.log('[TEST] sendWelcomeEmail result:', result);
    process.exit(0);
  } catch (err) {
    logger.error('[TEST] Error running email test:', err);
    process.exit(2);
  }
})();

import { Router } from 'express';
import { Contact } from '../models/Contact';
import { Waitlist } from '../models/Waitlist';
import { logger } from '../utils/logger';
import { sendWelcomeEmail } from '../services/emailService';

const router = Router();

// POST /api/webhook/new-user
// Internal webhook used by admin backend to trigger welcome emails after a user is created.
router.post('/webhook/new-user', async (req, res): Promise<void> => {
  try {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const providedSecret = req.headers['x-webhook-secret'];

    if (!webhookSecret || providedSecret !== webhookSecret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { email, name, firstName, clerkId } = req.body || {};
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const resolvedFirstName = firstName || name || 'there';
    await sendWelcomeEmail(email, resolvedFirstName);

    logger.info({ email, clerkId }, 'Welcome email webhook processed');
    res.status(200).json({ success: true, message: 'Welcome email sent' });
  } catch (error) {
    logger.error({ error }, 'Failed to process welcome email webhook');
    res.status(500).json({ error: 'Failed to send welcome email' });
  }
});

// POST /api/contact
router.post('/contact', async (req, res): Promise<void> => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      res.status(400).json({ error: 'Name, email, and message are required' });
      return;
    }

    const contact = new Contact({ name, email, subject, message });
    await contact.save();

    logger.info({ name, email }, 'Contact form submitted successfully');
    res.status(201).json({ success: true, message: 'Message saved successfully' });
    return;
  } catch (error) {
    logger.error({ error }, 'Failed to save contact form submission');
    res.status(500).json({ error: 'Failed to submit contact form' });
    return;
  }
});

// POST /api/waitlist
router.post('/waitlist', async (req, res): Promise<void> => {
  try {
    const { email, platform } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Check if already waitlisted
    const existing = await Waitlist.findOne({ email });
    if (existing) {
      res.status(200).json({ success: true, message: 'Already registered on waitlist' });
      return;
    }

    const waitlist = new Waitlist({ email, platform: platform || 'ios' });
    await waitlist.save();

    logger.info({ email }, 'Waitlist registration successful');
    res.status(201).json({ success: true, message: 'Waitlist registration successful!' });
    return;
  } catch (error) {
    logger.error({ error }, 'Failed to save waitlist registration');
    res.status(500).json({ error: 'Failed to register on waitlist' });
    return;
  }
});

export default router;

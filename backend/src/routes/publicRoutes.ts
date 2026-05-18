import { Router } from 'express';
import { Contact } from '../models/Contact';
import { Waitlist } from '../models/Waitlist';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/contact
router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const contact = new Contact({ name, email, subject, message });
    await contact.save();

    logger.info({ name, email }, 'Contact form submitted successfully');
    res.status(201).json({ success: true, message: 'Message saved successfully' });
  } catch (error) {
    logger.error({ error }, 'Failed to save contact form submission');
    res.status(500).json({ error: 'Failed to submit contact form' });
  }
});

// POST /api/waitlist
router.post('/waitlist', async (req, res) => {
  try {
    const { email, platform } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if already waitlisted
    const existing = await Waitlist.findOne({ email });
    if (existing) {
      return res.status(200).json({ success: true, message: 'Already registered on waitlist' });
    }

    const waitlist = new Waitlist({ email, platform: platform || 'ios' });
    await waitlist.save();

    logger.info({ email }, 'Waitlist registration successful');
    res.status(201).json({ success: true, message: 'Waitlist registration successful!' });
  } catch (error) {
    logger.error({ error }, 'Failed to save waitlist registration');
    res.status(500).json({ error: 'Failed to register on waitlist' });
  }
});

export default router;

import { OpenAI } from 'openai';
import { logger } from '../utils/logger';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const transcribeAudio = async (audioUrl: string): Promise<string> => {
  try {
    logger.info({ audioUrl }, 'Starting transcription with Whisper');

    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioUrl) as any,
      model: 'whisper-1',
    });

    logger.info({ duration: response.text.length }, 'Transcription completed');

    return response.text;
  } catch (error) {
    logger.error({ error }, 'Failed to transcribe audio');
    throw error;
  }
};

import { OpenAI } from 'openai';
import { logger } from '../utils/logger';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const transcribeAudio = async (filePath: string): Promise<string> => {
  try {
    console.log(`[DEBUGGER] Whisper Transcription: Starting with file: ${filePath}`);
    logger.info({ filePath }, 'Starting transcription with Whisper');

    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath) as any,
      model: 'whisper-1',
    });

    console.log(`[DEBUGGER] Whisper Transcription: SUCCESS. Received ${response.text.split(' ').length} words.`);

    logger.info({ duration: response.text.length }, 'Transcription completed');

    return response.text;
  } catch (error) {
    logger.error({ error }, 'Failed to transcribe audio');
    throw error;
  }
};

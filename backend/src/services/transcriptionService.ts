import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const transcribeWithWhisper = async (filePath: string): Promise<string> => {
  console.log(`[DEBUGGER] Whisper Transcription: Starting with file: ${filePath}`);
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath) as any,
    model: 'whisper-1',
  });
  console.log(`[DEBUGGER] Whisper Transcription: SUCCESS. Received ${response.text.split(' ').length} words.`);
  return response.text;
};

const transcribeWithGemini = async (filePath: string): Promise<string> => {
  console.log(`[DEBUGGER] Gemini Transcription Fallback: Processing ${filePath}`);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const audioData = fs.readFileSync(filePath);
  const audioPart = {
    inlineData: {
      data: audioData.toString('base64'),
      mimeType: 'audio/mp4', // Proper MIME type for .m4a
    },
  };

  const result = await model.generateContent([
    'Transcribe this audio meeting verbatim. Do not add any preamble or summary, just the text spoken.',
    audioPart,
  ]);

  const transcript = result.response.text();
  console.log(`[DEBUGGER] Gemini Transcription Fallback: SUCCESS. Received ${transcript.split(' ').length} words.`);
  return transcript;
};

export const transcribeAudio = async (filePath: string): Promise<string> => {
  try {
    // Try Whisper first
    return await transcribeWithWhisper(filePath);
  } catch (error: any) {
    if (error.status === 429 || error.code === 'insufficient_quota') {
      console.log(`[DEBUGGER] WARNING: Whisper quota exceeded, attempting Gemini fallback...`);
      try {
        return await transcribeWithGemini(filePath);
      } catch (geminiError) {
        console.error(`[DEBUGGER] FATAL: Gemini transcription fallback also failed.`, geminiError);
        throw geminiError;
      }
    }
    logger.error({ error }, 'Failed to transcribe audio with Whisper');
    throw error;
  }
};

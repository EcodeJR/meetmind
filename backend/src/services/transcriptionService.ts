import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * PHASE 1: OpenAI Whisper (Primary)
 */
const transcribeWithWhisper = async (filePath: string): Promise<string> => {
  console.log(`[DEBUGGER] Whisper Transcription: Starting with file: ${filePath}`);
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath) as any,
    model: 'whisper-1',
  });
  console.log(`[DEBUGGER] Whisper Transcription: SUCCESS. Received ${response.text.split(' ').length} words.`);
  return response.text;
};

/**
 * PHASE 2: Groq Whisper (First Fallback)
 */
const transcribeWithGroq = async (filePath: string): Promise<string> => {
  console.log(`[DEBUGGER] Groq Transcription Fallback: Starting with file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Ensure we are passing a path that ends in .m4a to help Groq's SDK
  // We use the raw stream but Groq's SDK often needs the explicit file hint
  const response = await groq.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: 'whisper-large-v3',
    response_format: 'text',
  });
  
  const transcript = typeof response === 'string' ? response : (response as any).text;
  console.log(`[DEBUGGER] Groq Transcription Fallback: SUCCESS. Received ${transcript.split(' ').length} words.`);
  return transcript;
};

/**
 * PHASE 3: Gemini 2.5 Flash (Last Resort)
 */
const transcribeWithGemini = async (filePath: string): Promise<string> => {
  console.log(`[DEBUGGER] Gemini Transcription Fallback: Processing ${filePath}`);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const audioData = fs.readFileSync(filePath);
  const audioPart = {
    inlineData: {
      data: audioData.toString('base64'),
      mimeType: 'audio/mp4',
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

/**
 * Main Controller with Triple Fallback: OpenAI > Groq > Gemini
 */
export const transcribeAudio = async (filePath: string): Promise<string> => {
  // 1. Try OpenAI Whisper
  try {
    return await transcribeWithWhisper(filePath);
  } catch (error: any) {
    console.log(`[DEBUGGER] OpenAI Whisper failed, attempting Groq... (${error.message})`);
  }

  // 2. Try Groq Whisper (Super fast fallback)
  try {
    return await transcribeWithGroq(filePath);
  } catch (error: any) {
    console.log(`[DEBUGGER] Groq Fallback failed, attempting Gemini... (${error.message})`);
  }

  // 3. Try Gemini 2.5 Flash
  try {
    return await transcribeWithGemini(filePath);
  } catch (error: any) {
    console.error(`[DEBUGGER] FATAL: All transcription providers failed.`, error.message);
    throw new Error('Transcription pipeline exhausted all providers.');
  }
};

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
 * Helper: Download audio from URL if needed
 */
const getAudioStream = async (source: string) => {
  // If it's a URL, download it
  if (source.startsWith('http')) {
    console.log(`[DEBUGGER] Attempting to download audio from URL: ${source.substring(0, 100)}...`);
    try {
      const response = await fetch(source, { timeout: 30000 } as any);
      console.log(`[DEBUGGER] Fetch response status: ${response.status}`);
      if (!response.ok) {
        console.error(`[DEBUGGER] HTTP error: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }
      console.log(`[DEBUGGER] Successfully downloaded audio stream`);
      return response.body as any;
    } catch (error: any) {
      console.error(`[DEBUGGER] Download failed:`, error.message);
      throw error;
    }
  }
  // Otherwise treat as local file path
  console.log(`[DEBUGGER] Attempting to read local file: ${source}`);
  if (!fs.existsSync(source)) {
    console.error(`[DEBUGGER] File not found: ${source}`);
    throw new Error(`File not found: ${source}`);
  }
  console.log(`[DEBUGGER] Successfully opened local file stream`);
  return fs.createReadStream(source);
};

/**
 * Helper: Download audio from URL as buffer
 */
const downloadAudioBuffer = async (url: string): Promise<Buffer> => {
  console.log(`[DEBUGGER] Downloading audio buffer from URL: ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
  const arrayBuffer = await (response as any).arrayBuffer();
  return Buffer.from(arrayBuffer);
};

/**
 * PHASE 1: OpenAI Whisper (Primary)
 */
const transcribeWithWhisper = async (source: string, language?: string): Promise<string> => {
  console.log(`[DEBUGGER] Whisper Transcription: Starting with source: ${source}`);
  const stream = await getAudioStream(source);
  const opts: any = {
    file: stream as any,
    model: 'whisper-1',
  };
  if (language) opts.language = language;
  const response = await openai.audio.transcriptions.create(opts as any);
  console.log(`[DEBUGGER] Whisper Transcription: SUCCESS. Received ${response.text.split(' ').length} words.`);
  return response.text;
};

/**
 * PHASE 2: Groq Whisper (First Fallback)
 */
const transcribeWithGroq = async (source: string, language?: string): Promise<string> => {
  console.log(`[DEBUGGER] Groq Transcription Fallback: Starting with source: ${source}`);
  
  const stream = await getAudioStream(source);
  const opts: any = {
    file: stream,
    model: 'whisper-large-v3',
    response_format: 'text',
  };
  if (language) opts.language = language;

  const response = await groq.audio.transcriptions.create(opts as any);
  
  const transcript = typeof response === 'string' ? response : (response as any).text;
  console.log(`[DEBUGGER] Groq Transcription Fallback: SUCCESS. Received ${transcript.split(' ').length} words.`);
  return transcript;
};

/**
 * PHASE 3: Gemini 2.5 Flash (Last Resort)
 */
const transcribeWithGemini = async (source: string, language?: string): Promise<string> => {
  console.log(`[DEBUGGER] Gemini Transcription Fallback: Processing ${source}`);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const audioBuffer = source.startsWith('http') 
    ? await downloadAudioBuffer(source)
    : fs.readFileSync(source);
    
  const audioPart = {
    inlineData: {
      data: audioBuffer.toString('base64'),
      mimeType: 'audio/mp4',
    },
  };

  const instruction = `Transcribe this audio meeting verbatim${language ? ` in language: ${language}` : ''}. Do not add any preamble or summary, just the text spoken.`;

  const result = await model.generateContent([
    instruction,
    audioPart,
  ] as any);

  const transcript = result.response.text();
  console.log(`[DEBUGGER] Gemini Transcription Fallback: SUCCESS. Received ${transcript.split(' ').length} words.`);
  return transcript;
};

/**
 * Main Controller with Triple Fallback: OpenAI > Groq > Gemini
 * Supports both local file paths and Cloudinary URLs
 */
export const transcribeAudio = async (source: string, language?: string): Promise<string> => {
  console.log(`[DEBUGGER] Starting transcription pipeline with source: ${source.substring(0, 80)}...`);
  
  // 1. Try OpenAI Whisper
  try {
    console.log(`[DEBUGGER] Attempting OpenAI Whisper...`);
    return await transcribeWithWhisper(source, language);
  } catch (error: any) {
    console.log(`[DEBUGGER] OpenAI Whisper failed, attempting Groq... (${error.message})`);
    console.error(`[DEBUGGER] OpenAI error details:`, error);
  }

  // 2. Try Groq Whisper (Super fast fallback)
  try {
    console.log(`[DEBUGGER] Attempting Groq Whisper fallback...`);
    return await transcribeWithGroq(source, language);
  } catch (error: any) {
    console.log(`[DEBUGGER] Groq Fallback failed, attempting Gemini... (${error.message})`);
    console.error(`[DEBUGGER] Groq error details:`, error);
  }

  // 3. Try Gemini 2.5 Flash
  try {
    console.log(`[DEBUGGER] Attempting Gemini fallback...`);
    return await transcribeWithGemini(source, language);
  } catch (error: any) {
    console.error(`[DEBUGGER] FATAL: All transcription providers failed.`);
    console.error(`[DEBUGGER] Gemini error details:`, error.message);
    console.error(`[DEBUGGER] Source was:`, source);
    throw new Error(`Transcription pipeline exhausted all providers: ${error.message}`);
  }
};

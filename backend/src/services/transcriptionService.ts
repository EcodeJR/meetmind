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
    console.log(`[DEBUGGER] Downloading audio from URL: ${source}`);
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
    return response.body as any;
  }
  // Otherwise treat as local file path
  if (!fs.existsSync(source)) {
    throw new Error(`File not found: ${source}`);
  }
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
const transcribeWithWhisper = async (source: string): Promise<string> => {
  console.log(`[DEBUGGER] Whisper Transcription: Starting with source: ${source}`);
  const stream = await getAudioStream(source);
  const response = await openai.audio.transcriptions.create({
    file: stream as any,
    model: 'whisper-1',
  });
  console.log(`[DEBUGGER] Whisper Transcription: SUCCESS. Received ${response.text.split(' ').length} words.`);
  return response.text;
};

/**
 * PHASE 2: Groq Whisper (First Fallback)
 */
const transcribeWithGroq = async (source: string): Promise<string> => {
  console.log(`[DEBUGGER] Groq Transcription Fallback: Starting with source: ${source}`);
  
  const stream = await getAudioStream(source);
  const response = await groq.audio.transcriptions.create({
    file: stream,
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
const transcribeWithGemini = async (source: string): Promise<string> => {
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
 * Supports both local file paths and Cloudinary URLs
 */
export const transcribeAudio = async (source: string): Promise<string> => {
  console.log(`[DEBUGGER] Starting transcription pipeline with source: ${source.substring(0, 80)}...`);
  
  // 1. Try OpenAI Whisper
  try {
    return await transcribeWithWhisper(source);
  } catch (error: any) {
    console.log(`[DEBUGGER] OpenAI Whisper failed, attempting Groq... (${error.message})`);
  }

  // 2. Try Groq Whisper (Super fast fallback)
  try {
    return await transcribeWithGroq(source);
  } catch (error: any) {
    console.log(`[DEBUGGER] Groq Fallback failed, attempting Gemini... (${error.message})`);
  }

  // 3. Try Gemini 2.5 Flash
  try {
    return await transcribeWithGemini(source);
  } catch (error: any) {
    console.error(`[DEBUGGER] FATAL: All transcription providers failed.`, error.message);
    throw new Error('Transcription pipeline exhausted all providers.');
  }
};

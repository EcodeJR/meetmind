import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

type ProviderName = 'openai' | 'groq' | 'gemini';

const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ESOCKET',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
]);

const isRetryableTranscriptionError = (error: any): boolean => {
  const status = Number(error?.status || error?.statusCode || error?.response?.status);
  const code = String(error?.code || error?.error?.code || '').toUpperCase();
  const message = String(error?.message || error?.error?.message || '').toLowerCase();

  if (TRANSIENT_ERROR_CODES.has(code)) return true;
  if (status >= 500 && status < 600) return true;
  if (status === 429) {
    return !message.includes('insufficient_quota') && !message.includes('billing');
  }

  return (
    message.includes('timeout') ||
    message.includes('temporar') ||
    message.includes('service unavailable') ||
    message.includes('high demand') ||
    message.includes('overloaded')
  );
};

const retryTranscriptionOnce = async <T>(
  provider: ProviderName,
  action: () => Promise<T>
): Promise<T> => {
  try {
    return await action();
  } catch (error: any) {
    if (!isRetryableTranscriptionError(error)) throw error;

    console.warn(
      {
        provider,
        code: error?.code || error?.error?.code,
        status: error?.status || error?.statusCode || error?.response?.status,
      },
      'Transient transcription failure detected; retrying once'
    );

    return await action();
  }
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

const writeAudioBufferToTempFile = async (source: string): Promise<string> => {
  const audioBuffer = source.startsWith('http')
    ? await downloadAudioBuffer(source)
    : fs.readFileSync(source);

  const rawExt = source.split('?')[0].split('.').pop()?.toLowerCase().trim() || '';
  const ext = rawExt && rawExt.length <= 5 ? rawExt : 'm4a';

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'meetmind-audio-'));
  const tempFilePath = path.join(tempDirectory, `audio.${ext}`);
  fs.writeFileSync(tempFilePath, audioBuffer);
  return tempFilePath;
};

// ============================================
// CHUNKED TRANSCRIPTION
// Splits large audio files into 10 minute 
// segments to stay under Groq's 25MB limit.
// Used automatically when file exceeds 20MB.
// WAV files (uncompressed) are much larger 
// than MP4 — always check size before sending.
// ============================================

const GROQ_MAX_FILE_SIZE_MB = 20; // Stay safely under Groq's 25MB limit
const CHUNK_DURATION_SECONDS = 600; // 10 minutes per chunk

/**
 * Split audio file into chunks of fixed duration
 */
const splitAudioIntoChunks = (
  inputPath: string,
  chunkDurationSeconds = CHUNK_DURATION_SECONDS
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, async (err: any, metadata: any) => {
      if (err) return reject(err);

      const totalDuration = metadata.format.duration || 0;
      const numChunks = Math.ceil(totalDuration / chunkDurationSeconds);
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'memovoice-chunks-')
      );

      console.log(
        `[CHUNKER] Duration: ${totalDuration.toFixed(1)}s — splitting into ${numChunks} chunk(s)`
      );

      const chunks: string[] = new Array(numChunks);

      const chunkPromises = Array.from({ length: numChunks }, (_, i) => {
        return new Promise<void>((res, rej) => {
          const startTime = i * chunkDurationSeconds;
          const chunkPath = path.join(tempDir, `chunk-${i}.mp4`);

          // ============================================
          // Output as MP4 not WAV — keeps chunks 
          // small and compressed. WAV would be 
          // ~10x larger and exceed Groq's limit.
          // ============================================
          ffmpeg(inputPath)
            .setStartTime(startTime)
            .setDuration(chunkDurationSeconds)
            .audioCodec('aac')
            .output(chunkPath)
            .on('end', () => {
              chunks[i] = chunkPath;
              res();
            })
            .on('error', rej)
            .run();
        });
      });

      try {
        await Promise.all(chunkPromises);
        resolve(chunks);
      } catch (chunkErr) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch { }
        reject(chunkErr);
      }
    });
  });
};

/**
 * Transcribe with Groq, automatically chunking if file is too large.
 * Only used internally — does not fall through to other providers.
 */
const transcribeWithGroqChunked = async (
  filePath: string,
  language = 'en'
): Promise<string> => {
  const stats = fs.statSync(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);

  console.log(`[CHUNKER] File size: ${fileSizeMB.toFixed(2)}MB`);

  // Small enough — send directly without chunking
  if (fileSizeMB < GROQ_MAX_FILE_SIZE_MB) {
    console.log('[CHUNKER] File within limit — transcribing directly with Groq');
    const response = await retryTranscriptionOnce('groq', () =>
      groq.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-large-v3',
        language,
        temperature: 0,
        response_format: 'text',
      } as any)
    );
    return typeof response === 'string' ? response : (response as any).text;
  }

  // File too large — split into chunks
  console.log('[CHUNKER] File exceeds limit — splitting into chunks...');
  const chunks = await splitAudioIntoChunks(filePath);
  const transcripts: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkStats = fs.statSync(chunks[i]);
    const chunkSizeMB = chunkStats.size / (1024 * 1024);
    console.log(
      `[CHUNKER] Transcribing chunk ${i + 1}/${chunks.length} (${chunkSizeMB.toFixed(2)}MB)...`
    );

    const response = await retryTranscriptionOnce('groq', () =>
      groq.audio.transcriptions.create({
        file: fs.createReadStream(chunks[i]),
        model: 'whisper-large-v3',
        language,
        temperature: 0,
        response_format: 'text',
      } as any)
    );

    const chunkText = typeof response === 'string' ? response : (response as any).text;
    transcripts.push(chunkText);
    console.log(`[CHUNKER] Chunk ${i + 1} complete`);
  }

  // Clean up chunk temp files
  try {
    fs.rmSync(path.dirname(chunks[0]), { recursive: true, force: true });
  } catch { }

  const fullTranscript = transcripts.join(' ');
  console.log(
    `[CHUNKER] All chunks complete. Total words: ${fullTranscript.split(' ').length}`
  );
  return fullTranscript;
};

/**
 * Public helper: transcribeInChunks
 * Call this from reprocessAdminMeeting and any other place
 * that needs to handle potentially large audio files.
 * Accepts both local file paths and Cloudinary URLs.
 * Always uses Groq — does not fall through to other providers.
 */
export const transcribeInChunks = async (
  source: string,
  language = 'en'
): Promise<string> => {
  console.log(`[CHUNKER] Starting chunked transcription for: ${source.substring(0, 80)}...`);

  // Download to temp file if URL so we can check file size
  const tempFilePath = await writeAudioBufferToTempFile(source);

  try {
    return await transcribeWithGroqChunked(tempFilePath, language);
  } finally {
    // Always clean up the downloaded temp file
    try {
      fs.rmSync(path.dirname(tempFilePath), { recursive: true, force: true });
    } catch { }
  }
};

/**
 * AI Speaker Diarization (Zero Cost)
 * Passes the raw Whisper transcript through Groq's Llama model to infer
 * speaker changes based on conversation flow and context.
 * Outputs a "Speaker 1: ...\nSpeaker 2: ..." formatted transcript.
 * Falls back to the original transcript if diarization fails.
 */
export const diarizeWithAI = async (transcript: string): Promise<string> => {
  console.log(`[DIARIZE] Starting AI speaker diarization (${transcript.length} chars)...`);

  // Skip diarization for very short transcripts — not enough context for the model
  if (!transcript || transcript.trim().length < 50) {
    console.log('[DIARIZE] Transcript too short — skipping diarization');
    return transcript;
  }

  const prompt = `The following is a meeting transcript with no speaker labels.
Analyze the conversation flow, topic changes, question-and-answer patterns, and speaking styles
to identify different speakers. Label them as Speaker 1, Speaker 2, etc.

Format the output exactly like this (one speaker turn per line):
Speaker 1: [what they said]
Speaker 2: [what they said]

Rules:
- Only return the reformatted transcript, nothing else — no preamble, no explanation.
- Keep each speaker's words exactly as they appear in the original.
- If the transcript clearly has only one speaker, label everything as Speaker 1.
- Group consecutive sentences from the same speaker together on one line.

Transcript:
${transcript}`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const diarized = response.choices[0]?.message?.content?.trim();

    if (!diarized || diarized.length < 10) {
      console.warn('[DIARIZE] Empty or too-short response from AI — falling back to raw transcript');
      return transcript;
    }

    console.log(`[DIARIZE] Diarization complete. Output length: ${diarized.length} chars`);
    return diarized;
  } catch (error: any) {
    console.error('[DIARIZE] AI diarization failed — falling back to raw transcript:', error.message);
    return transcript;
  }
};

/**
 * PHASE 2: Groq Whisper (First Fallback)
 * Standard single-file transcription.
 * Will fail with 413 if file exceeds 25MB.
 * Use transcribeInChunks for large files instead.
 */
const transcribeWithGroq = async (source: string, language?: string): Promise<string> => {
  console.log(`[DEBUGGER] Groq Transcription Fallback: Starting with source: ${source}`);

  const tempFilePath = await writeAudioBufferToTempFile(source);
  const opts: any = {
    file: fs.createReadStream(tempFilePath),
    model: 'whisper-large-v3',
    response_format: 'text',
    temperature: 0,
    language: language || 'en',
  };

  try {
    const response = await retryTranscriptionOnce('groq', () =>
      groq.audio.transcriptions.create(opts as any)
    );
    const transcript = typeof response === 'string' ? response : (response as any).text;
    console.log(
      `[DEBUGGER] Groq Transcription Fallback: SUCCESS. Received ${transcript.split(' ').length} words.`
    );
    return transcript;
  } finally {
    fs.rmSync(path.dirname(tempFilePath), { recursive: true, force: true });
  }
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

  const instruction = `Transcribe this audio meeting verbatim${language ? ` in language: ${language}` : ''
    }. Do not add any preamble or summary, just the text spoken.`;

  const result = await retryTranscriptionOnce('gemini', () =>
    model.generateContent([instruction, audioPart] as any)
  );

  const transcript = result.response.text();
  console.log(
    `[DEBUGGER] Gemini Transcription Fallback: SUCCESS. Received ${transcript.split(' ').length} words.`
  );
  return transcript;
};

/**
 * PHASE 1: OpenAI Whisper (Last Resort)
 */
const transcribeWithWhisper = async (source: string, language?: string): Promise<string> => {
  console.log(`[DEBUGGER] Whisper Transcription: Starting with source: ${source}`);
  const tempFilePath = await writeAudioBufferToTempFile(source);
  try {
    const opts: any = {
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      temperature: 0,
      language: language || 'en',
    };
    const response = await retryTranscriptionOnce('openai', () =>
      openai.audio.transcriptions.create(opts as any)
    );
    console.log(
      `[DEBUGGER] Whisper Transcription: SUCCESS. Received ${response.text.split(' ').length} words.`
    );
    return response.text;
  } finally {
    fs.rmSync(path.dirname(tempFilePath), { recursive: true, force: true });
  }
};

/**
 * Main transcription pipeline with triple fallback: Groq > Gemini > OpenAI
 * For large files use transcribeInChunks directly instead.
 */
export const transcribeAudio = async (source: string, language?: string): Promise<string> => {
  console.log(
    `[DEBUGGER] Starting transcription pipeline with source: ${source.substring(0, 80)}...`
  );

  // 1. Try Groq Whisper first
  try {
    console.log(`[DEBUGGER] Attempting Groq Whisper fallback...`);
    return await transcribeWithGroq(source, language);
  } catch (error: any) {
    console.log(
      `[DEBUGGER] Groq Fallback failed, attempting Gemini... (${error.message})`
    );
    console.error(`[DEBUGGER] Groq error details:`, error);
    console.error(`[DEBUGGER] Source was:`, source);
  }

  // 2. Try Gemini
  try {
    console.log(`[DEBUGGER] Attempting Gemini fallback...`);
    return await transcribeWithGemini(source, language);
  } catch (error: any) {
    console.error(`[DEBUGGER] FATAL: Gemini also failed.`);
    console.error(`[DEBUGGER] Gemini error details:`, error.message);
    console.error(`[DEBUGGER] Source was:`, source);
  }

  // 3. OpenAI Whisper as last resort
  try {
    console.log(`[DEBUGGER] Attempting OpenAI Whisper...`);
    return await transcribeWithWhisper(source, language);
  } catch (error: any) {
    console.log(
      `[DEBUGGER] OpenAI Whisper failed. (${error.message})`
    );
    console.error(`[DEBUGGER] OpenAI error details:`, error);
    console.error(`[DEBUGGER] Source was:`, source);
    throw new Error(
      `Transcription pipeline exhausted all providers: ${error.message}`
    );
  }
};
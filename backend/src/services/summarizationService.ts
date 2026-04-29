import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { logger } from '../utils/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface SummaryResult {
  title: string;
  summary: string;
  actionItems: string[];
  keyDecisions: string[];
}

const SYSTEM_PROMPT = `You are an expert meeting summarizer. Analyze the meeting transcript and extract:
1. A concise title (max 10 words)
2. A 2-4 sentence summary
3. Action items as an array (each starting with a verb, include owner if mentioned)
4. Key decisions as an array

Respond with ONLY valid JSON in this exact format, no markdown, no preamble:
{
  "title": "string",
  "summary": "string",
  "actionItems": ["string"],
  "keyDecisions": ["string"]
}`;

const parseJsonResult = (text: string): SummaryResult => {
  try {
    // Strip any accidental markdown fences
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned) as SummaryResult;
  } catch (e) {
    console.error('JSON Parse Error relative to AI text:', text);
    throw new Error('AI returned invalid JSON structure');
  }
};

/**
 * PHASE 1: Claude (Anthropic) - Highest Quality
 */
const summarizeWithClaude = async (rawTranscript: string): Promise<SummaryResult> => {
  logger.info({ transcriptLength: rawTranscript.length }, 'Attempting summarization with Claude');

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Please summarize this meeting transcript:\n\n${rawTranscript}`,
      },
    ],
  });

  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  return parseJsonResult(textContent.text);
};

/**
 * PHASE 2: Llama 3.3 70b (Groq) - Best Speed/Balance
 */
const summarizeWithGroq = async (rawTranscript: string): Promise<SummaryResult> => {
  logger.info({ transcriptLength: rawTranscript.length }, 'Attempting summarization with Groq (Llama 3.3)');

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Summarize this:\n\n${rawTranscript}` },
      ],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
    });

    return parseJsonResult(chatCompletion.choices[0]?.message?.content || '');
  } catch (error: any) {
    console.error(`[DEBUGGER] Groq Summarization Internal Error:`, error.message);
    throw error;
  }
};

/**
 * PHASE 3: Gemini 1.5 Flash (Google) - High Reliability
 */
const summarizeWithGemini = async (rawTranscript: string): Promise<SummaryResult> => {
  logger.info({ transcriptLength: rawTranscript.length }, 'Attempting summarization with Gemini (fallback)');

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
    });

    // Combining system prompt into the main prompt for maximum reliability
    const fullPrompt = `${SYSTEM_PROMPT}\n\nMeeting Transcript to analyze:\n${rawTranscript}`;
    const result = await model.generateContent(fullPrompt);

    const text = result.response.text();
    return parseJsonResult(text);
  } catch (error: any) {
    console.error(`[DEBUGGER] Gemini Summarization Internal Error:`, error.message);
    throw error;
  }
};

/**
 * Triple Fallback Summarization: Claude > Groq > Gemini
 */
export const summarizeTranscript = async (rawTranscript: string): Promise<SummaryResult> => {
  console.log(`[DEBUGGER] Summarization: Initiating analysis for transcript (${rawTranscript.length} chars)`);

  // 1. Claude
  try {
    const result = await summarizeWithClaude(rawTranscript);
    console.log(`[DEBUGGER] Summarization: SUCCESS via Claude. Title: "${result.title}"`);
    return result;
  } catch (error: any) {
    console.log(`[DEBUGGER] WARNING: Claude summarization failed, trying Groq...`);
  }

  // 2. Groq (Llama 3.3 70b)
  try {
    const result = await summarizeWithGroq(rawTranscript);
    console.log(`[DEBUGGER] Summarization: SUCCESS via Groq. Title: "${result.title}"`);
    return result;
  } catch (error: any) {
    console.log(`[DEBUGGER] WARNING: Groq summarization failed (${error.message || 'Unknown Error'}), trying Gemini...`);
  }

  // 3. Gemini
  try {
    const result = await summarizeWithGemini(rawTranscript);
    console.log(`[DEBUGGER] Summarization: SUCCESS via Gemini. Title: "${result.title}"`);
    return result;
  } catch (error: any) {
    console.error(`[DEBUGGER] Gemini summarization failed: ${error.message || 'Unknown Error'}`);
    console.error(`[DEBUGGER] FATAL: All summarization providers failed.`);
    throw new Error('AI pipeline exhausted all providers for summary.');
  }
};

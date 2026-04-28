import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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
  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned) as SummaryResult;
};

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

const summarizeWithGemini = async (rawTranscript: string): Promise<SummaryResult> => {
  logger.info({ transcriptLength: rawTranscript.length }, 'Attempting summarization with Gemini (fallback)');

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent(
    `Please summarize this meeting transcript:\n\n${rawTranscript}`
  );

  const text = result.response.text();
  return parseJsonResult(text);
};

export const summarizeTranscript = async (rawTranscript: string): Promise<SummaryResult> => {
  console.log(`[DEBUGGER] Summarization: Initiating analysis for transcript (${rawTranscript.length} chars)`);
  // Try Claude first
  try {
    const result = await summarizeWithClaude(rawTranscript);
    console.log(`[DEBUGGER] Summarization: SUCCESS via Claude. Title: "${result.title}"`);
    logger.info({ title: result.title }, 'Summarization completed via Claude');
    return result;
  } catch (claudeError) {
    console.log(`[DEBUGGER] WARNING: Claude summarization failed, trying Gemini fallback...`);
    logger.warn({ claudeError }, 'Claude summarization failed, falling back to Gemini');
  }

  // Fallback to Gemini
  try {
    const result = await summarizeWithGemini(rawTranscript);
    console.log(`[DEBUGGER] Summarization: SUCCESS via Gemini. Title: "${result.title}"`);
    logger.info({ title: result.title }, 'Summarization completed via Gemini (fallback)');
    return result;
  } catch (geminiError) {
    logger.error({ geminiError }, 'Gemini fallback also failed');
    throw new Error('All AI summarization providers failed');
  }
};

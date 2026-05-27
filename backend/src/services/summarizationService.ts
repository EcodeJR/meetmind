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
  riskSignals: string[];
}

export interface SummaryPreferences {
  language?: string;
  strategicAlerts?: {
    decisions?: boolean;
    actions?: boolean;
    risks?: boolean;
  };
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese',
};

const buildSystemPrompt = (preferences?: SummaryPreferences): string => {
  const languageCode = preferences?.language || 'en';
  const languageLabel = LANGUAGE_LABELS[languageCode] || `the user's preferred language (${languageCode})`;
  const strategicAlerts = preferences?.strategicAlerts || {};
  const focusAreas = [
    strategicAlerts.decisions !== false ? 'key decisions' : null,
    strategicAlerts.actions !== false ? 'action items' : null,
    strategicAlerts.risks !== false ? 'risks or blockers' : null,
  ].filter(Boolean).join(', ') || 'key decisions, action items, and risks';

  return `You are an expert meeting summarizer. Analyze the meeting transcript and extract:
1. A concise title (max 10 words)
2. A 2-4 sentence summary
3. Action items as an array (each starting with a verb, include owner if mentioned)
4. Key decisions as an array
5. Risk signals as an array capturing blockers, concerns, or risks mentioned in the meeting

Write all human-readable text in ${languageLabel}.
Prioritize the following alert categories in the summary output and keep them especially clear: ${focusAreas}.
If a category is not mentioned, return an empty array for it.

Respond with ONLY valid JSON in this exact format, no markdown, no preamble:
{
  "title": "string",
  "summary": "string",
  "actionItems": ["string"],
  "keyDecisions": ["string"],
  "riskSignals": ["string"]
}`;
};

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
 * Triple Fallback Summarization: Claude > Groq > Gemini
 */
export const summarizeTranscript = async (rawTranscript: string, preferences?: SummaryPreferences): Promise<SummaryResult> => {
  console.log(`[DEBUGGER] Summarization: Initiating analysis for transcript (${rawTranscript.length} chars)`);

  const systemPrompt = buildSystemPrompt(preferences);

  // 1. Claude
  try {
    const result = await summarizeWithClaudeWithPrompt(rawTranscript, systemPrompt);
    console.log(`[DEBUGGER] Summarization: SUCCESS via Claude. Title: "${result.title}"`);
    return result;
  } catch (error: any) {
    console.log(`[DEBUGGER] WARNING: Claude summarization failed, trying Groq...`);
  }

  // 2. Groq (Llama 3.3 70b)
  try {
    const result = await summarizeWithGroqWithPrompt(rawTranscript, systemPrompt);
    console.log(`[DEBUGGER] Summarization: SUCCESS via Groq. Title: "${result.title}"`);
    return result;
  } catch (error: any) {
    console.log(`[DEBUGGER] WARNING: Groq summarization failed (${error.message || 'Unknown Error'}), trying Gemini...`);
  }

  // 3. Gemini
  try {
    const result = await summarizeWithGeminiWithPrompt(rawTranscript, systemPrompt);
    console.log(`[DEBUGGER] Summarization: SUCCESS via Gemini. Title: "${result.title}"`);
    return result;
  } catch (error: any) {
    console.error(`[DEBUGGER] Gemini summarization failed: ${error.message || 'Unknown Error'}`);
    console.error(`[DEBUGGER] FATAL: All summarization providers failed.`);
    throw new Error('AI pipeline exhausted all providers for summary.');
  }
};

const summarizeWithClaudeWithPrompt = async (rawTranscript: string, systemPrompt: string): Promise<SummaryResult> => {
  logger.info({ transcriptLength: rawTranscript.length }, 'Attempting summarization with Claude');

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 1024,
    system: systemPrompt,
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

const summarizeWithGroqWithPrompt = async (rawTranscript: string, systemPrompt: string): Promise<SummaryResult> => {
  logger.info({ transcriptLength: rawTranscript.length }, 'Attempting summarization with Groq (Llama 3.3)');

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
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

const summarizeWithGeminiWithPrompt = async (rawTranscript: string, systemPrompt: string): Promise<SummaryResult> => {
  logger.info({ transcriptLength: rawTranscript.length }, 'Attempting summarization with Gemini (fallback)');

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
    });

    const fullPrompt = `${systemPrompt}\n\nMeeting Transcript to analyze:\n${rawTranscript}`;
    const result = await model.generateContent(fullPrompt);

    const text = result.response.text();
    return parseJsonResult(text);
  } catch (error: any) {
    console.error(`[DEBUGGER] Gemini Summarization Internal Error:`, error.message);
    throw error;
  }
};

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface SummaryResult {
  title: string;
  summary: string;
  actionItems: string[];
  keyDecisions: string[];
}

export const summarizeTranscript = async (rawTranscript: string): Promise<SummaryResult> => {
  try {
    logger.info({ transcriptLength: rawTranscript.length }, 'Starting summarization with Claude');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are an expert meeting summarizer. Analyze the meeting transcript and extract:
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
}`,
      messages: [
        {
          role: 'user',
          content: `Please summarize this meeting transcript:\n\n${rawTranscript}`,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const result = JSON.parse(textContent.text) as SummaryResult;

    logger.info({ title: result.title }, 'Summarization completed');

    return result;
  } catch (error) {
    logger.error({ error }, 'Failed to summarize transcript');
    throw error;
  }
};

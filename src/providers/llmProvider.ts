import { Finding } from '../types/index.js';

/**
 * Real LLM provider integration.
 * Requires OPENAI_API_KEY (or similar) in environment variables on your server.
 * If unreachable or improperly configured, throws a clear error to allow graceful job failure.
 */
export async function runLlmReview(rawDiff: string, maxFindings: number = 100): Promise<Finding[]> {
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('LLM provider not configured: Missing API key on server');
  }

  const endpoint = process.env.LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  const systemPrompt = `You are an expert AI code reviewer. Analyze the following unified diff and return findings strictly as a valid JSON array. Each object in the array must match this schema:
{
  "id": "LLM-<index>:<path>:<line>",
  "ruleId": "LLM-REVIEW",
  "path": "<file path>",
  "line": <line number in new file as integer>,
  "severity": "critical" | "high" | "medium" | "low",
  "category": "security" | "correctness" | "performance" | "style",
  "title": "<short title>",
  "evidence": "<the offending code snippet>"
}
Only output valid raw JSON array, no markdown formatting.`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: rawDiff },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM provider HTTP error: status ${response.status}`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const rawContent = data.choices?.[0]?.message?.content?.trim();

    if (!rawContent) {
      return [];
    }

    // Clean potential markdown wrap
    const cleanedContent = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const findings = JSON.parse(cleanedContent) as Finding[];

    return findings.slice(0, maxFindings);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown LLM error';
    throw new Error(`LLM review failed: ${message}`);
  }
}
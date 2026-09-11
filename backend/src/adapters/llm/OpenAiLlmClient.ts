import type OpenAI from 'openai';
import type { LlmClient } from '../../domain/ports/LlmClient.js';

// Adapter for gpt-5-nano, a reasoning model. Request shape is empirically
// determined — see DECISIONS.md §15's provider probe — and is non-negotiable:
// max_completion_tokens (not max_tokens), reasoning_effort: 'minimal' (required,
// otherwise the whole budget is burned on hidden reasoning), and no temperature
// field at all (the API rejects any value but the default).
export class OpenAiLlmClient implements LlmClient {
  constructor(private readonly sdkClient: OpenAI, private readonly model: string) {}

  async completeJson(params: {
    systemPrompt: string; userPrompt: string;
    jsonSchema: object; schemaName: string; maxCompletionTokens: number;
  }): Promise<unknown> {
    const response = await this.sdkClient.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      max_completion_tokens: params.maxCompletionTokens,
      reasoning_effort: 'minimal',
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: params.schemaName, strict: true,
          schema: params.jsonSchema as Record<string, unknown>,
        },
      },
    });

    const content = response.choices[0].message.content ?? '';
    return JSON.parse(content);
  }
}

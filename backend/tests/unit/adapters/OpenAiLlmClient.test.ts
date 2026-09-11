import { describe, it, expect, vi } from 'vitest';
import { OpenAiLlmClient } from '../../../src/adapters/llm/OpenAiLlmClient.js';

describe('OpenAiLlmClient', () => {
  it('sends max_completion_tokens, reasoning_effort minimal, no temperature, strict json_schema', async () => {
    const create = vi.fn(async (_request: any) => ({ choices: [{ message: { content: '{"ok":true}' } }] }));
    const fakeSdkClient = { chat: { completions: { create } } };
    const client = new OpenAiLlmClient(fakeSdkClient as any, 'gpt-5-nano');

    await client.completeJson({
      systemPrompt: 'sys', userPrompt: 'user',
      jsonSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
      schemaName: 'Feedback', maxCompletionTokens: 2000,
    });

    const callArgs = create.mock.calls[0][0];
    expect(callArgs.max_completion_tokens).toBe(2000);
    expect(callArgs.reasoning_effort).toBe('minimal');
    expect(callArgs.temperature).toBeUndefined();
    expect(callArgs.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'Feedback', strict: true, schema: expect.any(Object) },
    });
  });

  it('parses the JSON content out of the first choice', async () => {
    const create = vi.fn(async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }));
    const client = new OpenAiLlmClient({ chat: { completions: { create } } } as any, 'gpt-5-nano');
    const result = await client.completeJson({
      systemPrompt: 's', userPrompt: 'u', jsonSchema: {}, schemaName: 'X', maxCompletionTokens: 100,
    });
    expect(result).toEqual({ ok: true });
  });
});

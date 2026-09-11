export interface LlmClient {
  completeJson(params: {
    systemPrompt: string; userPrompt: string;
    jsonSchema: object; schemaName: string; maxCompletionTokens: number;
  }): Promise<unknown>; // raw parsed JSON; caller Zod-validates
}

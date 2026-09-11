import { z } from 'zod';

export const CreateLearnerRequestSchema = z.object({ handle: z.string().min(1).max(64) });
export type CreateLearnerRequest = z.infer<typeof CreateLearnerRequestSchema>;

export const StartAttemptRequestSchema = z.object({ learnerId: z.string().min(1), problemId: z.string().min(1) });
export type StartAttemptRequest = z.infer<typeof StartAttemptRequestSchema>;

export const SubmitAttemptRequestSchema = z.object({ rawContent: z.string().min(1), format: z.literal('markdown') });
export type SubmitAttemptRequest = z.infer<typeof SubmitAttemptRequestSchema>;

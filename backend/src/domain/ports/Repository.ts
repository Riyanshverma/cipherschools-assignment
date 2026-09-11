import type { Learner } from '../Learner.js';
import type { Problem } from '../Problem.js';
import type { Attempt } from '../Attempt.js';
import type { Evaluation } from '../Evaluation.js';

export interface LearnerRepository {
  findByHandle(handle: string): Promise<Learner | null>;
  save(learner: Learner): Promise<void>;
}
export interface ProblemRepository {
  findAll(): Promise<Problem[]>;
  findById(id: string): Promise<Problem | null>;
}
export interface AttemptRepository {
  save(attempt: Attempt): Promise<void>;
  findById(id: string): Promise<Attempt | null>;
  findByLearnerAndProblem(learnerId: string, problemId: string): Promise<Attempt[]>;
  findByLearner(learnerId: string): Promise<Attempt[]>;
}
export interface EvaluationRepository {
  save(evaluation: Evaluation): Promise<void>;
  findById(id: string): Promise<Evaluation | null>;
  findByAttemptId(attemptId: string): Promise<Evaluation[]>;
  findAllRunning(): Promise<Evaluation[]>;
}

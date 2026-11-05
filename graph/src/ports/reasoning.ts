// Reasoning port: the LLM as a typed function. input -> zod-validated output, with bound
// retries on schema failure. Every call records model_requested/model_served and token usage
// so the telemetry record (core/telemetry.ts) can be filled without a second lookup.
import type { ZodType } from 'zod';

export interface ReasoningUsage {
  input_tokens: number;
  output_tokens: number;
  model_requested: string;
  model_served: string;
}

export interface ReasoningCallResult<T> {
  output: T;
  usage: ReasoningUsage;
  attempts: number;
  llm_calls: number;
}

export interface ReasoningRequest<T> {
  stage: string;
  prompt: string;
  schema: ZodType<T, any, any>;
  modelRequested: string;
  maxRetries?: number; // bound on schema-failure retries (default 2 extra attempts)
  idempotencyKey?: string;
}

/** A typed-function LLM call. The implementation owns retrying until the schema validates,
 * up to `maxRetries`; it never silently returns unvalidated output. */
export interface Reasoning {
  call<T>(req: ReasoningRequest<T>): Promise<ReasoningCallResult<T>>;
}

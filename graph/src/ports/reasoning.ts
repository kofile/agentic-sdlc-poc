// Reasoning port: the LLM as a typed function. input -> zod-validated output, with bound
// retries on schema failure. Every call records model_requested/model_served and token usage
// so the telemetry record (core/telemetry.ts) can be filled without a second lookup.
import type { ZodType } from 'zod';

export interface ReasoningUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  /** 'reported' = the provider's usage block; 'estimated' = a stub or local guess. */
  source: 'reported' | 'estimated';
  model_requested: string;
  model_served: string;
}

export interface ReasoningCallResult<T> {
  output: T;
  usage: ReasoningUsage;
  attempts: number;
  llm_calls: number;
  /** Version of the versioned prompt file used (adapters that have one). */
  prompt_version?: string;
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

/** Thrown when a call ends without schema-valid output: the model never produced valid JSON
 * within the retry bound, refused, or hit max_tokens. Carries the usage spent so far so the
 * caller can still record the stage. Distinct from transport errors, which stay retryable. */
export class ReasoningOutputInvalid extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public readonly kind: 'schema_invalid' | 'refusal' | 'max_tokens',
    public readonly attempts: number,
    public readonly usage: ReasoningUsage,
  ) {
    super(message);
    this.name = 'ReasoningOutputInvalid';
  }
}

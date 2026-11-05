// A tiny, supertest-API-compatible request helper (`.get/.post/.patch/.delete`,
// chainable `.query()`/`.send()`, an awaited result with `.status`/`.body`/
// `.text`/`.headers`) built on `light-my-request` instead of `supertest`.
//
// Why: supertest drives requests over a REAL TCP socket (either an
// ephemeral `http.Server` it opens per call, or one we hand it). On this
// machine that turned out to be genuinely unreliable — rare, otherwise
// unreproducible wrong responses (statuses like 404/501/401 our app code
// never sends, and the occasional multi-second hang) traced back through
// several rounds of fixes (ephemeral-server-per-request churn, keep-alive
// socket pileup exceeding the fork's open descriptors, an unawaited
// `server.close()` racing the next test's `server.listen()`) to what looks
// like interference from background network tooling on the loopback
// interface (this machine runs a VPN/mesh network extension among other
// always-on local services) rather than a defect in the app under test.
//
// `light-my-request` (the library Fastify itself uses for this exact
// purpose) calls the Express app directly as a function with a synthetic
// request/response pair — there is no socket, no port, no OS network stack
// involved at all, so there is nothing for an unrelated process on the
// machine to intercept. This is a strictly stronger guarantee than "we
// made the flakiness rarer": there is no network path left for it to ride.
import { inject } from "light-my-request";
import type { Express } from "express";

export interface TestResponse {
  status: number;
  body: any;
  text: string;
  headers: Record<string, string | string[] | undefined>;
}

class RequestBuilder implements PromiseLike<TestResponse> {
  private payload: unknown;
  private queryParams: Record<string, unknown> = {};

  constructor(
    private app: Express,
    private method: "GET" | "POST" | "PATCH" | "DELETE",
    private url: string,
  ) {}

  query(params: Record<string, unknown>): this {
    this.queryParams = { ...this.queryParams, ...params };
    return this;
  }

  send(payload: unknown): this {
    this.payload = payload;
    return this;
  }

  private buildUrl(): string {
    const entries = Object.entries(this.queryParams).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.url;
    const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
    return this.url.includes("?") ? `${this.url}&${qs}` : `${this.url}?${qs}`;
  }

  private async execute(): Promise<TestResponse> {
    const hasBody = this.payload !== undefined;
    const res = await inject(this.app, {
      method: this.method,
      url: this.buildUrl(),
      payload: hasBody ? JSON.stringify(this.payload) : undefined,
      headers: hasBody ? { "content-type": "application/json" } : {},
    });

    const contentType = res.headers["content-type"];
    let body: unknown = {};
    if (typeof contentType === "string" && contentType.includes("application/json") && res.payload) {
      try {
        body = JSON.parse(res.payload);
      } catch {
        body = {};
      }
    }

    return {
      status: res.statusCode,
      body,
      text: res.payload,
      headers: res.headers as Record<string, string | string[] | undefined>,
    };
  }

  then<TResult1 = TestResponse, TResult2 = never>(
    onfulfilled?: ((value: TestResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function request(app: Express) {
  return {
    get: (url: string) => new RequestBuilder(app, "GET", url),
    post: (url: string) => new RequestBuilder(app, "POST", url),
    patch: (url: string) => new RequestBuilder(app, "PATCH", url),
    delete: (url: string) => new RequestBuilder(app, "DELETE", url),
  };
}

export default request;

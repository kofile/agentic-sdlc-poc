import { describe, it, expect, beforeEach } from "vitest";
import type { Express } from "express";
import request from "./testRequest.js";
import { freshApp } from "./testUtils.js";

describe("app", () => {
  let app: Express;

  beforeEach(() => {
    ({ app } = freshApp());
  });

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("returns 404 with a JSON body for an unknown route", async () => {
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns a JSON body (not an HTML stack trace) for a thrown HttpError", async () => {
    const res = await request(app).get("/customers/999");
    expect(res.headers["content-type"]).toContain("application/json");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import type { Express } from "express";
import request from "./testRequest.js";
import { freshApp } from "./testUtils.js";

describe("discount routes", () => {
  let app: Express;

  beforeEach(() => {
    ({ app } = freshApp());
  });

  it("POST /discounts creates a discount", async () => {
    const res = await request(app).post("/discounts").send({ code: "SAVE10", kind: "percent", value: 10 });
    expect(res.status).toBe(201);
  });

  it("GET /discounts lists discounts", async () => {
    await request(app).post("/discounts").send({ code: "SAVE10", kind: "percent", value: 10 });
    const res = await request(app).get("/discounts");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("GET /discounts/:code is case-insensitive", async () => {
    await request(app).post("/discounts").send({ code: "SAVE10", kind: "percent", value: 10 });
    const res = await request(app).get("/discounts/save10");
    expect(res.status).toBe(200);
  });

  it("POST /discounts/:code/deactivate deactivates a discount", async () => {
    await request(app).post("/discounts").send({ code: "SAVE10", kind: "percent", value: 10 });
    const res = await request(app).post("/discounts/SAVE10/deactivate");
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(0);
  });

  it("GET /discounts/:code returns 404 for an unknown code", async () => {
    const res = await request(app).get("/discounts/NOPE");
    expect(res.status).toBe(404);
  });
});

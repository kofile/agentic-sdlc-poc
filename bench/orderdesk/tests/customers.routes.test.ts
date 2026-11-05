import { describe, it, expect, beforeEach } from "vitest";
import type { Express } from "express";
import request from "./testRequest.js";
import { freshApp } from "./testUtils.js";

describe("customer routes", () => {
  let app: Express;

  beforeEach(() => {
    ({ app } = freshApp());
  });

  it("POST /customers creates a customer", async () => {
    const res = await request(app).post("/customers").send({ name: "Ada", email: "ada@example.com" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Ada");
  });

  it("POST /customers with a bad email returns 400", async () => {
    const res = await request(app).post("/customers").send({ name: "Ada", email: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("POST /customers with a duplicate email returns 409", async () => {
    await request(app).post("/customers").send({ name: "Ada", email: "dup@example.com" });
    const res = await request(app).post("/customers").send({ name: "Bob", email: "dup@example.com" });
    expect(res.status).toBe(409);
  });

  it("GET /customers/:id fetches an existing customer", async () => {
    const created = await request(app).post("/customers").send({ name: "Ada", email: "ada@example.com" });
    const res = await request(app).get(`/customers/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it("GET /customers/:id returns 404 for an unknown id", async () => {
    const res = await request(app).get("/customers/999");
    expect(res.status).toBe(404);
  });

  it("GET /customers lists with pagination envelope", async () => {
    await request(app).post("/customers").send({ name: "Ada", email: "a@example.com" });
    const res = await request(app).get("/customers");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total", 1);
  });

  it("PATCH /customers/:id updates fields", async () => {
    const created = await request(app).post("/customers").send({ name: "Ada", email: "ada@example.com" });
    const res = await request(app).patch(`/customers/${created.body.id}`).send({ name: "Ada L." });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Ada L.");
  });

  it("DELETE /customers/:id removes a customer with no orders", async () => {
    const created = await request(app).post("/customers").send({ name: "Ada", email: "ada@example.com" });
    const res = await request(app).delete(`/customers/${created.body.id}`);
    expect(res.status).toBe(204);
    const fetch = await request(app).get(`/customers/${created.body.id}`);
    expect(fetch.status).toBe(404);
  });

  it("DELETE /customers/:id for an unknown id returns 404", async () => {
    const res = await request(app).delete("/customers/999");
    expect(res.status).toBe(404);
  });
});

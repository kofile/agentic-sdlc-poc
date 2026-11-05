import { describe, it, expect, beforeEach } from "vitest";
import type { Express } from "express";
import request from "./testRequest.js";
import { freshApp } from "./testUtils.js";

describe("product routes", () => {
  let app: Express;

  beforeEach(() => {
    ({ app } = freshApp());
  });

  it("POST /products creates a product", async () => {
    const res = await request(app).post("/products").send({ sku: "W1", name: "Widget", price_cents: 500 });
    expect(res.status).toBe(201);
    expect(res.body.sku).toBe("W1");
  });

  it("POST /products with a duplicate sku returns 409", async () => {
    await request(app).post("/products").send({ sku: "W1", name: "Widget", price_cents: 500 });
    const res = await request(app).post("/products").send({ sku: "W1", name: "Widget 2", price_cents: 500 });
    expect(res.status).toBe(409);
  });

  it("GET /products/:id returns 404 for an unknown product", async () => {
    const res = await request(app).get("/products/999");
    expect(res.status).toBe(404);
  });

  it("GET /products lists products", async () => {
    await request(app).post("/products").send({ sku: "W1", name: "Widget", price_cents: 500 });
    const res = await request(app).get("/products");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it("POST /products/:id/adjust-stock changes stock", async () => {
    const created = await request(app).post("/products").send({ sku: "W1", name: "Widget", price_cents: 500, stock_qty: 5 });
    const res = await request(app).post(`/products/${created.body.id}/adjust-stock`).send({ delta: 5 });
    expect(res.status).toBe(200);
    expect(res.body.stock_qty).toBe(10);
  });

  it("POST /products/:id/adjust-stock rejects a non-integer delta", async () => {
    const created = await request(app).post("/products").send({ sku: "W1", name: "Widget", price_cents: 500 });
    const res = await request(app).post(`/products/${created.body.id}/adjust-stock`).send({ delta: "five" });
    expect(res.status).toBe(400);
  });

  it("PATCH /products/:id/price updates the price", async () => {
    const created = await request(app).post("/products").send({ sku: "W1", name: "Widget", price_cents: 500 });
    const res = await request(app).patch(`/products/${created.body.id}/price`).send({ price_cents: 750 });
    expect(res.status).toBe(200);
    expect(res.body.price_cents).toBe(750);
  });
});

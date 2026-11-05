import { describe, it, expect, beforeEach } from "vitest";
import type { Express } from "express";
import type Database from "better-sqlite3";
import request from "./testRequest.js";
import { freshApp, makeCustomer, makeProduct } from "./testUtils.js";

describe("order routes", () => {
  let app: Express;
  let db: Database.Database;

  beforeEach(() => {
    ({ app, db } = freshApp());
  });

  it("POST /orders creates an order", async () => {
    const customerId = makeCustomer(db);
    const productId = makeProduct(db, { stock_qty: 10 });
    const res = await request(app)
      .post("/orders")
      .send({ customer_id: customerId, items: [{ product_id: productId, quantity: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
  });

  it("POST /orders with no items returns 400", async () => {
    const customerId = makeCustomer(db);
    const res = await request(app).post("/orders").send({ customer_id: customerId, items: [] });
    expect(res.status).toBe(400);
  });

  it("POST /orders for an unknown customer returns 404", async () => {
    const productId = makeProduct(db, { stock_qty: 10 });
    const res = await request(app)
      .post("/orders")
      .send({ customer_id: 999, items: [{ product_id: productId, quantity: 1 }] });
    expect(res.status).toBe(404);
  });

  it("POST /orders that oversells returns 400", async () => {
    const customerId = makeCustomer(db);
    const productId = makeProduct(db, { stock_qty: 1 });
    const res = await request(app)
      .post("/orders")
      .send({ customer_id: customerId, items: [{ product_id: productId, quantity: 5 }] });
    expect(res.status).toBe(400);
  });

  it("GET /orders/:id fetches an order with items", async () => {
    const customerId = makeCustomer(db);
    const productId = makeProduct(db, { stock_qty: 10 });
    const created = await request(app)
      .post("/orders")
      .send({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });
    const res = await request(app).get(`/orders/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it("GET /orders filters by status", async () => {
    const customerId = makeCustomer(db);
    const productId = makeProduct(db, { stock_qty: 10 });
    const created = await request(app)
      .post("/orders")
      .send({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });
    await request(app).post(`/orders/${created.body.id}/pay`);

    const res = await request(app).get("/orders").query({ status: "paid" });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it("POST /orders/:id/pay then /fulfill walks the happy path", async () => {
    const customerId = makeCustomer(db);
    const productId = makeProduct(db, { stock_qty: 10 });
    const created = await request(app)
      .post("/orders")
      .send({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });

    const paid = await request(app).post(`/orders/${created.body.id}/pay`);
    expect(paid.body.status).toBe("paid");

    const fulfilled = await request(app).post(`/orders/${created.body.id}/fulfill`);
    expect(fulfilled.body.status).toBe("fulfilled");
  });

  it("POST /orders/:id/fulfill before pay returns 409", async () => {
    const customerId = makeCustomer(db);
    const productId = makeProduct(db, { stock_qty: 10 });
    const created = await request(app)
      .post("/orders")
      .send({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });
    const res = await request(app).post(`/orders/${created.body.id}/fulfill`);
    expect(res.status).toBe(409);
  });

  it("POST /orders/:id/cancel restores stock", async () => {
    const customerId = makeCustomer(db);
    const productId = makeProduct(db, { stock_qty: 10 });
    const created = await request(app)
      .post("/orders")
      .send({ customer_id: customerId, items: [{ product_id: productId, quantity: 3 }] });

    const cancelled = await request(app).post(`/orders/${created.body.id}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("cancelled");

    const product = await request(app).get(`/products/${productId}`);
    expect(product.body.stock_qty).toBe(10);
  });

  it("POST /orders with a discount_code applies the discount", async () => {
    const customerId = makeCustomer(db);
    const productId = makeProduct(db, { price_cents: 1000, stock_qty: 10 });
    await request(app).post("/discounts").send({ code: "SAVE10", kind: "percent", value: 10 });

    const res = await request(app)
      .post("/orders")
      .send({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }], discount_code: "SAVE10" });

    expect(res.status).toBe(201);
    expect(res.body.total_cents).toBe(900);
  });
});

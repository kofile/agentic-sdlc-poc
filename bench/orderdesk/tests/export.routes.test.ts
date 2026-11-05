import { describe, it, expect, beforeEach } from "vitest";
import type { Express } from "express";
import type Database from "better-sqlite3";
import request from "./testRequest.js";
import { freshApp, makeCustomer, makeProduct } from "./testUtils.js";

describe("export routes", () => {
  let app: Express;
  let db: Database.Database;

  beforeEach(() => {
    ({ app, db } = freshApp());
  });

  it("GET /export/orders returns CSV content type", async () => {
    const res = await request(app).get("/export/orders");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
  });

  it("GET /export/orders includes order rows", async () => {
    const customerId = makeCustomer(db);
    const productId = makeProduct(db, { stock_qty: 10 });
    await request(app)
      .post("/orders")
      .send({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });

    const res = await request(app).get("/export/orders");
    const lines = res.text.trim().split("\r\n");
    expect(lines).toHaveLength(2);
  });

  it("GET /export/orders?status= filters results", async () => {
    const customerId = makeCustomer(db);
    const productId = makeProduct(db, { stock_qty: 10 });
    await request(app)
      .post("/orders")
      .send({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });

    const res = await request(app).get("/export/orders").query({ status: "fulfilled" });
    const lines = res.text.trim().split("\r\n");
    expect(lines).toHaveLength(1); // header only
  });

  it("GET /export/orders with an invalid date returns 400", async () => {
    const res = await request(app).get("/export/orders").query({ from: "nope" });
    expect(res.status).toBe(400);
  });
});

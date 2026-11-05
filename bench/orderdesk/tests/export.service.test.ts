import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { ExportService, csvField } from "../src/export/service.js";
import { OrderService } from "../src/orders/service.js";
import { ValidationError } from "../src/errors.js";
import { freshDb, makeCustomer, makeProduct } from "./testUtils.js";

describe("csvField", () => {
  it("leaves a plain value untouched", () => {
    expect(csvField("hello")).toBe("hello");
    expect(csvField(42)).toBe("42");
  });

  it("quotes a value containing a comma", () => {
    expect(csvField("Doe, Jane")).toBe('"Doe, Jane"');
  });

  it("quotes a value containing a double quote and doubles it", () => {
    expect(csvField('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("ExportService", () => {
  let db: Database.Database;
  let exportService: ExportService;
  let orders: OrderService;

  beforeEach(() => {
    db = freshDb();
    exportService = new ExportService(db);
    orders = new OrderService(db);
  });

  it("returns only a header row when there are no orders", () => {
    const csv = exportService.toCsv();
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("order_id");
  });

  it("emits one row per line item", () => {
    const customerId = makeCustomer(db, { name: "Ada" });
    const a = makeProduct(db, { stock_qty: 10 });
    const b = makeProduct(db, { stock_qty: 10 });
    orders.create({
      customer_id: customerId,
      items: [
        { product_id: a, quantity: 1 },
        { product_id: b, quantity: 2 },
      ],
    });

    const csv = exportService.toCsv();
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3); // header + 2 line items
  });

  it("quotes a customer name containing a comma", () => {
    const customerId = makeCustomer(db, { name: "Doe, Jane" });
    const productId = makeProduct(db, { stock_qty: 10 });
    orders.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });

    const csv = exportService.toCsv();
    expect(csv).toContain('"Doe, Jane"');
  });

  it("filters by status", () => {
    const customerId = makeCustomer(db);
    const productId = makeProduct(db, { stock_qty: 10 });
    const order1 = orders.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });
    orders.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });
    orders.pay(order1.id);

    const csv = exportService.toCsv({ status: "paid" });
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2); // header + 1 line item
  });

  it("rejects an invalid from date", () => {
    expect(() => exportService.toCsv({ from: "not-a-date" })).toThrow(ValidationError);
  });

  it("rejects an invalid to date", () => {
    expect(() => exportService.toCsv({ to: "not-a-date" })).toThrow(ValidationError);
  });

  it("includes order-level totals repeated on each line", () => {
    const customerId = makeCustomer(db);
    const productId = makeProduct(db, { price_cents: 500, stock_qty: 10 });
    orders.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 2 }] });

    const csv = exportService.toCsv();
    const [, dataLine] = csv.trim().split("\r\n");
    expect(dataLine).toContain("1000"); // subtotal_cents and total_cents both 1000
  });
});

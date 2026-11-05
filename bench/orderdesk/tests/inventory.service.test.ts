import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { InventoryService } from "../src/inventory/service.js";
import { ConflictError, NotFoundError, ValidationError } from "../src/errors.js";
import { freshDb } from "./testUtils.js";

describe("InventoryService", () => {
  let db: Database.Database;
  let service: InventoryService;

  beforeEach(() => {
    db = freshDb();
    service = new InventoryService(db);
  });

  describe("create", () => {
    it("creates a product", () => {
      const product = service.create({ sku: "WIDGET-1", name: "Widget", price_cents: 500, stock_qty: 10 });
      expect(product.id).toBeTypeOf("number");
      expect(product.stock_qty).toBe(10);
    });

    it("defaults stock_qty to 0 when omitted", () => {
      const product = service.create({ sku: "WIDGET-2", name: "Widget", price_cents: 500 });
      expect(product.stock_qty).toBe(0);
    });

    it("rejects a negative price", () => {
      expect(() => service.create({ sku: "W", name: "W", price_cents: -1 })).toThrow(ValidationError);
    });

    it("rejects a non-integer price", () => {
      // @ts-expect-error testing runtime validation
      expect(() => service.create({ sku: "W", name: "W", price_cents: 9.99 })).toThrow(ValidationError);
    });

    it("rejects a duplicate sku", () => {
      service.create({ sku: "DUP", name: "A", price_cents: 100 });
      expect(() => service.create({ sku: "DUP", name: "B", price_cents: 200 })).toThrow(ConflictError);
    });

    it("rejects a missing name", () => {
      expect(() => service.create({ sku: "W", name: "", price_cents: 100 })).toThrow(ValidationError);
    });
  });

  describe("getById / getBySku", () => {
    it("fetches by id", () => {
      const created = service.create({ sku: "W1", name: "W", price_cents: 100 });
      expect(service.getById(created.id).sku).toBe("W1");
    });

    it("fetches by sku", () => {
      service.create({ sku: "W1", name: "W", price_cents: 100 });
      expect(service.getBySku("W1").sku).toBe("W1");
    });

    it("throws NotFoundError for an unknown id", () => {
      expect(() => service.getById(999)).toThrow(NotFoundError);
    });

    it("throws NotFoundError for an unknown sku", () => {
      expect(() => service.getBySku("NOPE")).toThrow(NotFoundError);
    });
  });

  describe("list", () => {
    it("paginates products", () => {
      for (let i = 0; i < 15; i++) {
        service.create({ sku: `S${i}`, name: `P${i}`, price_cents: 100 });
      }
      const result = service.list({ page: 2, pageSize: 10 });
      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(15);
    });

    it("returns products ordered by id ascending", () => {
      const first = service.create({ sku: "A", name: "A", price_cents: 100 });
      const second = service.create({ sku: "B", name: "B", price_cents: 100 });
      const result = service.list();
      expect(result.items.map((p) => p.id)).toEqual([first.id, second.id]);
    });
  });

  describe("adjustStock", () => {
    it("increases stock", () => {
      const created = service.create({ sku: "W", name: "W", price_cents: 100, stock_qty: 5 });
      const updated = service.adjustStock(created.id, 10);
      expect(updated.stock_qty).toBe(15);
    });

    it("decreases stock", () => {
      const created = service.create({ sku: "W", name: "W", price_cents: 100, stock_qty: 5 });
      const updated = service.adjustStock(created.id, -3);
      expect(updated.stock_qty).toBe(2);
    });

    it("rejects a decrease that would make stock negative", () => {
      const created = service.create({ sku: "W", name: "W", price_cents: 100, stock_qty: 5 });
      expect(() => service.adjustStock(created.id, -6)).toThrow(ValidationError);
    });

    it("allows decreasing stock to exactly zero", () => {
      const created = service.create({ sku: "W", name: "W", price_cents: 100, stock_qty: 5 });
      const updated = service.adjustStock(created.id, -5);
      expect(updated.stock_qty).toBe(0);
    });

    it("throws NotFoundError for an unknown product", () => {
      expect(() => service.adjustStock(999, 1)).toThrow(NotFoundError);
    });
  });

  describe("updatePrice", () => {
    it("updates the price", () => {
      const created = service.create({ sku: "W", name: "W", price_cents: 100 });
      const updated = service.updatePrice(created.id, 200);
      expect(updated.price_cents).toBe(200);
    });

    it("rejects a negative price", () => {
      const created = service.create({ sku: "W", name: "W", price_cents: 100 });
      expect(() => service.updatePrice(created.id, -1)).toThrow(ValidationError);
    });
  });

  describe("reserveForOrder / releaseForOrder", () => {
    it("decrements stock for each item", () => {
      const a = service.create({ sku: "A", name: "A", price_cents: 100, stock_qty: 10 });
      const b = service.create({ sku: "B", name: "B", price_cents: 100, stock_qty: 10 });
      service.reserveForOrder([
        { product_id: a.id, quantity: 3 },
        { product_id: b.id, quantity: 4 },
      ]);
      expect(service.getById(a.id).stock_qty).toBe(7);
      expect(service.getById(b.id).stock_qty).toBe(6);
    });

    it("throws without mutating anything when any item is oversold", () => {
      const a = service.create({ sku: "A", name: "A", price_cents: 100, stock_qty: 10 });
      const b = service.create({ sku: "B", name: "B", price_cents: 100, stock_qty: 2 });
      expect(() =>
        service.reserveForOrder([
          { product_id: a.id, quantity: 3 },
          { product_id: b.id, quantity: 5 },
        ]),
      ).toThrow(ValidationError);
      // the first item's validation-time stock check is read-only, so nothing moved
      expect(service.getById(a.id).stock_qty).toBe(10);
      expect(service.getById(b.id).stock_qty).toBe(2);
    });

    it("restores stock on release", () => {
      const a = service.create({ sku: "A", name: "A", price_cents: 100, stock_qty: 10 });
      service.reserveForOrder([{ product_id: a.id, quantity: 4 }]);
      service.releaseForOrder([{ product_id: a.id, quantity: 4 }]);
      expect(service.getById(a.id).stock_qty).toBe(10);
    });
  });
});

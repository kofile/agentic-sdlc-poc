import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { OrderService } from "../src/orders/service.js";
import { InventoryService } from "../src/inventory/service.js";
import { DiscountService } from "../src/discounts/service.js";
import { ConflictError, NotFoundError, ValidationError } from "../src/errors.js";
import { freshDb, makeCustomer, makeProduct } from "./testUtils.js";

describe("OrderService", () => {
  let db: Database.Database;
  let service: OrderService;
  let inventory: InventoryService;
  let discounts: DiscountService;

  beforeEach(() => {
    db = freshDb();
    service = new OrderService(db);
    inventory = new InventoryService(db);
    discounts = new DiscountService(db);
  });

  describe("create", () => {
    it("creates an order with one line item", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { price_cents: 1000, stock_qty: 10 });

      const order = service.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 2 }] });

      expect(order.status).toBe("pending");
      expect(order.subtotal_cents).toBe(2000);
      expect(order.total_cents).toBe(2000);
      expect(order.items).toHaveLength(1);
      expect(order.items[0].unit_price_cents).toBe(1000);
    });

    it("creates an order with multiple line items", () => {
      const customerId = makeCustomer(db);
      const a = makeProduct(db, { price_cents: 500, stock_qty: 10 });
      const b = makeProduct(db, { price_cents: 300, stock_qty: 10 });

      const order = service.create({
        customer_id: customerId,
        items: [
          { product_id: a, quantity: 2 },
          { product_id: b, quantity: 3 },
        ],
      });

      expect(order.subtotal_cents).toBe(2 * 500 + 3 * 300);
      expect(order.items).toHaveLength(2);
    });

    it("merges duplicate product ids in the items array", () => {
      const customerId = makeCustomer(db);
      const a = makeProduct(db, { price_cents: 100, stock_qty: 10 });

      const order = service.create({
        customer_id: customerId,
        items: [
          { product_id: a, quantity: 2 },
          { product_id: a, quantity: 3 },
        ],
      });

      expect(order.items).toHaveLength(1);
      expect(order.items[0].quantity).toBe(5);
      expect(order.subtotal_cents).toBe(500);
      expect(inventory.getById(a).stock_qty).toBe(5);
    });

    it("decrements stock for each reserved item", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { stock_qty: 10 });
      service.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 4 }] });
      expect(inventory.getById(productId).stock_qty).toBe(6);
    });

    it("rejects an order for an unknown customer", () => {
      const productId = makeProduct(db);
      expect(() => service.create({ customer_id: 999, items: [{ product_id: productId, quantity: 1 }] })).toThrow(
        NotFoundError,
      );
    });

    it("rejects an order with an empty items array", () => {
      const customerId = makeCustomer(db);
      expect(() => service.create({ customer_id: customerId, items: [] })).toThrow(ValidationError);
    });

    it("rejects an order referencing an unknown product", () => {
      const customerId = makeCustomer(db);
      expect(() => service.create({ customer_id: customerId, items: [{ product_id: 999, quantity: 1 }] })).toThrow(
        NotFoundError,
      );
    });

    it("rejects an order that oversells a product and leaves stock untouched", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { stock_qty: 2 });
      expect(() =>
        service.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 5 }] }),
      ).toThrow(ValidationError);
      expect(inventory.getById(productId).stock_qty).toBe(2);
    });

    it("rejects an order where the first item is fine but a later item oversells, without partially reserving stock", () => {
      const customerId = makeCustomer(db);
      const a = makeProduct(db, { stock_qty: 10 });
      const b = makeProduct(db, { stock_qty: 1 });
      expect(() =>
        service.create({
          customer_id: customerId,
          items: [
            { product_id: a, quantity: 5 },
            { product_id: b, quantity: 5 },
          ],
        }),
      ).toThrow(ValidationError);
      expect(inventory.getById(a).stock_qty).toBe(10);
      expect(inventory.getById(b).stock_qty).toBe(1);
    });

    it("rejects a zero quantity line item", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db);
      expect(() =>
        service.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 0 }] }),
      ).toThrow(ValidationError);
    });

    it("rejects a negative quantity line item", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db);
      expect(() =>
        service.create({ customer_id: customerId, items: [{ product_id: productId, quantity: -1 }] }),
      ).toThrow(ValidationError);
    });

    it("applies a valid percent discount code", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { price_cents: 1000, stock_qty: 10 });
      discounts.create({ code: "SAVE10", kind: "percent", value: 10 });

      const order = service.create({
        customer_id: customerId,
        items: [{ product_id: productId, quantity: 1 }],
        discount_code: "SAVE10",
      });

      expect(order.subtotal_cents).toBe(1000);
      expect(order.discount_cents).toBe(100);
      expect(order.total_cents).toBe(900);
      expect(order.discount_code).toBe("SAVE10");
    });

    it("applies a discount code case-insensitively", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { price_cents: 1000, stock_qty: 10 });
      discounts.create({ code: "SAVE10", kind: "percent", value: 10 });

      const order = service.create({
        customer_id: customerId,
        items: [{ product_id: productId, quantity: 1 }],
        discount_code: "save10",
      });

      expect(order.discount_code).toBe("SAVE10");
    });

    it("rejects an unknown discount code", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { stock_qty: 10 });
      expect(() =>
        service.create({
          customer_id: customerId,
          items: [{ product_id: productId, quantity: 1 }],
          discount_code: "NOPE",
        }),
      ).toThrow(NotFoundError);
    });

    it("rejects a discount below its minimum subtotal", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { price_cents: 100, stock_qty: 10 });
      discounts.create({ code: "BIG", kind: "fixed", value: 50, min_subtotal_cents: 5000 });
      expect(() =>
        service.create({
          customer_id: customerId,
          items: [{ product_id: productId, quantity: 1 }],
          discount_code: "BIG",
        }),
      ).toThrow(ValidationError);
    });

    it("does not reserve stock when the discount code is invalid", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { stock_qty: 10 });
      expect(() =>
        service.create({
          customer_id: customerId,
          items: [{ product_id: productId, quantity: 3 }],
          discount_code: "NOPE",
        }),
      ).toThrow(NotFoundError);
      expect(inventory.getById(productId).stock_qty).toBe(10);
    });

    it("prices line items at the product's price at order time", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { price_cents: 1000, stock_qty: 10 });
      const order = service.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });
      inventory.updatePrice(productId, 2000);
      expect(order.items[0].unit_price_cents).toBe(1000);
      expect(service.getById(order.id).items[0].unit_price_cents).toBe(1000);
    });
  });

  describe("getById", () => {
    it("throws NotFoundError for an unknown order", () => {
      expect(() => service.getById(999)).toThrow(NotFoundError);
    });

    it("includes line items", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { stock_qty: 10 });
      const created = service.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });
      const fetched = service.getById(created.id);
      expect(fetched.items).toHaveLength(1);
    });
  });

  describe("list", () => {
    it("filters by customer_id", () => {
      const c1 = makeCustomer(db);
      const c2 = makeCustomer(db);
      const productId = makeProduct(db, { stock_qty: 100 });
      service.create({ customer_id: c1, items: [{ product_id: productId, quantity: 1 }] });
      service.create({ customer_id: c2, items: [{ product_id: productId, quantity: 1 }] });

      const result = service.list({ customer_id: c1 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].customer_id).toBe(c1);
    });

    it("filters by status", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { stock_qty: 100 });
      const order = service.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });
      service.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });
      service.pay(order.id);

      const result = service.list({ status: "paid" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(order.id);
    });

    it("filters by both customer_id and status together", () => {
      const c1 = makeCustomer(db);
      const c2 = makeCustomer(db);
      const productId = makeProduct(db, { stock_qty: 100 });
      const o1 = service.create({ customer_id: c1, items: [{ product_id: productId, quantity: 1 }] });
      service.create({ customer_id: c2, items: [{ product_id: productId, quantity: 1 }] });
      service.pay(o1.id);

      const result = service.list({ customer_id: c1, status: "paid" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(o1.id);
    });

    it("returns an empty list for a customer with no orders", () => {
      const customerId = makeCustomer(db);
      const result = service.list({ customer_id: customerId });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("paginates orders", () => {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { stock_qty: 1000 });
      for (let i = 0; i < 12; i++) {
        service.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] });
      }
      const result = service.list({ page: 2, pageSize: 10 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(12);
    });
  });

  describe("status transitions", () => {
    function makeOrder(stock = 10) {
      const customerId = makeCustomer(db);
      const productId = makeProduct(db, { stock_qty: stock });
      return { order: service.create({ customer_id: customerId, items: [{ product_id: productId, quantity: 1 }] }), productId };
    }

    it("pays a pending order", () => {
      const { order } = makeOrder();
      const paid = service.pay(order.id);
      expect(paid.status).toBe("paid");
    });

    it("rejects paying an already-paid order", () => {
      const { order } = makeOrder();
      service.pay(order.id);
      expect(() => service.pay(order.id)).toThrow(ConflictError);
    });

    it("fulfills a paid order", () => {
      const { order } = makeOrder();
      service.pay(order.id);
      const fulfilled = service.fulfill(order.id);
      expect(fulfilled.status).toBe("fulfilled");
    });

    it("rejects fulfilling a pending (unpaid) order", () => {
      const { order } = makeOrder();
      expect(() => service.fulfill(order.id)).toThrow(ConflictError);
    });

    it("rejects fulfilling an already-fulfilled order", () => {
      const { order } = makeOrder();
      service.pay(order.id);
      service.fulfill(order.id);
      expect(() => service.fulfill(order.id)).toThrow(ConflictError);
    });

    it("cancels a pending order and restores stock", () => {
      const { order, productId } = makeOrder(10);
      expect(inventory.getById(productId).stock_qty).toBe(9);
      const cancelled = service.cancel(order.id);
      expect(cancelled.status).toBe("cancelled");
      expect(inventory.getById(productId).stock_qty).toBe(10);
    });

    it("cancels a paid order and restores stock", () => {
      const { order, productId } = makeOrder(10);
      service.pay(order.id);
      service.cancel(order.id);
      expect(inventory.getById(productId).stock_qty).toBe(10);
    });

    it("rejects cancelling an already-cancelled order", () => {
      const { order } = makeOrder();
      service.cancel(order.id);
      expect(() => service.cancel(order.id)).toThrow(ConflictError);
    });

    it("rejects cancelling a fulfilled order", () => {
      const { order } = makeOrder();
      service.pay(order.id);
      service.fulfill(order.id);
      expect(() => service.cancel(order.id)).toThrow(ConflictError);
    });

    it("restores stock for every line item on a multi-item cancellation", () => {
      const customerId = makeCustomer(db);
      const a = makeProduct(db, { stock_qty: 10 });
      const b = makeProduct(db, { stock_qty: 10 });
      const order = service.create({
        customer_id: customerId,
        items: [
          { product_id: a, quantity: 3 },
          { product_id: b, quantity: 4 },
        ],
      });
      service.cancel(order.id);
      expect(inventory.getById(a).stock_qty).toBe(10);
      expect(inventory.getById(b).stock_qty).toBe(10);
    });

    it("throws NotFoundError when transitioning an unknown order", () => {
      expect(() => service.pay(999)).toThrow(NotFoundError);
      expect(() => service.fulfill(999)).toThrow(NotFoundError);
      expect(() => service.cancel(999)).toThrow(NotFoundError);
    });
  });
});

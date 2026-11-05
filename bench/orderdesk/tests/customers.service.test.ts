import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { CustomerService } from "../src/customers/service.js";
import { ConflictError, NotFoundError, ValidationError } from "../src/errors.js";
import { freshDb, makeCustomer } from "./testUtils.js";

describe("CustomerService", () => {
  let db: Database.Database;
  let service: CustomerService;

  beforeEach(() => {
    db = freshDb();
    service = new CustomerService(db);
  });

  describe("create", () => {
    it("creates a customer with a name and email", () => {
      const customer = service.create({ name: "Grace Hopper", email: "grace@example.com" });
      expect(customer.id).toBeTypeOf("number");
      expect(customer.name).toBe("Grace Hopper");
      expect(customer.email).toBe("grace@example.com");
      expect(customer.created_at).toBeTypeOf("string");
    });

    it("rejects a missing name", () => {
      expect(() => service.create({ name: "", email: "a@example.com" })).toThrow(ValidationError);
    });

    it("rejects a missing email", () => {
      // @ts-expect-error testing runtime validation
      expect(() => service.create({ name: "A" })).toThrow(ValidationError);
    });

    it("rejects a malformed email", () => {
      expect(() => service.create({ name: "A", email: "not-an-email" })).toThrow(ValidationError);
    });

    it("rejects a duplicate email", () => {
      service.create({ name: "A", email: "dup@example.com" });
      expect(() => service.create({ name: "B", email: "dup@example.com" })).toThrow(ConflictError);
    });

    it("treats whitespace-only name as invalid", () => {
      expect(() => service.create({ name: "   ", email: "a@example.com" })).toThrow(ValidationError);
    });
  });

  describe("getById", () => {
    it("fetches a previously created customer", () => {
      const created = service.create({ name: "A", email: "a@example.com" });
      const fetched = service.getById(created.id);
      expect(fetched).toEqual(created);
    });

    it("throws NotFoundError for an unknown id", () => {
      expect(() => service.getById(999)).toThrow(NotFoundError);
    });
  });

  describe("list", () => {
    it("returns an empty page when there are no customers", () => {
      const result = service.list();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("paginates results", () => {
      for (let i = 0; i < 25; i++) {
        service.create({ name: `Customer ${i}`, email: `c${i}@example.com` });
      }
      const page1 = service.list({ page: 1, pageSize: 10 });
      expect(page1.items).toHaveLength(10);
      expect(page1.total).toBe(25);

      const page3 = service.list({ page: 3, pageSize: 10 });
      expect(page3.items).toHaveLength(5);
    });

    it("returns an empty array for a page past the end, not an error", () => {
      service.create({ name: "A", email: "a@example.com" });
      const result = service.list({ page: 50, pageSize: 10 });
      expect(result.items).toEqual([]);
    });

    it("rejects an invalid page number", () => {
      expect(() => service.list({ page: 0 })).toThrow(ValidationError);
    });

    it("rejects a pageSize over 100", () => {
      expect(() => service.list({ pageSize: 101 })).toThrow(ValidationError);
    });

    it("defaults to page 1 and pageSize 20 when no query is given", () => {
      for (let i = 0; i < 5; i++) {
        service.create({ name: `C${i}`, email: `c${i}@example.com` });
      }
      const result = service.list();
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.items).toHaveLength(5);
    });

    it("rejects a non-integer page", () => {
      expect(() => service.list({ page: 1.5 })).toThrow(ValidationError);
    });
  });

  describe("update", () => {
    it("updates a customer's name", () => {
      const created = service.create({ name: "A", email: "a@example.com" });
      const updated = service.update(created.id, { name: "B" });
      expect(updated.name).toBe("B");
      expect(updated.email).toBe("a@example.com");
    });

    it("updates a customer's email when it is not taken", () => {
      const created = service.create({ name: "A", email: "a@example.com" });
      const updated = service.update(created.id, { email: "new@example.com" });
      expect(updated.email).toBe("new@example.com");
    });

    it("rejects updating to an email already in use by another customer", () => {
      service.create({ name: "A", email: "a@example.com" });
      const b = service.create({ name: "B", email: "b@example.com" });
      expect(() => service.update(b.id, { email: "a@example.com" })).toThrow(ConflictError);
    });

    it("allows updating a customer to its own existing email", () => {
      const created = service.create({ name: "A", email: "a@example.com" });
      const updated = service.update(created.id, { email: "a@example.com" });
      expect(updated.email).toBe("a@example.com");
    });

    it("throws NotFoundError when updating an unknown customer", () => {
      expect(() => service.update(999, { name: "X" })).toThrow(NotFoundError);
    });
  });

  describe("delete", () => {
    it("deletes a customer with no orders", () => {
      const created = service.create({ name: "A", email: "a@example.com" });
      service.delete(created.id);
      expect(() => service.getById(created.id)).toThrow(NotFoundError);
    });

    it("throws NotFoundError when deleting an unknown customer", () => {
      expect(() => service.delete(999)).toThrow(NotFoundError);
    });

    it("refuses to delete a customer that has an order", () => {
      const customerId = makeCustomer(db);
      db.prepare(
        "INSERT INTO orders (customer_id, subtotal_cents, discount_cents, total_cents) VALUES (?, 0, 0, 0)",
      ).run(customerId);
      expect(() => service.delete(customerId)).toThrow(ValidationError);
    });
  });
});

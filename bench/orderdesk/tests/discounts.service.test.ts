import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { DiscountService } from "../src/discounts/service.js";
import { ConflictError, NotFoundError, ValidationError } from "../src/errors.js";
import { freshDb } from "./testUtils.js";

describe("DiscountService", () => {
  let db: Database.Database;
  let service: DiscountService;

  beforeEach(() => {
    db = freshDb();
    service = new DiscountService(db);
  });

  describe("create", () => {
    it("creates a percent discount", () => {
      const discount = service.create({ code: "save10", kind: "percent", value: 10 });
      expect(discount.code).toBe("SAVE10");
      expect(discount.active).toBe(1);
    });

    it("creates a fixed discount", () => {
      const discount = service.create({ code: "FIVEOFF", kind: "fixed", value: 500 });
      expect(discount.kind).toBe("fixed");
      expect(discount.value).toBe(500);
    });

    it("rejects an invalid kind", () => {
      // @ts-expect-error testing runtime validation
      expect(() => service.create({ code: "X", kind: "bogus", value: 1 })).toThrow(ValidationError);
    });

    it("rejects a percent value over 100", () => {
      expect(() => service.create({ code: "X", kind: "percent", value: 150 })).toThrow(ValidationError);
    });

    it("allows a fixed value over 100", () => {
      const discount = service.create({ code: "X", kind: "fixed", value: 150 });
      expect(discount.value).toBe(150);
    });

    it("rejects a negative value", () => {
      expect(() => service.create({ code: "X", kind: "fixed", value: -1 })).toThrow(ValidationError);
    });

    it("rejects a duplicate code regardless of case", () => {
      service.create({ code: "SAVE10", kind: "percent", value: 10 });
      expect(() => service.create({ code: "save10", kind: "percent", value: 20 })).toThrow(ConflictError);
    });

    it("defaults min_subtotal_cents to 0", () => {
      const discount = service.create({ code: "X", kind: "fixed", value: 100 });
      expect(discount.min_subtotal_cents).toBe(0);
    });

    it("rejects a missing code", () => {
      // @ts-expect-error testing runtime validation
      expect(() => service.create({ kind: "fixed", value: 100 })).toThrow(ValidationError);
    });

    it("allows a percent discount of exactly 100", () => {
      const discount = service.create({ code: "FREE", kind: "percent", value: 100 });
      expect(discount.value).toBe(100);
    });

    it("allows a value of exactly 0", () => {
      const discount = service.create({ code: "NOOP", kind: "fixed", value: 0 });
      expect(discount.value).toBe(0);
    });
  });

  describe("getByCode", () => {
    it("is case-insensitive", () => {
      service.create({ code: "SAVE10", kind: "percent", value: 10 });
      expect(service.getByCode("save10").code).toBe("SAVE10");
    });

    it("throws NotFoundError for an unknown code", () => {
      expect(() => service.getByCode("NOPE")).toThrow(NotFoundError);
    });
  });

  describe("deactivate", () => {
    it("marks a discount inactive", () => {
      service.create({ code: "X", kind: "fixed", value: 100 });
      const updated = service.deactivate("X");
      expect(updated.active).toBe(0);
    });

    it("throws NotFoundError for an unknown code", () => {
      expect(() => service.deactivate("NOPE")).toThrow(NotFoundError);
    });
  });

  describe("computeDiscountCents", () => {
    it("computes a percent discount, rounding down", () => {
      const discount = service.create({ code: "X", kind: "percent", value: 33 });
      expect(service.computeDiscountCents(discount, 1000)).toBe(330);
      const odd = service.create({ code: "Y", kind: "percent", value: 10 });
      expect(service.computeDiscountCents(odd, 999)).toBe(99);
    });

    it("computes a fixed discount", () => {
      const discount = service.create({ code: "X", kind: "fixed", value: 500 });
      expect(service.computeDiscountCents(discount, 1000)).toBe(500);
    });

    it("caps a fixed discount at the subtotal so total never goes negative", () => {
      const discount = service.create({ code: "X", kind: "fixed", value: 5000 });
      expect(service.computeDiscountCents(discount, 1000)).toBe(1000);
    });

    it("rejects an inactive discount", () => {
      const discount = service.create({ code: "X", kind: "fixed", value: 100 });
      service.deactivate("X");
      const inactive = service.getByCode("X");
      expect(() => service.computeDiscountCents(inactive, 1000)).toThrow(ValidationError);
    });

    it("rejects an expired discount", () => {
      const discount = service.create({
        code: "X",
        kind: "fixed",
        value: 100,
        expires_at: "2000-01-01T00:00:00.000Z",
      });
      expect(() => service.computeDiscountCents(discount, 1000)).toThrow(ValidationError);
    });

    it("accepts a discount that has not yet expired", () => {
      const discount = service.create({
        code: "X",
        kind: "fixed",
        value: 100,
        expires_at: "2999-01-01T00:00:00.000Z",
      });
      expect(service.computeDiscountCents(discount, 1000)).toBe(100);
    });

    it("rejects an order below the minimum subtotal", () => {
      const discount = service.create({ code: "X", kind: "fixed", value: 100, min_subtotal_cents: 2000 });
      expect(() => service.computeDiscountCents(discount, 1000)).toThrow(ValidationError);
    });

    it("accepts an order at exactly the minimum subtotal", () => {
      const discount = service.create({ code: "X", kind: "fixed", value: 100, min_subtotal_cents: 1000 });
      expect(service.computeDiscountCents(discount, 1000)).toBe(100);
    });
  });
});

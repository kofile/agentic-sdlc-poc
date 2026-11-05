import type Database from "better-sqlite3";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import { requireNonNegativeInt, requireString } from "../validation.js";
import type { CreateDiscountInput, Discount } from "./model.js";

const VALID_KINDS = new Set(["percent", "fixed"]);

export class DiscountService {
  constructor(private db: Database.Database) {}

  create(input: CreateDiscountInput): Discount {
    const code = requireString(input.code, "code").toUpperCase();
    if (!VALID_KINDS.has(input.kind)) {
      throw new ValidationError("kind must be 'percent' or 'fixed'");
    }
    const value = requireNonNegativeInt(input.value, "value");
    if (input.kind === "percent" && value > 100) {
      throw new ValidationError("a percent discount's value cannot exceed 100");
    }
    const minSubtotal =
      input.min_subtotal_cents !== undefined ? requireNonNegativeInt(input.min_subtotal_cents, "min_subtotal_cents") : 0;

    const existing = this.db.prepare("SELECT code FROM discounts WHERE code = ?").get(code);
    if (existing) {
      throw new ConflictError(`a discount with code ${code} already exists`);
    }

    this.db
      .prepare(
        "INSERT INTO discounts (code, kind, value, min_subtotal_cents, expires_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(code, input.kind, value, minSubtotal, input.expires_at ?? null);

    return this.getByCode(code);
  }

  getByCode(code: string): Discount {
    const row = this.db
      .prepare("SELECT * FROM discounts WHERE code = ?")
      .get(code.toUpperCase()) as Discount | undefined;
    if (!row) {
      throw new NotFoundError("discount", code);
    }
    return row;
  }

  list(): Discount[] {
    return this.db.prepare("SELECT * FROM discounts ORDER BY created_at ASC").all() as Discount[];
  }

  deactivate(code: string): Discount {
    this.getByCode(code);
    this.db.prepare("UPDATE discounts SET active = 0 WHERE code = ?").run(code.toUpperCase());
    return this.getByCode(code);
  }

  /**
   * Validates that a discount can be applied to an order with the given
   * subtotal, and returns the discount amount in cents. Only a single
   * discount code may be applied per order; this method does not implement
   * stacking of multiple codes.
   */
  computeDiscountCents(discount: Discount, subtotalCents: number): number {
    if (!discount.active) {
      throw new ValidationError(`discount ${discount.code} is not active`);
    }
    if (discount.expires_at && new Date(discount.expires_at).getTime() < Date.now()) {
      throw new ValidationError(`discount ${discount.code} has expired`);
    }
    if (subtotalCents < discount.min_subtotal_cents) {
      throw new ValidationError(
        `order subtotal ${subtotalCents} is below the minimum ${discount.min_subtotal_cents} required for discount ${discount.code}`,
      );
    }

    if (discount.kind === "percent") {
      return Math.floor((subtotalCents * discount.value) / 100);
    }

    // fixed: never discount below zero
    return Math.min(discount.value, subtotalCents);
  }
}

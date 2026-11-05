import type Database from "better-sqlite3";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import {
  parsePagination,
  requireNonNegativeInt,
  requireString,
} from "../validation.js";
import type { Product, CreateProductInput } from "./model.js";

export class InventoryService {
  constructor(private db: Database.Database) {}

  create(input: CreateProductInput): Product {
    const sku = requireString(input.sku, "sku");
    const name = requireString(input.name, "name");
    const price = requireNonNegativeInt(input.price_cents, "price_cents");
    const stock = input.stock_qty !== undefined ? requireNonNegativeInt(input.stock_qty, "stock_qty") : 0;

    const existing = this.db.prepare("SELECT id FROM products WHERE sku = ?").get(sku);
    if (existing) {
      throw new ConflictError(`a product with sku ${sku} already exists`);
    }

    const result = this.db
      .prepare("INSERT INTO products (sku, name, price_cents, stock_qty) VALUES (?, ?, ?, ?)")
      .run(sku, name, price, stock);

    return this.getById(Number(result.lastInsertRowid));
  }

  getById(id: number): Product {
    const row = this.db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Product | undefined;
    if (!row) {
      throw new NotFoundError("product", id);
    }
    return row;
  }

  getBySku(sku: string): Product {
    const row = this.db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as Product | undefined;
    if (!row) {
      throw new NotFoundError("product", sku);
    }
    return row;
  }

  list(query: Record<string, unknown> = {}): { items: Product[]; page: number; pageSize: number; total: number } {
    const { page, pageSize } = parsePagination(query);
    const total = (this.db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number }).count;
    const items = this.db
      .prepare("SELECT * FROM products ORDER BY id ASC LIMIT ? OFFSET ?")
      .all(pageSize, (page - 1) * pageSize) as Product[];
    return { items, page, pageSize, total };
  }

  adjustStock(id: number, delta: number): Product {
    const product = this.getById(id);
    const newQty = product.stock_qty + delta;
    if (newQty < 0) {
      throw new ValidationError(`insufficient stock for product ${id}: have ${product.stock_qty}, requested change ${delta}`);
    }
    this.db.prepare("UPDATE products SET stock_qty = ? WHERE id = ?").run(newQty, id);
    return this.getById(id);
  }

  updatePrice(id: number, price_cents: number): Product {
    this.getById(id);
    requireNonNegativeInt(price_cents, "price_cents");
    this.db.prepare("UPDATE products SET price_cents = ? WHERE id = ?").run(price_cents, id);
    return this.getById(id);
  }

  /**
   * Reserves stock for an order's line items inside the caller's transaction.
   * Throws ValidationError (without mutating anything) if any item would
   * oversell a product. Caller is responsible for wrapping this (and the
   * order insert) in a single db.transaction() so partial reservations never
   * persist.
   */
  reserveForOrder(items: Array<{ product_id: number; quantity: number }>): void {
    for (const item of items) {
      const product = this.getById(item.product_id);
      if (product.stock_qty < item.quantity) {
        throw new ValidationError(
          `insufficient stock for product ${item.product_id} (${product.sku}): have ${product.stock_qty}, requested ${item.quantity}`,
        );
      }
    }
    for (const item of items) {
      this.db
        .prepare("UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?")
        .run(item.quantity, item.product_id);
    }
  }

  releaseForOrder(items: Array<{ product_id: number; quantity: number }>): void {
    for (const item of items) {
      this.db
        .prepare("UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?")
        .run(item.quantity, item.product_id);
    }
  }
}

import type Database from "better-sqlite3";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import { parsePagination, requirePositiveInt } from "../validation.js";
import { CustomerService } from "../customers/service.js";
import { InventoryService } from "../inventory/service.js";
import { DiscountService } from "../discounts/service.js";
import type { CreateOrderInput, Order, OrderItem, OrderStatus, OrderWithItems } from "./model.js";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["fulfilled", "cancelled"],
  fulfilled: [],
  cancelled: [],
};

export class OrderService {
  private customers: CustomerService;
  private inventory: InventoryService;
  private discounts: DiscountService;

  constructor(private db: Database.Database) {
    this.customers = new CustomerService(db);
    this.inventory = new InventoryService(db);
    this.discounts = new DiscountService(db);
  }

  create(input: CreateOrderInput): OrderWithItems {
    this.customers.getById(requirePositiveInt(input.customer_id, "customer_id"));

    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new ValidationError("items must be a non-empty array");
    }

    const normalizedItems = input.items.map((item, idx) => {
      const productId = requirePositiveInt(item.product_id, `items[${idx}].product_id`);
      const quantity = requirePositiveInt(item.quantity, `items[${idx}].quantity`);
      return { product_id: productId, quantity };
    });

    // Merge duplicate product ids so reservation and totals are correct
    // even if the caller lists the same product twice.
    const merged = new Map<number, number>();
    for (const item of normalizedItems) {
      merged.set(item.product_id, (merged.get(item.product_id) ?? 0) + item.quantity);
    }
    const mergedItems = Array.from(merged.entries()).map(([product_id, quantity]) => ({ product_id, quantity }));

    const run = this.db.transaction(() => {
      // Price each line at the product's *current* price before reserving
      // stock, so an order never persists against a product that no longer
      // exists.
      const priced = mergedItems.map((item) => {
        const product = this.inventory.getById(item.product_id);
        return { ...item, unit_price_cents: product.price_cents };
      });

      this.inventory.reserveForOrder(mergedItems);

      const subtotalCents = priced.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);

      let discountCents = 0;
      let discountCode: string | null = null;
      if (input.discount_code) {
        const discount = this.discounts.getByCode(input.discount_code);
        discountCents = this.discounts.computeDiscountCents(discount, subtotalCents);
        discountCode = discount.code;
      }

      const totalCents = subtotalCents - discountCents;

      const orderResult = this.db
        .prepare(
          `INSERT INTO orders (customer_id, discount_code, subtotal_cents, discount_cents, total_cents)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(input.customer_id, discountCode, subtotalCents, discountCents, totalCents);

      const orderId = Number(orderResult.lastInsertRowid);

      const insertItem = this.db.prepare(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?)",
      );
      for (const item of priced) {
        insertItem.run(orderId, item.product_id, item.quantity, item.unit_price_cents);
      }

      return orderId;
    });

    const orderId = run();
    return this.getById(orderId);
  }

  getById(id: number): OrderWithItems {
    const order = this.db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order | undefined;
    if (!order) {
      throw new NotFoundError("order", id);
    }
    const items = this.db
      .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC")
      .all(id) as OrderItem[];
    return { ...order, items };
  }

  list(query: Record<string, unknown> = {}): { items: Order[]; page: number; pageSize: number; total: number } {
    const { page, pageSize } = parsePagination(query);

    const filters: string[] = [];
    const params: unknown[] = [];

    if (query.customer_id !== undefined) {
      filters.push("customer_id = ?");
      params.push(Number(query.customer_id));
    }
    if (query.status !== undefined) {
      filters.push("status = ?");
      params.push(String(query.status));
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const total = (
      this.db.prepare(`SELECT COUNT(*) as count FROM orders ${where}`).get(...params) as { count: number }
    ).count;

    const items = this.db
      .prepare(`SELECT * FROM orders ${where} ORDER BY id ASC LIMIT ? OFFSET ?`)
      .all(...params, pageSize, (page - 1) * pageSize) as Order[];

    return { items, page, pageSize, total };
  }

  private transition(id: number, next: OrderStatus): OrderWithItems {
    const order = this.getById(id);
    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(next)) {
      throw new ConflictError(`cannot move order ${id} from ${order.status} to ${next}`);
    }
    this.db
      .prepare("UPDATE orders SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
      .run(next, id);
    return this.getById(id);
  }

  pay(id: number): OrderWithItems {
    return this.transition(id, "paid");
  }

  fulfill(id: number): OrderWithItems {
    return this.transition(id, "fulfilled");
  }

  cancel(id: number): OrderWithItems {
    const order = this.getById(id);
    if (order.status === "cancelled") {
      throw new ConflictError(`order ${id} is already cancelled`);
    }
    if (order.status === "fulfilled") {
      throw new ConflictError(`order ${id} has already been fulfilled and cannot be cancelled`);
    }

    const run = this.db.transaction(() => {
      this.inventory.releaseForOrder(
        order.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
      );
      this.db
        .prepare("UPDATE orders SET status = 'cancelled', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
        .run(id);
    });
    run();

    return this.getById(id);
  }
}

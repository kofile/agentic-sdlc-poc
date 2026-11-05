import type Database from "better-sqlite3";
import { ValidationError } from "../errors.js";

export interface OrderExportFilters {
  from?: string;
  to?: string;
  status?: string;
}

interface ExportRow {
  order_id: number;
  order_created_at: string;
  status: string;
  customer_name: string;
  customer_email: string;
  product_sku: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
}

const CSV_HEADER = [
  "order_id",
  "order_created_at",
  "status",
  "customer_name",
  "customer_email",
  "product_sku",
  "product_name",
  "quantity",
  "unit_price_cents",
  "line_total_cents",
  "subtotal_cents",
  "discount_cents",
  "total_cents",
];

/** Quotes a CSV field per RFC 4180: wrap in quotes if it contains a comma,
 * quote, or newline, doubling any embedded quotes. */
export function csvField(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class ExportService {
  constructor(private db: Database.Database) {}

  private queryRows(filters: OrderExportFilters): ExportRow[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.from) {
      if (Number.isNaN(Date.parse(filters.from))) {
        throw new ValidationError("from must be a valid ISO date");
      }
      clauses.push("o.created_at >= ?");
      params.push(filters.from);
    }
    if (filters.to) {
      if (Number.isNaN(Date.parse(filters.to))) {
        throw new ValidationError("to must be a valid ISO date");
      }
      clauses.push("o.created_at <= ?");
      params.push(filters.to);
    }
    if (filters.status) {
      clauses.push("o.status = ?");
      params.push(filters.status);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    return this.db
      .prepare(
        `
      SELECT
        o.id AS order_id,
        o.created_at AS order_created_at,
        o.status AS status,
        c.name AS customer_name,
        c.email AS customer_email,
        p.sku AS product_sku,
        p.name AS product_name,
        oi.quantity AS quantity,
        oi.unit_price_cents AS unit_price_cents,
        (oi.quantity * oi.unit_price_cents) AS line_total_cents,
        o.subtotal_cents AS subtotal_cents,
        o.discount_cents AS discount_cents,
        o.total_cents AS total_cents
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      ${where}
      ORDER BY o.id ASC, oi.id ASC
    `,
      )
      .all(...params) as ExportRow[];
  }

  /**
   * Builds a CSV document: one row per order line item, with order-level
   * totals repeated on each line so the export is flat and spreadsheet-ready.
   * Orders with no line items are omitted (an order always has at least one
   * item at creation time, so this only affects data created out-of-band).
   */
  toCsv(filters: OrderExportFilters = {}): string {
    const rows = this.queryRows(filters);
    const lines = [CSV_HEADER.join(",")];

    for (const row of rows) {
      lines.push(
        [
          row.order_id,
          row.order_created_at,
          row.status,
          csvField(row.customer_name),
          csvField(row.customer_email),
          csvField(row.product_sku),
          csvField(row.product_name),
          row.quantity,
          row.unit_price_cents,
          row.line_total_cents,
          row.subtotal_cents,
          row.discount_cents,
          row.total_cents,
        ]
          .map((value) => csvField(value as string | number))
          .join(","),
      );
    }

    return lines.join("\r\n") + "\r\n";
  }
}

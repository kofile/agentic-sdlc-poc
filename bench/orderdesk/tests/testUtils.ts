import type Database from "better-sqlite3";
import type { Express } from "express";
import { openDatabase } from "../src/db/connection.js";
import { createApp } from "../src/app.js";

export function freshDb(): Database.Database {
  return openDatabase(":memory:");
}

// No real HTTP server here on purpose — see tests/testRequest.ts for why:
// route tests drive the Express app in-process via `light-my-request`
// (no socket, no port), not over a real TCP connection.
export function freshApp(): { db: Database.Database; app: Express } {
  const db = freshDb();
  const app = createApp(db);
  return { db, app };
}

export function makeCustomer(db: Database.Database, overrides: Partial<{ name: string; email: string }> = {}) {
  const name = overrides.name ?? "Ada Lovelace";
  const email = overrides.email ?? `ada+${Math.random().toString(36).slice(2)}@example.com`;
  const result = db.prepare("INSERT INTO customers (name, email) VALUES (?, ?)").run(name, email);
  return Number(result.lastInsertRowid);
}

export function makeProduct(
  db: Database.Database,
  overrides: Partial<{ sku: string; name: string; price_cents: number; stock_qty: number }> = {},
) {
  const sku = overrides.sku ?? `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const name = overrides.name ?? "Widget";
  const price_cents = overrides.price_cents ?? 1000;
  const stock_qty = overrides.stock_qty ?? 100;
  const result = db
    .prepare("INSERT INTO products (sku, name, price_cents, stock_qty) VALUES (?, ?, ?, ?)")
    .run(sku, name, price_cents, stock_qty);
  return Number(result.lastInsertRowid);
}

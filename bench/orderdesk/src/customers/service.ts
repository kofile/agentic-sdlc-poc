import type Database from "better-sqlite3";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import { parsePagination, requireEmail, requireString } from "../validation.js";
import type { Customer, CreateCustomerInput } from "./model.js";

export class CustomerService {
  constructor(private db: Database.Database) {}

  create(input: CreateCustomerInput): Customer {
    const name = requireString(input.name, "name");
    const email = requireEmail(input.email, "email");

    const existing = this.db.prepare("SELECT id FROM customers WHERE email = ?").get(email);
    if (existing) {
      throw new ConflictError(`a customer with email ${email} already exists`);
    }

    const result = this.db
      .prepare("INSERT INTO customers (name, email) VALUES (?, ?)")
      .run(name, email);

    return this.getById(Number(result.lastInsertRowid));
  }

  getById(id: number): Customer {
    const row = this.db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as Customer | undefined;
    if (!row) {
      throw new NotFoundError("customer", id);
    }
    return row;
  }

  list(query: Record<string, unknown> = {}): { items: Customer[]; page: number; pageSize: number; total: number } {
    const { page, pageSize } = parsePagination(query);
    const total = (this.db.prepare("SELECT COUNT(*) as count FROM customers").get() as { count: number }).count;
    const items = this.db
      .prepare("SELECT * FROM customers ORDER BY id ASC LIMIT ? OFFSET ?")
      .all(pageSize, (page - 1) * pageSize) as Customer[];
    return { items, page, pageSize, total };
  }

  update(id: number, input: Partial<CreateCustomerInput>): Customer {
    const existing = this.getById(id);

    const name = input.name !== undefined ? requireString(input.name, "name") : existing.name;
    const email = input.email !== undefined ? requireEmail(input.email, "email") : existing.email;

    if (email !== existing.email) {
      const emailTaken = this.db
        .prepare("SELECT id FROM customers WHERE email = ? AND id != ?")
        .get(email, id);
      if (emailTaken) {
        throw new ConflictError(`a customer with email ${email} already exists`);
      }
    }

    this.db.prepare("UPDATE customers SET name = ?, email = ? WHERE id = ?").run(name, email, id);
    return this.getById(id);
  }

  delete(id: number): void {
    this.getById(id);
    const inUse = this.db.prepare("SELECT id FROM orders WHERE customer_id = ? LIMIT 1").get(id);
    if (inUse) {
      throw new ValidationError("cannot delete a customer that has orders");
    }
    this.db.prepare("DELETE FROM customers WHERE id = ?").run(id);
  }
}

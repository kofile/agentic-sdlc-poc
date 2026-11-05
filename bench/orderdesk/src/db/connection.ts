import Database from "better-sqlite3";
import { applySchema } from "./schema.js";

/**
 * Opens a database connection and ensures the schema exists.
 * Pass ":memory:" (the default used by tests) for an ephemeral database,
 * or a file path for a persistent one.
 */
export function openDatabase(path: string = ":memory:"): Database.Database {
  const db = new Database(path);
  applySchema(db);
  return db;
}

import { ValidationError } from "./errors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} is required and must be a non-empty string`);
  }
  return value;
}

export function requireEmail(value: unknown, field = "email"): string {
  const str = requireString(value, field);
  if (!EMAIL_RE.test(str)) {
    throw new ValidationError(`${field} must be a valid email address`);
  }
  return str;
}

export function requirePositiveInt(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return value;
}

export function requireNonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }
  return value;
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string when provided`);
  }
  return value;
}

export function parsePagination(query: Record<string, unknown>): { page: number; pageSize: number } {
  let page = 1;
  let pageSize = 20;

  if (query.page !== undefined) {
    const parsed = Number(query.page);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new ValidationError("page must be a positive integer");
    }
    page = parsed;
  }

  if (query.pageSize !== undefined) {
    const parsed = Number(query.pageSize);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw new ValidationError("pageSize must be an integer between 1 and 100");
    }
    pageSize = parsed;
  }

  return { page, pageSize };
}

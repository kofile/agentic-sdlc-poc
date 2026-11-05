import type { ApiErrorBody, Customer, Order, OrderWithItems, Paginated, Product } from "./types.js";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error);
    this.name = "ApiError";
    this.status = status;
    this.details = body.details;
  }
}

/** Base URL for the orderdesk API. Overridable so tests and deployments can
 * point this client at a different host without rebuilding. */
export function getApiBaseUrl(): string {
  return (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ?? "http://localhost:3000";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, body as ApiErrorBody);
  }

  return body as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string | number][];
  if (entries.length === 0) return "";
  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
  return `?${search.toString()}`;
}

export const api = {
  customers: {
    list: (page = 1, pageSize = 20) => request<Paginated<Customer>>(`/customers${query({ page, pageSize })}`),
    get: (id: number) => request<Customer>(`/customers/${id}`),
    create: (input: { name: string; email: string }) =>
      request<Customer>("/customers", { method: "POST", body: JSON.stringify(input) }),
  },

  products: {
    list: (page = 1, pageSize = 20) => request<Paginated<Product>>(`/products${query({ page, pageSize })}`),
    get: (id: number) => request<Product>(`/products/${id}`),
  },

  orders: {
    list: (filters: { page?: number; pageSize?: number; customer_id?: number; status?: string } = {}) =>
      request<Paginated<Order>>(`/orders${query(filters)}`),
    get: (id: number) => request<OrderWithItems>(`/orders/${id}`),
    create: (input: { customer_id: number; items: Array<{ product_id: number; quantity: number }>; discount_code?: string }) =>
      request<OrderWithItems>("/orders", { method: "POST", body: JSON.stringify(input) }),
    pay: (id: number) => request<OrderWithItems>(`/orders/${id}/pay`, { method: "POST" }),
    fulfill: (id: number) => request<OrderWithItems>(`/orders/${id}/fulfill`, { method: "POST" }),
    cancel: (id: number) => request<OrderWithItems>(`/orders/${id}/cancel`, { method: "POST" }),
  },
};

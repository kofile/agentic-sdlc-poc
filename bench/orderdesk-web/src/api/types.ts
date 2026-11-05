// Mirrors the orderdesk API's response shapes. Keep in sync with
// bench/orderdesk/src/*/model.ts — these are the two sides of the same
// contract.

export interface Customer {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  price_cents: number;
  stock_qty: number;
  created_at: string;
}

export type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled";

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price_cents: number;
}

export interface Order {
  id: number;
  customer_id: number;
  status: OrderStatus;
  discount_code: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  created_at: string;
  updated_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}

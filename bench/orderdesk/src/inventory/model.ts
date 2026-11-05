export interface Product {
  id: number;
  sku: string;
  name: string;
  price_cents: number;
  stock_qty: number;
  created_at: string;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  price_cents: number;
  stock_qty?: number;
}

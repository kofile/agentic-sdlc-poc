export type DiscountKind = "percent" | "fixed";

export interface Discount {
  code: string;
  kind: DiscountKind;
  value: number;
  active: 0 | 1;
  min_subtotal_cents: number;
  expires_at: string | null;
  created_at: string;
}

export interface CreateDiscountInput {
  code: string;
  kind: DiscountKind;
  value: number;
  min_subtotal_cents?: number;
  expires_at?: string | null;
}

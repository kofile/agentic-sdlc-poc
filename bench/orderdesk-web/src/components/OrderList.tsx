import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client.js";
import type { Order, OrderStatus } from "../api/types.js";
import { formatCents, formatStatus } from "../format.js";

const STATUS_FILTERS: Array<OrderStatus | "all"> = ["all", "pending", "paid", "fulfilled", "cancelled"];

export interface OrderListProps {
  onSelect: (orderId: number) => void;
  refreshToken?: number;
}

export function OrderList({ onSelect, refreshToken }: OrderListProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.orders
      .list({ page, pageSize, status: status === "all" ? undefined : status })
      .then((result) => {
        if (cancelled) return;
        setOrders(result.items);
        setTotal(result.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "failed to load orders");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, page, refreshToken]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div data-testid="order-list">
      <div role="group" aria-label="status filter">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={status === option}
            onClick={() => {
              setStatus(option);
              setPage(1);
            }}
          >
            {option === "all" ? "All" : formatStatus(option)}
          </button>
        ))}
      </div>

      {loading && <p>Loading orders…</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && orders.length === 0 && <p>No orders found.</p>}

      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            <button type="button" onClick={() => onSelect(order.id)}>
              Order #{order.id} — {formatStatus(order.status)} — {formatCents(order.total_cents)}
            </button>
          </li>
        ))}
      </ul>

      <div aria-label="pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

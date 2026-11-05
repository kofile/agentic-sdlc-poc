import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client.js";
import type { OrderWithItems } from "../api/types.js";
import { formatCents, formatStatus } from "../format.js";

export interface OrderDetailProps {
  orderId: number;
  onChanged?: () => void;
  onClose?: () => void;
}

const NEXT_ACTION: Record<string, { label: string; run: (id: number) => Promise<OrderWithItems> } | undefined> = {
  pending: { label: "Mark as paid", run: api.orders.pay },
  paid: { label: "Mark as fulfilled", run: api.orders.fulfill },
};

export function OrderDetail({ orderId, onChanged, onClose }: OrderDetailProps) {
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setError(null);
    api.orders
      .get(orderId)
      .then(setOrder)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "failed to load order"));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function runAction(action: (id: number) => Promise<OrderWithItems>) {
    setBusy(true);
    setError(null);
    try {
      const updated = await action(orderId);
      setOrder(updated);
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "action failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) {
    return (
      <div data-testid="order-detail">
        <p role="alert">{error}</p>
        {onClose && (
          <button type="button" onClick={onClose}>
            Back
          </button>
        )}
      </div>
    );
  }

  if (!order) {
    return <p>Loading order…</p>;
  }

  const nextAction = NEXT_ACTION[order.status];
  const canCancel = order.status === "pending" || order.status === "paid";

  return (
    <div data-testid="order-detail">
      <h2>Order #{order.id}</h2>
      <p>Status: {formatStatus(order.status)}</p>
      {error && <p role="alert">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Line total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>#{item.product_id}</td>
              <td>{item.quantity}</td>
              <td>{formatCents(item.unit_price_cents)}</td>
              <td>{formatCents(item.unit_price_cents * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>Subtotal: {formatCents(order.subtotal_cents)}</p>
      {order.discount_cents > 0 && (
        <p>
          Discount ({order.discount_code}): -{formatCents(order.discount_cents)}
        </p>
      )}
      <p>
        <strong>Total: {formatCents(order.total_cents)}</strong>
      </p>

      <div>
        {nextAction && (
          <button type="button" disabled={busy} onClick={() => runAction(nextAction.run)}>
            {nextAction.label}
          </button>
        )}
        {canCancel && (
          <button type="button" disabled={busy} onClick={() => runAction(api.orders.cancel)}>
            Cancel order
          </button>
        )}
      </div>

      {onClose && (
        <button type="button" onClick={onClose}>
          Back to list
        </button>
      )}
    </div>
  );
}

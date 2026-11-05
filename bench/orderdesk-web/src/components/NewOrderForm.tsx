import { useState } from "react";
import { api, ApiError } from "../api/client.js";

interface LineItemDraft {
  product_id: string;
  quantity: string;
}

export interface NewOrderFormProps {
  onCreated: (orderId: number) => void;
}

function emptyLine(): LineItemDraft {
  return { product_id: "", quantity: "1" };
}

export function NewOrderForm({ onCreated }: NewOrderFormProps) {
  const [customerId, setCustomerId] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [lines, setLines] = useState<LineItemDraft[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateLine(index: number, patch: Partial<LineItemDraft>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const customerIdNum = Number(customerId);
    if (!Number.isInteger(customerIdNum) || customerIdNum <= 0) {
      setError("Enter a valid customer id");
      return;
    }

    const items = [];
    for (const line of lines) {
      const productId = Number(line.product_id);
      const quantity = Number(line.quantity);
      if (!Number.isInteger(productId) || productId <= 0) {
        setError("Every line item needs a valid product id");
        return;
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        setError("Every line item needs a quantity of at least 1");
        return;
      }
      items.push({ product_id: productId, quantity });
    }

    setSubmitting(true);
    try {
      const order = await api.orders.create({
        customer_id: customerIdNum,
        items,
        discount_code: discountCode.trim() || undefined,
      });
      onCreated(order.id);
      setCustomerId("");
      setDiscountCode("");
      setLines([emptyLine()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="new-order-form" noValidate>
      <h2>New order</h2>

      <label>
        Customer id
        <input
          type="number"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          min={1}
        />
      </label>

      {lines.map((line, index) => (
        <div key={index} data-testid={`line-item-${index}`}>
          <label>
            Product id
            <input
              type="number"
              value={line.product_id}
              onChange={(e) => updateLine(index, { product_id: e.target.value })}
              min={1}
            />
          </label>
          <label>
            Quantity
            <input
              type="number"
              value={line.quantity}
              onChange={(e) => updateLine(index, { quantity: e.target.value })}
              min={1}
            />
          </label>
          <button type="button" onClick={() => removeLine(index)} disabled={lines.length === 1}>
            Remove
          </button>
        </div>
      ))}

      <button type="button" onClick={addLine}>
        Add line item
      </button>

      <label>
        Discount code (optional)
        <input type="text" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} />
      </label>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={submitting}>
        Create order
      </button>
    </form>
  );
}

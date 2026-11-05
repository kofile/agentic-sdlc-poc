import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderDetail } from "../src/components/OrderDetail.js";

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    customer_id: 1,
    status: "pending",
    discount_code: null,
    subtotal_cents: 1000,
    discount_cents: 0,
    total_cents: 1000,
    items: [{ id: 1, order_id: 1, product_id: 5, quantity: 2, unit_price_cents: 500 }],
    ...overrides,
  };
}

function mockSequence(responses: Array<{ status: number; body: unknown }>) {
  const fn = vi.fn();
  for (const { status, body } of responses) {
    fn.mockResolvedValueOnce({ status, ok: status >= 200 && status < 300, json: async () => body });
  }
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("OrderDetail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders order items and totals", async () => {
    mockSequence([{ status: 200, body: baseOrder() }]);
    render(<OrderDetail orderId={1} />);

    await waitFor(() => expect(screen.getByText("Order #1")).toBeInTheDocument());
    expect(screen.getByText(/^subtotal: \$10\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/^total: \$10\.00/i)).toBeInTheDocument();
  });

  it("shows the discount line only when a discount was applied", async () => {
    mockSequence([{ status: 200, body: baseOrder({ discount_cents: 100, discount_code: "SAVE10", total_cents: 900 }) }]);
    render(<OrderDetail orderId={1} />);
    await waitFor(() => expect(screen.getByText(/discount \(save10\)/i)).toBeInTheDocument());
  });

  it("does not show a discount line when none was applied", async () => {
    mockSequence([{ status: 200, body: baseOrder() }]);
    render(<OrderDetail orderId={1} />);
    await waitFor(() => screen.getByText("Order #1"));
    expect(screen.queryByText(/discount/i)).not.toBeInTheDocument();
  });

  it("shows a 'Mark as paid' action for a pending order", async () => {
    mockSequence([{ status: 200, body: baseOrder({ status: "pending" }) }]);
    render(<OrderDetail orderId={1} />);
    await waitFor(() => screen.getByRole("button", { name: /mark as paid/i }));
  });

  it("shows a 'Mark as fulfilled' action for a paid order", async () => {
    mockSequence([{ status: 200, body: baseOrder({ status: "paid" }) }]);
    render(<OrderDetail orderId={1} />);
    await waitFor(() => screen.getByRole("button", { name: /mark as fulfilled/i }));
  });

  it("shows no next-step action for a fulfilled order", async () => {
    mockSequence([{ status: 200, body: baseOrder({ status: "fulfilled" }) }]);
    render(<OrderDetail orderId={1} />);
    await waitFor(() => screen.getByText("Order #1"));
    expect(screen.queryByRole("button", { name: /mark as/i })).not.toBeInTheDocument();
  });

  it("hides the cancel button for a fulfilled order", async () => {
    mockSequence([{ status: 200, body: baseOrder({ status: "fulfilled" }) }]);
    render(<OrderDetail orderId={1} />);
    await waitFor(() => screen.getByText("Order #1"));
    expect(screen.queryByRole("button", { name: /cancel order/i })).not.toBeInTheDocument();
  });

  it("calls onChanged after a successful action", async () => {
    const onChanged = vi.fn();
    mockSequence([
      { status: 200, body: baseOrder({ status: "pending" }) },
      { status: 200, body: baseOrder({ status: "paid" }) },
    ]);
    render(<OrderDetail orderId={1} onChanged={onChanged} />);
    await waitFor(() => screen.getByRole("button", { name: /mark as paid/i }));
    await userEvent.click(screen.getByRole("button", { name: /mark as paid/i }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("shows an error if the action fails, without losing the loaded order", async () => {
    mockSequence([
      { status: 200, body: baseOrder({ status: "pending" }) },
      { status: 409, body: { error: "cannot move order 1 from pending to paid" } },
    ]);
    render(<OrderDetail orderId={1} />);
    await waitFor(() => screen.getByRole("button", { name: /mark as paid/i }));
    await userEvent.click(screen.getByRole("button", { name: /mark as paid/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/cannot move order/i));
    expect(screen.getByText("Order #1")).toBeInTheDocument();
  });

  it("shows an error state when the initial load fails", async () => {
    mockSequence([{ status: 404, body: { error: "order 1 not found" } }]);
    render(<OrderDetail orderId={1} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/not found/i));
  });
});

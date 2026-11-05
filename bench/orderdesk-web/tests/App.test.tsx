import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the order list by default", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ items: [], page: 1, pageSize: 10, total: 0 }),
    }) as unknown as typeof fetch;

    render(<App />);
    expect(screen.getByTestId("order-list")).toBeInTheDocument();
  });

  it("switches to the new order form via nav", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ items: [], page: 1, pageSize: 10, total: 0 }),
    }) as unknown as typeof fetch;

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "New order" }));
    expect(screen.getByTestId("new-order-form")).toBeInTheDocument();
  });

  it("navigates to order detail after creating an order", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ items: [], page: 1, pageSize: 10, total: 0 }) })
      .mockResolvedValueOnce({
        status: 201,
        ok: true,
        json: async () => ({ id: 5, status: "pending", items: [] }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          id: 5,
          customer_id: 1,
          status: "pending",
          discount_code: null,
          subtotal_cents: 0,
          discount_cents: 0,
          total_cents: 0,
          items: [],
        }),
      }) as unknown as typeof fetch;

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "New order" }));
    await userEvent.type(screen.getByLabelText(/customer id/i), "1");
    await userEvent.type(screen.getByLabelText(/product id/i), "1");
    await userEvent.click(screen.getByRole("button", { name: /create order/i }));

    await waitFor(() => expect(screen.getByTestId("order-detail")).toBeInTheDocument());
    expect(screen.getByText("Order #5")).toBeInTheDocument();
  });
});

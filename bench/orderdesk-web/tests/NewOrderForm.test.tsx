import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewOrderForm } from "../src/components/NewOrderForm.js";

describe("NewOrderForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects submission with no customer id", async () => {
    render(<NewOrderForm onCreated={() => {}} />);
    await userEvent.type(screen.getByLabelText(/product id/i), "1");
    await userEvent.click(screen.getByRole("button", { name: /create order/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid customer id/i);
  });

  it("rejects submission with an invalid quantity", async () => {
    render(<NewOrderForm onCreated={() => {}} />);
    await userEvent.type(screen.getByLabelText(/customer id/i), "1");
    await userEvent.type(screen.getByLabelText(/product id/i), "1");
    await userEvent.clear(screen.getByLabelText(/quantity/i));
    await userEvent.type(screen.getByLabelText(/quantity/i), "0");
    await userEvent.click(screen.getByRole("button", { name: /create order/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/quantity of at least 1/i);
  });

  it("adds and removes line items", async () => {
    render(<NewOrderForm onCreated={() => {}} />);
    expect(screen.getAllByLabelText(/product id/i)).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: /add line item/i }));
    expect(screen.getAllByLabelText(/product id/i)).toHaveLength(2);

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await userEvent.click(removeButtons[0]);
    expect(screen.getAllByLabelText(/product id/i)).toHaveLength(1);
  });

  it("cannot remove the last remaining line item", async () => {
    render(<NewOrderForm onCreated={() => {}} />);
    const removeButton = screen.getByRole("button", { name: /remove/i });
    expect(removeButton).toBeDisabled();
  });

  it("submits a well-formed order and calls onCreated", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ id: 42, status: "pending", items: [] }),
    }) as unknown as typeof fetch;

    const onCreated = vi.fn();
    render(<NewOrderForm onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText(/customer id/i), "3");
    await userEvent.type(screen.getByLabelText(/product id/i), "9");
    await userEvent.clear(screen.getByLabelText(/quantity/i));
    await userEvent.type(screen.getByLabelText(/quantity/i), "2");

    await userEvent.click(screen.getByRole("button", { name: /create order/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(42));

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body).toEqual({ customer_id: 3, items: [{ product_id: 9, quantity: 2 }], discount_code: undefined });
  });

  it("trims and includes a discount code when provided", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ id: 1, status: "pending", items: [] }),
    }) as unknown as typeof fetch;

    render(<NewOrderForm onCreated={() => {}} />);
    await userEvent.type(screen.getByLabelText(/customer id/i), "1");
    await userEvent.type(screen.getByLabelText(/product id/i), "1");
    await userEvent.type(screen.getByLabelText(/discount code/i), "  SAVE10  ");
    await userEvent.click(screen.getByRole("button", { name: /create order/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.discount_code).toBe("SAVE10");
  });

  it("shows the server error message when the API rejects the order", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 400,
      ok: false,
      json: async () => ({ error: "insufficient stock for product 9" }),
    }) as unknown as typeof fetch;

    render(<NewOrderForm onCreated={() => {}} />);
    await userEvent.type(screen.getByLabelText(/customer id/i), "1");
    await userEvent.type(screen.getByLabelText(/product id/i), "9");
    await userEvent.click(screen.getByRole("button", { name: /create order/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/insufficient stock/i);
  });
});

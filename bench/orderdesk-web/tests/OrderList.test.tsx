import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderList } from "../src/components/OrderList.js";

function mockOrdersResponse(items: unknown[], total = items.length) {
  global.fetch = vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({ items, page: 1, pageSize: 10, total }),
  }) as unknown as typeof fetch;
}

describe("OrderList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading state then the fetched orders", async () => {
    mockOrdersResponse([
      { id: 1, status: "pending", total_cents: 1000 },
      { id: 2, status: "paid", total_cents: 2000 },
    ]);

    render(<OrderList onSelect={() => {}} />);

    expect(screen.getByText(/loading orders/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText(/order #1/i)).toBeInTheDocument());
    expect(screen.getByText(/order #2/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no orders", async () => {
    mockOrdersResponse([]);
    render(<OrderList onSelect={() => {}} />);
    await waitFor(() => expect(screen.getByText(/no orders found/i)).toBeInTheDocument());
  });

  it("shows an error message when the fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      json: async () => ({ error: "internal server error" }),
    }) as unknown as typeof fetch;

    render(<OrderList onSelect={() => {}} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("internal server error"));
  });

  it("calls onSelect with the order id when an order is clicked", async () => {
    mockOrdersResponse([{ id: 7, status: "pending", total_cents: 1000 }]);
    const onSelect = vi.fn();
    render(<OrderList onSelect={onSelect} />);

    await waitFor(() => screen.getByText(/order #7/i));
    await userEvent.click(screen.getByText(/order #7/i));
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it("re-fetches with the selected status filter", async () => {
    mockOrdersResponse([]);
    render(<OrderList onSelect={() => {}} />);
    await waitFor(() => screen.getByText(/no orders found/i));

    await userEvent.click(screen.getByRole("button", { name: "Paid" }));

    await waitFor(() => {
      const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string;
      expect(calledUrl).toContain("status=paid");
    });
  });

  it("disables the Previous button on the first page", async () => {
    mockOrdersResponse([{ id: 1, status: "pending", total_cents: 100 }]);
    render(<OrderList onSelect={() => {}} />);
    await waitFor(() => screen.getByText(/order #1/i));
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("disables the Next button when all results fit on one page", async () => {
    mockOrdersResponse([{ id: 1, status: "pending", total_cents: 100 }], 1);
    render(<OrderList onSelect={() => {}} />);
    await waitFor(() => screen.getByText(/order #1/i));
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

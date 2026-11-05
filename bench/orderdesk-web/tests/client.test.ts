import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError } from "../src/api/client.js";

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("api client", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("customers", () => {
    it("lists customers", async () => {
      mockFetchOnce(200, { items: [{ id: 1, name: "Ada", email: "ada@example.com" }], page: 1, pageSize: 20, total: 1 });
      const result = await api.customers.list();
      expect(result.items).toHaveLength(1);
    });

    it("creates a customer", async () => {
      mockFetchOnce(201, { id: 1, name: "Ada", email: "ada@example.com" });
      const customer = await api.customers.create({ name: "Ada", email: "ada@example.com" });
      expect(customer.id).toBe(1);
    });

    it("throws ApiError with the server message on failure", async () => {
      mockFetchOnce(400, { error: "email is required" });
      await expect(api.customers.create({ name: "Ada", email: "" })).rejects.toMatchObject({
        message: "email is required",
      });
    });

    it("throws an instance of ApiError carrying the status code", async () => {
      mockFetchOnce(404, { error: "customer 1 not found" });
      try {
        await api.customers.get(1);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(404);
      }
    });
  });

  describe("orders", () => {
    it("lists orders with filters encoded in the query string", async () => {
      mockFetchOnce(200, { items: [], page: 1, pageSize: 10, total: 0 });
      await api.orders.list({ status: "paid", page: 2 });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("status=paid"),
        expect.anything(),
      );
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("page=2"), expect.anything());
    });

    it("omits undefined filters from the query string", async () => {
      mockFetchOnce(200, { items: [], page: 1, pageSize: 10, total: 0 });
      await api.orders.list({});
      const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl.endsWith("/orders")).toBe(true);
    });

    it("creates an order", async () => {
      mockFetchOnce(201, { id: 1, status: "pending", items: [] });
      const order = await api.orders.create({ customer_id: 1, items: [{ product_id: 1, quantity: 1 }] });
      expect(order.id).toBe(1);
    });

    it("pays an order via POST", async () => {
      mockFetchOnce(200, { id: 1, status: "paid", items: [] });
      const order = await api.orders.pay(1);
      expect(order.status).toBe("paid");
      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1]).toMatchObject({ method: "POST" });
    });

    it("treats a 204 response as having no body, without calling json()", async () => {
      const jsonSpy = vi.fn().mockResolvedValue({});
      global.fetch = vi.fn().mockResolvedValue({ status: 204, ok: true, json: jsonSpy }) as unknown as typeof fetch;
      const result = await api.orders.cancel(1);
      // cancel actually returns 200 with a body in the real API; this just
      // exercises the 204 short-circuit path generically
      expect(result).toBeUndefined();
      expect(jsonSpy).not.toHaveBeenCalled();
    });
  });

  describe("products", () => {
    it("fetches a single product", async () => {
      mockFetchOnce(200, { id: 1, sku: "W1", name: "Widget", price_cents: 500, stock_qty: 10 });
      const product = await api.products.get(1);
      expect(product.sku).toBe("W1");
    });
  });
});

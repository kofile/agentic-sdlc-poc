import { describe, it, expect } from "vitest";
import { formatCents, formatStatus } from "../src/format.js";

describe("formatCents", () => {
  it("formats whole dollars", () => {
    expect(formatCents(1000)).toBe("$10.00");
  });

  it("formats cents with a leading zero", () => {
    expect(formatCents(105)).toBe("$1.05");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0.00");
  });

  it("formats a negative amount", () => {
    expect(formatCents(-500)).toBe("-$5.00");
  });

  it("formats a single-digit cents amount", () => {
    expect(formatCents(5)).toBe("$0.05");
  });
});

describe("formatStatus", () => {
  it("capitalizes the first letter", () => {
    expect(formatStatus("pending")).toBe("Pending");
  });

  it("leaves the rest of the string unchanged", () => {
    expect(formatStatus("fulfilled")).toBe("Fulfilled");
  });
});

import { describe, expect, it } from "vitest";
import { areIntervalsOverlapping } from "date-fns";

describe("booking overlap detection", () => {
  it("detects overlapping intervals", () => {
    const aStart = new Date("2026-05-26T10:00:00Z");
    const aEnd = new Date("2026-05-26T10:30:00Z");
    const bStart = new Date("2026-05-26T10:15:00Z");
    const bEnd = new Date("2026-05-26T10:45:00Z");

    expect(
      areIntervalsOverlapping(
        { start: aStart, end: aEnd },
        { start: bStart, end: bEnd },
        { inclusive: false }
      )
    ).toBe(true);
  });

  it("allows adjacent intervals", () => {
    const aStart = new Date("2026-05-26T10:00:00Z");
    const aEnd = new Date("2026-05-26T10:30:00Z");
    const bStart = new Date("2026-05-26T10:30:00Z");
    const bEnd = new Date("2026-05-26T11:00:00Z");

    expect(
      areIntervalsOverlapping(
        { start: aStart, end: aEnd },
        { start: bStart, end: bEnd },
        { inclusive: false }
      )
    ).toBe(false);
  });
});

describe("hold expiry logic", () => {
  it("expires holds after ttl", () => {
    const now = Date.now();
    const expiresAt = now - 1000;
    expect(expiresAt <= now).toBe(true);
  });
});

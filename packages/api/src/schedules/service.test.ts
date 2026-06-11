import { describe, expect, it } from "vitest";
import { validateScheduleWindows } from "./service";
import { validateScheduleExceptions } from "./exceptions";

describe("validateScheduleWindows", () => {
  it("accepts valid windows including multiple on same day", () => {
    expect(() =>
      validateScheduleWindows([
        { dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
        { dayOfWeek: 1, startTime: "15:00", endTime: "19:00" },
      ])
    ).not.toThrow();
  });

  it("rejects end before start", () => {
    expect(() =>
      validateScheduleWindows([{ dayOfWeek: 2, startTime: "18:00", endTime: "09:00" }])
    ).toThrow("startTime must be before endTime");
  });

  it("rejects invalid day", () => {
    expect(() =>
      validateScheduleWindows([{ dayOfWeek: 7, startTime: "09:00", endTime: "18:00" }])
    ).toThrow("Invalid dayOfWeek");
  });
});

describe("validateScheduleExceptions", () => {
  it("accepts closed day", () => {
    expect(() =>
      validateScheduleExceptions([{ date: "2026-12-25", isClosed: true }])
    ).not.toThrow();
  });

  it("requires hours when not closed", () => {
    expect(() =>
      validateScheduleExceptions([{ date: "2026-12-25", isClosed: false }])
    ).toThrow("Custom hours require startTime and endTime");
  });
});

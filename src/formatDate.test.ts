import { describe, it, expect } from "vitest";
import { formatDate } from "./formatDate";

describe("formatDate", () => {
  it("YYYY-MM-DD を年・月・日に分解する", () => {
    expect(formatDate("2026-08-23")).toEqual({ year: 2026, month: 8, day: 23 });
  });

  it("月日の先頭のゼロを落とす", () => {
    expect(formatDate("2026-01-05")).toEqual({ year: 2026, month: 1, day: 5 });
  });

  it("年をまたぐ日付も分解できる", () => {
    expect(formatDate("2025-12-31")).toEqual({ year: 2025, month: 12, day: 31 });
  });

  // spec §9: 形式違反はプレビューが壊れて見えることで気づく仕組みになっている。
  // ここで既定値に丸めると、その検知手段を潰してしまう
  it("スラッシュ区切りは整形せず NaN を返す", () => {
    expect(formatDate("2026/08/23").year).toBeNaN();
  });

  it("日付として読めない文字列は NaN を返す", () => {
    expect(formatDate("明日").year).toBeNaN();
  });

  it("空文字は year が 0、月日が undefined になる", () => {
    const parts = formatDate("");

    expect(parts.year).toBe(0);
    expect(parts.month).toBeUndefined();
    expect(parts.day).toBeUndefined();
  });

  it("区切りが足りなければ足りない部分は undefined になる", () => {
    const parts = formatDate("2026-08");

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(8);
    expect(parts.day).toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";
import { buildImagePath } from "./buildImagePath";

describe("buildImagePath", () => {
  it("年とその下の月日で分ける", () => {
    expect(buildImagePath("2026-10-12", "0_1.png")).toBe("2026/10-12/0_1.png");
  });

  it("元のファイル名は変えない", () => {
    expect(buildImagePath("2026-10-12", "IMG_1234.jpg")).toBe("2026/10-12/IMG_1234.jpg");
  });

  it("日本語のファイル名もそのまま通す", () => {
    expect(buildImagePath("2026-01-05", "夏の海.png")).toBe("2026/01-05/夏の海.png");
  });

  it("月日は0埋めのまま使う", () => {
    expect(buildImagePath("2026-01-05", "a.png")).toBe("2026/01-05/a.png");
  });

  // date がまだ書かれていないことがある。//a.png のような壊れたパスを作らない
  it.each(["", "   ", "2026/10/12", "2026-10", "きょう", "20261012"])(
    "YYYY-MM-DD でなければフォルダを付けない（%s）",
    (date) => {
      expect(buildImagePath(date, "a.png")).toBe("a.png");
    }
  );

  it("ファイル名が空なら空のまま返す", () => {
    expect(buildImagePath("2026-10-12", "")).toBe("");
  });

  // 二重に付けると 2026/10-12/2026/10-12/a.png になる
  it("すでにフォルダが付いていれば付け直さない", () => {
    expect(buildImagePath("2026-10-12", "2026/10-12/a.png")).toBe("2026/10-12/a.png");
  });

  it("別のフォルダが付いていればそれを尊重する", () => {
    expect(buildImagePath("2026-10-12", "shared/logo.png")).toBe("shared/logo.png");
  });

  it("前後の空白を落とす", () => {
    expect(buildImagePath("  2026-10-12  ", "  a.png  ")).toBe("2026/10-12/a.png");
  });
});

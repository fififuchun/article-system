import { describe, it, expect } from "vitest";
import { resolveImageSrc } from "./resolveImageSrc";

describe("resolveImageSrc", () => {
  it.each([
    "http://example.com/a.webp",
    "https://example.com/a.webp",
    "//example.com/a.webp",
  ])("絶対URL %s はそのまま返す", (src) => {
    expect(resolveImageSrc(src, "/imgs/")).toBe(src);
  });

  // spec §9: ドロップした画像は blob URL でプレビューに即反映する
  it.each(["blob:http://localhost:5173/abc-123", "data:image/png;base64,iVBORw0KGgo="])(
    "ブラウザ内の一時URL %s はそのまま返す",
    (src) => {
      expect(resolveImageSrc(src, "/imgs/")).toBe(src);
    }
  );

  it("相対パスには imageBasePath を前置する", () => {
    expect(resolveImageSrc("art_0.webp", "/imgs/")).toBe("/imgs/art_0.webp");
  });

  it("先頭以外に http を含む相対パスは素通ししない", () => {
    expect(resolveImageSrc("my-http-image.webp", "/imgs/")).toBe("/imgs/my-http-image.webp");
  });

  it("サブディレクトリ付きの相対パスにも前置する", () => {
    expect(resolveImageSrc("2026/a.webp", "/imgs/")).toBe("/imgs/2026/a.webp");
  });

  it("空文字には imageBasePath だけを返す", () => {
    expect(resolveImageSrc("", "/imgs/")).toBe("/imgs/");
  });

  it("imageBasePath が空なら相対パスをそのまま返す", () => {
    expect(resolveImageSrc("art_0.webp", "")).toBe("art_0.webp");
  });
});

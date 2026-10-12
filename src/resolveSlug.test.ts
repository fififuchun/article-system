import { describe, it, expect } from "vitest";
import { resolveSlug } from "./resolveSlug";

describe("resolveSlug", () => {
  it("フロントマターの slug を優先する", () => {
    expect(resolveSlug("2026-08-23-夏の更新.md", "summer")).toBe("summer");
  });

  it("slug が無ければファイル名から拡張子を除く", () => {
    expect(resolveSlug("2026-08-23-夏の更新.md")).toBe("2026-08-23-夏の更新");
  });

  it("slug が空文字ならファイル名を使う", () => {
    expect(resolveSlug("2026-08-23-a.md", "")).toBe("2026-08-23-a");
  });

  // 「slug: 」と書いて放置されることがある
  it("slug が空白だけならファイル名を使う", () => {
    expect(resolveSlug("2026-08-23-a.md", "   ")).toBe("2026-08-23-a");
  });

  it("前後の空白を落とす", () => {
    expect(resolveSlug("a.md", "  summer  ")).toBe("summer");
  });

  it(".md 以外の拡張子は落とさない", () => {
    expect(resolveSlug("a.markdown")).toBe("a.markdown");
  });

  it("名前の途中の .md は落とさない", () => {
    expect(resolveSlug("a.md.md")).toBe("a.md");
  });
});

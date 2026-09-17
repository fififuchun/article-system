import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

/** ブロックを開くセレクタ行を集める（@media などのアットルールは除く） */
function selectors(source: string): string[] {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith("{") && !line.startsWith("@"))
    .map((line) => line.slice(0, -1).trim())
    .filter((line) => line.length > 0);
}

describe("styles.css", () => {
  // spec §10 ★重要: 詳細度が同点だと定義順で勝敗が決まり、
  // Vite のコード分割や HMR で順序が変わりうる
  it("すべてのセレクタが :where() で包まれている", () => {
    const bare = selectors(css).filter((selector) => !selector.includes(":where("));

    expect(bare).toEqual([]);
  });

  it("セレクタが1つ以上ある", () => {
    expect(selectors(css).length).toBeGreaterThan(0);
  });

  it("CSS変数を as- 接頭辞で定義している", () => {
    const variables = css.match(/--[a-z-]+(?=\s*:)/g) ?? [];

    expect(variables.length).toBeGreaterThan(0);
    expect(variables.filter((name) => !name.startsWith("--as-"))).toEqual([]);
  });
});

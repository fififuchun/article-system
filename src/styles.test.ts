import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { specificity, splitSelectorList, format } from "./specificity";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

/** ブロックを開くセレクタ行を集める（@media などのアットルールは除く） */
function selectors(source: string): string[] {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith("{") && !line.startsWith("@"))
    .map((line) => line.slice(0, -1).trim())
    .filter((line) => line.length > 0)
    .flatMap(splitSelectorList);
}

/**
 * 変数を定義するブロックだけは `html body` を前置しません（spec §10）。
 *
 * `:root` は `html` そのものなので `html body` の子孫になりません。変数は
 * preflight と名前が衝突しないため、詳細度を上げる必要もありません。
 */
const VARIABLES_ONLY = ":where(:root)";

describe("styles.css — 詳細度の不変条件（spec §10 ★重要）", () => {
  /*
   * 条件は2つあります。どちらも「読み込み順に関係なく」成立させるためです。
   * 順序に頼ると Vite のコード分割や HMR で勝敗が変わります。
   */

  // 1. 利用側が classNames で渡したクラス（0.1.0）に必ず負ける
  it("クラス相当の桁が0（利用側のクラスに必ず負ける）", () => {
    const offenders = selectors(css)
      .map((selector) => ({ selector, spec: specificity(selector) }))
      .filter(({ spec }) => spec.a > 0 || spec.b > 0)
      .map(({ selector, spec }) => `${selector} → ${format(spec)}`);

    expect(offenders).toEqual([]);
  });

  // 2. Tailwind の preflight など、要素1つのリセット（0.0.1）に必ず勝つ
  it("型セレクタが2つ以上（要素リセットに必ず勝つ）", () => {
    const offenders = selectors(css)
      .filter((selector) => selector !== VARIABLES_ONLY)
      .map((selector) => ({ selector, spec: specificity(selector) }))
      .filter(({ spec }) => spec.c < 2)
      .map(({ selector, spec }) => `${selector} → ${format(spec)}`);

    expect(offenders).toEqual([]);
  });

  // 条件2の唯一の例外。増やすときは理由を spec に書く
  it("例外は変数の定義1件だけ", () => {
    const exceptions = selectors(css).filter(
      (selector) => specificity(selector).c < 2
    );

    expect(exceptions).toEqual([VARIABLES_ONLY]);
  });

  it("セレクタが1つ以上ある", () => {
    expect(selectors(css).length).toBeGreaterThan(0);
  });
});

describe("styles.css — その他", () => {
  it("CSS変数を as- 接頭辞で定義している", () => {
    const variables = css.match(/--[a-z-]+(?=\s*:)/g) ?? [];

    expect(variables.length).toBeGreaterThan(0);
    expect(variables.filter((name) => !name.startsWith("--as-"))).toEqual([]);
  });

  // v3 は @layer を自分の機能として奪っており、書くとビルドが止まる（spec §10）
  it("層なし版に @layer を書かない", () => {
    expect(css).not.toContain("@layer");
  });
});

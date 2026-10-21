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

// 宣言と README がずれると、どちらが本当か分からなくなる
describe("browserslist", () => {
  const pkg = JSON.parse(
    readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")
  ) as { browserslist: string[] };
  const readme = readFileSync(
    fileURLToPath(new URL("../README.md", import.meta.url)),
    "utf8"
  );

  it("宣言がある", () => {
    expect(pkg.browserslist.length).toBeGreaterThan(0);
  });

  it.each([["chrome"], ["edge"], ["safari"], ["firefox"]])(
    "%s を宣言している",
    (name) => {
      expect(pkg.browserslist.some((entry) => entry.startsWith(name))).toBe(true);
    }
  );

  // 例: "safari >= 15.4" → README に "Safari 15.4" が出てくること
  it("宣言した版が README にも書かれている", () => {
    const missing = pkg.browserslist
      .map((entry) => entry.split(/\s*>=\s*/))
      .map(([name, version]) => {
        const label = name[0].toUpperCase() + name.slice(1);
        return readme.includes(`${label} ${version}`) ? null : `${label} ${version}`;
      })
      .filter((item): item is string => item !== null);

    expect(missing).toEqual([]);
  });
});

/*
 * spec §10: 詳細度が足りていても、**元から設定していない**プロパティは
 * preflight が消したままになる。v0.5.0 でリンクとリストが実際に崩れた。
 * 「preflight が消すもののうち、復元が必要なもの」を表で固定する。
 */
describe("styles.css — preflight が消すものの復元", () => {
  /** `html body :where(セレクタ) {` の宣言ブロックを取り出す */
  function block(selector: string): string | null {
    const open = `html body :where(${selector}) {`;
    const start = css.indexOf(open);
    if (start === -1) return null;
    const end = css.indexOf("\n}", start);
    return css.slice(start + open.length, end);
  }

  const MUST_RESTORE: [string, string[]][] = [
    // ol, ul, menu { list-style: none }
    [".as-article ul", ["list-style"]],
    [".as-article ol", ["list-style"]],
    // a { color: inherit; text-decoration: inherit }
    [".as-article a", ["color", "text-decoration"]],
    [".as-studio-login a", ["color", "text-decoration"]],
    // blockquote, ..., hr, ..., p, pre { margin: 0 }
    [".as-article hr", ["margin"]],
  ];

  it.each(MUST_RESTORE)("%s が %s を指定している", (selector, props) => {
    const found = block(selector);

    expect(found, `${selector} のルールが無い`).not.toBeNull();
    const missing = props.filter((prop) => !new RegExp(`\\b${prop}\\s*:`).test(found!));
    expect(missing).toEqual([]);
  });

  // 入れ子のリストはブラウザ既定（disc → circle → square）に合わせる
  it("入れ子の ul でマーカーが変わる", () => {
    expect(block(".as-article li > ul")).not.toBeNull();
    expect(block(".as-article li li > ul")).not.toBeNull();
  });

  // リンクの色は変数で差し替えられる
  it("リンクの色を変数にしている", () => {
    expect(css).toContain("--as-color-link");
    expect(block(".as-article a")).toContain("var(--as-color-link)");
  });

  // タスクリストはマーカーを出さない。上の指定より後に書く必要がある
  it("タスクリストのマーカー消しが後に来る", () => {
    const lists = css.indexOf("html body :where(.as-article ul) {");
    const task = css.indexOf('html body :where(.as-article li:has(> input[type="checkbox"])) {');

    expect(lists).toBeGreaterThan(-1);
    expect(task).toBeGreaterThan(lists);
  });
});

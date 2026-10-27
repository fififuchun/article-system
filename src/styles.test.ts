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
 * 変数だけを宣言するブロックは `html body` を前置しません（spec §10）。
 *
 * 置き場所が `:root`（= `html` 自身）なので `html body` の子孫になりません。
 * そして **preflight は `--as-*` をリセットしません**。詳細度を上げる理由が
 * どちらの意味でもありません。
 *
 * 宣言が全部カスタムプロパティのブロックを、ファイルから機械的に拾います。
 */
function variablesOnlySelectors(source: string): string[] {
  const found: string[] = [];
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");

  for (const match of text.matchAll(/([^{}@\n][^{}]*)\{([^{}]*)\}/g)) {
    const selector = match[1].trim();
    const declarations = match[2]
      .split(";")
      .map((line) => line.trim())
      .filter((line) => line.includes(":"));

    if (declarations.length === 0) continue;
    if (declarations.every((line) => line.startsWith("--"))) found.push(selector);
  }

  return [...new Set(found)];
}

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
    const exempt = new Set(variablesOnlySelectors(css));
    const offenders = selectors(css)
      .filter((selector) => !exempt.has(selector))
      .map((selector) => ({ selector, spec: specificity(selector) }))
      .filter(({ spec }) => spec.c < 2)
      .map(({ selector, spec }) => `${selector} → ${format(spec)}`);

    expect(offenders).toEqual([]);
  });

  // 条件2を外せるのは、変数だけを宣言しているブロックに限る
  it("例外は変数だけのブロックに限られる", () => {
    const exempt = new Set(variablesOnlySelectors(css));
    const exceptions = selectors(css).filter(
      (selector) => specificity(selector).c < 2
    );

    expect(exceptions.filter((selector) => !exempt.has(selector))).toEqual([]);
    expect(exceptions.length).toBeGreaterThan(0);
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

/*
 * spec §9: 幅 390px で Studio が 409px に広がり、横スクロールが出た。
 * 原因は2つで、どちらも「中身の最小幅がレイアウトを広げる」こと。
 */
describe("styles.css — 狭い画面で横にはみ出さない", () => {
  function block(selector: string, from = 0): string | null {
    const open = `html body :where(${selector}) {`;
    const start = css.indexOf(open, from);
    if (start === -1) return null;
    return css.slice(start + open.length, css.indexOf("\n", start) + 1 + 400);
  }

  /*
   * 素の `1fr` は `minmax(auto, 1fr)` と同じで、中身の最小幅でトラックが
   * 広がります。`fr` を使うトラックは必ず `minmax()` で下限を明示します
   * （カード一覧の `minmax(15rem, 1fr)` のように、0 以外が正しい場所もある）。
   */
  it("列の fr は minmax で下限を明示している", () => {
    // 行（grid-template-rows）は対象外。中身に合わせて伸び、縦は
    // スクロールで逃げられる。minmax(0, ...) にすると中身がはみ出す
    const columns = css.match(/grid-template-columns:[^;]+;/g) ?? [];
    const bare = columns.filter((line) =>
      line.replace(/minmax\([^)]*\)/g, "").includes("fr")
    );

    expect(columns.length).toBeGreaterThan(0);
    expect(bare).toEqual([]);
  });

  // グリッドの子は min-width: auto が既定で、中身より小さくならない
  it.each([
    ".as-studio-actions",
    ".as-studio-tabs",
    ".as-studio-editor",
    ".as-studio-preview",
  ])("%s に min-width: 0 がある", (selector) => {
    expect(block(selector)).toContain("min-width: 0");
  });

  // 操作帯のボタンは nowrap で縮まないため、入らなければ行を折る。
  // 640px より上でも操作帯は半分の幅しかないので、狭い画面専用にしない
  it("操作帯が折り返せる", () => {
    expect(block(".as-studio-actions")).toContain("flex-wrap: wrap");
  });
});

/*
 * spec §10 テーマ: 装飾を変数に出した。**既定値は従来の見た目をそのまま
 * 移したもの**で、何も指定しなければ1ピクセルも変わらない。変数に出す
 * ついでに値を変えてしまうと、既存利用者の見た目が黙って動く。
 */
describe("styles.css — テーマの変数", () => {
  /** `:root` に宣言された変数の既定値 */
  function defaultOf(name: string): string | null {
    const match = css.match(new RegExp(`\\n\\s+${name}:\\s*([^;]+);`));
    return match ? match[1].trim() : null;
  }

  // 変数に出す前に書かれていた値
  const DEFAULTS: [string, string][] = [
    ["--as-heading-marker", "4px solid var(--as-color-accent)"],
    ["--as-date-divider", "1px solid var(--as-color-border)"],
    ["--as-footer-divider", "1px solid var(--as-color-border)"],
    ["--as-quote-marker", "4px solid var(--as-color-border)"],
    ["--as-table-border", "1px solid var(--as-color-border)"],
    ["--as-divider", "1px solid var(--as-color-border)"],
    ["--as-article-padding", "var(--as-space-xl)"],
  ];

  it.each(DEFAULTS)("%s の既定値が従来と同じ", (name, value) => {
    expect(defaultOf(name)).toBe(value);
  });

  // 変数に出したのに、使う側が直書きのままだとテーマが効かない
  it.each([
    ["--as-heading-marker", ".as-heading"],
    ["--as-date-divider", ".as-date"],
    ["--as-footer-divider", ".as-footer"],
    ["--as-quote-marker", ".as-article blockquote"],
    ["--as-table-border", ".as-article th, .as-article td"],
    ["--as-divider", ".as-article hr"],
    ["--as-article-padding", ".as-article"],
  ])("%s を %s が使っている", (name, selector) => {
    const open = `html body :where(${selector}) {`;
    const start = css.indexOf(open);

    expect(start, `${selector} のルールが無い`).toBeGreaterThan(-1);
    expect(css.slice(start, css.indexOf("\n}", start))).toContain(`var(${name})`);
  });

  /*
   * 狭い画面の余白は、要素ではなく変数を書き換える。要素に書くと
   * テーマの指定（`:root`）より近い位置になり、テーマが効かなくなる
   */
  it("狭い画面でも記事の余白が変数で決まる", () => {
    const narrow = css.slice(css.indexOf("@media (max-width: 40rem)"));

    expect(narrow).toContain("--as-article-padding:");
    expect(narrow).not.toMatch(/:where\(\.as-article\) \{\s*padding:/);
  });
});

// spec §10 テーマ: テーマ用の変数で編集画面の見た目まで動いてはいけない
describe("styles.css — テーマと Studio の画面を分ける", () => {
  /** その変数を使っているセレクタ */
  function usedBy(name: string): string[] {
    const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const found: string[] = [];

    for (const match of text.matchAll(/([^{}@\n][^{}]*)\{([^{}]*)\}/g)) {
      if (new RegExp(`var\\(${name}[,)]`).test(match[2])) found.push(match[1].trim());
    }

    return found;
  }

  const THEME_VARIABLES = [
    "--as-radius",
    "--as-radius-sm",
    "--as-shadow-card",
    "--as-heading-marker",
    "--as-date-divider",
    "--as-footer-divider",
    "--as-quote-marker",
    "--as-table-border",
    "--as-divider",
    "--as-article-padding",
  ];

  it.each(THEME_VARIABLES)("%s を Studio の画面部分が使っていない", (name) => {
    const chrome = usedBy(name).filter(
      (selector) => selector.includes(".as-studio") && !selector.includes(".as-article")
    );

    expect(chrome).toEqual([]);
  });

  it("Studio の画面には専用の角丸がある", () => {
    expect(usedBy("--as-studio-radius").length).toBeGreaterThan(0);
  });
});

/*
 * spec §10 テーマ: 作り置きのテーマは styles.css の中に入れる（ファイルを
 * 増やさない）。`<html data-as-theme="...">` で切り替える
 */
describe("styles.css — 作り置きのテーマ", () => {
  const MINIMAL = ':where([data-as-theme="minimal"])';

  it("minimal がある", () => {
    expect(css).toContain(MINIMAL);
  });

  // 詳細度0なので、@media の中の変数書き換えより後に来ないと負ける
  it("テーマは @media より後ろにある", () => {
    expect(css.indexOf(MINIMAL)).toBeGreaterThan(css.lastIndexOf("@media"));
  });

  // 利用側の :root（0,1,0）に必ず負ける必要がある（spec §10 条件1）
  it("テーマのセレクタもクラス相当が0", () => {
    expect(specificity(MINIMAL).b).toBe(0);
  });

  it("装飾を外している", () => {
    const block = css.slice(css.indexOf(MINIMAL), css.indexOf("\n}", css.indexOf(MINIMAL)));

    for (const name of [
      "--as-heading-marker",
      "--as-date-divider",
      "--as-footer-divider",
      "--as-shadow-card",
      "--as-radius",
    ]) {
      expect(block, `${name} が無い`).toContain(name);
    }
  });

  // 内容を読むのに必要なものは残す。本文の余白を 0 にすると、文字が
  // 白い箱の端に貼り付いて読めなくなる
  it.each([
    "--as-table-border",
    "--as-quote-marker",
    "--as-divider",
    "--as-article-padding",
  ])(
    "%s は外さない",
    (name) => {
      const block = css.slice(css.indexOf(MINIMAL), css.indexOf("\n}", css.indexOf(MINIMAL)));

      expect(block).not.toContain(name);
    }
  );

  // 色はテーマの担当外。変えると Studio のタブやボタンまで動く
  it("色を変えない", () => {
    const block = css.slice(css.indexOf(MINIMAL), css.indexOf("\n}", css.indexOf(MINIMAL)));

    expect(block).not.toContain("--as-color-");
  });
});

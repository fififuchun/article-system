/**
 * CSS の版の取り違えを知らせる（spec §10）。
 *
 * Tailwind v4 は自分の CSS をすべてカスケードレイヤーに入れます。層に入って
 * いない CSS は層の中に必ず勝つため、v4 のサイトで層なし版（`styles.css`）を
 * 読むと、**利用側が `classNames` で渡したクラスがライブラリに負けます**。
 *
 * エラーも例外も出ず、渡したクラスが黙って無視されるだけなので、原因を
 * 探すのに時間がかかります。実行時に気づけるようにします。
 *
 * **`src/index.ts` からは公開しません。** 警告が意味を持つのはライブラリの
 * CSS を読み込んでいるときだけで、それは `ArticleDetail` / `ArticleList` を
 * 使っているときです。どちらも自分で呼ぶので、利用側に呼ぶ手段は要りません。
 */

/** 読み込まれている CSS の版。`--as-stylesheet` の値で見分ける */
export type StylesheetKind = "plain" | "layer" | "unknown";

export const WARNING =
  "[article-system] カスケードレイヤー（Tailwind v4 など）が使われていますが、" +
  "層なしの styles.css が読み込まれています。\n" +
  "このままでは classNames で渡したクラスがライブラリに負けて効きません。\n" +
  '  import "@fififuchun/article-system/styles.layer.css";\n' +
  "に読み替えてください（両方を読み込まないでください）。詳しくは spec §10。";

/**
 * 本物のカスケードレイヤーが使われているか（spec §10）。
 *
 * `base` と `utilities` の両方があることを条件にします。Tailwind v4 は
 * `theme, base, components, utilities` を宣言します。**v3 は本物の層を
 * 一切出さない**ため、v3 では成立しません。
 *
 * 利用側が独自に `@layer base, components` だけを使っている場合も成立
 * させません。誤検出するより、気づけないほうを選びます。
 */
export function usesCascadeLayers(names: Iterable<string>): boolean {
  const seen = new Set(names);
  return seen.has("base") && seen.has("utilities");
}

/** 警告が必要か。版が分からないときは黙る（CSS 自体が未読込の場合など） */
export function needsLayerStylesheet(layered: boolean, kind: StylesheetKind): boolean {
  return layered && kind === "plain";
}

/** `@layer` の名前を集める。宣言（nameList）とブロック（name）の両方を見る */
export function collectLayerNames(sheets: ArrayLike<CSSStyleSheet>): string[] {
  const names: string[] = [];

  for (let i = 0; i < sheets.length; i += 1) {
    let rules: CSSRuleList;
    try {
      // 別オリジンのスタイルシートは読めず例外になる
      rules = sheets[i].cssRules;
    } catch {
      continue;
    }

    for (let j = 0; j < rules.length; j += 1) {
      const rule = rules[j] as { nameList?: unknown; name?: unknown };

      if (Array.isArray(rule.nameList)) {
        names.push(...rule.nameList.map(String));
      } else if (typeof rule.name === "string" && rule.name !== "") {
        names.push(rule.name);
      }
    }
  }

  return names;
}

/** 読み込まれている版を調べる */
export function readStylesheetKind(): StylesheetKind {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--as-stylesheet")
    .trim();

  return value === "layer" || value === "plain" ? value : "unknown";
}

/** 1ページに1回だけ調べる。CSS は React が動く前に読み込まれている */
let checked = false;

/** 取り違えていれば1回だけ警告する。ブラウザ以外では何もしない */
export function warnStylesheetMismatch(): void {
  if (checked || typeof document === "undefined") return;
  checked = true;

  try {
    const layered = usesCascadeLayers(collectLayerNames(document.styleSheets));
    if (needsLayerStylesheet(layered, readStylesheetKind())) {
      console.warn(WARNING);
    }
  } catch {
    // 調べられない環境では黙る
  }
}

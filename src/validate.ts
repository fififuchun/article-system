import { levenshtein } from "./levenshtein";
import { parseFrontmatter } from "./parser";
import type { Article } from "./types";

export interface Issue {
  level: "error";
  field?: string;
  message: string;
}

export interface ValidateContext {
  /** ファイル名衝突の検出に使う既存記事 */
  articles?: Article[];
  /** 検証対象のファイル名 */
  filename?: string;
}

/** フロントマターに必ず必要な項目（spec §3） */
const REQUIRED_FIELDS = ["title", "date", "latestUpdate", "staff", "thumbnail"] as const;

/** 書いてもよい項目。無くてもよいが、typo は拾いたい（spec §3 §18） */
const OPTIONAL_FIELDS = ["slug", "description"] as const;

/** 既知の項目。これ以外は typo の候補として照合する */
const KNOWN_FIELDS: readonly string[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

/**
 * typo と見なす編集距離の上限。
 * spec §6 が例に挙げる lastUpdate → latestUpdate がちょうど 2 のため、
 * この例を拾える最小値として 2 を採用する。
 */
const TYPO_MAX_DISTANCE = 2;

/** YYYY-MM-DD で書かれていなければならない項目（spec §3） */
const DATE_FIELDS = ["date", "latestUpdate"] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** URL のパスとして成立しない文字（spec §3）。`/` はパスを割り、`?` `#` は以降を切る */
const SLUG_FORBIDDEN = /[\/?#\s]/;

/**
 * 値が引用符で囲まれているか。
 * YAML ではないため引用符は外されず、そのまま値に入ってしまう（spec §3）。
 */
function isQuoted(value: string): boolean {
  if (value.length < 2) return false;
  const head = value[0];
  const tail = value[value.length - 1];
  return (head === '"' || head === "'") && head === tail;
}

/**
 * md の文字列を検証して問題の一覧を返す。
 * 問題が無ければ空配列を返す。例外は投げない。
 */
export function validateArticle(
  raw: string,
  context: ValidateContext = {}
): Issue[] {
  const { data, content } = parseFrontmatter(raw);

  // パースに失敗すると content には raw がそのまま返る（spec §3）。
  // --- で始まっているのに失敗しているなら、閉じ忘れが原因。
  if (content === raw && raw.startsWith("---")) {
    return [
      {
        level: "error",
        message:
          "フロントマターが --- で閉じられていません。閉じないと全文が本文として扱われます。",
      },
    ];
  }

  const issues: Issue[] = [];

  for (const field of REQUIRED_FIELDS) {
    // parseFrontmatter は値をトリム済みだが、キー自体が無い場合も同じ扱いにする
    if ((data[field] ?? "").trim() === "") {
      issues.push({
        level: "error",
        field,
        message: `${field} が入力されていません。`,
      });
    }
  }

  for (const [field, value] of Object.entries(data)) {
    if (isQuoted(value)) {
      issues.push({
        level: "error",
        field,
        message: `${field} の値が引用符で囲まれています。引用符は値の一部として扱われるため外してください。現在の値: ${value}`,
      });
    }
  }

  for (const field of DATE_FIELDS) {
    const value = (data[field] ?? "").trim();
    // 欠落・引用符は上で報告済み。同じ問題を二重に出さない
    if (value === "" || isQuoted(value)) continue;

    if (!DATE_PATTERN.test(value)) {
      issues.push({
        level: "error",
        field,
        message: `${field} は YYYY-MM-DD の形式で書いてください（例: 2026-08-23）。現在の値: ${value}`,
      });
    }
  }

  for (const field of Object.keys(data)) {
    if (KNOWN_FIELDS.includes(field)) continue;

    let nearest = "";
    let nearestDistance = Infinity;

    for (const known of KNOWN_FIELDS) {
      const distance = levenshtein(field, known);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = known;
      }
    }

    // 遠いキーは利用側が独自に足したものとして黙って通す
    if (nearestDistance <= TYPO_MAX_DISTANCE) {
      issues.push({
        level: "error",
        field,
        message: `${field} は既知の項目にありません。${nearest} の誤りではありませんか。`,
      });
    }
  }

  // 形式が正しい日付が2つ揃ったときだけ前後関係を見る。
  // YYYY-MM-DD は辞書順と時系列順が一致するため文字列比較でよい（spec §5）
  const date = (data.date ?? "").trim();
  const latestUpdate = (data.latestUpdate ?? "").trim();

  if (
    DATE_PATTERN.test(date) &&
    DATE_PATTERN.test(latestUpdate) &&
    latestUpdate < date
  ) {
    issues.push({
      level: "error",
      field: "latestUpdate",
      message: `latestUpdate (${latestUpdate}) が date (${date}) より前になっています。最終編集日は公開日以降にしてください。`,
    });
  }

  // slug は URL のパスになる。成立しない値はリンクが切れるので止める（spec §3）。
  // 任意の項目なので、書いていなければ何も言わない
  const slug = (data.slug ?? "").trim();

  if (slug !== "" && !isQuoted(slug)) {
    if (SLUG_FORBIDDEN.test(slug)) {
      issues.push({
        level: "error",
        field: "slug",
        message: `slug に URL で使えない文字が含まれています（/ ? # と空白）。現在の値: ${slug}`,
      });
    } else if (slug.startsWith(".") || slug.endsWith(".")) {
      // "." や ".." は相対パスとして解釈され、別の場所を指す
      issues.push({
        level: "error",
        field: "slug",
        message: `slug の先頭と末尾にドットは使えません。相対パスとして扱われます。現在の値: ${slug}`,
      });
    }
  }

  // 同名のファイルを書き出すと既存記事が上書きされて消える（spec §6）
  const { articles, filename } = context;

  if (filename && articles?.some((article) => article.filename === filename)) {
    issues.push({
      level: "error",
      message: `ファイル名 ${filename} は既存の記事と重複しています。このまま保存すると既存の記事が上書きされて消えます。`,
    });
  }

  return issues;
}

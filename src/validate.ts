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

/** YYYY-MM-DD で書かれていなければならない項目（spec §3） */
const DATE_FIELDS = ["date", "latestUpdate"] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * md の文字列を検証して問題の一覧を返す。
 * 問題が無ければ空配列を返す。例外は投げない。
 */
export function validateArticle(
  raw: string,
  _context: ValidateContext = {}
): Issue[] {
  const { data } = parseFrontmatter(raw);
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

  for (const field of DATE_FIELDS) {
    const value = (data[field] ?? "").trim();
    // 欠落は上で報告済み。同じ問題を二重に出さない
    if (value === "") continue;

    if (!DATE_PATTERN.test(value)) {
      issues.push({
        level: "error",
        field,
        message: `${field} は YYYY-MM-DD の形式で書いてください（例: 2026-08-23）。現在の値: ${value}`,
      });
    }
  }

  return issues;
}

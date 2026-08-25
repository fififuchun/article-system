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

  return issues;
}

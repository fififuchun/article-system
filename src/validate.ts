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

/**
 * md の文字列を検証して問題の一覧を返す。
 * 問題が無ければ空配列を返す。例外は投げない。
 */
export function validateArticle(
  _raw: string,
  _context: ValidateContext = {}
): Issue[] {
  return [];
}

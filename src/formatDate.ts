export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * YYYY-MM-DD を年・月・日に分解する。
 *
 * **不正な日付を整形しません。** spec §9 は「形式違反はプレビューが壊れて見えることで
 * 気づける」ことを検知手段として使っているため、既定値に丸めるとその仕組みを潰します。
 */
export function formatDate(date: string): DateParts {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

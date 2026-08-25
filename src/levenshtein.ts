/**
 * 2つの文字列の編集距離を返す。
 * 置換・挿入・削除をそれぞれ1と数える（隣接文字の入れ替えは2）。
 * フィールド名の typo 検出に使う（spec §6）。
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // 直前の行だけを保持して 1 行ずつ更新する
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitution
      );
    }

    previous = current;
  }

  return previous[b.length];
}

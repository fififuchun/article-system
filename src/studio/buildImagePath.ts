/** 記事の date がこの形のときだけフォルダを作る（spec §3） */
const DATE_PATTERN = /^(\d{4})-(\d{2}-\d{2})$/;

/**
 * ドロップした画像の置き場所を決める（spec §9 画像）。
 *
 * `imageDir` は記事ごとではなく**全体で1つの名前空間**です。平らに置くと
 * `0_1.png` のような名前が別の記事と衝突し、コミットが止まります（spec §15）。
 * 記事の `date` から `YYYY/MM-DD/` を作って分けます。
 *
 * ```
 * buildImagePath("2026-10-12", "0_1.png")  →  "2026/10-12/0_1.png"
 * ```
 */
export function buildImagePath(date: string, filename: string): string {
  const name = filename.trim();
  if (name === "") return name;

  // 利用者が自分でフォルダを付けていれば尊重する。
  // 付け直すと 2026/10-12/2026/10-12/a.png になる
  if (name.includes("/")) return name;

  // date が空のままドロップされることがある。//a.png を作らない
  const parts = DATE_PATTERN.exec(date.trim());
  if (!parts) return name;

  const [, year, monthDay] = parts;

  return `${year}/${monthDay}/${name}`;
}

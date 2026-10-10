/** Date を YYYY-MM-DD にする。toISOString() は UTC に変換され日付がずれるため使わない */
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 空いている slug を選ぶ（spec §3）。
 *
 * 既定を日付にすることで、**何もしなくても URL に日本語が入りません**。
 * 同じ日に2本目を書くときだけ `-2` が付きます。
 */
function pickSlug(date: string, existingSlugs: string[]): string {
  const taken = new Set(existingSlugs);
  if (!taken.has(date)) return date;

  // 空いている最小の番号を選ぶ。飛んでいる番号も埋める
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${date}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * 新規記事の雛形 md を生成する（spec §9）。
 *
 * **title / staff / thumbnail に値を入れません。** 「記事タイトルをここに書く」の
 * ような文字列を置くと値が入っていることになり検証を通ってしまうため、
 * 雛形のまま公開される事故が起きます。
 */
export function buildTemplate(
  today: Date = new Date(),
  /** 既存記事の slug。同じ日の2本目に連番を付けるために使う */
  existingSlugs: string[] = []
): string {
  const date = toDateString(today);

  return [
    "---",
    "title:",
    `slug: ${pickSlug(date, existingSlugs)}`,
    `date: ${date}`,
    `latestUpdate: ${date}`,
    "staff:",
    "thumbnail:",
    "---",
    "",
    "## 見出し",
    "",
    "本文をここに書きます。",
    "",
  ].join("\n");
}

/** Date を YYYY-MM-DD にする。toISOString() は UTC に変換され日付がずれるため使わない */
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 新規記事の雛形 md を生成する（spec §9）。
 *
 * **title / staff / thumbnail に値を入れません。** 「記事タイトルをここに書く」の
 * ような文字列を置くと値が入っていることになり検証を通ってしまうため、
 * 雛形のまま公開される事故が起きます。
 */
export function buildTemplate(today: Date = new Date()): string {
  const date = toDateString(today);

  return [
    "---",
    "title:",
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

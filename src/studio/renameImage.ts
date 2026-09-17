/**
 * md の画像記法に書かれたファイル名を置き換える（spec §9）。
 *
 * **`](名前)` の形だけを対象にします。** 素朴に全文置換すると、本文に同じ
 * 文字列があるときに壊れます。リネームは1文字ずつ起きるため、途中の短い名前
 * （`a` など）で全文置換すると被害が大きくなります。
 *
 * **`thumbnail:` の値も追随させます。** 追随しないと、サムネイルに指定して
 * からリネームした場合に旧名だけが取り残され、存在確認に引っかかって本番
 * ダウンロードが止まります。
 */
export function renameImageInMarkdown(markdown: string, from: string, to: string): string {
  return markdown
    .split(`](${from})`)
    .join(`](${to})`)
    .split("\n")
    .map((line) => (isThumbnailOf(line, from) ? `thumbnail: ${to}` : line))
    .join("\n");
}

/** その行が指定した画像を指す thumbnail か */
function isThumbnailOf(line: string, name: string): boolean {
  const match = line.match(/^thumbnail:(.*)$/);
  return match !== null && match[1].trim() === name;
}

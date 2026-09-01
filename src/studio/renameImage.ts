/**
 * md の画像記法に書かれたファイル名を置き換える（spec §9）。
 *
 * **`](名前)` の形だけを対象にします。** 素朴に全文置換すると、本文に同じ
 * 文字列があるときに壊れます。リネームは1文字ずつ起きるため、途中の短い名前
 * （`a` など）で全文置換すると被害が大きくなります。
 */
export function renameImageInMarkdown(markdown: string, from: string, to: string): string {
  return markdown.split(`](${from})`).join(`](${to})`);
}

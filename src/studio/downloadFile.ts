/**
 * Blob をファイルとしてダウンロードさせる。
 *
 * jsdom には `URL.createObjectURL` が無いため、ここは自動テストの対象外です
 * （フェーズ6の方針）。デモでの目視確認で担保します。
 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  // Firefox は DOM に繋がっていない要素の click を無視する
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // 即座に revoke するとダウンロードが始まらないブラウザがあるため次のタスクに回す
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** md 文字列をファイルとしてダウンロードさせる */
export function downloadMarkdown(filename: string, markdown: string): void {
  // 日本語が化けないよう charset を明示する
  downloadBlob(filename, new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
}

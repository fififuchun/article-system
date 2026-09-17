/** ファイルシステムで使えない文字（spec §9） */
const FORBIDDEN = /[/\\:*?"<>|]/g;

/** タイトル部分の上限。長すぎるファイル名を避ける */
const MAX_TITLE_LENGTH = 50;

/**
 * タイトルをファイル名に使える形にする。
 * 日本語はそのまま許容し、除去も変換もしない（spec §9）。
 */
function sanitizeTitle(title: string): string {
  return title
    .replace(FORBIDDEN, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, MAX_TITLE_LENGTH)
    .replace(/-+$/, "");
}

/**
 * ダウンロードする md のファイル名を作る（spec §9）。
 *
 * `date` はフロントマターの値をそのまま使います。下書きは `_` を接頭に付け、
 * glob の `[!_]*.md` から外れるようにします（spec §4）。
 */
export function buildFilename(
  date: string,
  title: string,
  options: { draft?: boolean } = {}
): string {
  const safeTitle = sanitizeTitle(title);
  // 下書きは検証を通らないため title が空のまま出せてしまう
  const base = safeTitle ? `${date}-${safeTitle}` : date;

  return `${options.draft ? "_" : ""}${base}.md`;
}

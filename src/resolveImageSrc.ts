/**
 * http:// https:// とプロトコル相対の //、およびブラウザ内の一時URL。
 * blob: は Studio にドロップした画像のプレビューで使う（spec §9）。
 */
const ABSOLUTE_URL = /^(?:(?:https?:)?\/\/|blob:|data:)/;

/** ブラウザがそのまま解決できる src か（絶対URL・blob・data） */
export function isAbsoluteImageSrc(src: string): boolean {
  return ABSOLUTE_URL.test(src);
}

/**
 * 絶対URLはそのまま、相対パスには imageBasePath を前置する（spec §7-3）。
 * ArticleDetail と ArticleList の両方が同じ判定を使う。
 */
export function resolveImageSrc(src: string, imageBasePath: string): string {
  return isAbsoluteImageSrc(src) ? src : `${imageBasePath}${src}`;
}

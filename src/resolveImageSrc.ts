/** http:// https:// とプロトコル相対の // */
const ABSOLUTE_URL = /^(?:https?:)?\/\//;

/**
 * 絶対URLはそのまま、相対パスには imageBasePath を前置する（spec §7-3）。
 * ArticleDetail と ArticleList の両方が同じ判定を使う。
 */
export function resolveImageSrc(src: string, imageBasePath: string): string {
  return ABSOLUTE_URL.test(src) ? src : `${imageBasePath}${src}`;
}

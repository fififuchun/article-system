/**
 * ビルド時に走る部分だけをまとめたエントリ（spec §18）。
 *
 * `@fififuchun/article-system/vite` から読み込みます。**読者のバンドルには
 * 入りません。** `node:fs` を使うため、ブラウザ向けの入口とは分けています。
 */
export { articleOgTags } from "./articleOgTags";
export type { ArticleOgTagsOptions, ArticleOgTagsPlugin } from "./articleOgTags";

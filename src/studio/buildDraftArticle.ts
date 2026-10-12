import { parseFrontmatter } from "../parser";
import type { Article } from "../types";
import { buildFilename } from "./buildFilename";

/**
 * 編集中の md を `Article` に組み立てる。
 *
 * `ArticleDetail` / `ArticleList` にそのまま渡してプレビューするための形です。
 */
export function buildDraftArticle(raw: string): Article {
  const { data, content } = parseFrontmatter(raw);
  const date = data.date ?? "";
  const title = data.title ?? "";

  return {
    filename: buildFilename(date, title),
    // フロントマター優先、無ければファイル名から拡張子を除く（spec §3）
    slug: data.slug?.trim() || buildFilename(date, title).replace(/\.md$/, ""),
    title,
    date,
    latestUpdate: data.latestUpdate ?? "",
    staff: data.staff ?? "",
    thumbnail: data.thumbnail ?? "",
    description: data.description?.trim(),
    content,
  };
}

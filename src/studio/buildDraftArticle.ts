import { parseFrontmatter } from "../parser";
import type { Article } from "../types";
import { buildFilename } from "./buildFilename";

/**
 * 編集中の md を `Article` に組み立てる。
 *
 * `ArticleDetail` / `ArticleList` にそのまま渡してプレビューするための形です。
 * `id` は既存記事に混ぜて日付順に並べたときの位置で、spec §9 が言う
 * 「挿入位置から `id` の予告も出せます」を満たします。
 */
export function buildDraftArticle(raw: string, articles: Article[] = []): Article {
  const { data, content } = parseFrontmatter(raw);
  const date = data.date ?? "";
  const title = data.title ?? "";

  return {
    // date 昇順に並べたとき何番目に入るか。同じ日付の記事より後ろに付く
    id: articles.filter((article) => article.date <= date).length,
    filename: buildFilename(date, title),
    // フロントマター優先、無ければファイル名から拡張子を除く（spec §3）
    slug: data.slug?.trim() || buildFilename(date, title).replace(/\.md$/, ""),
    title,
    date,
    latestUpdate: data.latestUpdate ?? "",
    staff: data.staff ?? "",
    thumbnail: data.thumbnail ?? "",
    content,
  };
}

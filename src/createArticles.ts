import { parseFrontmatter } from "./parser";
import { resolveSlug } from "./resolveSlug";
import { validateArticle } from "./validate";
import type { Article } from "./types";

/**
 * 同じ slug の記事を見つけて知らせる（spec §3）。
 *
 * 例外は投げません。記事そのものは読めるため、サイトを壊すほどではない
 * と判断しています（spec §5）。ただし**片方は URL で辿れません**。
 */
function warnDuplicateSlugs(articles: Article[]): void {
  const bySlug = new Map<string, string[]>();

  for (const article of articles) {
    const files = bySlug.get(article.slug) ?? [];
    files.push(article.filename);
    bySlug.set(article.slug, files);
  }

  for (const [slug, files] of bySlug) {
    if (files.length < 2) continue;

    console.warn(
      `[article-system] slug "${slug}" が ${files.length} 件の記事で重複しています:\n` +
        files.map((file) => `  - ${file}`).join("\n") +
        `\nURL は1つしか指せないため、1件しか開けません。` +
        `フロントマターの slug を書き分けてください。`
    );
  }
}

export function createArticles(
  rawFiles: Record<string, string>
): Article[] {
  const articles = Object.entries(rawFiles)
    .map(([path, raw]) => {
      const filename = path.split("/").pop() ?? path;

      // glob パターンが誤っている証拠。本文はすでに配信済みで取り消せないため、
      // 壊れたサイトを警報として機能させる（spec §4）
      if (filename.startsWith("_")) {
        throw new Error(
          `[article-system] 下書きファイル "${filename}" がバンドルに含まれています。\n` +
            `本文が公開されています。import.meta.glob のパターンを\n` +
            `  "../articles/[!_]*.md"\n` +
            `に変更してください。`
        );
      }

      // 問題があっても停止はさせない。下書き混入と違い、記事が読めなくなるわけではない（spec §5）
      const issues = validateArticle(raw);
      if (issues.length > 0) {
        console.warn(
          `[article-system] ${filename} に問題があります:\n` +
            issues.map((issue) => `  - ${issue.message}`).join("\n")
        );
      }

      const { data, content } = parseFrontmatter(raw);
      return {
        filename,
        // 決め方は resolveSlug に1か所だけ置く。Vite プラグインも同じものを呼ぶ（spec §18）
        slug: resolveSlug(filename, data.slug),
        title: data.title ?? "",
        date: data.date ?? "",
        latestUpdate: data.latestUpdate ?? "",
        staff: data.staff ?? "",
        thumbnail: data.thumbnail ?? "",
        content,
      };
    })
    // YYYY-MM-DD は辞書順と時系列順が一致する。new Date() 比較だと不正な日付で
    // NaN が返り、sort の結果が仕様上保証されなくなる（spec §5）
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
;

  warnDuplicateSlugs(articles);

  return articles;
}

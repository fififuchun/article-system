import { parseFrontmatter } from "./parser";
import { validateArticle } from "./validate";
import type { Article } from "./types";

export function createArticles(
  rawFiles: Record<string, string>
): Article[] {
  return Object.entries(rawFiles)
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
        // フロントマター優先、無ければファイル名から拡張子を除く（spec §3）
        slug: data.slug?.trim() || filename.replace(/\.md$/, ""),
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
    .map((article, index) => ({ ...article, id: index }));
}

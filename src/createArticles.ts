import { parseFrontmatter } from "./parser";
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

      const { data, content } = parseFrontmatter(raw);
      return {
        filename,
        title: data.title ?? "",
        date: data.date ?? "",
        latestUpdate: data.latestUpdate ?? "",
        staff: data.staff ?? "",
        thumbnail: data.thumbnail ?? "",
        content,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((article, index) => ({ ...article, id: index }));
}

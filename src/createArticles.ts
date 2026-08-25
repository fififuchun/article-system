import { parseFrontmatter } from "./parser";
import type { Article } from "./types";

export function createArticles(
  rawFiles: Record<string, string>
): Article[] {
  return Object.entries(rawFiles)
    .map(([path, raw]) => {
      const { data, content } = parseFrontmatter(raw);
      return {
        filename: path.split("/").pop() ?? path,
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

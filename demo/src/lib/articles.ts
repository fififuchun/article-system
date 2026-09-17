import { createArticles } from "@fififuchun/article-system";

// [!_] は必須。下書きの中身がバンドルに埋め込まれるのを防ぐ（spec §4）
const rawFiles = import.meta.glob("../articles/[!_]*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const articles = createArticles(rawFiles);

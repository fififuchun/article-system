import { createArticles } from "@fififuchun/article-system";

const rawFiles = import.meta.glob("../articles/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const articles = createArticles(rawFiles);

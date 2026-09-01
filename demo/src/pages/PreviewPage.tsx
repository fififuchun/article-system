import { ArticleStudio } from "@fififuchun/article-system";
import { articles } from "../lib/articles";

export default function PreviewPage() {
  return (
    <ArticleStudio
      articles={articles}
      storageKey="article-system-demo"
      imageBasePath="https://placehold.co/800x400/e8e8e8/999999?text="
      dateLabel="最終更新日時"
    />
  );
}

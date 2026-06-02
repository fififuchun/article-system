import { useState } from "react";
import { parseFrontmatter } from "../parser";
import { ArticleDetail } from "./ArticleDetail";
import type { ArticleDetailClassNames, ArticlePreviewClassNames } from "../types";

interface Props {
  imageBasePath?: string;
  dateLabel?: string;
  classNames?: ArticlePreviewClassNames;
  articleClassNames?: ArticleDetailClassNames;
  defaultValue?: string;
}

export function ArticlePreview({
  imageBasePath = "/article_imgs/",
  dateLabel = "最終更新日時",
  classNames = {},
  articleClassNames = {},
  defaultValue = "",
}: Props) {
  const [raw, setRaw] = useState(defaultValue);

  const { data, content } = parseFrontmatter(raw);
  const article = {
    id: 0,
    title: data.title ?? "",
    date: data.date ?? "",
    latestUpdate: data.latestUpdate ?? "",
    staff: data.staff ?? "",
    thumbnail: data.thumbnail ?? "",
    content,
  };

  return (
    <div className={classNames.wrapper}>
      <div className={classNames.editorPane}>
        <textarea
          className={classNames.textarea}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          spellCheck={false}
        />
      </div>
      <div className={classNames.previewPane}>
        <ArticleDetail
          article={article}
          imageBasePath={imageBasePath}
          dateLabel={dateLabel}
          classNames={articleClassNames}
        />
      </div>
    </div>
  );
}

import { ArticlePreview } from "@fififuchun/article-system";

const SAMPLE = `---
title: 記事タイトルをここに書く
date: 2025-06-01
latestUpdate: 2025-06-01
staff: 担当者名
thumbnail: sample.webp
---

## 大見出し

ここに本文を書きます。マークダウンで記述でき、右側にリアルタイムでプレビューが表示されます。

### 小見出し

段落テキストが続きます。改行してもひとつの段落としてまとめられます。

![](sample.webp)

## 別のセクション

- リストも使えます
- remark-gfm により表なども対応しています
`;

export default function PreviewPage() {
  return (
    <ArticlePreview
      imageBasePath="https://placehold.co/800x400/e8e8e8/999999?text="
      dateLabel="最終更新日時"
      defaultValue={SAMPLE}
      classNames={{
        wrapper: "preview-wrapper",
        editorPane: "preview-editor-pane",
        textarea: "preview-textarea",
        previewPane: "preview-preview-pane",
      }}
      articleClassNames={{
        wrapper: "article-wrapper",
        dateYear: "article-date-year",
        dateDay: "article-date-day",
        title: "article-title",
        latestUpdate: "article-latest-update",
        thumbnail: "article-thumbnail",
        heading: "article-heading",
        subheading: "article-subheading",
        paragraph: "article-paragraph",
        image: "article-image",
        footer: "article-footer",
      }}
    />
  );
}

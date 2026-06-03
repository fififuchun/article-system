# @fififuchun/article-system

マークダウンファイルを置くだけで記事データを自動生成し、一覧・詳細表示コンポーネントを提供するライブラリです。  
スタイルはすべて利用側が指定します（ライブラリ自体はスタイルを持ちません）。

<br>
<br>

## 前提条件

- **Vite + React** プロジェクトであること（`import.meta.glob` というVite専用の記法を利用しています）
- **TypeScript** を使用していること
- **Node.js** がインストールされていること

<br>
<br>

## 導入手順

### 1. リポジトリをクローンしてビルドする

```bash
git clone https://github.com/fififuchun/article-system.git
cd article-system
npm install
npm run build
npm link
```

### 2. 利用側プロジェクトでリンクする

```bash
cd your-project
npm link @fififuchun/article-system
```

### 3. 記事フォルダを作成する

利用側プロジェクトに記事ファイル用のフォルダを作成します。

```
your-project/
└── src/
    └── articles/
        ├── 2025-06-01-first-post.md
        └── 2025-06-10-second-post.md
```

### 4. マークダウンファイルを作成する

各ファイルの先頭にフロントマターを記述します。

```markdown
---
title: 記事タイトル
date: 2025-06-01
latestUpdate: 2025-06-01
staff: 担当者名
thumbnail: art_0.webp
---

## 見出し

本文テキスト...

### 小見出し

段落テキスト...

![](art_0.webp)
```

| フィールド     | 型                   | 説明                         |
| -------------- | -------------------- | ---------------------------- |
| `title`        | string               | 記事タイトル                 |
| `date`         | string（YYYY-MM-DD） | 投稿日。並び順・IDに使われる |
| `latestUpdate` | string（YYYY-MM-DD） | 最終更新日                   |
| `staff`        | string               | 担当者名                     |
| `thumbnail`    | string               | サムネイル画像のファイル名   |

### 5. 記事データ生成ファイルを作成する

```ts
// src/lib/articles.ts
import { createArticles } from "@fififuchun/article-system";

const rawFiles = import.meta.glob("../articles/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const articles = createArticles(rawFiles);
```

> `import.meta.glob` はViteのビルド時処理のため、利用側プロジェクトに記述する必要があります。

### 6. 画像ファイルを配置する

```
your-project/
└── public/
    └── article_imgs/
        ├── art_0.webp
        └── art_1.webp
```

---

## コンポーネントの使い方

### `<ArticleList>` — 記事一覧

リンク要素は `renderLink` で利用側から注入します。使用しているルーターの `<Link>` や通常の `<a>` タグなど、どれでも渡せます。

```tsx
// src/pages/BlogList.tsx
import { ArticleList } from "@fififuchun/article-system";
import { articles } from "../lib/articles";
import { Link } from "react-router-dom"; // 使用しているルーターに合わせて変更してください

export default function BlogList() {
  return (
    <ArticleList
      articles={articles}
      imageBasePath="/article_imgs/"
      getArticleUrl={(article) => `/blog/${article.id}`}
      classNames={{
        grid: "blog-grid",
        card: "blog-card",
        cardImage: "blog-card-image",
        cardTitle: "blog-card-title",
        cardDate: "blog-card-date",
      }}
      renderLink={(url, children, key) => (
        <Link key={key} to={url}>
          {children}
        </Link>
      )}
    />
  );
}
```

### `<ArticleDetail>` — 記事詳細

URLの `:id` パラメータから記事を特定して渡します。`article.id` は `0` 始まりの連番です。

```tsx
// src/pages/BlogDetail.tsx
import { ArticleDetail } from "@fififuchun/article-system";
import { articles } from "../lib/articles";
import { useParams } from "react-router-dom"; // 使用しているルーターに合わせて変更してください

export default function BlogDetail() {
  const { id } = useParams();
  const article = articles[Number(id)];

  if (!article) return <p>記事が見つかりません</p>;

  return (
    <ArticleDetail
      article={article}
      imageBasePath="/article_imgs/"
      dateLabel="最終更新日時"
      classNames={{
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
```

### `<ArticlePreview>` — 執筆プレビュー（開発用）

マークダウンを入力しながら記事の仕上がりをリアルタイムで確認できます。

```tsx
// src/pages/BlogPreview.tsx
import { ArticlePreview } from "@fififuchun/article-system";

export default function BlogPreview() {
  return (
    <ArticlePreview
      imageBasePath="/article_imgs/"
      dateLabel="最終更新日時"
      classNames={{
        wrapper: "preview-wrapper",
        editorPane: "preview-editor",
        textarea: "preview-textarea",
        previewPane: "preview-output",
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
```

### ルーティング

上記3つのページをルーティングに登録します（React Router の例）。

```tsx
// src/App.tsx
import { Routes, Route } from "react-router-dom";
import BlogList from "./pages/BlogList";
import BlogDetail from "./pages/BlogDetail";
import BlogPreview from "./pages/BlogPreview";

export default function App() {
  return (
    <Routes>
      <Route path="/blog" element={<BlogList />} />
      <Route path="/blog/preview" element={<BlogPreview />} />
      {/* :id より前に定義する */}
      <Route path="/blog/:id" element={<BlogDetail />} />
    </Routes>
  );
}
```

<br>
<br>

## Article 型

```ts
interface Article {
  id: number; // 0始まり（古い順）
  title: string;
  date: string; // "YYYY-MM-DD"
  latestUpdate: string;
  staff: string;
  thumbnail: string; // ファイル名のみ（パスなし）
  content: string; // マークダウン本文
}
```

<br>
<br>

## 記事を追加するとき

```
src/articles/ に .md ファイルを追加するだけ
```

`createArticles` が自動でソート・ID採番するため、他のファイルを変更する必要はありません。

<br>
<br>

## ライブラリを更新するとき

```bash
cd article-system
# ソースを編集後
npm run build
```

`npm link` 中のプロジェクトに即反映されます。

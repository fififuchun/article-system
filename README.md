# @fififuchun/article-system

マークダウンファイルを置くだけで記事データを自動生成し、一覧・詳細表示コンポーネントを提供するライブラリです。  
スタイルはすべて利用側が指定します（ライブラリ自体はスタイルを持ちません）。

> **開発中のライブラリです。** 現在 v0.2 に向けた改修を進めており、執筆用の `ArticleStudio`、デフォルトCSSの同梱、下書き機能などが順次入ります。設計の確定版は [docs/spec.md](./docs/spec.md)、進捗は [docs/tasks.md](./docs/tasks.md) にあります。  
> **この README は今日時点で実際に動く内容だけを説明しています。**

<br>
<br>

## 前提条件

- **Vite + React** プロジェクトであること（`import.meta.glob` というVite専用の記法を利用しています）
- **TypeScript** を使用していること
- **React 18 以上**
- **Node.js** がインストールされていること

<br>
<br>

## 導入手順

### 1. インストールする

GitHub から直接インストールします。ビルド済みの `dist/` をリポジトリに含めているため、そのまま動きます。

```bash
npm i github:fififuchun/article-system
```

**バージョンはタグかコミットで固定することを強く推奨します。**

```bash
# タグで固定する（推奨）
npm i github:fififuchun/article-system#v0.2.0

# コミットハッシュで固定する
npm i github:fififuchun/article-system#b5e66ab
```

固定しないと `npm update` を実行したときに意図せず最新が入り、破壊的変更を含んでいた場合に利用側が壊れます。

> 現在このリポジトリにタグはまだ切られていません。当面はコミットハッシュで固定してください。

> **`npm link` は使わないでください。** ローカルのファイルシステム上のパスを指す仕組みのため、Vercel や Netlify のビルド環境には存在せず、**利用側プロジェクトをデプロイできなくなります**。`file:../` も同様です。

### 2. 記事フォルダを作成する

利用側プロジェクトに記事ファイル用のフォルダを作成します。

```
your-project/
└── src/
    └── articles/
        ├── 2025-06-01-first-post.md
        └── 2025-06-10-second-post.md
```

ファイル名は記事の識別に使われません。フォルダを見て分かりやすくするためのものです。実際に効くのはフロントマターの `date` です。

### 3. マークダウンファイルを作成する

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
| `latestUpdate` | string（YYYY-MM-DD） | 最終更新日。一覧カードに表示される |
| `staff`        | string               | 担当者名                     |
| `thumbnail`    | string               | サムネイル画像のファイル名   |

**すべて必須です。** 書き忘れると例外は出ませんが、画面に `0年undefined月undefined日` のような表示が出ます。

フロントマターは YAML ではなく自前のパーサで読んでいます。以下に注意してください。

| 記法 | 結果 |
| --- | --- |
| `title: 記事：その1` | ✅ 値の中のコロンは安全 |
| `title: "記事"` | ❌ **引用符が値に含まれたまま**になる。囲まないでください |
| `date: 2025/06/01` | ❌ ソートが壊れます。必ず `-` 区切りで |
| `tags: [a, b]` | ❌ 文字列として扱われます（配列になりません） |

### 4. 記事データ生成ファイルを作成する

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

### 5. 画像ファイルを配置する

```
your-project/
└── public/
    └── article_imgs/
        ├── art_0.webp
        └── art_1.webp
```

`thumbnail` や `![]()` にはファイル名だけを書き、パスは `imageBasePath` で指定します。単純な文字列連結のため、**外部URLの画像は現在使えません**。

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
      articles={[...articles].reverse()}
      imageBasePath="/article_imgs/"
      getArticleUrl={(article) => `/blog/${article.id}`}
      classNames={{
        grid: "blog-grid",
        card: "blog-card",
        cardImage: "blog-card-image",
        cardTitle: "blog-card-title",
        cardDate: "blog-card-date",
        cardDateIcon: "blog-card-date-icon",
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

> **`articles` は古い順に並んでいます。** 新しい記事を先頭にしたい場合は上記のように `[...articles].reverse()` を渡してください。`.reverse()` は破壊的なのでスプレッドでコピーしてから呼びます。`id` は保持されるので URL は壊れません。

カードに表示される日付は `latestUpdate` です。

`renderLink` に渡される第3引数の `key` を、返す要素に付けるのは利用側の責任です。付け忘れると React の key 警告が出ます。

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
        headerWrapper: "article-header",
        dateWrapper: "article-date",
        dateYear: "article-date-year",
        dateDay: "article-date-day",
        title: "article-title",
        latestUpdate: "article-latest-update",
        dateIcon: "article-date-icon",
        thumbnail: "article-thumbnail",
        heading: "article-heading",
        subheading: "article-subheading",
        subsubheading: "article-subsubheading",
        paragraph: "article-paragraph",
        image: "article-image",
        footer: "article-footer",
      }}
    />
  );
}
```

記事が見つからない場合のハンドリングはライブラリ側にありません。上記のように利用側でガードしてください。

#### マークダウンの対応状況

`classNames` でクラスを指定できるのは以下だけです。

| 記法 | 対応する `classNames` |
| --- | --- |
| `##` | `heading` |
| `###` | `subheading` |
| `####` | `subsubheading` |
| 段落 | `paragraph` |
| `![](file.webp)` | `image` |

リスト・表・引用・コードブロック・太字・リンク・`#`（h1）も動作しますが、**クラスは付きません**。スタイルを当てるには子孫セレクタを使ってください。

```css
.article-wrapper ul { … }
.article-wrapper table { … }
```

そのほかの挙動です。

- **単一改行が `<br>` になります**（`remark-breaks`）。マークダウン標準とは異なります
- **生の HTML は無効です**（`rehype-raw` 未導入）。記事経由の XSS は構造的に防がれています
- 表・取り消し線・タスクリストなどは `remark-gfm` により利用できます

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
      defaultValue={"---\ntitle: \ndate: \n---\n"}
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

入力内容は保存されません。**リロードすると消えます。** エディタで書いたものを貼って確認する使い方を想定しています。

`defaultValue` を渡さないと初期表示が `0年undefined月undefined日` になるため、上記のように雛形を渡すことを推奨します。

> このコンポーネントは v0.2 で `ArticleStudio` に置き換わる予定です（検証機能、画像のドラッグ&ドロップ、md のダウンロード、自動保存が入ります）。

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

## 記事の検証

`validateArticle` で、マークダウンの文字列に問題がないか確認できます。

```ts
import { validateArticle } from "@fififuchun/article-system";
import { articles } from "../lib/articles";

const issues = validateArticle(raw, {
  articles,              // ファイル名衝突の検出に使う（任意）
  filename: "2025-06-01-post.md",
});

if (issues.length > 0) {
  issues.forEach((issue) => console.warn(issue.message));
}
```

### 検出できる問題

| 検出内容 | 例 |
| --- | --- |
| 必須項目の欠落・空文字 | `latestUpdate` がない |
| キー名の typo | `lastUpdate` と書いた → 「`latestUpdate` の誤りでは」と提案 |
| 日付の形式違反 | `date: 2025/06/01` |
| 引用符付きの値 | `title: "記事"` |
| フロントマターの閉じ忘れ | `---` が片方だけ |
| 更新日が投稿日より前 | `latestUpdate` < `date` |
| ファイル名の衝突 | 既存記事と同名 |

### 戻り値

```ts
interface Issue {
  level: "error";
  field?: string;   // 問題のあるフィールド名
  message: string;  // 日本語の説明
}
```

問題がなければ空配列を返します。**例外は投げません。**

<br>
<br>

## Article 型

```ts
interface Article {
  id: number;          // 0始まり（古い順）
  filename: string;    // 拡張子付きファイル名
  title: string;
  date: string;        // "YYYY-MM-DD"
  latestUpdate: string;
  staff: string;
  thumbnail: string;   // ファイル名のみ（パスなし）
  content: string;     // マークダウン本文
}
```

`filename` は衝突検出などに使う参考情報です。**URL には使いません**（識別子は `id`）。

すべてのフィールドが必須の型になっていますが、`createArticles` はフロントマターに欠けている項目を空文字で埋めます。**型は「存在すること」しか保証せず、「空でないこと」は保証しません。**

<br>
<br>

## 記事を追加するとき

```
src/articles/ に .md ファイルを追加するだけ
```

`createArticles` が自動でソート・ID採番するため、他のファイルを変更する必要はありません。

> **注意：`id` は `date` 昇順の連番です。** 既存の記事より古い日付の記事を後から追加すると、それ以降の記事の `id` がすべてずれ、**公開済みのURLが別の記事を指すようになります**。新しい記事は既存より新しい日付で追加してください。

<br>
<br>

## ライブラリを更新するとき

```bash
cd article-system
# ソースを編集後
npm test          # テストが通ることを確認
npm run build     # dist/ を更新
git add . && git commit
```

**`dist/` はリポジトリにコミットしています。** GitHub から直接インストールする方式のため、ビルド成果物が入っていないと利用側で動きません。

`src/` を編集して `npm run build` を忘れると、GitHub 上のコードと配布物がズレたまま各プロジェクトに配られます。**コミット前に必ずビルドしてください。**

利用側に反映するには、対象プロジェクトで再インストールします。

```bash
cd your-project
npm i github:fififuchun/article-system#<新しいタグ or コミット>
```

<br>
<br>

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [docs/spec.md](./docs/spec.md) | v0.2 の実装仕様書（設計の確定版） |
| [docs/tasks.md](./docs/tasks.md) | 実装タスクリストと進捗 |
| [docs/findings.md](./docs/findings.md) | 既知の問題と制約 |
| [docs/architecture.md](./docs/architecture.md) | 内部構造とデータフロー |

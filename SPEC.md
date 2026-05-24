# @fififuchun/article-system 仕様書

マークダウンファイルを特定フォルダに置くだけで、自動的にWEB上に記事として表示されるシステム。  
スタイルはすべて利用側が指定する（ライブラリ自体はスタイルを持たない）。

---

## インストール・セットアップ

### ローカルパッケージ（npm link）

```bash
# ライブラリ側
cd article-system
npm run build
npm link

# 利用側プロジェクト
npm link @fififuchun/article-system
```

### 利用側の初期設定（1ファイルのみ）

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

> `import.meta.glob` はViteのビルド時処理のため、利用側プロジェクトに記述する必要がある。

---

## マークダウンファイルの形式

### ファイル配置

```
src/articles/YYYY-MM-DD-slug.md
```

命名規則は自由だが、`YYYY-MM-DD` を先頭につけると日付順の管理がしやすい。

### フロントマター（必須）

```markdown
---
title: 記事タイトル
date: 2025-11-22
latestUpdate: 2025-11-22
staff: 担当者名
thumbnail: art_0.webp
---
```

| フィールド | 型 | 説明 |
|---|---|---|
| `title` | string | 記事タイトル |
| `date` | string（YYYY-MM-DD） | 投稿日。記事のIDと並び順に使われる |
| `latestUpdate` | string（YYYY-MM-DD） | 最終更新日 |
| `staff` | string | 担当者名 |
| `thumbnail` | string | サムネイル画像のファイル名 |

### 本文（マークダウン）

```markdown
## 大見出し（セクション）

### 小見出し（サブセクション）

段落テキスト...

![](画像ファイル名.webp)
```

| 記法 | 対応するコンポーネント部位 |
|---|---|
| `##` | `heading`（大見出し） |
| `###` | `subheading`（小見出し） |
| 段落 | `paragraph`（本文） |
| `![](filename)` | `image`（画像） |

画像のパスは `imageBasePath + filename` に解決される（デフォルト: `/article_imgs/filename`）。

---

## API

### `createArticles(rawFiles)`

`import.meta.glob` の結果を受け取り、`Article[]` を返す。

```ts
createArticles(rawFiles: Record<string, string>): Article[]
```

- `date` の昇順でソート済み
- `id` は 0 始まり（0 = 最古の記事）
- 新しいファイルを追加するだけで自動的に配列に追加される

---

### `Article` 型

```ts
interface Article {
  id: number;         // 0始まり、URLの :id に対応
  title: string;
  date: string;       // "YYYY-MM-DD"
  latestUpdate: string;
  staff: string;
  thumbnail: string;  // 画像ファイル名のみ（パスなし）
  content: string;    // マークダウン本文
}
```

---

### `<ArticleDetail>`

記事1件を詳細表示するコンポーネント。

```tsx
<ArticleDetail
  article={article}
  imageBasePath="/article_imgs/"
  dateLabel="最終更新日時"
  classNames={{...}}
/>
```

| Props | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `article` | `Article` | ✓ | — | 表示する記事オブジェクト |
| `imageBasePath` | string | | `/article_imgs/` | 画像ファイルのベースパス |
| `dateLabel` | string | | `最終更新日時` | 最終更新日の前に表示するラベル |
| `classNames` | `ArticleDetailClassNames` | | `{}` | 各要素に適用するCSSクラス名 |

#### `ArticleDetailClassNames`

```ts
interface ArticleDetailClassNames {
  wrapper?: string;     // 記事全体のラッパー
  dateYear?: string;    // 投稿年
  dateDay?: string;     // 投稿月/日
  title?: string;       // 記事タイトル
  latestUpdate?: string;// 最終更新日の行
  thumbnail?: string;   // サムネイル画像
  heading?: string;     // ## 大見出し
  subheading?: string;  // ### 小見出し
  paragraph?: string;   // 段落ラッパー
  image?: string;       // 本文内画像ラッパー
  footer?: string;      // 担当者表示
}
```

---

### `<ArticleList>`

記事一覧を表示するコンポーネント。  
リンクの実装（`<Link>` や `<a>`）は利用側が `renderLink` で注入する。

```tsx
<ArticleList
  articles={articles}
  imageBasePath="/article_imgs/"
  getArticleUrl={(article) => `/blog/${article.id}`}
  classNames={{...}}
  renderLink={(url, children, key) => (
    <a key={key} href={url}>{children}</a>
  )}
/>
```

| Props | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `articles` | `Article[]` | ✓ | — | 表示する記事配列 |
| `imageBasePath` | string | | `/article_imgs/` | 画像ファイルのベースパス |
| `getArticleUrl` | `(article: Article) => string` | ✓ | — | 記事URLを生成する関数 |
| `classNames` | `ArticleListClassNames` | | `{}` | 各要素に適用するCSSクラス名 |
| `renderLink` | `(url, children, key) => ReactNode` | ✓ | — | リンク要素を返す関数 |

#### `ArticleListClassNames`

```ts
interface ArticleListClassNames {
  grid?: string;      // 一覧全体のグリッドラッパー
  card?: string;      // 各記事カード
  cardImage?: string; // カードのサムネイル画像
  cardTitle?: string; // カードのタイトル
  cardDate?: string;  // カードの更新日
}
```

---

## ライブラリの更新手順

```bash
cd article-system

# ソースを編集後
npm run build   # これだけで npm link 中の全プロジェクトに即反映
```

---

## 依存関係

| パッケージ | 種別 | 用途 |
|---|---|---|
| `react` | peerDependency | 利用側で用意する |
| `react-markdown` | dependency | マークダウン→HTML変換 |
| `remark-gfm` | dependency | テーブル・打ち消し線などのGFM拡張 |

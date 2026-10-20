# api.md — 公開API

`src/index.ts` が公開しているものの一覧です。仕様の根拠は [spec.md](./spec.md) にあります。

```ts
export type { Article, ArticleDetailClassNames, ArticleListClassNames,
              ArticleStudioClassNames, GitHubConfig };
export type { Issue };
export type { IconProps };
export type { ArticleHeadOptions };

export { createArticles, validateArticle };
export { resolveSlug, buildDescription, buildArticleHead };
export { ArticleDetail, ArticleList, ArticleStudio, ArticleStudioRoute };
export { ArrowIcon, ClockIcon, CloseIcon, CopyIcon, DownloadIcon,
         ExternalLinkIcon, ImageIcon, PersonIcon, TagIcon, WarningIcon };
```

ビルド時に走るものは別のエントリです。**読者のバンドルには入りません。**

```ts
// @fififuchun/article-system/vite
export { articleOgTags };
export type { ArticleOgTagsOptions, ArticleOgTagsPlugin };
```

### CSS

| 読む側 | 指定 |
| --- | --- |
| Tailwind v3 / Tailwind なし | `@fififuchun/article-system/styles.css` |
| **Tailwind v4** | `@fififuchun/article-system/styles.layer.css` |

**どちらか一方だけを読み込みます。** 取り違えると実行時に警告が出ます（spec §10）。

---

## 型

### `Article`

```ts
interface Article {
  slug: string;         // URL に使う識別子。記事の身元
  filename: string;     // 拡張子付きファイル名
  title: string;
  date: string;         // "YYYY-MM-DD" 公開日
  latestUpdate: string; // "YYYY-MM-DD" 最終編集日
  staff: string;
  thumbnail: string;    // ファイル名のみ（パスなし）
  content: string;      // フロントマターを除いた本文
}
```

`filename` は衝突検出に使います。**URL には使いません**（識別子は `slug`）。

### `Issue`

```ts
interface Issue {
  level: "error";
  field?: string;   // フロントマターのキー名。該当しない問題では未設定
  message: string;
}
```

### `IconProps`

```ts
interface IconProps {
  className?: string;
}
```

サイズは CSS で指定するため `width` / `height` は受け取りません。

### `ClassNames` 各種

| 型 | キー |
| --- | --- |
| `ArticleDetailClassNames` | `wrapper` `headerWrapper` `dateWrapper` `dateYear` `dateDay` `title` `latestUpdate` `dateIcon` `thumbnail` `heading` `subheading` `subsubheading` `paragraph` `image` `footer` |
| `ArticleListClassNames` | `grid` `card` `cardImage` `cardTitle` `cardDate` `cardDateIcon` |
| `ArticleStudioClassNames` | `wrapper` `editorPane` `textarea` `previewPane` `tabs` `issues` `imagePane` `actions` `login` `dialog` |

すべて任意です。渡したクラスは `as-` 接頭のデフォルトクラスに**追記**されます。

---

## 関数

### `createArticles(rawFiles): Article[]`

`import.meta.glob` の戻り値から記事一覧を作ります。

- `_` 始まりのファイル名を見つけたら**例外を投げます**（下書きの漏洩を知らせる警報）
- `date` を**文字列比較**で昇順ソートします
- `slug` を決めます（フロントマター優先、無ければファイル名から拡張子を除く）。重複していれば `console.warn`
- 各記事を検証し、問題があれば `console.warn` で報告します

### `validateArticle(raw, context?): Issue[]`

md の文字列を検証します。例外は投げません。

```ts
validateArticle(raw, { articles?: Article[]; filename?: string })
```

検出するもの: 必須5項目の欠落、キー名の typo、日付の形式違反、引用符付きの値、フロントマターの閉じ忘れ、`latestUpdate < date`、ファイル名の衝突。

**画像の存在確認は含みません。** 読み込みを伴うため `ArticleStudio` 側で行います。

### `resolveSlug(filename, frontmatterSlug?): string`

記事の slug を決めます。フロントマター優先、無ければファイル名から拡張子を除いたもの。

**`createArticles` と Vite プラグインの両方がこれを呼びます。** 2か所に書くとブラウザ側とビルド側で違う URL になり、OGタグが別の記事を指します（spec §18）。

### `buildDescription(content, maxLength?): string`

本文から共有用の説明文を作ります（既定120文字）。マークダウンの記号を落として1行に畳みます。**アンダースコアは落としません**（`0_1.png` のようなファイル名を壊さないため）。

### `buildArticleHead(article, options): string`

記事から `<head>` に入れるタグを作ります（spec §18）。

```ts
buildArticleHead(article, {
  siteUrl: "https://example.com",   // 必須。絶対URLでないと例外
  path: "/blog/2026-10-12",         // 必須
  imageBasePath?: string,           // 既定 "/article_imgs/"
  siteName?: string,
  descriptionLength?: number,
})
```

`<title>` / `canonical` / `og:*` / `twitter:card` / `article:published_time` を返します。

- 属性値を escape します（`title: 夏の"更新"` で HTML が壊れないように）
- `og:image` と `og:url` は `URL` で絶対化します。手で文字列を繋ぎません
- サムネイルが無ければ `og:image` を出さず、`twitter:card` も `summary` に落とします

---

## コンポーネント

### `<ArticleDetail>`

| prop | 型 | 必須 | 既定値 |
| --- | --- | --- | --- |
| `article` | `Article` | ✔ | — |
| `imageBasePath` | `string` | | `"/article_imgs/"` |
| `dateLabel` | `string` | | `"最終更新日時"` |
| `classNames` | `ArticleDetailClassNames` | | `{}` |

見出しは `<h2>` / `<h3>` / `<h4>` で出力します。`thumbnail` が空なら描画しません。絶対URL・`blob:`・`data:` は `imageBasePath` を前置せず素通しします。

### `<ArticleList>`

| prop | 型 | 必須 | 既定値 |
| --- | --- | --- | --- |
| `articles` | `Article[]` | ✔ | — |
| `getArticleUrl` | `(article) => string` | ✔ | — |
| `renderLink` | `(url, children, key) => ReactNode` | ✔ | — |
| `imageBasePath` | `string` | | `"/article_imgs/"` |
| `classNames` | `ArticleListClassNames` | | `{}` |

`renderLink` でリンク要素の生成を委ねているため**ルーターに依存しません**。カードに出す日付は `latestUpdate` です。

### `<ArticleStudio>`

| prop | 型 | 必須 | 既定値 |
| --- | --- | --- | --- |
| `articles` | `Article[]` | ✔ | — |
| `storageKey` | `string` | | `"default"` |
| `imageBasePath` | `string` | | `"/article_imgs/"` |
| `dateLabel` | `string` | | `"最終更新日時"` |
| `classNames` | `ArticleStudioClassNames` | | `{}` |
| `articleClassNames` | `ArticleDetailClassNames` | | `{}` |
| `github` | `GitHubConfig` | | — |

`articles` は必須です。渡さないとファイル名の衝突を検出できず、既存記事が上書きで消えます。

`github` を渡すと、ダウンロードの代わりにリポジトリへ**投稿**します。トークンを入れるまで執筆画面は出ません（spec §15）。

- ボタンの文言が「投稿」になります（押した時点で公開されるため）
- 押すと `window.confirm` で一度止まります（タイトル・ファイル名・画像の件数を出します）
- 成功すると**雛形に戻り**、画像欄も空になります。失敗したときは残します
- ドロップした画像は IndexedDB に保存され、**リロードしても消えません**

```ts
interface GitHubConfig {
  repo: string;       // "owner/name"
  branch?: string;    // 既定 "main"
  mdDir?: string;     // 既定 "src/articles"
  imageDir?: string;  // 既定 "public/article_imgs"
}
```

---

### `<ArticleStudioRoute>`

`<ArticleStudio>` を `#/studio` で全画面に開く薄い入り口（spec §9 設置方法）。
`App.tsx` に1行置くだけで済み、`<Route>` の定義もページファイルも要らない。

```tsx
<ArticleStudioRoute articles={articles} github={{ repo: "me/blog" }} />
```

| prop | 型 | 必須 | 既定値 |
| --- | --- | --- | --- |
| `hashPath` | `string` | | `"#/studio"` |

ほかの prop は `<ArticleStudio>` と同じ。

- ハッシュが一致しないときは `null` を返す（置き場所が結果に影響しない）
- `<dialog>` を `showModal()` で開くのでトップレイヤーに乗る。`z-index` は書いていない
- × と Esc のどちらでも閉じ、閉じるとハッシュを `replaceState` で戻す

---

## Vite プラグイン

### `articleOgTags(options)`

`@fififuchun/article-system/vite` から読み込みます。ビルドの最後に、記事ごとの HTML を出力先へ書き出します（spec §18）。

```ts
// vite.config.ts
import { articleOgTags } from "@fififuchun/article-system/vite";

plugins: [
  react(),
  articleOgTags({
    siteUrl: "https://example.com",   // 必須
    path: "/blog/:slug",              // 必須。:slug を含めること
    articlesDir?: "src/articles",     // 既定
    imageBasePath?: "/article_imgs/", // 既定
    siteName?: string,
    descriptionLength?: number,
  }),
]
```

- **`vite` に依存しません。** `configResolved` と `closeBundle` だけを持つ素のオブジェクトを返します
- 問題があれば**例外を投げてビルドを止めます**（`path` に `:slug` が無い / `siteUrl` が相対 / 記事のフォルダが読めない / 記事0件 / 出力に `index.html` が無い / `</head>` が無い）
- 記事用のコピーからは元の `<title>` と `og:` / `twitter:` / `description` を消します（重複すると静かに間違った結果になるため）
- フォルダ名は生の slug、`og:url` は percent-encoding

**記事の URL が実パスである必要があります。** ハッシュ（`#/blog/x`）では `#` から後ろがサーバーに送られないため、原理的に動きません。

---

## アイコン

すべてインライン SVG です。`fill="currentColor"` で CSS の `color` に追従し、`aria-hidden="true"` が付きます。サイズは CSS で指定します。

| 分類 | アイコン |
| --- | --- |
| 記事系 | `ClockIcon` `PersonIcon` `TagIcon` |
| Studio 系 | `DownloadIcon` `ImageIcon` `WarningIcon` `CloseIcon` |
| 汎用 | `ArrowIcon` `ExternalLinkIcon` `CopyIcon` |

`ArrowIcon` は右向きです。他の向きは CSS の `transform: rotate()` で作ります。

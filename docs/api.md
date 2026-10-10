# api.md — 公開API

`src/index.ts` が公開しているものの一覧です。仕様の根拠は [spec.md](./spec.md) にあります。

```ts
export type { Article, ArticleDetailClassNames, ArticleListClassNames, ArticleStudioClassNames };
export type { Issue };
export type { IconProps };

export { createArticles, validateArticle };
export { ArticleDetail, ArticleList, ArticleStudio };
export { ArrowIcon, ClockIcon, CloseIcon, CopyIcon, DownloadIcon,
         ExternalLinkIcon, ImageIcon, PersonIcon, TagIcon, WarningIcon };
```

CSS は `@fififuchun/article-system/styles.css` として別に読み込みます。

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
| `ArticleStudioClassNames` | `wrapper` `editorPane` `textarea` `previewPane` `tabs` `issues` `imagePane` `actions` |

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

`github` を渡すと、ダウンロードの代わりにリポジトリへ直接コミットします。トークンを入れるまで執筆画面は出ません（spec §15）。

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

## アイコン

すべてインライン SVG です。`fill="currentColor"` で CSS の `color` に追従し、`aria-hidden="true"` が付きます。サイズは CSS で指定します。

| 分類 | アイコン |
| --- | --- |
| 記事系 | `ClockIcon` `PersonIcon` `TagIcon` |
| Studio 系 | `DownloadIcon` `ImageIcon` `WarningIcon` `CloseIcon` |
| 汎用 | `ArrowIcon` `ExternalLinkIcon` `CopyIcon` |

`ArrowIcon` は右向きです。他の向きは CSS の `transform: rotate()` で作ります。

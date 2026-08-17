# 公開 API リファレンス

`src/index.ts` がエクスポートしているものがすべてです。

```ts
export type { Article, ArticleDetailClassNames, ArticleListClassNames, ArticlePreviewClassNames };
export { createArticles };
export { ArticleDetail, ArticleList, ArticlePreview };
export { ClockIcon };
```

## 型

### `Article`

```ts
interface Article {
  id: number;          // 0始まりの連番。date 昇順ソート後の index
  title: string;
  date: string;        // "YYYY-MM-DD" 投稿日
  latestUpdate: string;// "YYYY-MM-DD" 最終更新日
  staff: string;       // 担当者名
  thumbnail: string;   // ファイル名のみ。パスは含まない
  content: string;     // フロントマターを除いたマークダウン本文
}
```

全フィールドが必須（optional なし）ですが、`createArticles` はフロントマターに欠けている項目を `""` で埋めるため、**実行時に空文字が入ることがあります**。型は「存在する」ことしか保証せず、「空でない」ことは保証しません。

### `ArticleDetailClassNames`

すべて optional の `string`。

| キー | 適用先 |
| --- | --- |
| `wrapper` | 記事全体を包む `<div>` |
| `headerWrapper` | 日付＋タイトルの `<div>` |
| `dateWrapper` | 年・月日を包む `<div>` |
| `dateYear` | 年（`<p>`） |
| `dateDay` | `月/日`（`<p>`） |
| `title` | タイトル（`<p>`） |
| `latestUpdate` | 更新日行の `<div>` |
| `dateIcon` | 更新日行の `ClockIcon`（SVG） |
| `thumbnail` | サムネイル `<img>` |
| `heading` | マークダウンの `##`（`<div>` として出力） |
| `subheading` | `###` |
| `subsubheading` | `####` |
| `paragraph` | 段落の外側 `<div>`（内側は `<p>`） |
| `image` | 本文中画像の外側 `<div>` |
| `footer` | 「担当：〇〇」の `<p>` |

> `subsubheading` は README のサンプルに載っていません（`####` サポートは後から追加されたため）。使う場合は自分で追加してください。

### `ArticleListClassNames`

| キー | 適用先 |
| --- | --- |
| `grid` | 一覧全体の `<div>` |
| `card` | カード1枚の `<div>` |
| `cardImage` | サムネイル `<img>` |
| `cardTitle` | タイトル `<p>` |
| `cardDate` | 日付行の `<div>` |
| `cardDateIcon` | 日付行の `ClockIcon` |

### `ArticlePreviewClassNames`

| キー | 適用先 |
| --- | --- |
| `wrapper` | 2カラム全体 |
| `editorPane` | 左のエディタ領域 |
| `textarea` | `<textarea>` 本体 |
| `previewPane` | 右のプレビュー領域 |

## 関数

### `createArticles(rawFiles: Record<string, string>): Article[]`

キー（ファイルパス）は使われず、値の文字列だけを処理します。返り値は `date` 昇順（古い順）で、`id` は 0 からの連番です。

```ts
const rawFiles = import.meta.glob("../articles/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const articles = createArticles(rawFiles);
```

`eager: true` が必須です（`false` だと値が `() => Promise<string>` になり、型アサーションが嘘になって実行時に壊れます）。

## コンポーネント

### `<ArticleList>`

| prop | 型 | 必須 | デフォルト |
| --- | --- | --- | --- |
| `articles` | `Article[]` | ✔ | — |
| `getArticleUrl` | `(article: Article) => string` | ✔ | — |
| `renderLink` | `(url, children, key) => React.ReactNode` | ✔ | — |
| `imageBasePath` | `string` | | `"/article_imgs/"` |
| `classNames` | `ArticleListClassNames` | | `{}` |

`renderLink` には `key` が第3引数で渡されます。返す要素に `key={key}` を付けるのは**利用側の責任**です。付け忘れると React の key 警告が出ます。

```tsx
renderLink={(url, children, key) => <Link key={key} to={url}>{children}</Link>}
```

表示される日付は `article.latestUpdate` です。

### `<ArticleDetail>`

| prop | 型 | 必須 | デフォルト |
| --- | --- | --- | --- |
| `article` | `Article` | ✔ | — |
| `imageBasePath` | `string` | | `"/article_imgs/"` |
| `classNames` | `ArticleDetailClassNames` | | `{}` |
| `dateLabel` | `string` | | `"最終更新日時"` |

ヘッダーの大きな日付は `article.date`、`dateLabel` の隣に出るのが `article.latestUpdate` です。

記事が見つからない場合のハンドリングはありません。`articles[Number(id)]` が `undefined` のときのガードは利用側で書く必要があります（README のサンプルもそうしています）。

### `<ArticlePreview>`

| prop | 型 | 必須 | デフォルト |
| --- | --- | --- | --- |
| `imageBasePath` | `string` | | `"/article_imgs/"` |
| `dateLabel` | `string` | | `"最終更新日時"` |
| `classNames` | `ArticlePreviewClassNames` | | `{}` |
| `articleClassNames` | `ArticleDetailClassNames` | | `{}` |
| `defaultValue` | `string` | | `""` |

`defaultValue` は初期値としてのみ使われ、非制御です。入力内容の保存機能（localStorage、ファイル出力など）はありません。リロードすると消えます。

### `<ClockIcon>`

```tsx
<ClockIcon className?: string />
```

24x24 viewBox、`fill="currentColor"`。サイズは CSS（`width` / `height`）で指定します。

## マークダウンでサポートされる記法

有効なプラグインは `remark-gfm` と `remark-breaks` です。

| 記法 | 状態 |
| --- | --- |
| `##` `###` `####` | ✔ `<div>` + 指定クラスで出力 |
| 段落 | ✔ `<div><p>` |
| `![](file.webp)` | ✔ `imageBasePath` を前置して出力 |
| 単一改行 | ✔ `<br>` に変換（remark-breaks） |
| 表、取り消し線、タスクリスト、自動リンク | ✔ 動作するが**クラス指定不可**（素の HTML 要素） |
| リスト、引用、コードブロック、太字、リンク | ✔ 動作するが**クラス指定不可** |
| `#`（h1） | ✔ 動作するが `<h1>` のまま、クラス指定不可 |
| 生の HTML | ✘ 無効（`rehype-raw` 未導入。文字列としてエスケープされる） |

`classNames` を渡せるのは `components` マップに定義された h2 / h3 / h4 / p / img のみです。それ以外の要素は react-markdown のデフォルト出力なので、利用側で `.article-wrapper ul` のような子孫セレクタでスタイルを当てることになります。

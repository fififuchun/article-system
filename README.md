# @fififuchun/article-system

マークダウンファイルを置くだけで記事データを自動生成し、一覧・詳細表示コンポーネントを提供するライブラリです。  
デフォルトCSSを同梱しており、読み込むだけで記事の体裁が整います。見た目は `classNames` で全部差し替えられます。

> **開発中のライブラリです（現在 0.5.2）。** 破壊的変更が入ることがあります。**バージョンはタグで固定してください。** 設計の確定版は [docs/spec.md](./docs/spec.md)、進捗は [docs/tasks.md](./docs/tasks.md) にあります。  
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
npm i github:fififuchun/article-system#v0.5.2

# コミットハッシュで固定する
npm i github:fififuchun/article-system#b5e66ab
```

固定しないと `npm update` を実行したときに意図せず最新が入り、破壊的変更を含んでいた場合に利用側が壊れます。


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

ファイル名は並び順には使われません（効くのはフロントマターの `date` です）。ただし **`slug:` を書いていない記事では、ファイル名がそのまま URL になります**。

### 3. マークダウンファイルを作成する

各ファイルの先頭にフロントマターを記述します。

```markdown
---
title: 記事タイトル
slug: 2025-06-01
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
| `date`         | string（YYYY-MM-DD） | 投稿日。並び順に使われる     |
| `slug`         | string（任意）       | URL に使う識別子。省略するとファイル名から作る |
| `latestUpdate` | string（YYYY-MM-DD） | 最終更新日。一覧カードに表示される |
| `staff`        | string               | 担当者名                     |
| `thumbnail`    | string               | サムネイル画像のファイル名   |

**`slug` 以外はすべて必須です。** 書き忘れると例外は出ませんが、画面に `0年undefined月undefined日` のような表示が出ます。

`slug` は URL になります。Studio で新しく書くと**日付が自動で入る**ため、URL に日本語が入りません。英語の URL にしたい記事だけ `slug: summer-update` のように書き換えてください。**一度公開した記事の `slug` を変えると、そのURLは切れます。**

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

const rawFiles = import.meta.glob("../articles/[!_]*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const articles = createArticles(rawFiles);
```

> `import.meta.glob` はViteのビルド時処理のため、利用側プロジェクトに記述する必要があります。

#### `[!_]` は必須です

`_` で始まるファイルは下書きです。**このパターンで除外しないと、下書きの本文が公開されます。**

`import.meta.glob` は**ビルド時にファイルの中身を JavaScript の文字列としてバンドルに埋め込みます**。`createArticles` の中で除外してもそれはブラウザ上の処理で、**本文はすでに配信済み**です。開発者ツールから誰でも読めます。

そして glob パターンは**ファイルのパスしか見られません**。フロントマターに `draft: true` と書いても Vite はそれを読めないため除外できません。**glob での除外が唯一の手段です。**

`_` 始まりのファイルが渡された場合、`createArticles` は例外を投げてページを停止させます。漏洩自体は取り消せませんが、壊れたサイトが最も確実な警報として機能し、放置される期間を最短にします。

### 5. CSS を読み込む

**Tailwind v4 を使っているかどうかでファイルが変わります。**

```tsx
// Tailwind v4
import "@fififuchun/article-system/styles.layer.css";

// Tailwind v3 / Tailwind を使っていない
import "@fififuchun/article-system/styles.css";
```

詳しくは[スタイル](#スタイル)の節を読んでください。**両方を読み込まないでください。**

### 6. 画像ファイルを配置する

```
your-project/
└── public/
    └── article_imgs/
        ├── art_0.webp
        └── art_1.webp
```

`thumbnail` や `![]()` にはファイル名だけを書き、パスは `imageBasePath` で指定します。単純な文字列連結のため、**外部URLの画像は現在使えません**。

---

## スタイル

デフォルトCSSを同梱しています。読み込むだけで記事の体裁が整い、`classNames` を一切渡さなくても読める記事になります。

### どちらのファイルを読むか ★最初に確認してください

**Tailwind CSS v4 を使っているかどうかで、読み込むファイルが変わります。**

```bash
# どちらを使っているか調べる
npm ls tailwindcss
```

| あなたのプロジェクト | 読み込むファイル |
| --- | --- |
| **Tailwind v4** | `@fififuchun/article-system/styles.layer.css` |
| Tailwind v3 | `@fififuchun/article-system/styles.css` |
| Tailwind を使っていない | `@fififuchun/article-system/styles.css` |

```tsx
// Tailwind v4
import "@fififuchun/article-system/styles.layer.css";

// それ以外
import "@fififuchun/article-system/styles.css";
```

**両方を読み込まないでください。** 層なしが勝って、`styles.layer.css` が無意味になります。

> **読み込み順はどちらでも構いません。** 利用側の CSS の前でも後でも結果は変わりません。

#### 間違えたときどうなるか

| | 何が起きるか |
| --- | --- |
| v4 で `styles.css` を読んだ | **`classNames` が効かなくなります。** ブラウザのコンソールに警告が出ます |
| v3 で `styles.layer.css` を読んだ | **ビルドが止まります**（`@layer components` is used but no matching `@tailwind components` directive is present） |

#### なぜ分かれているのか

Tailwind v4 は自分の CSS をすべて「カスケードレイヤー」に入れます。層に入っていない CSS は層の中の CSS に必ず勝つため、v4 のサイトで層なし版を読むと、**ライブラリがあなたの Tailwind クラスにまで勝ってしまいます**。

v3 には層の仕組みがなく、むしろ `@layer` と書くとビルドが止まるため、同じファイルで両対応できません。

### 上書きの仕方

`as-` 接頭のクラスが常時付き、`classNames` で渡したクラスは**追記**されます。

```
classNames 未指定:              <h2 class="as-heading">
classNames={{heading:"my-h"}}:  <h2 class="as-heading my-h">
```

**読み込み順に関係なく、`classNames` で渡したクラスが必ず勝ちます。** Tailwind のユーティリティクラスも追記で効きます。

#### タグ名だけで書いた CSS は負けます（Tailwind v3 / Tailwind なしの場合）

```css
h2 { margin-top: 40px; }           /* ライブラリに負ける */
.article h2 { margin-top: 40px; }  /* 勝つ */
```

デフォルトCSSは、Tailwind のリセット（`h2 { font-size: inherit }` のようなタグ名の指定）に負けないよう作られています。その結果、**あなたがタグ名だけで書いた指定にも勝ってしまいます。** クラスを足せば勝てます。

**Tailwind v4（`styles.layer.css`）ではこれは起きません。** 層ありのライブラリは、層に入っていない CSS すべてに負けるためです。

### 色やサイズを変える

CSS変数を再定義するだけで差し替えられます。

```css
:root {
  --as-color-accent: #e2574a;
  --as-color-link: #2563eb;   /* 既定はアクセント色に追従 */
  --as-text-body: 1rem;
  --as-article-width: 50rem;
}
```

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
      getArticleUrl={(article) => `/blog/${encodeURIComponent(article.slug)}`}
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

> **`articles` は古い順に並んでいます。** 新しい記事を先頭にしたい場合は上記のように `[...articles].reverse()` を渡してください。`.reverse()` は破壊的なのでスプレッドでコピーしてから呼びます。`slug` は並び順に依存しないので URL は壊れません。

カードに表示される日付は `latestUpdate` です。

`renderLink` に渡される第3引数の `key` は **`article.slug`（文字列）**です。返す要素に付けるのは利用側の責任です。付け忘れると React の key 警告が出ます。

### `<ArticleDetail>` — 記事詳細

URLの `:slug` パラメータから記事を特定して渡します。`article.slug` は記事の身元で、**記事を足しても変わりません**。

```tsx
// src/pages/BlogDetail.tsx
import { ArticleDetail } from "@fififuchun/article-system";
import { articles } from "../lib/articles";
import { useParams } from "react-router-dom"; // 使用しているルーターに合わせて変更してください

export default function BlogDetail() {
  const { slug } = useParams();
  // パラメータは percent-encoding されているのでデコードして突き合わせる
  const article = articles.find((a) => a.slug === decodeURIComponent(slug ?? ""));

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

### `<ArticleStudio>` — 執筆画面

書く・確認する・検証する・md として取り出す、までを1画面で行います。

> **ふつうは `<ArticleStudioRoute>` を使ってください。**（後述）1行置くだけで `#/studio` に
> 全画面で開きます。`<ArticleStudio>` を直接使うのは、自分のレイアウトの中に埋め込みたい
> 場合だけです。

```tsx
// 自分のページに埋め込む場合
import { ArticleStudio } from "@fififuchun/article-system";
import { articles } from "../lib/articles";

export default function BlogStudio() {
  return <ArticleStudio articles={articles} storageKey="my-blog" />;
}
```

| prop | 型 | 必須 | 既定値 |
| --- | --- | --- | --- |
| `articles` | `Article[]` | ✔ | — |
| `storageKey` | `string` | | `"default"` |
| `imageBasePath` | `string` | | `"/article_imgs/"` |
| `dateLabel` | `string` | | `"最終更新日時"` |
| `classNames` | `ArticleStudioClassNames` | | `{}` |
| `articleClassNames` | `ArticleDetailClassNames` | | `{}` |
| `github` | `GitHubConfig` | | — （渡すとコミットになる） |

#### `articles` は必ず渡してください

渡さないと**ファイル名の衝突を検出できません**。既存記事と同じ名前で書き出してしまい、置いた時点で既存記事が上書きされて消えます。記事が0件のプロジェクトでも `createArticles({})` の戻り値をそのまま渡してください。

#### `storageKey` は複数プロジェクトで使うなら指定してください

下書きは `as-studio-draft:{storageKey}` として localStorage に自動保存されます。`vite dev` はどのプロジェクトでも既定で同じオリジンを使い、localStorage はオリジン単位です。**指定しないとプロジェクト間で下書きが混ざります。**

#### できること

- **自動保存** — 入力のたびに保存されます。ボタンはありません。閉じても次に開くと続きから書けます
- **プレビュー** — 詳細と一覧をタブで切り替えます。本番と同じコンポーネントを使うので表示が食い違いません。**ドロップした画像も、置く前からそのまま見えます**
- **検証** — ダウンロードボタンを押したときにまとめて確認します。執筆中は警告を出しません
- **画像** — ドラッグ&ドロップで仮登録します。名前をその場で直せて、その名前で保存できます。**ドロップすると `2026/10-12/0_1.png` のように日付のフォルダが付きます**（下記）
- **リロードしても消えません** — 本文は localStorage、画像の実体は IndexedDB に保存されます。保存できない環境では画像欄にその旨が出ます
- **md の出力** — 本番用（検証必須）と下書き用（`_` 接頭、検証なし）の2つ


#### GitHub に投稿する（任意）

`github` を渡すと、ダウンロードの代わりに**リポジトリへ直接投稿**します。渡さなければ今までどおりダウンロードのままです。

ボタンの文言が「投稿」に変わります。**押した時点でリポジトリに入って公開されます。**「コミット」と書かないのは、手元に積んだだけに見えるためです。

```tsx
<ArticleStudio
  articles={articles}
  storageKey="my-blog"
  github={{ repo: "yourname/your-blog" }}
/>
```

| 項目 | 型 | 必須 | 既定値 |
| --- | --- | --- | --- |
| `repo` | `string` | ✔ | — （`"owner/name"`） |
| `branch` | `string` | | `"main"` |
| `mdDir` | `string` | | `"src/articles"` |
| `imageDir` | `string` | | `"public/article_imgs"` |

`imageBasePath` は**表示用のURLパス**、`imageDir` は**リポジトリ上の置き場所**です。別物なので、既定から変えるなら両方を指定してください。

##### トークンを用意する

`github` を渡すと、**トークンを入れるまで執筆画面が出ません。** これが認証の代わりになります。

作り方は関門画面にも手順として出ますが、先に用意しておくこともできます。

1. <https://github.com/settings/personal-access-tokens/new> を開く
2. **Repository access** で対象のリポジトリだけを選ぶ
3. **Permissions → Contents** を **Read and write** にする（これだけで足ります）
4. **Expiration** は短めを推奨します
5. 発行されたトークンを Studio の入力欄に貼る

トークンは sessionStorage に入ります。**タブを閉じれば消えます。** 画面には表示しません。

> **注意:** 下書き本文は localStorage に残ります。トークンの寿命を短くしても、書きかけの記事は端末に残ります。

##### 投稿されるもの

投稿ボタンを押すと、md と**ドロップした画像を1つのコミット**にまとめて置きます。途中で失敗してもリポジトリには何も現れません。

- 同名の md が既にあれば止めます（上書きすると元の記事が消えます）
- 同名の画像が既にあれば止めます（上書きすると**その画像を使っている別の記事**が壊れます）。Studio で名前を変えてから出し直してください
- **下書きはコミットしません。** ダウンロードのままです

失敗したときは理由を出し、その場に「代わりにダウンロード」を出します。書いたものは必ず持ち帰れます。

##### 押す前に一度確認します

取り消す手段がこの画面に無いため、投稿の前に確認が出ます。

```
「夏の更新」を投稿します。

ファイル: 2026-08-23-夏の更新.md
画像: 2 件

投稿するとリポジトリに入って公開されます。この画面からは取り消せません。
```

確認は**検証を通った後**に出ます。ダウンロードでは出ません（取り返しがつきます）。

##### 投稿に成功すると雛形に戻ります

投稿が済んだ記事はそのまま残りません。**画像欄も空になります**（持ち越すと次の投稿で同名衝突になります）。続けて次の記事を書き始められます。

同じ日に2本目を投稿すると、雛形の `slug` に `-2` が付きます。

**失敗したときは残ります。** 書いたものが消えないようにするためです。

##### なぜ GitHub ログインではないのか

トークンを交換するエンドポイント（`github.com/login/oauth/access_token`）に CORS が無く、ブラウザから叩けないためです。GitHub App の SPA 対応は Preview かつ Paused です。再開したらログイン方式に乗り換えます。

#### 画像は日付のフォルダに入ります

ドロップすると、記事の `date` から作ったフォルダが名前に付きます。

```
public/article_imgs/2026/10-12/0_1.png
```

`imageDir` は**記事ごとではなく全体で1つの名前空間**です。平らに置くと `0_1.png` のような名前が別の記事と衝突し、コミットが止まります。スマホから入れると似た名前になりがちなので、実際に起こります。

- **サムネイルに使うときは、画像欄に出ている名前をそのまま `thumbnail:` に書いてください**（`thumbnail: 2026/10-12/0_1.png`）
- 名前欄で自分でフォルダを付けた場合は、そちらが優先されます（共通のロゴを `shared/logo.png` に置くなど）
- `date` がまだ `YYYY-MM-DD` で書かれていないときはフォルダを付けません
- ドロップした後に `date` を書き換えても、フォルダ名は追随しません。表示は壊れませんが、気になる場合は画像名を直してください

#### まだできないこと

- **同じ日に同じタイトルの記事を2本出せません。** ファイル名が `{date}-{title}.md` なので衝突して止まります。日付かタイトルを変えてください
- **既存の記事を編集できません。** 書き直すと別の記事として増えます
- 下書きはデバイス間で同期しません（localStorage に入るだけで、コミットしません）
- 画像はリポジトリに自分で配置する必要があります。本番ダウンロード後、画像欄に「未配置」と出ます（`github` を渡した場合は同じコミットに入るので不要です）

詳しい理由と、直すときに決めることは [spec.md §16](./docs/spec.md) に書いてあります。

### `<ArticleStudioRoute>` — 執筆画面を1行で置く

`App.tsx` に1行置くだけで、`#/studio` を開いたときに執筆画面が全画面で出ます。**ページファイルも `<Route>` の定義も要りません。**

```tsx
// src/App.tsx
import { ArticleStudioRoute } from "@fififuchun/article-system";
import { articles } from "./lib/articles";

export default function App() {
  return (
    <>
      <YourRoutes />
      <ArticleStudioRoute articles={articles} github={{ repo: "me/blog" }} />
    </>
  );
}
```

| prop | 型 | 必須 | 既定値 |
| --- | --- | --- | --- |
| `hashPath` | `string` | | `"#/studio"` |

ほかの prop は `<ArticleStudio>` と同じものをそのまま渡せます。

#### 置き場所はどこでもかまいません

**ハッシュが一致しないときは何も描画しません。** だから `<main>` の外でも中でも、レイアウトのどこに書いても結果は同じです。

#### なぜハッシュなのか

`#` より後ろは**サーバーに送られず、`react-router` の `<Route path>` も見ません**。だから**あなたのルーティング設定に手を入れる必要がありません。** これが「追加1行」の理由です。

読者向けの一覧・詳細は実パスのままにしてください。ハッシュだと検索エンジンから見て全ページが同じ1ページになり、記事ごとに検索結果へ載りません。

#### 入り口は変えられます

```tsx
<ArticleStudioRoute articles={articles} hashPath="#/write" />
```

`"#/write"` / `"/write"` / `"write"` のどの書き方でも同じに扱います。

#### 閉じ方

右上の × か **Esc** で閉じます。閉じるとハッシュが戻り、元の画面に帰ります。

**開いているあいだ、あなたのヘッダーとフッターは隠れます。** モーダルは背後のすべてを操作
不能にする仕組みなので、ヘッダーだけ残すことはできません。ナビを使いたい場合は × か Esc で
閉じてください。

#### 最前面を取ります

`<dialog>` を `showModal()` で開いています。**トップレイヤー**という専用の層に乗るため、利用側がどんなに大きい `z-index` を使っていても Studio が前に出ます。背後はクリックも Tab 移動もできません。

逆に言うと**ライブラリが最前面を取る**ので、Studio より手前に何かを出すことはできません。

#### 本番に残してかまいません

誰でも `#/studio` を開けますが、**`github` を渡していればトークンが無い限り編集画面は出ません。** スマホから書けるようにするため、環境変数で落とすことは勧めていません。

#### 自分のルーティングに埋め込みたい場合

`<ArticleStudio>` を直接使えます。その場合は上に出る自分のナビの高さを CSS 変数で伝えてください。

```css
:root { --as-studio-header-top: 52px; }
```

<br>
<br>

### ルーティング

**読者向けの2ページだけ**をルーティングに登録します。執筆画面は `<ArticleStudioRoute>` が
ハッシュで開くので、ここには書きません。

```tsx
// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { ArticleStudioRoute } from "@fififuchun/article-system";
import { articles } from "./lib/articles";
import BlogList from "./pages/BlogList";
import BlogDetail from "./pages/BlogDetail";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/blog" element={<BlogList />} />
        {/* :slug より前に定義する */}
        <Route path="/blog/:slug" element={<BlogDetail />} />
      </Routes>

      {/* 執筆画面。#/studio のときだけ全画面で開く */}
      <ArticleStudioRoute articles={articles} github={{ repo: "me/blog" }} />
    </>
  );
}
```

#### Studio を本番に置く場合

**`github` を渡すか、ホスティング側で認証をかけてください。** ライブラリ自体は認証を
持ちません。誰でも `#/studio` を開けます。

`github` を渡せば**トークンを入れるまで執筆画面が出ない**ため、それ自体が鍵になります。

スマホから書けるようにするなら、環境変数で落とさずそのまま残してください。落とすと
本番環境では書けなくなります。

```

<br>
<br>

## 共有したときにサムネイルを出す

記事の URL を X や LINE に貼ったとき、サムネイル付きのカードを出します。

```
┌────────────────────────────────┐
│       [ 記事のサムネイル ]       │
├────────────────────────────────┤
│ 夏の更新                        │
│ 今年の夏にやったことのまとめです。 │
│ example.com                     │
└────────────────────────────────┘
```

### なぜビルド時に作る必要があるのか

**X や LINE のクローラーは JavaScript を実行しません。** URL を貼られると、向こうのサーバーがその URL を1回取りに行き、返ってきた HTML から `og:` のタグを読むだけです。

React が描画するのはその後なので、`react-helmet` のように React からタグを足す仕組みは**カードには一切反映されません。** ビルド時に HTML そのものに書いておく必要があります。

このライブラリは `npm run build` の最後に、記事ごとの HTML を出力先に書き出します。

```
dist/
├── index.html
├── article/
│   ├── 2026-10-12/index.html   ← この記事のタグが入っている
│   └── 2026-10-10/index.html
└── assets/...
```

中身は `dist/index.html` の `<head>` にタグを足しただけのコピーです。**`<script>` はそのままなので、人間が開いたときの見え方は何も変わりません。**

<br>

## 既存のサイトに導入する手順

ここまでで `ArticleList` / `ArticleDetail` が動いているプロジェクトに、サムネイル表示を足す手順です。**上から順に実行してください。**

### ステップ1. ライブラリを更新する

```bash
npm i github:fififuchun/article-system#v0.5.2
```

OGタグは **0.4.0 で入った機能**です。それより古いものが入っていると**プラグインが存在せず**、`./vite` が `exports` に無いというエラーになります。

### ステップ2. 記事の URL が実パスかを確認する

```bash
grep -rn "HashRouter\|createHashRouter" src/
```

**何も出なければ、そのまま次へ進んでください。** react-router は既定で実パス（`BrowserRouter`）です。

`HashRouter` が見つかった場合は、**先にそれをやめる必要があります。** `#/article/夏` のような URL だと `#` から後ろがサーバーに送られないため、記事ごとのタグを届けることが**原理的にできません**。

```diff
- import { HashRouter } from "react-router-dom";
+ import { BrowserRouter } from "react-router-dom";
```

> 執筆画面（`#/studio`）はハッシュのままで構いません。誰にも共有しないのでタグが不要です。

### ステップ3. 記事のパスを確認する

ルート定義を見て、記事1本の URL の形をメモします。

```tsx
<Route path="/blog/:slug" element={<BlogDetail />} />
                ↑ これ
```

この例なら `/blog/:slug` です。

### ステップ4. `vite.config.ts` にプラグインを足す

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { articleOgTags } from "@fififuchun/article-system/vite";

export default defineConfig({
  plugins: [
    react(),
    articleOgTags({
      siteUrl: "https://example.com",   // 本番のドメイン（必須）
      path: "/blog/:slug",              // ステップ3でメモした形（必須）
      siteName: "私のブログ",            // 任意
    }),
  ],
});
```

**4つの値が合っているか確認してください。** ここが食い違うと、ビルドは通るのにカードが出ません。

| 値 | 合わせる相手 | 既定 |
| --- | --- | --- |
| `siteUrl` | 本番のドメイン。`https://` から始めること | なし（必須） |
| `path` | ルート定義の `<Route path>` | なし（必須） |
| `articlesDir` | `import.meta.glob` が見ている md のフォルダ | `src/articles` |
| `imageBasePath` | `ArticleDetail` / `ArticleList` に渡している `imageBasePath` | `/article_imgs/` |

> **`articlesDir` と `imageBasePath` は、渡していなければ既定のままでよいか必ず確認してください。** プラグインはブラウザの外（Node）で動くため、`import.meta.glob` のパターンを読み取れません。md の置き場所を変えている場合は `articlesDir` に同じ場所を渡してください。
>
> `imageBasePath` がずれると、**画面に出ている画像とカードの画像が食い違います**（カード側だけ 404 になります）。

### ステップ5. ローカルでビルドして確認する

```bash
npm run build
```

最後にこの行が出れば書き出せています。

```
[article-system] 12 件の記事に og タグを書き出しました
```

ファイルを直接見て確かめます。

```bash
ls dist/blog/
cat dist/blog/<記事のslug>/index.html | grep og:
```

ブラウザ越しにも確認できます。

```bash
npx vite preview
curl -s http://localhost:4173/blog/<記事のslug>/ | grep og:
```

> **末尾の `/` を付けてください。** `vite preview` は末尾スラッシュが無いと SPA のフォールバックが先に効き、トップの `index.html` を返します。これは `vite preview` の挙動で、本番のホスティングでは起きません（下で確認します）。

### ステップ6. デプロイして確認する

デプロイしたら、**本番の URL を実際に取得して確かめます。**

```bash
curl -s https://example.com/blog/<記事のslug> | grep -E "og:title|og:image"
```

`og:title` と `og:image` が記事のものになっていれば完了です。

**もしトップページのタイトルが返ってきたら**、ホスティングが「記事の HTML ファイル」ではなく「SPA のフォールバック」を返しています。

```bash
# まず末尾スラッシュ付きで試す。これで出るならファイル自体は置けている
curl -s https://example.com/blog/<記事のslug>/ | grep og:title
```

- 出た → ホスティングの設定で、**静的ファイルがフォールバックより先に評価される**ようにします。`vercel.json` や `_redirects` に `/*` → `/index.html` のような全部書き換えの規則を入れている場合、それが原因です
- 出ない → ファイルが置けていません。ステップ5に戻って `dist/` の中身を確認してください

### ステップ7. 実際に貼って確認する

X や Slack に URL を貼って、カードが出ることを確認します。

> **一度読まれた URL はしばらくキャッシュされます。** 直した直後は古いカード（または何も無い状態）が出ることがあります。確実に見たいときは、確認用に末尾を変えた URL で試してください。

<br>

### 画像について

`og:image` に使われるのはフロントマターの `thumbnail` です。

- **公開されていて、ログイン不要で開ける画像**である必要があります
- **1200×630 を推奨します。** 小さすぎると大きいカードにならず、小さいカードに落ちます
- `thumbnail` が空の記事は、画像なしの小さいカードになります

カードの説明文は**本文の冒頭から自動で作られます。** フロントマターに書く項目はありません。

### 設定が間違っていればビルドが止まります

OGタグは**誰かが共有するまで壊れているか分かりません。** ブラウザを見ても気づけないので、黙って諦めずに例外を投げます。

```
[article-system] path には :slug を含めてください（例: "/article/:slug"）。
[article-system] siteUrl は http:// か https:// から始まる絶対URLで渡してください。
[article-system] 記事のフォルダが読めませんでした: /path/to/your-project/src/articles
[article-system] /path/to/your-project/src/articles に md が1件もありません。
```

### タグだけ欲しい場合

書き出しを自分で行いたい場合は、タグを作る関数だけ使えます。

```ts
import { buildArticleHead } from "@fififuchun/article-system";

const head = buildArticleHead(article, {
  siteUrl: "https://example.com",
  path: `/blog/${article.slug}`,
});
// → <title>…</title><link rel="canonical" …><meta property="og:title" …> …
```

<br>
<br>

## 動作環境と注意点

### ブラウザ

**対応ブラウザ**（`package.json` の `browserslist` に宣言しています）

```
Chrome 108+ / Edge 108+ / Safari 15.4+ / Firefox 101+
```

使っている機能から逆算した値です。どれも2022年以降のブラウザで使えます。

| 機能 | 使っている場所 |
| --- | --- |
| `:where()` | デフォルトCSS全体 |
| `<dialog>` + `showModal()` | `<ArticleStudioRoute>` の全画面表示 |
| `100dvh` | 同上 |
| `@layer` | **`styles.layer.css` だけ**（Chrome 99 / Safari 15.4 / Firefox 97 以降） |
| IndexedDB | Studio の画像の保存 |

上の数字を決めているのは `100dvh`（Chrome 108）と `@layer`（Safari 15.4）です。

> **`browserslist` は宣言です。** ビルドがこれを読んで自動で検証する仕組みは入れていません。範囲外のブラウザで動かないことを保証するものではなく、「ここを下回る環境は対象にしていない」という表明です。

> **`@layer` 未対応のブラウザでは、`styles.layer.css` のスタイルが丸ごと無視されます。** エラーは出ません。層に入っていないスタイルだけが適用されるという CSS の仕様です。
>
> ただし Tailwind v4 自体がもっと新しいブラウザを要求するため、v4 を使っているなら実害はありません。`styles.css`（層なし）はこの影響を受けません。

### Shadow DOM の中では効きません

デフォルトCSSのセレクタは `html body` から始まります。**Shadow DOM（Web Components）の中に記事を置くと、スタイルが一切効きません。**

```bash
# 使っていないか調べる
grep -rn "attachShadow\|shadowRoot" src/
```

React + Vite の普通の作り方では出てきません。何も出なければ問題ありません。

### 警告を止めたい場合

v4 で意図的に層なし版（`styles.css`）を使いたい場合、コンソールの警告は自分の CSS で止められます。

```css
:root { --as-stylesheet: layer; }
```

**止めると、`classNames` で渡したクラスが効かない状態がそのまま残ります。** 意図したうえで使ってください。

### 将来の注意点

- **`!important` は層の順番を逆転させます。** Tailwind v4 のリセットに `!important` が増えると、`styles.layer.css` が負ける箇所が出る可能性があります。現在は1箇所（`[hidden]`）だけで、ライブラリは使っていません
- このライブラリは**記事の見出しを `<h2>` から始めます。** `<h1>` は持ちません。ページの `<h1>` は利用側で用意してください
- **ファイル名の大文字小文字を区別します。** `A.md` と `a.md` は別の記事として扱われます。大文字小文字を区別しないファイルシステムでは衝突しえますが、検出しません
- **未来の日付を検証しません。** `date: 2099-01-01` のような打ち間違いは通ります

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
  slug: string;        // URL に使う識別子。記事の身元
  filename: string;    // 拡張子付きファイル名
  title: string;
  date: string;        // "YYYY-MM-DD"
  latestUpdate: string;
  staff: string;
  thumbnail: string;   // ファイル名のみ（パスなし）
  content: string;     // マークダウン本文
}
```

`filename` は衝突検出などに使う参考情報です。**URL には使いません**（識別子は `slug`）。

すべてのフィールドが必須の型になっていますが、`createArticles` はフロントマターに欠けている項目を空文字で埋めます。**型は「存在すること」しか保証せず、「空でないこと」は保証しません。**

<br>
<br>

## 記事を追加するとき

```
src/articles/ に .md ファイルを追加するだけ
```

`createArticles` が自動でソートするため、他のファイルを変更する必要はありません。

> **`slug` は記事の身元です。** 古い日付の記事を後から追加しても、既存の記事の URL は変わりません。ファイル名を変えると（`slug:` を書いていない記事では）URL が変わるので、URL を保ちたいときはフロントマターに `slug:` を明示してください。

<br>
<br>

## 0.5.1 から 0.5.2 への変更

**不具合の修正だけです。** import もAPIも変わりません。

**狭い画面で執筆画面が横にはみ出していました。** 幅 390px で全体が 409px になり、横スクロールが出ていました。

操作帯のボタン3つが折り返さず縮まないこと、グリッドの列が中身の最小幅で広がることの2つが原因です。ボタンは入らなければ折り返すようにし、列は中身で広がらないようにしました。

**2ペイン表示でも起きていました。** 操作帯は画面の半分の幅しかないため、818px より狭いと入りません。

<br>
<br>

## 0.5.0 から 0.5.1 への変更

**不具合の修正だけです。** import もAPIも変わりません。

Tailwind のリセットが消していたものを3つ復元しました。詳細度は足りていましたが、**ライブラリが元から指定していなかった**ため戻っていませんでした。

| 直したところ | 症状 |
| --- | --- |
| 本文の `ul` / `ol` | 点と番号が出ていなかった（入れ子も） |
| リンク（本文・トークン入力画面） | ただの文字に見えていた |
| 本文の `---`（区切り線） | 前後の文にくっついていた |

リンクの色は変数で差し替えられます。既定はアクセント色（`--as-color-accent`）に追従します。

```css
:root { --as-color-link: #e2574a; }
```

<br>
<br>

## 0.4.0 から 0.5.0 への移行

**CSS の優先順位が変わります。** API は変わりません。

### Tailwind v4 を使っている場合

**import を1行変えてください。**

```diff
- import "@fififuchun/article-system/styles.css";
+ import "@fififuchun/article-system/styles.layer.css";
```

変えないと `classNames` で渡したクラスが効きません。**ブラウザのコンソールに警告が出ます。**

### Tailwind v3 / Tailwind を使っていない場合

**import はそのままです。** ただし、**タグ名だけで書いた CSS が効かなくなる可能性があります。**

```bash
# 記事に出てくる要素をタグ名だけで指定している CSS を探す
grep -rnE "^[[:space:]]*(h[1-6]|p|ul|ol|li|a|img|button|input|textarea|table|code|pre|blockquote)[[:space:]]*(,|\{)" src/ --include=*.css
```

出てきた指定は、クラスを足せば今までどおり効きます。

```css
h2 { margin-top: 40px; }           /* 効かなくなる */
.article h2 { margin-top: 40px; }  /* 効く */
```

### なぜ変えたか

Tailwind v3 のリセット（preflight）がライブラリのスタイルに勝っていて、**記事表示と Studio が崩れていました。** 実測で61箇所です。見出しの階層、段落の余白、画像、リストの点と番号、ボタンの背景、罫線のすべてが消えていました。

リセットはタグ名で指定されているので、これに勝つにはライブラリの優先順位を少し上げる必要がありました。その副作用として、あなたがタグ名だけで書いた指定も巻き込みます。

**`classNames` で渡したクラスは、今までどおり必ず勝ちます。** ここは変わりません。

<br>
<br>

## 0.3.0 から 0.4.0 への変更

**破壊的変更はありません。** 入れ替えるだけで動きます。挙動が変わる点だけ書きます。

### 追加

- **共有したときのサムネイル（OGタグ）。** 導入は上記の手順を参照してください。入れなければ何も変わりません
- **ドロップした画像がリロードで消えなくなりました。** 本文は localStorage、画像の実体は IndexedDB に保存されます。保存できない環境では画像欄にその旨が出ます

### 変わること

| | 0.3.0 | 0.4.0 |
| --- | --- | --- |
| `github` を渡したときのボタン | 「本番コミット」 | **「投稿」**（プッシュまで済むため） |
| 投稿ボタンを押したとき | すぐコミット | **確認が出る**（タイトル・ファイル名・画像の件数） |
| 投稿に成功した後 | 編集内容がそのまま残る | **雛形に戻る**（画像欄も空になる） |
| 「新しく書く」 | 画像は残っていた | **画像も捨てる** |

### 直したこと

- **ドロップした画像が本文プレビューに出なかった**のを直しました。react-markdown が `blob:` の URL を消していました。一覧タブのカードも同じ理由で出ていませんでした
- 操作帯のボタンの右に隙間が開くのを直しました
- 閉じる（×）ボタンが操作帯の高さによって崩れるのを直しました

<br>
<br>

## 0.2.0 から 0.3.0 への移行

**破壊的変更です。** `Article.id` が無くなり、`Article.slug` に替わりました。

### なぜ変えたか

`id` は `date` 昇順に並べた位置の番号でした。それを URL に使っていたため、
**既存より古い日付の記事を後から足すと、以降のすべての URL が別の記事を指しました。**
エラーも警告も出ず、静かにずれます。`slug` は記事に紐づくので動きません。

### 直す箇所は3つ

**1. リンクの生成**

```diff
- getArticleUrl={(article) => `/blog/${article.id}`}
+ getArticleUrl={(article) => `/blog/${encodeURIComponent(article.slug)}`}
```

**2. ルート定義**

```diff
- <Route path="/blog/:id" element={<BlogDetail />} />
+ <Route path="/blog/:slug" element={<BlogDetail />} />
```

**3. 記事の特定**

```diff
- const { id } = useParams();
- const article = articles[Number(id)];
+ const { slug } = useParams();
+ const article = articles.find((a) => a.slug === decodeURIComponent(slug ?? ""));
```

`decodeURIComponent` を忘れると、日本語を含む slug の記事が見つかりません。

### 記事ファイルの書き換えは不要です

`slug:` を書いていない記事は、**ファイル名から拡張子を除いたもの**が slug になります。

```
src/articles/2026-08-23-夏の更新.md  →  slug = "2026-08-23-夏の更新"
```

### 公開済みURLは変わります

`/blog/0` のような番号のURLは使えなくなります。すでに外部からリンクされている場合は、
ホスティング側でリダイレクトを設定してください。

### `renderLink` の key の型が変わりました

第3引数が `number` から `string`（`article.slug`）になりました。そのまま
`key={key}` に渡していれば修正は不要です。

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
| [docs/spec.md](./docs/spec.md) | 実装仕様書（設計の確定版。判断の理由はここに残しています） |
| [docs/tasks.md](./docs/tasks.md) | 実装タスクリストと進捗 |
| [docs/findings.md](./docs/findings.md) | 既知の問題と制約 |
| [docs/architecture.md](./docs/architecture.md) | 内部構造とデータフロー |

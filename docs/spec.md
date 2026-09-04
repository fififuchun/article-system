# @fififuchun/article-system 仕様書

この1枚が設計の確定版です。実装に必要な内容はすべてここに含まれています。

`design-decisions.md` と `design-revisions.md` は検討の経緯を残した記録であり、読む必要はありません。内容が食い違う場合はこの文書が優先します。

---

## 1. このライブラリは何か

**記事を書く側に提供する道具です。**

マークダウンを書いて記事にするまでの流れ — 書く、確認する、検証する、md として取り出す — を丸ごと引き受け、複数のプロジェクトで毎回作り直さずに済ませることが目的です。

読者向けの表示コンポーネント（`ArticleList` / `ArticleDetail`）も提供しますが、これらは **Studio のプレビューが本番と一致することを保証する土台**という位置づけです。

### 前提条件

- **Vite + React** プロジェクトであること（`import.meta.glob` に依存するため）
- **TypeScript** を使用していること
- React 18 以上

### 提供するもの

| 種別 | 名前 | 役割 |
| --- | --- | --- |
| 関数 | `createArticles` | md の文字列群から `Article[]` を生成する |
| 関数 | `validateArticle` | md の文字列を検証して問題の一覧を返す |
| コンポーネント | `ArticleStudio` | 執筆・プレビュー・検証・md 出力を行う画面 |
| コンポーネント | `ArticleDetail` | 記事詳細の表示 |
| コンポーネント | `ArticleList` | 記事一覧の表示 |
| スタイル | `styles.css` | そのまま公開できる完成度のデフォルトCSS |
| アイコン | 各種 | インライン SVG のアイコンセット |

---

## 2. 利用側プロジェクトの構成

```
your-project/
├── src/
│   ├── articles/
│   │   ├── 2026-08-22-夏の更新.md
│   │   └── _2026-08-23-書きかけ.md    ← 下書き（公開されない）
│   ├── lib/
│   │   └── articles.ts                ← 記事データの生成
│   └── pages/
│       ├── BlogList.tsx
│       ├── BlogDetail.tsx
│       └── BlogStudio.tsx
└── public/
    └── article_imgs/
        ├── art_0.webp
        └── art_1.webp
```

### 記事データの生成

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

**`[!_]` は必須です。** 理由は第4章で説明します。

`import.meta.glob` は Vite のビルド時処理のため、ライブラリ側ではなく利用側に書く必要があります。

### ルーティング

```tsx
import { Routes, Route } from "react-router-dom";

<Routes>
  <Route path="/blog" element={<BlogList />} />
  <Route path="/article/preview" element={<BlogStudio />} />
  {/* :id より前に定義する */}
  <Route path="/blog/:id" element={<BlogDetail />} />
</Routes>
```

Studio を本番に置くかどうかは利用側が決めます。ライブラリは認証を持ちません。

```tsx
{import.meta.env.VITE_STUDIO === "1" && (
  <Route path="/article/preview" element={<BlogStudio />} />
)}
```

---

## 3. データモデル

### Article 型

```ts
interface Article {
  id: number;           // date 昇順ソート後の index（0始まり）
  filename: string;     // 拡張子付きファイル名
  title: string;
  date: string;         // "YYYY-MM-DD" 公開日
  latestUpdate: string; // "YYYY-MM-DD" 最終編集日
  staff: string;        // 担当者名
  thumbnail: string;    // ファイル名のみ（パスなし）
  content: string;      // フロントマターを除いた本文
}
```

`filename` はファイル名衝突の検出と、将来の既存記事編集に使います。**URL には使いません**（識別子は `id`）。あくまで参考情報です。

### フロントマター

```markdown
---
title: 記事タイトル
date: 2026-08-23
latestUpdate: 2026-08-23
staff: 田中 花子
thumbnail: art_0.webp
---

## 見出し

本文...
```

| フィールド | 型 | 意味 |
| --- | --- | --- |
| `title` | string | 記事タイトル |
| `date` | YYYY-MM-DD | **公開日**。並び順と `id` の採番に使う |
| `latestUpdate` | YYYY-MM-DD | **最終編集日**。一覧カードに表示される |
| `staff` | string | 担当者名 |
| `thumbnail` | string | サムネイル画像のファイル名 |

すべて必須です。欠けると検証で止まります。

**新規作成時は `date` と `latestUpdate` の両方が今日になります。** 既存記事を編集したときだけ `latestUpdate` が動きます（v2 の機能）。

**未来日も許可します。** 静的サイトは再ビルドしないと内容が変わらないため予約投稿にはなりませんが、書くこと自体は止めません。

### id の採番

`date` 昇順にソートした後の index です。

```
id=0  2026-03-15   ← 最も古い
id=1  2026-08-20
id=2  2026-08-23   ← 最も新しい
```

**既知のリスク**: 既存記事より古い日付の記事を後から追加すると、以降の `id` がすべてずれて公開済みURLが別の記事を指します。

**対処**: Studio が `date` の初期値を常に今日にします。新しい記事は必ず末尾に付くため、既存の `id` は動きません。

### フロントマターのパース仕様

自前実装です。YAML ではありません。

```ts
function parseFrontmatter(raw: string): {
  data: Record<string, string>;
  content: string;
}
```

`---` で囲まれたブロックを行ごとに読み、**最初のコロン**で key と value に分けます。

| 記法 | 結果 |
| --- | --- |
| `title: 記事：その1` | ✅ 値の中のコロンは安全 |
| CRLF 改行 | ✅ 正しく処理される |
| `title: "記事"` | ❌ 引用符が値に含まれる → 検証で止める |
| `tags: [a, b]` | ❌ 文字列 `"[a, b]"` になる（配列にならない） |
| 複数行の値 | ❌ 2行目以降は無視される |
| `# コメント` | ❌ コロンがない行として読み飛ばされる |

フロントマターが無い場合は例外を投げず `{ data: {}, content: raw }` を返します。Studio で入力途中の壊れたテキストでもクラッシュしないためです。

---

## 4. 下書きの扱い ★実装上もっとも注意が必要

### 仕組み

下書きは**ファイル名の `_` 接頭辞**で区別します。

```
src/articles/
  _2026-08-23-書きかけの記事.md   ← 下書き
  2026-08-22-夏の更新.md          ← 公開
```

### なぜ glob パターンで除外しなければならないのか

`import.meta.glob` は**ビルド時にファイルの中身を JavaScript の文字列として埋め込みます**。

```js
// ビルド後の dist/assets/index.js（イメージ）
{
  "../articles/2026-08-22-夏の更新.md": "---\ntitle: 夏の更新\n...本文全部...",
  "../articles/_2026-08-23-書きかけ.md": "---\ntitle: 書きかけ\n...本文全部...",
}
```

`createArticles` の中で除外しても、それはブラウザ上で走る処理です。**下書きの本文はすでに配信済み**であり、開発者ツールから誰でも読めます。

そして glob パターンは**ファイルのパスしか見られません**。フロントマターに `draft: true` と書いても Vite はそれを読めないため除外できません。

**glob パターンによる除外が唯一の手段です。**

```ts
import.meta.glob("../articles/[!_]*.md", { ... })
```

### 混入時は例外を投げる

`createArticles` が `_` 始まりのファイルを受け取ったら、glob パターンが誤っている証拠です。**開発・本番を問わず例外を投げてページを停止させます。**

```ts
if (basename.startsWith("_")) {
  throw new Error(
    `[article-system] 下書きファイル "${basename}" がバンドルに含まれています。\n` +
    `本文が公開されています。import.meta.glob のパターンを\n` +
    `  "../articles/[!_]*.md"\n` +
    `に変更してください。`
  );
}
```

例外を投げても漏洩自体は取り消せません（すでに配信済みのため）が、**壊れたサイトが最も確実な警報**として機能し、放置される期間を最短にします。エラーメッセージには原因と直し方を必ず含めます。

---

## 5. createArticles

```ts
function createArticles(rawFiles: Record<string, string>): Article[]
```

### 処理

1. `Object.entries()` でファイルパスと中身を取得する
2. `_` 始まりのファイルがあれば例外を投げる（第4章）
3. 各ファイルの フロントマターをパースする
4. 検証を行い、問題があれば `console.warn` で出す
5. `date` 昇順（古い順）でソートする
6. ソート後の index を `id` として採番する

### 実装上の注意

**不正な日付でソートが壊れないようにします。** `new Date()` の比較で `NaN` が返ると `Array.prototype.sort` の結果は仕様上保証されません。実測でも順序が崩れます。

```
入力:  ["x", "2026-01-01", "2025-01-01"]
結果:  x, 2025-01-01, 2026-01-01     ← "x" が先頭に居座る
```

`YYYY-MM-DD` は辞書順と時系列順が一致するため、**文字列比較でソートします**。これで `NaN` が発生しません。

### 並び順

`date` 昇順（古い順）です。一覧を新しい順にしたい場合は利用側で反転します。

```tsx
<ArticleList articles={[...articles].reverse()} … />
```

`.reverse()` は破壊的なのでスプレッドでコピーしてから呼びます。`id` は保持されるので URL は壊れません。

---

## 6. バリデータ

Studio と `createArticles` の両方から使う独立した部品です。

```ts
interface Issue {
  level: "error";
  field?: string;
  message: string;
}

function validateArticle(
  raw: string,
  context?: {
    articles?: Article[];   // ファイル名衝突の検出用
    filename?: string;      // 検証対象のファイル名
  }
): Issue[]
```

### 検証ルール

| 検出内容 | 例 | 放置した場合に起きること |
| --- | --- | --- |
| 必須項目の欠落 | `latestUpdate` がない | `0年undefined月undefined日` と表示される |
| キー名の typo | `lastUpdate` と書いた | 同上。無言で通過する |
| 日付の形式違反 | `date: 2026/08/23` | ソートが壊れ、`id` の採番まで連鎖して崩れる |
| 引用符付きの値 | `title: "記事"` | 引用符ごと値に入る |
| フロントマターの閉じ忘れ | `---` が片方だけ | 全文が本文として扱われる |
| 更新日が投稿日より前 | `latestUpdate < date` | 論理矛盾 |
| 画像が見つからない | typo したファイル名 | 本番で壊れた画像になる |
| ファイル名の衝突 | 既存と同名 | 既存記事が物理的に上書きされ消える |

**未来日は検証しません。** 許可する方針のためです。

キー名の typo は、既知のフィールド名との編集距離が近い未知キーを検出して「`latestUpdate` の誤りでは」と示します。

### 画像の存在確認

ファイル一覧を受け取るのではなく、**実際に読み込んで確かめます**。

```
手書きの art_0.webp
  → imageBasePath + ファイル名 で画像の読み込みを試す
  → 成功 = リポジトリに実在する → 問題なし
  → 失敗 = 名前の間違い         → エラー

ドロップした画像
  → blob URL で表示。サーバーに無いのは当然なので検証対象外
  → 本番ダウンロード時の「配置してください」一覧へ
```

設定が増えず、既存画像の使い回しもでき、typo も捕まえられます。

**実装上の注意**: SPA のフォールバック設定によっては存在しないパスでも `index.html` が 200 で返ります。ステータスコードではなく `<img>` の `onError` で判定してください。

---

## 7. ArticleDetail

```tsx
<ArticleDetail
  article={article}
  imageBasePath="/article_imgs/"    // 既定値
  dateLabel="最終更新日時"           // 既定値
  classNames={{ ... }}              // 任意
/>
```

### Props

| prop | 型 | 必須 | 既定値 |
| --- | --- | --- | --- |
| `article` | `Article` | ✔ | — |
| `imageBasePath` | `string` | | `"/article_imgs/"` |
| `dateLabel` | `string` | | `"最終更新日時"` |
| `classNames` | `ArticleDetailClassNames` | | `{}` |

記事が見つからない場合のハンドリングはありません。利用側でガードします。

### DOM 構造

```html
<div class="as-article">
  <div class="as-header">
    <div class="as-date">
      <p class="as-date-year">2026</p>
      <p class="as-date-day">8/23</p>
    </div>
    <p class="as-title">記事タイトル</p>
  </div>

  <div class="as-latest-update">
    <svg class="as-date-icon">…</svg>
    <span>最終更新日時 2026年8月23日</span>
  </div>

  <img class="as-thumbnail" src="/article_imgs/art_0.webp">

  <!-- 本文（react-markdown の出力） -->
  <h2 class="as-heading">見出し</h2>
  <p  class="as-paragraph">本文...</p>
  <div class="as-image"><img src="/article_imgs/art_1.webp"></div>

  <p class="as-footer">担当：田中 花子</p>
</div>
```

### マークダウンの対応

| 記法 | 出力 |
| --- | --- |
| `##` | `<h2 class="as-heading">` |
| `###` | `<h3 class="as-subheading">` |
| `####` | `<h4 class="as-subsubheading">` |
| 段落 | `<p class="as-paragraph">` |
| `![](file.webp)`（画像だけの行） | `<div class="as-image"><img>` |
| 文中の画像（テキストと混在） | `<p>` の中にインラインの `<img>`。GitHub のマークダウンに準拠する |
| 単一改行 | `<br>`（remark-breaks） |
| 表・取り消し線・タスクリスト | 素の HTML 要素（remark-gfm）。CSS は子孫セレクタで当てる |
| リスト・引用・コードブロック | 同上 |
| 生の HTML | 無効。文字列としてエスケープされる |

`rehype-raw` を入れないため、**記事経由の XSS は構造的に防がれています**。

### 現行実装から修正する点

**1. 見出しを正しいタグで出力する**

```tsx
// Before — すべて div
h2: ({ children }) => <div className={classNames.heading}>{children}</div>,

// After
h2: ({ children }) => <h2 className={cx("as-heading", classNames.heading)}>{children}</h2>,
```

現在は `<div>` で出力しているため、スクリーンリーダーの見出しジャンプが効かず、検索エンジンも文書構造を読めません。デフォルトCSS側でブラウザ標準スタイルをリセットするので、見た目は変わりません。

**記事タイトルは `<p>` のままとし、`<h1>` は持ちません。** 本文の見出しが `<h2>` から始まるのを正常とします。CSS でタイトルが `h2` より大きく見えるよう階層を作ります。

**2. `<p>` の中に `<div>` が入る問題を解消する**

マークダウンでは画像だけの行も段落として扱われるため、現在の出力は不正な入れ子になっています。

```html
<div class="article-paragraph">
  <p><div class="article-image"><img></div></p>   ← 不正
</div>
```

CSR では動きますが、React 開発モードで `validateDOMNesting` 警告が出ます。SSR ではブラウザが `<p>` を自動で閉じ、ハイドレーションエラーになります。

段落のラッパーを1段（`<p class="as-paragraph">`）にし、画像は `<p>` でラップしません。

**3. その他**

| 項目 | 対処 |
| --- | --- |
| `thumbnail` が空でも `<img>` が出る | 未指定なら描画しない |
| 外部URLの画像が使えない | 絶対URL（`http://` `https://` `//` 始まり）は `imageBasePath` を前置せず素通し |

---

## 8. ArticleList

```tsx
<ArticleList
  articles={articles}
  imageBasePath="/article_imgs/"
  getArticleUrl={(article) => `/blog/${article.id}`}
  renderLink={(url, children, key) => <Link key={key} to={url}>{children}</Link>}
  classNames={{ ... }}
/>
```

### Props

| prop | 型 | 必須 | 既定値 |
| --- | --- | --- | --- |
| `articles` | `Article[]` | ✔ | — |
| `getArticleUrl` | `(article) => string` | ✔ | — |
| `renderLink` | `(url, children, key) => ReactNode` | ✔ | — |
| `imageBasePath` | `string` | | `"/article_imgs/"` |
| `classNames` | `ArticleListClassNames` | | `{}` |

`renderLink` でリンク要素の生成を利用側に委ねているため、**ルーターに一切依存しません**。React Router でも Next.js の `Link` でも素の `<a>` でも動きます。

返す要素に `key={key}` を付けるのは利用側の責任です。

カードに表示する日付は `latestUpdate` です。

### DOM 構造

```html
<div class="as-grid">
  <!-- renderLink が返す要素 -->
    <div class="as-card">
      <img class="as-card-image">
      <p class="as-card-title">記事タイトル</p>
      <div class="as-card-date">
        <svg class="as-card-date-icon">…</svg>
        <span>2026年8月23日</span>
      </div>
    </div>
</div>
```

---

## 9. ArticleStudio

### 接続

```tsx
// src/pages/BlogStudio.tsx
import { ArticleStudio } from "@fififuchun/article-system";
import { articles } from "../lib/articles";

export default function BlogStudio() {
  return <ArticleStudio articles={articles} storageKey="my-blog" />;
}
```

### Props

```ts
interface ArticleStudioProps {
  articles?: Article[];       // 衝突検出・一覧プレビュー用
  storageKey?: string;        // localStorage の保存先を分ける
  imageBasePath?: string;     // 既定 "/article_imgs/"
  dateLabel?: string;         // 既定 "最終更新日時"
  classNames?: ArticleStudioClassNames;
  articleClassNames?: ArticleDetailClassNames;
}
```

**v1 は新規作成専用**ですが、内部状態は「白紙から書く」ではなく**「編集中の記事」**としてモデル化します。既存記事編集（v2）は初期値を差し替えるだけで実現できる形にしておきます。

### レイアウト

```
PC（左右2ペイン）                     スマホ（上下2ペイン）
┌─編集────────┬─プレビュー──┐         ┌─編集──────────┐
│ ---         │ [詳細][一覧]│         │ ---           │
│ title: ...  │             │         │ title: ...    │
│ ---         │  2026       │         │ ---           │
│             │  8/23       │         ├───────────────┤
│ ## 見出し    │  記事タイトル│         │ [詳細][一覧]  │
│ 本文...      │  ────────   │         │  2026 8/23    │
│             │  見出し      │         │  記事タイトル   │
├─────────────┤  本文...     │         │  ────────     │
│画像 [名前][↓]│             │         └───────────────┘
├─────────────┤             │
│[本番DL][下書きDL]          │
└─────────────┴─────────────┘
```

### 編集ペイン

**生の md を1枚の textarea で編集します。** フォーム化しないことで、エディタとのコピーペーストが自由に行き来でき、ファイルの中身と 1:1 が保たれます。

### 起動時のテンプレート

localStorage が空のとき、この内容を初期表示します。

```markdown
---
title:
date: 2026-08-23
latestUpdate: 2026-08-23
staff:
thumbnail:
---

## 見出し

本文をここに書きます。
```

`date` と `latestUpdate` には今日の日付を入れます。`staff` は毎回入力する方針のため空にします。

**プレースホルダの値は入れません。** `title: 記事タイトルをここに書く` のような文字列を入れると値が入っていることになり検証を通ってしまうため、雛形のまま公開される事故が起きます。

**復帰する下書きがある場合はテンプレートを出しません。** 保存内容を上書きしてしまうためです。

Ctrl+A で全消しして空になっても、**テンプレートは自動で再挿入しません**。意図的に消したものを勝手に戻すと操作を奪うことになるためです。

### プレビューペイン

タブで2種類を切り替えます。

| タブ | 内容 |
| --- | --- |
| **詳細** | `ArticleDetail` をそのまま描画 |
| **一覧** | `ArticleList` に**直近6件**を渡す。新規記事を含めて日付の新しい順 |

一覧プレビューは既存記事に混ぜて表示します。隣の記事と並べることで、タイトルの折り返しやサムネイルの雰囲気を比較できます。挿入位置から `id` の予告も出せます。

タイトルの折り返しやサムネイルのトリミングは**詳細プレビューでは絶対に気づけない**ため、両方を確認できるようにします。

`ArticleDetail` / `ArticleList` をそのまま再利用することで、**プレビューと本番の一致が構造的に保証されます**。

### 検証のタイミング

**ダウンロードボタンを押したときに一括で検証します。** 執筆中は警告を出しません。

テンプレートの値が空である以上、常時検証すると起動直後から必須項目の欠落が3件出続けます。それに慣れてしまうと、後から出た本当の間違いを見落とします。

なお日付の形式違反は、**プレビューを見れば気づけます**。`ArticleDetail` が日付を描画するため、`2026/08/23` と書けばプレビューに `0年undefined月undefined日` が出ます。

### 2つのダウンロードボタン

| ボタン | 検証 | ファイル名 | 押した後 |
| --- | --- | --- | --- |
| **本番ダウンロード** | 必須。エラーがゼロでないと出せない | `2026-08-23-記事タイトル.md` | そのまま留まる |
| **下書きダウンロード** | しない | `_2026-08-23-記事タイトル.md` | そのまま留まる |

#### ファイル名の生成

日付とタイトルを自動連結します。`date` はフロントマターの値を使います。

- ファイルシステムで使えない文字（`/ \ : * ? " < > |`）を除去
- 空白をハイフンに変換
- 長すぎる場合は切り詰め
- 日本語はそのまま許容

#### 本番ダウンロード後の挙動

**編集内容はそのまま残します。** 白紙に戻す・退避する・復元する、のいずれも行いません。

出した直後に typo に気づいたらその場で直して出し直せます。次の記事に移るときは自分で消せばよく、消す操作より消えたものを取り戻す操作のほうが高くつきます。

### 自動保存

入力のたびに localStorage へ保存します。ボタンを押す必要がないため、保存忘れが原理的に起きません。

**保存先は `storageKey` で分けます。**

```
as-studio-draft:my-blog
as-studio-draft:another-site
```

`vite dev` はどのプロジェクトでも既定で `http://localhost:5173` を使い、localStorage はオリジン単位です。プロジェクトを順番に開発すると**下書きが混ざります**。`storageKey` 未指定でも既定値で動きますが、複数プロジェクトで使う場合は指定を推奨します。

デバイス間の同期は行いません。同一デバイスでの編集のみを対象とします。

### 画像

**ドラッグ&ドロップで仮登録します。アップロードは行いません。**

```
画像をドロップ
  → ブラウザ内だけの一時URL（blob）でプレビューに即反映
  → md にはファイル名だけが入る
  → Studio 上で名前を編集できる
  → 編集後の名前で画像をダウンロードできる
  → 本番DL時に「配置してください」一覧を提示
```

スマホの写真フォルダから選ぶと `IMG_1234.jpg` のような名前になるため、**その場でリネームできることが必須**です。リネーム後の名前で画像をダウンロードできるので、スマホだけで作業が完結します。

**既知の制約**: blob URL はリロードすると無効になります。localStorage から本文が復帰しても画像は消えているため、画像を貼り直す必要があります。これは許容します。

---

## 10. スタイル

### 同梱範囲

**そのまま公開できる完成度**まで作り込みます。

- 記事のタイポグラフィ（見出し階層・行間・余白）
- リスト・表・引用・コードブロック
- 一覧のグリッド
- Studio の2ペインレイアウト
- レスポンシブ

`classNames` を一切渡さなくても読める記事になることが目標です。

```tsx
// 新規プロジェクトで必要な全コード
import "@fififuchun/article-system/styles.css";
<ArticleDetail article={article} />
```

### クラスの付き方

`as-` 接頭のデフォルトクラスを**常時付与**し、`classNames` は**追記**します。

```
classNames 未指定:              <h2 class="as-heading">
classNames={{heading:"my-h"}}:  <h2 class="as-heading my-h">
```

`styles.css` の import は任意です。読み込まなければ `as-` クラスは無害なただの文字列になるため、**従来どおり全部自分で書く**運用もそのまま成立します。Tailwind のユーティリティクラスも追記で効きます。

### `:where()` で詳細度を0にする ★重要

```css
/* Before — 利用側と同点になり、CSSの定義順で勝敗が決まる */
.as-heading { font-size: 1.5rem; }

/* After — 詳細度0。利用側のクラスに必ず負ける */
:where(.as-heading) { font-size: 1.5rem; }
```

クラスセレクタは詳細度が同点です。同点だと CSS の定義順で勝敗が決まり、Vite のコード分割や HMR で順序が変わりえます。「昨日は効いていたのに今日は効かない」が起きます。

`:where()` は中身の詳細度を強制的に0にするため、読み込み順に関係なく上書きが常に効きます。**最初からこの形で書き始めます。**

### classNames の型

```ts
interface ArticleDetailClassNames {
  wrapper?: string; headerWrapper?: string; dateWrapper?: string;
  dateYear?: string; dateDay?: string; title?: string;
  latestUpdate?: string; dateIcon?: string; thumbnail?: string;
  heading?: string; subheading?: string; subsubheading?: string;
  paragraph?: string; image?: string; footer?: string;
}

interface ArticleListClassNames {
  grid?: string; card?: string; cardImage?: string;
  cardTitle?: string; cardDate?: string; cardDateIcon?: string;
}

interface ArticleStudioClassNames {
  wrapper?: string; editorPane?: string; textarea?: string;
  previewPane?: string; tabs?: string; issues?: string;
  imagePane?: string; actions?: string;
}
```

---

## 11. アイコン

幅広いアイコンセットとして提供します。

- **記事系** — 時計、人、タグ
- **Studio 系** — ダウンロード、画像、警告、閉じる
- **汎用** — 矢印、外部リンク、コピーなど

すべてインライン SVG で、`fill="currentColor"` により CSS の `color` で色が変わります。サイズは CSS で指定します。

```tsx
<ClockIcon className="my-icon" />
```

**named export のまま個別に出す**ことで、使わないアイコンは利用側のバンドルから tree-shaking で落ちます。`package.json` に `"sideEffects": false` を指定してください。

外部のアイコンライブラリには依存しません。現在の依存は react-markdown 系の3つだけで、それも `external` 指定でバンドルから外しています。この軽さを保ちます。

---

## 12. ビルドと配布

### ビルド設定

```ts
// tsup.config.ts
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["react", "react-dom", "react-markdown", "remark-gfm", "remark-breaks"],
});
```

### package.json

```json
{
  "sideEffects": false,
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./styles.css": "./dist/styles.css"
  },
  "peerDependencies": { "react": ">=18" }
}
```

`exports` の条件は**記述順にマッチする**ため、`types` を先頭に置きます。

### インストール方法

```bash
# 推奨: タグで固定する
npm i github:fififuchun/article-system#v0.2.0

# 非推奨: npm update で意図せず更新される
npm i github:fififuchun/article-system
```

**`npm link` と `file:../` は使えません。** どちらもローカルのファイルシステム上のパスを指す仕組みで、Vercel や Netlify のビルド環境には存在しないためです。Studio を本番サイトに常設する以上、この方式では利用側プロジェクトをデプロイできません。

### dist のコミット

`dist/` はリポジトリにコミットし続けます。GitHub から直接インストールするため、成果物が入っていないと動きません。

**`dist` のコミット忘れが即座に利用側の不具合になります。** `src` を直して `npm run build` を忘れると、GitHub 上のコードと配布物がズレたまま各プロジェクトに配られます。pre-commit フックで同期を機械的に強制します。

### Studio コードの分離について

`./studio` エントリポイントへの分離は**後回し**とします。

現在のバンドル 307KB のうち 156KB は react-markdown 系で、これは読者向けの `ArticleDetail` が使うため Studio の有無に関わりません。Studio 固有の増分は十数KB程度（gzip 後は数KB）と見積もられ、個人ブログの規模では影響がありません。Studio が育った段階で対応します。

---

## 13. README に記載する項目

- `import.meta.glob` のパターンは `[!_]*.md` にすること（**必須**）
- インストールはタグで固定すること
- `styles.css` の import 方法と、読み込まない場合の挙動
- 複数プロジェクトで使う場合は `storageKey` を指定すること
- Studio を本番に置く場合、ホスティング側の認証を強く推奨すること
- `subsubheading`（`####`）が `classNames` に存在すること（現在の README に記載漏れ）
- 一覧を新しい順にするには `[...articles].reverse()` が必要なこと

---

## 14. 実装順序

1. **バリデータの切り出しとテスト** — Studio と `createArticles` の両方が依存するため最初に必要
2. **`createArticles` の改修** — `Object.entries()` 化、`filename` 追加、`_` 検出と throw、文字列比較によるソート
3. **表示コンポーネントの修正** — 見出しタグ、`<p>` の入れ子、画像パス、`as-` クラス付与
4. **`styles.css` の作成** — 最初から `:where()` で書く。3が終わらないとクラス構造が固まらない
5. **アイコンセット** — 4と並行可能
6. **`ArticleStudio`** — 上記すべてに依存する
7. **配布まわり** — `exports` 追加、`sideEffects` 追加、pre-commit フック、README 改訂

テストは `parseFrontmatter` / `createArticles` / `validateArticle` に置きます。いずれも入出力が明確な純粋関数で、コストが低く、エッジケースの回帰を防げます。

**コンポーネントには DOM テストを置きます。** 検証するのは**構造だけ**です — 見出しのタグ、`<p>` の入れ子、`as-` クラスの付与、`thumbnail` 未指定時の非描画、絶対URLの素通し、そして `ArticleStudio` の状態遷移（下書き復帰、タブ切替、検証のタイミング）。**見た目は検証しません**。スタイルの確認は `demo/` での目視で行います。

jsdom は純粋関数のテストより桁違いに遅いため、環境はファイル単位で指定します（`// @vitest-environment jsdom`）。純粋関数のテストは Node 環境のまま高速に保ちます。

---

## 15. 将来やること（v1 では実装しない）

| 項目 | 内容 |
| --- | --- |
| **既存記事の編集** | `articles` から選んで開き、`latestUpdate` を自動更新する |
| **画像のアップロード** | GitHub Contents API で `public/article_imgs/` に直接コミットする。実現すれば blob 消失の制約も解消される |
| **md の GitHub コミット** | ダウンロードを経由せず直接コミットする。トークンは localStorage に保存し、ホスティング認証が必須になる |
| **日付衝突の警告** | 既存記事より古い日付を検出して `id` のずれを警告する |
| **Studio コードの分離** | `./studio` エントリポイントに分け、読者向けバンドルから外す |

---

## 16. 意図的に受け入れている制約

設計上わかっていて許容している点です。実装で解決しようとしないでください。

| 制約 | 理由 |
| --- | --- |
| `<h1>` を持たない | 記事の見出しが `<h2>` から始まるのを正常とする |
| デバイス間で下書きが同期されない | 同一デバイスでの編集のみを対象とする |
| リロードすると貼った画像が消える | アップロードを行わないため。貼り直しで対応 |
| 未来日の typo を検出できない | 未来日を許可する方針のため |
| ファイル名を変えれば検証を回避できる | 別の手段で対処する |
| ファイル名と `date` がずれうる | 中身（フロントマター）を信じる。ファイル名は付属情報 |
| ファイル名の大文字小文字を区別する | `A.md` と `a.md` は別ファイルとして扱う。大文字小文字を区別しないファイルシステムでは衝突しうるが、検出しない |
| `staff` を毎回入力する | 記憶させない |
| 例外を投げても漏洩は取り消せない | 放置期間を最短にするための警報として機能させる |

---

記録日: 2026-08-23 / 対象コミット: `2072733`

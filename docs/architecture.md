# アーキテクチャ

## 全体のデータフロー

```
[利用側プロジェクト]                       [ライブラリ]

src/articles/*.md
      │
      │ Vite の import.meta.glob(..., { query: "?raw", eager: true })
      │ ※ ビルド時に静的解決される。利用側に書く必要がある
      ▼
Record<パス, ファイル内容の文字列>
      │
      ├──────────────────────────────▶ createArticles()
      │                                      │
      │                                      ├─ parseFrontmatter() で --- ブロックを分離
      │                                      ├─ date 昇順（古い順）でソート
      │                                      └─ ソート後の index を id として採番
      ▼                                      ▼
export const articles              Article[]
      │
      ├──▶ <ArticleList articles renderLink getArticleUrl classNames />
      │         └─ カードを並べ、リンク要素の生成は renderLink に委譲
      │
      └──▶ <ArticleDetail article classNames />
                └─ react-markdown で content を描画
                   components マップで h2/h3/h4/p/img を差し替え、classNames を付与

              <ArticlePreview />
                └─ textarea の中身をその場で parseFrontmatter し
                   ArticleDetail に流して即時プレビュー
```

重要なのは、**`import.meta.glob` の呼び出しがライブラリ側ではなく利用側にある**ことです。`import.meta.glob` は Vite がビルド時にソースコードを静的解析して展開する構文であり、コンパイル済みの `dist/index.js` の中に書いても展開されません。そのため README では `src/lib/articles.ts` を利用側に作らせ、そこで glob してから `createArticles` に渡させています。ライブラリが受け取るのは、あくまで「ファイル内容の文字列マップ」という素朴なデータです。

この境界の引き方によって、`createArticles` 自体は Vite にもファイルシステムにも依存しない純粋関数になっています。テストも書きやすく、将来 Vite 以外の仕組みで読み込む場合も差し替えが効きます。

## 各モジュールの責務

### `src/parser.ts` — フロントマターの分離

```ts
const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
```

正規表現1本でフロントマターと本文を分け、行ごとに**最初のコロン**で key / value に切ります。gray-matter や js-yaml といった依存を持たず、約18行で完結しています。

`indexOf(":")` で切っているため、`title: 記事：その1` のように値の側にコロンが含まれても正しく動きます。一方で YAML の機能（引用符、複数行、リスト、コメント）は一切解釈しません。詳細は [findings.md](./findings.md) を参照。

フロントマターが無い場合は `{ data: {}, content: raw }` を返すため、例外を投げません。この寛容さが `ArticlePreview` で効いてきます（入力途中の壊れたテキストでもクラッシュしない）。

### `src/createArticles.ts` — 記事配列の生成

```ts
.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
.map((article, index) => ({ ...article, id: index }))
```

やっていることは3つだけです。

1. 各ファイルをパースし、欠けたフィールドは `?? ""` で空文字に落とす
2. `date` の昇順（**古い記事が先頭**）でソート
3. ソート後の並び順をそのまま `id` にする（0始まり）

`Object.values()` を使っているのでファイルパスは捨てられます。つまり**ファイル名は記事の識別に一切使われていません**。ファイル名の日付部分（`2024-03-15-first-steps.md`）は人間が並べ替えて眺めるためのもので、システム的な意味は持ちません。実際に効くのはフロントマターの `date` だけです。

`id` がソート結果に連動する設計は、記事の追加だけで済むという手軽さと引き換えに、URL の安定性を犠牲にしています（[findings.md](./findings.md) の「ID の不安定性」を参照）。

### `src/components/ArticleDetail.tsx` — 記事詳細

react-markdown の `components` マップで、マークダウンの見出しと段落を差し替えています。

```ts
h2: ({ children }) => <div className={classNames.heading}>{children}</div>,
h3: ({ children }) => <div className={classNames.subheading}>{children}</div>,
h4: ({ children }) => <div className={classNames.subsubheading}>{children}</div>,
p:  ({ children }) => <div className={classNames.paragraph}><p>{children}</p></div>,
img: ({ src, alt }) => <div className={classNames.image}><img src={`${imageBasePath}${src}`} /></div>,
```

見出しが `<h2>` ではなく `<div>` になっている点は設計上の意図的な選択に見えます（利用側でブラウザ標準スタイルの打ち消しが不要になる）。ただし見出しレベルの情報が DOM から失われるため、アクセシビリティ・SEO の観点ではトレードオフがあります。

段落だけは `<div><p>` の二重構造で、外側にクラスを付けています。おそらく「段落ごとに余白やボーダーを付けたいが、内側のテキストは `<p>` のままにしたい」という要求から来た形です。

`remarkBreaks` を入れているため、**マークダウン標準と違い単一改行がそのまま `<br>` になります**。日本語の記事執筆では自然な挙動で、日本語話者向けを意識した選択です。

日付は `article.date.split("-").map(Number)` で分解し、`{year}` / `{month}/{day}` を別要素に出しています。`Date` オブジェクトを経由しないためタイムゾーンのズレが起きません。素朴ですが正しい実装です。

### `src/components/ArticleList.tsx` — 記事一覧

このライブラリでもっとも特徴的な部分が `renderLink` です。

```ts
renderLink: (url: string, children: React.ReactNode, key: number) => React.ReactNode
```

ライブラリ側はカードの中身（画像・タイトル・日付）だけを組み立て、それを `children` として渡します。リンク要素そのものは利用側が作ります。この一手間によって、react-router-dom への依存が完全に消えています。ルーターを peerDependency にすると利用側のバージョンに縛られるため、それを避ける妥当な設計です。

なお一覧のカードに表示される日付は `article.date` ではなく **`article.latestUpdate`** です。詳細ページのヘッダーが `date`（投稿日）、一覧が `latestUpdate`（更新日）という使い分けになっています。

### `src/components/ArticlePreview.tsx` — 執筆用プレビュー

`useState` で保持した textarea の文字列を、毎レンダリングで `parseFrontmatter` にかけ、`ArticleDetail` にそのまま流し込む2カラム構成です。50行程度で、記事執筆時の確認画面が成立しています。

`ArticleDetail` を再利用しているため、**プレビューと本番の見た目が構造的に一致することが保証されます**。プレビュー専用の描画ロジックを持たないのは良い判断です。

### `src/icons/ClockIcon.tsx`

インライン SVG の時計アイコン。`fill="currentColor"` なので CSS の `color` で色が変わります。このライブラリが同梱する唯一のビジュアル要素で、公開エクスポートにも含まれているため利用側から単体で使えます。

## ビルド構成

```ts
// tsup.config.ts
entry: ["src/index.ts"],
format: ["esm"],           // ESM のみ。CJS は出力しない
dts: true,                 // 型定義を生成
clean: true,
external: ["react", "react-dom", "react-markdown", "remark-gfm", "remark-breaks"],
```

出力は `dist/index.js` と `dist/index.d.ts` の2ファイルのみです。マークダウン関連は `dependencies` に入っていますが `external` 指定でバンドルから除外されるため、利用側の node_modules にあるものが使われます。React の二重ロードを避ける通常の作法に従っています。

## デモアプリ

`demo/` は `"@fififuchun/article-system": "file:../"` でルートを参照する独立した Vite アプリです。ルーターは導入せず、`window.location.hash` と `hashchange` イベントによる自前の30行ほどのルーティングで済ませています。ライブラリがルーター非依存であることを、デモ自身が実証する形になっています。

画像は `imageBasePath` に `https://placehold.co/800x400/...?text=` を渡すことで、プレースホルダ画像サービスに解決させています。`imageBasePath + ファイル名` という単純な文字列結合であることを逆手に取った小技で、デモ用の画像アセットを一切リポジトリに置かずに済んでいます。

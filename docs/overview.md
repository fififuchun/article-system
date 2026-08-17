# プロジェクト概要

## 一言でいうと

**Vite + React プロジェクト向けの、マークダウン記事表示ライブラリ**です。
アプリケーションではなくライブラリ（npm パッケージ）であり、`src/articles/` に `.md` を置くだけで記事一覧・詳細ページが成立することを狙っています。

`article-system` という名前ですが、CMS でもサーバーでもありません。ビルド時にマークダウンを読み込んで配列に変換する関数と、それを描画する React コンポーネント3つだけの、非常に小さなパッケージです。

## 設計上の中心的な決定

このライブラリの性格を決めているのは次の3点です。

1. **スタイルを一切持たない**
   CSS ファイルを同梱せず、すべての要素に `classNames` prop 経由でクラス名を注入させます。ライブラリ側は DOM 構造だけを提供し、見た目は利用側が100%決めます。
2. **ルーターに依存しない**
   `ArticleList` はリンク要素を自分で作らず、`renderLink` コールバックで利用側に描画させます。React Router でも Next.js の `Link` でも素の `<a>` でも動きます。
3. **ビルド時に完結する**
   記事の読み込みは Vite の `import.meta.glob` に任せ、その呼び出し自体は利用側に書かせます。ランタイムの fetch もサーバーも不要で、成果物は静的サイトとして配信できます。

## 技術スタック

| 項目 | 内容 |
| --- | --- |
| 言語 | TypeScript 5.7（`strict: true`） |
| UI | React 18以上（`peerDependencies`） |
| ビルド | tsup 8（esbuild ベース）、ESM 単一フォーマット、`dts: true` |
| Markdown | react-markdown 9 + remark-gfm 4 + remark-breaks 4 |
| デモ | Vite 5 + @vitejs/plugin-react、React 18 |
| 配布 | npm レジストリではなく **git clone + `npm link`** 前提 |

## リポジトリ構成

```
article-system/
├── src/                        ← ライブラリ本体（これがビルド対象）
│   ├── index.ts                公開エントリポイント
│   ├── types.ts                Article 型と classNames 型
│   ├── parser.ts               フロントマターの自前パーサ
│   ├── createArticles.ts       raw文字列 → Article[] 変換
│   ├── components/
│   │   ├── ArticleList.tsx     記事一覧
│   │   ├── ArticleDetail.tsx   記事詳細
│   │   └── ArticlePreview.tsx  執筆用ライブプレビュー
│   └── icons/ClockIcon.tsx     インラインSVG（唯一の同梱アセット）
├── dist/                       ← ビルド成果物。git にコミットされている
├── demo/                       ← 独立した Vite アプリ（動作確認用）
│   └── src/articles/*.md       サンプル記事3本
├── demo.sh                     デモ起動スクリプト（依存が無ければ npm install してから vite）
├── tsup.config.ts
└── README.md                   利用者向けドキュメント
```

`src/` はコメントがほぼ無く、全ファイル合計でも 250 行程度です。読み切るのに時間はかかりません。

## 配布方法が特殊な点

`.gitignore` を見ると `dist/` の無視が**コメントアウトで解除**されており、直近のコミット `ce86c36「distもビルドに含める」` でビルド成果物が意図的にリポジトリへ入りました。npm publish はされておらず（version は `0.1.0` のまま）、README も `git clone` → `npm run build` → `npm link` という手順を案内しています。

つまりこれは**公開パッケージではなく、作者が自分の複数プロジェクトで使い回すための私的ライブラリ**として運用されています。`dist/` をコミットしているのは、リンク先やデプロイ環境でビルドを走らせずに済ませるためと読めます。

## 開発の経緯（git 履歴）

```
61f4e9f first commit
9094b8d Add initial README with project title and description
aca58d8 仕様書・デモ起動のシェル追加
7486059 デモページの作成
03c0632 SPECは削除・README更新       ← 仕様書を廃し README に一本化
12ec1de ####タグ追加                 ← h4 のサポート追加
9354b0b アイコン追加                 ← ClockIcon
ce86c36 distもビルドに含める
```

コミット8件、いずれも単独作者による小刻みな追加です。一度は `SPEC` ファイルを置いたものの README に統合して削除している点から、ドキュメントを一箇所に集めたい意向が読み取れます。

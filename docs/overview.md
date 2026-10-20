# overview.md — プロジェクトの正体

## 何をするものか

**記事を書く側に提供する道具です。** マークダウンを書いて記事にするまでの流れ — 書く、確認する、検証する、md として取り出す — を丸ごと引き受け、複数のプロジェクトで毎回作り直さずに済ませることが目的です。

読者向けの表示コンポーネント（`ArticleList` / `ArticleDetail`）も提供しますが、これらは **Studio のプレビューが本番と一致することを保証する土台**という位置づけです。

書いた記事は**ブラウザから直接 GitHub へ投稿**できます（spec §15）。共有したときのサムネイル（OGタグ）は、ビルド時に記事ごとの HTML を書き出して実現します（spec §18）。

## 前提条件

- **Vite + React**（`import.meta.glob` に依存）
- **TypeScript**
- React 18 以上

## 技術スタック

| 用途 | 使っているもの |
| --- | --- |
| ビルド | tsup（esbuild）。ESM のみ出力 |
| テスト | vitest。DOM は jsdom をファイル単位で指定 |
| マークダウン | react-markdown + remark-gfm + remark-breaks |
| 型 | TypeScript 5.7 |
| IndexedDB のテスト | fake-indexeddb（Studio の画像の保存） |
| Tailwind との同居の確認 | `demo/tailwind.html`（Tailwind v3 の preflight 入り。spec §10） |

実行時の依存は react-markdown 系の3つだけで、それも `external` 指定でバンドルから外しています。アイコンは自前のインライン SVG で、外部のアイコンライブラリには依存しません。

## リポジトリ構成

```
src/
├── index.ts               公開API
├── types.ts               Article と各 ClassNames
├── parser.ts              フロントマターのパース（自前実装。YAML ではない）
├── createArticles.ts      md 群 → Article[]
├── validate.ts            md の検証
├── levenshtein.ts         キー名 typo 検出用の編集距離
├── cx.ts                  クラス名の連結
├── formatDate.ts          YYYY-MM-DD の分解
├── resolveImageSrc.ts     画像パスの解決
├── resolveSlug.ts         slug の決め方（本体とプラグインが共有。spec §18）
├── buildDescription.ts    本文から共有用の説明文を作る
├── buildArticleHead.ts    記事から og: タグを作る
├── specificity.ts         CSS セレクタの詳細度の計算（テスト用。spec §10）
├── stylesheetWarning.ts   CSS の版の取り違えを警告（spec §10）
├── styles.css             デフォルトCSS（全セレクタ (0,0,2)。spec §10）
├── css/
│   └── wrapInLayer.ts     @layer components 版の組み立て（spec §10）
├── components/
│   ├── ArticleDetail.tsx      記事詳細
│   ├── ArticleList.tsx        記事一覧
│   ├── ArticleStudio.tsx      執筆画面
│   └── ArticleStudioRoute.tsx #/studio で全画面に開く入り口
├── studio/                Studio が使う純粋関数群
│   ├── buildTemplate.ts     雛形の生成
│   ├── buildFilename.ts     ファイル名の生成
│   ├── buildDraftArticle.ts md → Article
│   ├── buildImagePath.ts    画像を日付のフォルダに入れる
│   ├── draftStorage.ts      下書きの保存と復帰（localStorage）
│   ├── imageStorage.ts      画像の保存と復帰（IndexedDB）
│   ├── downloadFile.ts      Blob のダウンロード
│   ├── renameImage.ts       画像名の置き換え
│   ├── collectImageNames.ts 参照している画像名の収集
│   ├── hashRoute.ts         ハッシュの一致判定と購読
│   └── probeImages.ts       画像の存在確認
├── github/                GitHub への投稿（spec §15）
│   ├── api.ts               認証付き fetch の薄いラッパ
│   ├── verifyToken.ts       トークンの検証
│   ├── tokenStorage.ts      sessionStorage への保持
│   ├── useGitHubToken.ts    貼り付け・検証・破棄
│   ├── resolveConfig.ts     既定値の解決
│   └── commitArticle.ts     Git Data API で1コミット
├── vite/                  ビルド時に Node で走る側（spec §18）
│   ├── index.ts             `/vite` エントリ
│   └── articleOgTags.ts     記事ごとの HTML を書き出すプラグイン
└── icons/                 インライン SVG 10種

dist/       ビルド成果物。**コミットし続ける**（GitHub から直接インストールするため）
demo/       動作確認用の Vite アプリ
docs/       このディレクトリ
```

## 配布

GitHub から直接インストールします。`npm link` と `file:../` は**使えません**。どちらもローカルのパスを指すため、Vercel や Netlify のビルド環境に存在せず、利用側プロジェクトをデプロイできなくなります。

`dist/` のコミット忘れは即座に利用側の不具合になるため、pre-commit フック（`.githooks/pre-commit`）で機械的に止めています。クローン後は次の設定が必要です。

```bash
git config core.hooksPath .githooks
```

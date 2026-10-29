# architecture.md — データフローと責務

## 全体の流れ

```
src/articles/*.md
      │  import.meta.glob（利用側に書く。ビルド時にファイルの中身を埋め込む）
      ▼
Record<パス, 中身>
      │  createArticles
      ├─ _ 始まりを検出 → 例外を投げてページを止める
      ├─ parseFrontmatter
      ├─ validateArticle → 問題があれば console.warn
      ├─ date 昇順ソート（文字列比較）
      └─ slug を決定（フロントマター優先 / ファイル名）
      ▼
Article[]  ──→ ArticleList / ArticleDetail（読者向け）
           └─→ ArticleStudio（書き手向け。プレビューと衝突検出に使う）
```

Studio 側は逆向きに流れます。

```
textarea の md 文字列
      ├─ draftStorage        入力のたび localStorage へ保存
      ├─ buildDraftArticle   → Article（プレビュー用。slug は URL の予告）
      │        └─ ArticleDetail / ArticleList をそのまま描画
      ├─ imageStorage        ドロップした画像を IndexedDB へ保存
      └─ 本番ボタン
             ├─ validateArticle    フロントマターの検証
             ├─ probeImages        画像の存在確認（読み込みを試す）
             └─ github あり ─→ window.confirm で確認
             │                  └─ commitArticle（md と画像を1コミット）
             │                       └─ 成功したら雛形に戻す
             └─ github なし ─→ downloadFile（Blob として保存）
```

ビルド時にもう1本、読者向けの HTML を作る流れがあります（spec §18）。

```
src/articles/*.md
      │  articleOgTags（Vite プラグイン。Node で動く）
      ├─ parseFrontmatter
      ├─ resolveSlug        ← createArticles と同じ関数を呼ぶ
      └─ buildArticleHead   og: タグと <title> の文字列
      ▼
dist/{path}/{slug}/index.html   dist/index.html の <head> にタグを入れたコピー
```

## 設計の柱

### プレビューと本番を同じコンポーネントで描く

Studio のプレビューは `ArticleDetail` / `ArticleList` を**そのまま**呼びます。プレビュー専用の描画を持たないため、片方だけ直して食い違う、ということが起こりえません。

### ルーターに依存しない

`ArticleList` はリンク要素の生成を `renderLink` で利用側に委ねます。React Router でも Next.js の `Link` でも素の `<a>` でも動きます。Studio のプレビューでは遷移させたくないので `<div>` を返しています。

### スタイルは持つが、利用側のクラスには必ず負ける

`styles.css` のセレクタは**すべて詳細度 (0,0,2)** です。条件は2つで、どちらも読み込み順に依存させないためです（spec §10）。

| | 条件 | 書き方 | 保証 |
| --- | --- | --- | --- |
| 1 | クラス相当の桁を0にする | `:where()` で包む | 利用側のクラス (0,1,0) に必ず負ける |
| 2 | 型セレクタを2つ以上にする | `html body` を前置する | 要素リセット (0,0,1) に必ず勝つ |

**条件2は Tailwind v3 の preflight のために足しました。** タグ名のリセット（`h2 { font-size: inherit }` など）が詳細度0のライブラリに勝ち、実測で61箇所が崩れていました。型セレクタを何個積んでもクラス1つには勝てないため、1と2は両立します。

`src/styles.test.ts` が全セレクタの詳細度を計算し、2条件の違反をコミット前に止めます。詳細度の計算は `specificity.ts` に切り出してテストしています。

### 見た目はテーマ（変数のセット）で決める

`styles.css` は**構造と既定値**を持ち、見た目の値は CSS変数に出してあります。装飾（見出しの左線、日付の縦線、カードの影など）も変数なので、`none` を入れれば消えます。

**変数はページ全体で共有される値なので、`:root` に置けば本番の記事ページと Studio のプレビューの両方が同じものを読みます。** `props` を渡す必要がありません。これが「プレビューと本番を1か所から描く」の実現方法です（spec §10 テーマ）。

| | 置き場所 |
| --- | --- |
| 既定（青基調） | `styles.css` の `:where(:root)` |
| 同梱の `minimal` | `styles.css` の末尾。`<html data-as-theme="minimal">` で切り替え |
| 利用側のデザイン | **利用側のプロジェクト。** ライブラリは持たない |

テーマ用の変数と Studio の画面用の変数（`--as-studio-radius`）は分けてあります。記事のデザインを変えただけで編集画面の見た目が動かないようにするためです。

### CSS を2つ配る

Tailwind v4 は自分の CSS をすべてカスケードレイヤーに入れます。**層に入っていない CSS は層の中に必ず勝つ**ため、層の外にいると利用側のユーティリティにまで勝ってしまいます。

| 読む側 | ファイル | 仕組み |
| --- | --- | --- |
| Tailwind v3 / Tailwind なし | `styles.css` | 層なし・(0,0,2) |
| Tailwind v4 | `styles.layer.css` | `@layer components` に入る |

v3 は本物の `@layer` を書くとビルドが止まるため、1つのファイルでは両立できません。層あり版は**ビルド時に層なし版を包んで生成**します（`css/wrapInLayer.ts`）。中身を2つ管理しません。

取り違えは `stylesheetWarning.ts` が実行時に1回だけ知らせます。

### 下書きの漏洩は glob でしか防げない

`import.meta.glob` はビルド時にファイルの中身を JavaScript の文字列として埋め込みます。`createArticles` の中で除外してもブラウザ上の処理であり、**本文はすでに配信済み**です。glob パターンによる除外が唯一の手段で、混入時は例外を投げて**壊れたサイトを警報として使います**。

## モジュールの責務

| モジュール | 責務 | 備考 |
| --- | --- | --- |
| `parser.ts` | フロントマターの分離 | YAML ではない自前実装。壊れた入力でも例外を投げない（Studio で入力途中でもクラッシュさせないため） |
| `createArticles.ts` | md 群 → `Article[]` | ソートは文字列比較。`new Date()` だと不正な日付で `NaN` になり順序が保証されない |
| `validate.ts` | md の検証 | 同期・純粋。画像の存在確認は含まない |
| `levenshtein.ts` | 編集距離 | typo 検出の閾値は2（spec §6 の例 `lastUpdate` → `latestUpdate` を拾える最小値） |
| `resolveImageSrc.ts` | 画像パスの解決 | 絶対URL・`blob:`・`data:` は素通し |
| `resolveSlug.ts` | slug の決め方 | **`createArticles` と Vite プラグインの両方が呼ぶ。** 2か所に書くとブラウザ側とビルド側で違う URL になり、静かにずれる |
| `buildDescription.ts` | 本文 → 説明文 | マークダウンの記号を落として120文字で切る。アンダースコアは残す（ファイル名を壊さない） |
| `buildArticleHead.ts` | 記事 → `og:` タグ | 属性値を escape し、URL は `URL` に任せて絶対化する |
| `specificity.ts` | 詳細度の計算 | テストが2条件を測るために使う。完全な CSS パーサではない |
| `stylesheetWarning.ts` | CSS の版の取り違えの検出 | 判定は純関数。誤検出するより気づけないほうを選ぶ |
| `css/wrapInLayer.ts` | 層あり版の組み立て | ビルド時にだけ使う。配布物には入らない |
| `specificity.ts` の使い先 | `styles.test.ts` | 詳細度の2条件、テーマの順序、`minimal` の中身をすべて CSS のテキストから検査する |
| `studio/*` | Studio の部品 | UI を持たない純粋関数に切り出し、テストで守る |
| `github/*` | GitHub への投稿 | `github` を渡さない利用側ではコードが一切動かないよう、コンポーネントを分けている |
| `vite/*` | ビルド時の HTML 生成 | **`vite` に依存しない。** 型だけのために依存すると、利用側の Vite 更新に追従し続けることになる |
| `components/*` | 描画 | DOM テストで**構造だけ**を検証する。見た目は `demo/` で目視 |

## テストの方針

| 対象 | 方法 |
| --- | --- |
| 純粋関数 | Node 環境で通常のテスト |
| コンポーネント | jsdom で DOM テスト。ファイル先頭に `// @vitest-environment jsdom` |
| `styles.css` | ファイルを読んで**全セレクタの詳細度を計算**し、2条件を検査 |
| `styles.layer.css` | 層なし版を包んだだけであること（印1行を除いて同一）を検査 |
| Tailwind との同居 | `demo/tailwind.html` での目視。v4 は使い捨ての一時プロジェクトで検証 |
| 見た目 | `demo/` での目視のみ |

**Blob ダウンロード・画像のドラッグ&ドロップ・画像の存在確認の3件はテストを書いていません。** jsdom がこれらの API を実装しておらず、モックの正しさ自体は検証できないためです。ロジックは純粋関数（`downloadFile` / `probeImages` / `renameImage`）に切り出してあり、そちらはテストで守られています。

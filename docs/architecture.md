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
      └─ ダウンロードボタン
             ├─ validateArticle    フロントマターの検証
             ├─ probeImages        画像の存在確認（読み込みを試す）
             └─ downloadFile       Blob として保存
```

## 設計の柱

### プレビューと本番を同じコンポーネントで描く

Studio のプレビューは `ArticleDetail` / `ArticleList` を**そのまま**呼びます。プレビュー専用の描画を持たないため、片方だけ直して食い違う、ということが起こりえません。

### ルーターに依存しない

`ArticleList` はリンク要素の生成を `renderLink` で利用側に委ねます。React Router でも Next.js の `Link` でも素の `<a>` でも動きます。Studio のプレビューでは遷移させたくないので `<div>` を返しています。

### スタイルは持つが、必ず負ける

`styles.css` のセレクタはすべて `:where()` で包み**詳細度を0**にしています。クラスセレクタは詳細度が同点で、同点だと定義順で勝敗が決まり、Vite のコード分割や HMR で順序が変わりえます。`:where()` なら読み込み順に関係なく利用側の上書きが効きます。

`src/styles.test.ts` が全セレクタを検査し、`:where()` の付け忘れをコミット前に止めます。

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
| `studio/*` | Studio の部品 | UI を持たない純粋関数に切り出し、テストで守る |
| `components/*` | 描画 | DOM テストで**構造だけ**を検証する。見た目は `demo/` で目視 |

## テストの方針

| 対象 | 方法 |
| --- | --- |
| 純粋関数 | Node 環境で通常のテスト |
| コンポーネント | jsdom で DOM テスト。ファイル先頭に `// @vitest-environment jsdom` |
| `styles.css` | ファイルを読んで `:where()` を検査 |
| 見た目 | `demo/` での目視のみ |

**Blob ダウンロード・画像のドラッグ&ドロップ・画像の存在確認の3件はテストを書いていません。** jsdom がこれらの API を実装しておらず、モックの正しさ自体は検証できないためです。ロジックは純粋関数（`downloadFile` / `probeImages` / `renameImage`）に切り出してあり、そちらはテストで守られています。

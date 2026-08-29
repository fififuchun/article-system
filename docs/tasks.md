# 実装タスクリスト

[spec.md](./spec.md) を実装に落とし込んだ作業リストです。**ループ実行時の唯一の状態ファイル**であり、進捗はこのファイルのチェックボックスだけが持ちます。

## 🎯 ゴール

`spec.md` の内容をすべて実装し、`styles.css` を import するだけで記事が書けて公開できるライブラリにする。

## 運用ルール

- **1周回 = 未完了の先頭タスク1件のみ**。まとめて進めない
- 完了の条件は **`npm test && npm run build` が通ること**。通らないうちはチェックを付けない
- **（テスト → 実装 → グリーン）** と書かれたタスクは、テストを先に書いて落ちることを確かめ、実装で通すところまでを**1周回で閉じる**。赤い状態を次の周回に持ち越さない
- 1タスク = 1コミット。コミット後にこのファイルのチェックを付ける
- `dist/` はコミット対象。`src/` を変えたら必ずビルドしてから commit する（spec §12）
- **判断に迷ったら止めて質問する。** spec に書かれていないことを推測で実装しない
- spec §16 の「意図的に受け入れている制約」は**直さない**

---

## 📋 タスクリスト

### フェーズ1: バリデータ（spec §6 / 実装順序 1）

`ArticleStudio` と `createArticles` の両方が依存するため最初に作る。

- [x] `src/validate.ts` を作り、`Issue` 型と `validateArticle(raw, context?)` の骨組み（常に空配列を返す）を定義する
- [x] `src/validate.test.ts` を作り、必須5項目（`title` / `date` / `latestUpdate` / `staff` / `thumbnail`）の欠落・空文字を検出する（テスト → 実装 → グリーン）
- [x] `date` / `latestUpdate` が `YYYY-MM-DD` 形式でない場合を検出する（テスト → 実装 → グリーン）
- [x] 値が引用符で囲まれている場合（`title: "記事"`）を検出する（テスト → 実装 → グリーン）
- [x] フロントマターの閉じ忘れを検出する（`parseFrontmatter` が `data: {}` を返すことを利用。テスト → 実装 → グリーン）
- [x] `latestUpdate` が `date` より前の論理矛盾を検出する（テスト → 実装 → グリーン）
- [x] 既知フィールド名との編集距離を求める関数を書き、単体テストを付ける（テスト → 実装 → グリーン）
- [x] 未知キーを既知フィールドと照合し「`latestUpdate` の誤りでは」と提案する typo 検出を実装する（テスト → 実装 → グリーン）
- [x] `Article` 型に `filename: string` を追加し、`Object.values()` を `Object.entries()` に変えてパスから拡張子付きファイル名を取り出す（spec §3）。`it.todo`「Article に filename を含める」を `it` に変えて通す
- [x] `context.articles` と `context.filename` からファイル名衝突を検出する（テスト → 実装 → グリーン）
- [x] `src/index.ts` から `validateArticle` と `Issue` 型を export する

> 画像の存在確認（spec §6）は `<img>` の `onError` に依存するためフェーズ6に置く。

### フェーズ2: createArticles の改修（spec §4 §5 / 実装順序 2）

`src/createArticles.test.ts` の `it.todo` 残り3件がここで解消される（`filename` の1件はフェーズ1で対応済み）。

- [x] `_` 始まりのファイル名を検出したら spec §4 のメッセージで例外を投げる。`it.todo`「`_` 始まりのファイルを受け取ったら例外を投げる」を `it` に変えて通す
- [x] ソートを `new Date()` 比較から**文字列比較**に変更する（spec §5。不正な日付で順序が壊れるバグの修正）。`it.todo`「不正な date が混ざってもソート順が壊れない」を `it` に変えて通す
- [x] 各記事に `validateArticle` を掛け、問題があれば `console.warn` で報告する。`it.todo`「検証で問題が見つかったら console.warn で報告する」を `it` に変えて通す

### フェーズ3: 表示コンポーネントの修正（spec §7 §8 / 実装順序 3）

`as-` クラスの構造がここで確定する。フェーズ4はこれが終わらないと着手できない。

- [x] `src/cx.ts` に `cx(...classes)` ヘルパー（falsy を除いて空白連結）を作り、テストを付ける
- [x] `src/formatDate.ts` に `YYYY-MM-DD` を年・月・日に分解するヘルパーを作り、テストを付ける（不正な日付の扱いを含む）
- [x] `ArticleDetail` の `h2` / `h3` / `h4` を `<div>` から**正しい見出しタグ**に変える（spec §7-1。テスト → 実装 → グリーン）
- [x] `ArticleDetail` の段落ラッパーを1段にし、画像を `<p>` でラップしないよう `p` / `img` のマッピングを直す（spec §7-2。テスト → 実装 → グリーン。`validateDOMNesting` 警告が出ないことも検査する）
- [x] `ArticleDetail` の全要素に `cx("as-*", classNames.*)` でデフォルトクラスを常時付与する（spec §7 の DOM 構造どおり。テスト → 実装 → グリーン）
- [x] `thumbnail` が空のときサムネイル `<img>` を描画しないようにする（spec §7-3。テスト → 実装 → グリーン）
- [x] 画像 `src` が絶対URL（`http://` `https://` `//` 始まり）なら `imageBasePath` を前置せず素通しする（spec §7-3。テスト → 実装 → グリーン）
- [x] `ArticleList` の全要素に `as-` クラスを常時付与する（spec §8 の DOM 構造どおり。テスト → 実装 → グリーン）
- [x] `ArticleDetail` / `ArticleList` を `formatDate` ヘルパーに置き換えて日付整形を一本化する（テスト → 実装 → グリーン）
- [x] テキストと画像が混在する段落では、画像を `as-image` で包まずインラインの `<img>` として `<p>` の中に置く（spec §7。GitHub のマークダウンに準拠。テスト → 実装 → グリーン）
- [x] `resolveImageSrc` を `src/resolveImageSrc.ts` に切り出してテストを付け、`ArticleList` のカード画像にも適用する（spec §7-3。テスト → 実装 → グリーン）

### フェーズ4: styles.css の作成（spec §10 / 実装順序 4）

**最初から `:where()` で書く。** 後から書き換えると詳細度の問題を取りこぼす（spec §10）。

- [x] `src/styles.css` を作り、CSS変数（色・余白・フォントサイズ階層）を `:where(:root)` に定義する
- [x] 記事のタイポグラフィ（`as-title` / `as-heading` / `as-subheading` / `as-subsubheading` / `as-paragraph`）を書く。ブラウザ標準の見出しスタイルのリセットを含む
- [ ] 記事の外枠と周辺（`as-article` / `as-header` / `as-date` / `as-date-year` / `as-date-day` / `as-date-icon` / `as-latest-update` / `as-thumbnail` / `as-image` / `as-footer`）を書く
- [ ] 本文中のリスト・表・引用・コードブロックを子孫セレクタで書く（remark-gfm の出力。spec §7）
- [ ] 一覧のグリッド（`as-grid` / `as-card` 系）を書く
- [ ] レスポンシブのブレークポイントを定義し、記事と一覧を1カラムに落とす
- [ ] tsup の設定に CSS を `dist/styles.css` として出力する処理を追加し、ビルドを確認する
- [ ] `package.json` の `exports` に `"./styles.css": "./dist/styles.css"` を追加する（`types` を先頭に置く順序に注意。spec §12）
- [ ] `demo/` で `styles.css` を読み込み、既定を「デフォルトCSSのみ（`classNames` を渡さない）」にする
- [ ] `demo/` に「デフォルト / カスタム」の切り替えを付け、カスタム時だけ `classNames` を渡す。demo 独自CSSは削らず、クラスが付かなければ当たらない状態にする
- [ ] `demo/` を起動して目視確認する — デフォルトで**CSSを1行も書かずに記事の体をなしている**こと、カスタムに切り替えると独自CSSが**上書きできている**こと（`:where()` の詳細度0が効いている証拠）

### フェーズ5: アイコンセット（spec §11 / 実装順序 5）

フェーズ4と並行可能。

- [ ] 既存の `ClockIcon` を、`className` を受け取り `fill="currentColor"` を使う共通の書き方に揃える
- [ ] 記事系アイコン（人、タグ）を `src/icons/` に追加する
- [ ] Studio 系アイコン（ダウンロード、画像、警告、閉じる）を追加する
- [ ] 汎用アイコン（矢印、外部リンク、コピー）を追加する
- [ ] 全アイコンを `src/index.ts` から named export し、`package.json` に `"sideEffects": false` を追加する（spec §11）

### フェーズ6: ArticleStudio（spec §9 / 実装順序 6）

上記すべてに依存する。**v1 は新規作成専用だが、内部状態は「編集中の記事」としてモデル化する**（spec §9）。

- [ ] `ArticleStudioClassNames` 型を `src/types.ts` に追加する（spec §10）
- [ ] `src/studio/buildTemplate.ts` に今日の日付で雛形 md を生成する関数を作り、テストを付ける（**プレースホルダの値を入れない**こと。spec §9）
- [ ] `src/components/ArticleStudio.tsx` の骨組みを作る（props 受け取り、md 文字列の state、textarea 1枚）
- [ ] `storageKey` 付きの localStorage キー（`as-studio-draft:{key}`）で入力のたびに自動保存する
- [ ] 起動時に localStorage を読み、**復帰する下書きがあればテンプレートを出さない**分岐を実装する（spec §9）
- [ ] 編集中の md を `parseFrontmatter` で `Article` に組み立てるヘルパーを作り、テストを付ける
- [ ] 詳細プレビューとして `ArticleDetail` をそのまま描画する
- [ ] 詳細 / 一覧のタブ切り替えを実装する
- [ ] 一覧タブで、既存 `articles` に編集中の記事を混ぜて日付の新しい順の**直近6件**を `ArticleList` に渡す（spec §9）
- [ ] `src/studio/buildFilename.ts` にファイル名生成（禁止文字 `/ \ : * ? " < > |` の除去、空白→ハイフン、切り詰め、日本語は許容）を作り、テストを付ける
- [ ] md 文字列を Blob でダウンロードさせる処理を実装する
- [ ] 下書きダウンロードボタン（検証なし、`_` 接頭、押した後もそのまま留まる）を実装する
- [ ] 本番ダウンロードボタンを実装する（`validateArticle` でエラー0のときだけ実行 → テンプレートに戻す）
- [ ] 検証で見つかった `Issue` の一覧を表示する UI を作る（**執筆中は出さず、ボタンを押したときだけ**。spec §9）
- [ ] ダウンロード内容を localStorage に退避し、テンプレート復帰直後だけ「直前の記事に戻す」ボタンを出す（spec §9）
- [ ] 画像のドラッグ&ドロップを受け、blob URL で仮登録して md にファイル名を挿入する
- [ ] 仮登録した画像の名前を Studio 上でリネームできる UI を作る（スマホの `IMG_1234.jpg` 対策。spec §9）
- [ ] リネーム後の名前で画像をダウンロードできるようにする
- [ ] 手書きのファイル名の画像を `<img>` の `onError` で存在確認する（**ステータスコードで判定しない**。blob 画像は対象外。spec §6）
- [ ] 本番ダウンロード時に「配置してください」画像一覧を提示する
- [ ] PC 左右2ペイン / スマホ上下2ペインのレイアウトを `styles.css` に追加する（spec §9）
- [ ] `ArticleStudio` を `src/index.ts` から export し、`ArticlePreview` と `ArticlePreviewClassNames` を削除する
- [ ] `demo/` を `ArticlePreview` から `ArticleStudio` に差し替えて動作確認する

### フェーズ7: 配布まわり（spec §12 §13 / 実装順序 7）

- [ ] `package.json` の `exports` / `sideEffects` / `peerDependencies` が spec §12 の記述どおりか照合して直す
- [ ] `src` の変更時に `npm run build` の実行漏れを検出する pre-commit フックを書く（spec §12）
- [ ] pre-commit フックを、ビルド忘れのコミットを実際に止められるか試して確認する
- [ ] README を改訂する① — インストールを `npm link` から**タグ固定の GitHub インストール**に差し替える（spec §12）
- [ ] README を改訂する② — `import.meta.glob` のパターンを `[!_]*.md` にすること（必須）と、その理由を書く
- [ ] README を改訂する③ — `styles.css` の import 方法と、読み込まない場合の挙動を書く
- [ ] README を改訂する④ — `ArticlePreview` の節を `ArticleStudio` に差し替え、`storageKey` の指定を推奨する
- [ ] README を改訂する⑤ — Studio を本番に置く場合のホスティング認証の推奨、`subsubheading` の記載漏れ、一覧を新しい順にする `[...articles].reverse()` を追記する
- [ ] `docs/` 配下（`overview.md` / `architecture.md` / `api.md`）を新しい実装に合わせて更新する

---

## ⚠️ 注意点・前提条件

- **ベースラインは `72bca59`**（vitest 導入とテスト追加）。ここまで戻れば必ずグリーンな状態に復帰できる
- フェーズ1と2はテストが書ける純粋関数。**テストを先に書いて落とし、同じ周回で実装して通す**。テストだけを書いて終わる周回を作らない（ゲートが赤いままコミットできないため）
- コンポーネントは **DOM テストで構造のみ**を検証する（spec §14）。テストファイルの先頭に `// @vitest-environment jsdom` を書く。**見た目は検証しない** — スタイルの確認は `demo/` での目視
- `Article` に `filename` を足すと `createArticles` の戻り値の形が変わる。フェーズ6の Studio が `Article` を組み立てるときも `filename` が要る
- フェーズ6で `ArticlePreview` を削除するのは**破壊的変更**。利用側プロジェクトの差し替えが必要になる

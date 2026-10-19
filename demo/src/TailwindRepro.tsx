import { useState } from "react";
import { ArticleDetail, ArticleList, ArticleStudio } from "@fififuchun/article-system";
// ライブラリを先、preflight を後に読む。利用側プロジェクトと同じ順序（spec §10）
import "@fififuchun/article-system/styles.css";
import "./tailwind-base.css";
import { articles } from "./lib/articles";

/**
 * Tailwind v3 の preflight との同居を目で確かめるページ（spec §10）。
 *
 * **既定のデモとは別のエントリです**（`tailwind.html`）。ここだけ
 * `@tailwind base` を読み込んでいます。
 *
 * 見るところ:
 * 1. 見出しの大きさ・太さ、本文の余白、画像、リストの点
 * 2. Studio の操作帯のボタン、タブ、textarea の枠
 * 3. トークン入力画面の枠線・ボタンの背景・手順の番号
 * 4. 「classNames で渡した Tailwind クラスが勝つ」の確認
 */
export default function TailwindRepro() {
  const [tab, setTab] = useState<"detail" | "list" | "studio" | "login">("detail");
  const [override, setOverride] = useState(false);

  // 利用側が classNames に渡すユーティリティ。詳細度 0,1,0
  const detailClassNames = override
    ? { heading: "text-red-600 underline", paragraph: "text-xs italic" }
    : undefined;

  return (
    <div>
      <nav style={{ display: "flex", gap: 8, padding: 12, borderBottom: "1px solid #ddd" }}>
        {(["detail", "list", "studio", "login"] as const).map((name) => (
          <button key={name} type="button" onClick={() => setTab(name)}
            style={{ padding: "4px 10px", border: "1px solid #999", background: tab === name ? "#333" : "#fff", color: tab === name ? "#fff" : "#333" }}>
            {name}
          </button>
        ))}
        <label style={{ marginLeft: "auto", fontSize: 13 }}>
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
          {" "}classNames に Tailwind を渡す
        </label>
      </nav>

      {tab === "detail" && (
        <ArticleDetail article={articles[0]} classNames={detailClassNames} />
      )}

      {tab === "list" && (
        <ArticleList
          articles={articles}
          getArticleUrl={() => "#"}
          renderLink={(url, children, key) => <a key={key} href={url}>{children}</a>}
        />
      )}

      {tab === "studio" && <ArticleStudio articles={articles} storageKey="tw-repro" />}

      {tab === "login" && (
        <ArticleStudio articles={articles} storageKey="tw-login" github={{ repo: "me/blog" }} />
      )}
    </div>
  );
}

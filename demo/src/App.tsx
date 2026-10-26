import { useState, useEffect } from "react";
import {
  ArticleDetail,
  ArticleList,
  ArticleStudioRoute,
  type Article,
} from "@fififuchun/article-system";
import { articles } from "./lib/articles";
import SettingsPage, { loadRepo } from "./pages/SettingsPage";
import "./styles.css";
import "@fififuchun/article-system/styles.css";

type Route = "list" | "detail" | "settings";

/**
 * テーマ（spec §10 テーマ）。
 *
 * `<html data-as-theme="...">` を書き換えるだけで、記事ページと Studio の
 * プレビューの両方が同時に変わります。**props は何も渡していません。**
 *
 * - `""`      … ライブラリ既定（テーマA。青基調）
 * - `minimal` … ライブラリ同梱。装飾を外したもの
 * - `demo`    … **このデモが自分の CSS に書いたもの**（利用側の書き方の例）
 */
const THEMES = ["", "minimal", "demo"] as const;
type Theme = (typeof THEMES)[number];

const THEME_LABELS: Record<Theme, string> = {
  "": "既定（テーマA）",
  minimal: "minimal（同梱）",
  demo: "demo（利用側が書いた例）",
};

/**
 * 読者向けは**実パス**、執筆画面はハッシュ（spec §9 設置方法）。
 *
 * 記事を `#/article/...` で開くと、`#` はサーバーに送られないため
 * **共有したときのサムネイル（OGタグ）が原理的に出せません**（spec §18）。
 */
function getRoute(): { route: Route; slug?: string } {
  if (window.location.hash === "#/settings") return { route: "settings" };

  const m = window.location.pathname.match(/^\/article\/(.+?)\/?$/);
  // パスは percent-encoding されるのでデコードして突き合わせる
  if (m) return { route: "detail", slug: decodeURIComponent(m[1]) };

  return { route: "list" };
}

/* カスタム時だけ渡すクラス。渡さなければ demo 独自CSSは要素に付かず当たらない */
const detailClassNames = {
  wrapper: "article-wrapper",
  dateYear: "article-date-year",
  dateDay: "article-date-day",
  title: "article-title",
  latestUpdate: "article-latest-update",
  thumbnail: "article-thumbnail",
  heading: "article-heading",
  subheading: "article-subheading",
  paragraph: "article-paragraph",
  image: "article-image",
  footer: "article-footer",
};

const listClassNames = {
  grid: "grid",
  card: "card",
  cardImage: "card-image",
  cardTitle: "card-title",
  cardDate: "card-date",
};

export default function App() {
  const [{ route, slug }, setRouteState] = useState(getRoute);
  const [useCustomCss, setUseCustomCss] = useState(false);
  const [repo, setRepo] = useState(loadRepo);
  const [theme, setTheme] = useState<Theme>("");

  // 属性1つで全体が切り替わる。記事ページと Studio のプレビューの両方に効く
  useEffect(() => {
    if (theme === "") delete document.documentElement.dataset.asTheme;
    else document.documentElement.dataset.asTheme = theme;
  }, [theme]);

  useEffect(() => {
    const handler = () => setRouteState(getRoute());
    window.addEventListener("hashchange", handler);
    // 戻るボタンで実パスの行き来にも追随させる
    window.addEventListener("popstate", handler);
    return () => {
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("popstate", handler);
    };
  }, []);

  const navigate = (hash: string) => {
    window.location.hash = hash;
  };

  /** 実パスへ移動する。href は本物のままにして、読み込み直しだけ省く */
  const navigatePath = (path: string) => {
    window.history.pushState({}, "", path);
    setRouteState(getRoute());
  };

  const selectedArticle: Article | undefined =
    route === "detail" && slug !== undefined
      ? articles.find((article) => article.slug === slug)
      : undefined;

  return (
    <div style={{ fontFamily: "sans-serif", minHeight: "100vh", background: "#f5f5f5" }}>
      <nav className="nav">
        <span className="nav-brand">article-system demo</span>
        <div className="nav-links">
          <a
            href="/"
            className={`nav-link${route === "list" || route === "detail" ? " active" : ""}`}
            onClick={(event) => {
              event.preventDefault();
              navigatePath("/");
            }}
          >
            記事一覧
          </a>
          {/* ArticleStudioRoute がこのハッシュを見て全画面で開く */}
          <a href="#/studio" className="nav-link" onClick={() => navigate("#/studio")}>
            執筆
          </a>
          <a
            href="#/settings"
            className={`nav-link${route === "settings" ? " active" : ""}`}
            onClick={() => navigate("#/settings")}
          >
            GitHub 設定
          </a>
          <button
            type="button"
            className="css-toggle"
            onClick={() => setUseCustomCss((current) => !current)}
          >
            CSS: {useCustomCss ? "カスタム" : "デフォルト"}
          </button>
          <select
            className="css-toggle"
            value={theme}
            onChange={(event) => setTheme(event.target.value as Theme)}
          >
            {THEMES.map((name) => (
              <option key={name} value={name}>
                {THEME_LABELS[name]}
              </option>
            ))}
          </select>
        </div>
      </nav>

      <main style={{ maxWidth: 840, margin: "0 auto", padding: "32px 16px" }}>
        {route === "settings" && <SettingsPage repo={repo} onChange={setRepo} />}

        {route === "detail" && selectedArticle && (
          <>
            <button onClick={() => navigatePath("/")} className="back-button">
              ← 一覧に戻る
            </button>
            <ArticleDetail
              article={selectedArticle}
              imageBasePath="https://placehold.co/800x400/e8e8e8/999999?text="
              dateLabel="最終更新日時"
              classNames={useCustomCss ? detailClassNames : undefined}
            />
          </>
        )}

        {route === "list" && (
          <ArticleList
            articles={articles}
            imageBasePath="https://placehold.co/400x240/e8e8e8/999999?text="
            getArticleUrl={(article) => `/article/${encodeURIComponent(article.slug)}`}
            classNames={useCustomCss ? listClassNames : undefined}
            renderLink={(url, children, key) => (
              <a
                key={key}
                href={url}
                onClick={(event) => {
                  event.preventDefault();
                  navigatePath(url);
                }}
              >
                {children}
              </a>
            )}
          />
        )}
      </main>

      {/*
        設置はこの1行だけ。#/studio のときだけ全画面で開き、それ以外では
        何も描画しない。<main> の幅制限の外に置く必要も無い（spec §9 設置方法）
      */}
      <ArticleStudioRoute
        articles={articles}
        storageKey="article-system-demo"
        imageBasePath="https://placehold.co/800x400/e8e8e8/999999?text="
        dateLabel="最終更新日時"
        github={repo ? { repo } : undefined}
      />
    </div>
  );
}

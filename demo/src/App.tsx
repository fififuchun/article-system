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

function getRoute(): { route: Route; slug?: string } {
  const hash = window.location.hash;
  if (hash === "#/settings") return { route: "settings" };
  const m = hash.match(/^#\/article\/(.+)$/);
  // ハッシュは percent-encoding されるのでデコードして突き合わせる
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

  useEffect(() => {
    const handler = () => setRouteState(getRoute());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = (hash: string) => {
    window.location.hash = hash;
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
            href="#/"
            className={`nav-link${route === "list" || route === "detail" ? " active" : ""}`}
            onClick={() => navigate("#/")}
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
        </div>
      </nav>

      <main style={{ maxWidth: 840, margin: "0 auto", padding: "32px 16px" }}>
        {route === "settings" && <SettingsPage repo={repo} onChange={setRepo} />}

        {route === "detail" && selectedArticle && (
          <>
            <button onClick={() => navigate("#/")} className="back-button">
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
            getArticleUrl={(article) => `#/article/${encodeURIComponent(article.slug)}`}
            classNames={useCustomCss ? listClassNames : undefined}
            renderLink={(url, children, key) => (
              <a key={key} href={url}>
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

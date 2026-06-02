import { useState, useEffect } from "react";
import { ArticleDetail, ArticleList, type Article } from "@fififuchun/article-system";
import { articles } from "./lib/articles";
import PreviewPage from "./pages/PreviewPage";
import "./styles.css";

type Route = "list" | "detail" | "preview";

function getRoute(): { route: Route; id?: number } {
  const hash = window.location.hash;
  if (hash === "#/preview") return { route: "preview" };
  const m = hash.match(/^#\/article\/(\d+)$/);
  if (m) return { route: "detail", id: Number(m[1]) };
  return { route: "list" };
}

export default function App() {
  const [{ route, id }, setRouteState] = useState(getRoute);

  useEffect(() => {
    const handler = () => setRouteState(getRoute());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = (hash: string) => {
    window.location.hash = hash;
  };

  const selectedArticle: Article | undefined =
    route === "detail" && id !== undefined ? articles[id] : undefined;

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
          <a
            href="#/preview"
            className={`nav-link${route === "preview" ? " active" : ""}`}
            onClick={() => navigate("#/preview")}
          >
            プレビュー
          </a>
        </div>
      </nav>

      <main style={{ maxWidth: route === "preview" ? "none" : 840, margin: "0 auto", padding: route === "preview" ? 0 : "32px 16px" }}>
        {route === "preview" && <PreviewPage />}

        {route === "detail" && selectedArticle && (
          <>
            <button
              onClick={() => navigate("#/")}
              className="back-button"
            >
              ← 一覧に戻る
            </button>
            <ArticleDetail
              article={selectedArticle}
              imageBasePath="https://placehold.co/800x400/e8e8e8/999999?text="
              dateLabel="最終更新日時"
              classNames={{
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
              }}
            />
          </>
        )}

        {route === "list" && (
          <ArticleList
            articles={articles}
            imageBasePath="https://placehold.co/400x240/e8e8e8/999999?text="
            getArticleUrl={(article) => `#/article/${article.id}`}
            classNames={{
              grid: "grid",
              card: "card",
              cardImage: "card-image",
              cardTitle: "card-title",
              cardDate: "card-date",
            }}
            renderLink={(url, children, key) => (
              <a
                key={key}
                href={url}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                {children}
              </a>
            )}
          />
        )}
      </main>
    </div>
  );
}

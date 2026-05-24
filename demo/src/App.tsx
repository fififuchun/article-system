import { useState } from "react";
import { ArticleDetail, ArticleList, type Article } from "@fififuchun/article-system";
import { articles } from "./lib/articles";
import "./styles.css";

export default function App() {
  const [selected, setSelected] = useState<Article | null>(null);

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 840, margin: "0 auto", padding: "32px 16px" }}>
      <header style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>@fififuchun/article-system</p>
        <h1 style={{ fontSize: 22, fontWeight: "bold", color: "#222" }}>デモページ</h1>
        {selected && (
          <button
            onClick={() => setSelected(null)}
            style={{
              marginTop: 12,
              padding: "6px 14px",
              cursor: "pointer",
              background: "none",
              border: "1px solid #ccc",
              borderRadius: 4,
              fontSize: 13,
              color: "#555",
            }}
          >
            ← 一覧に戻る
          </button>
        )}
      </header>

      {selected ? (
        <ArticleDetail
          article={selected}
          imageBasePath={`https://placehold.co/800x400/e8e8e8/999999?text=`}
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
      ) : (
        <ArticleList
          articles={articles}
          imageBasePath={`https://placehold.co/400x240/e8e8e8/999999?text=`}
          getArticleUrl={(article) => `#${article.id}`}
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
              onClick={(e) => {
                e.preventDefault();
                setSelected(articles[key]);
              }}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {children}
            </a>
          )}
        />
      )}
    </div>
  );
}

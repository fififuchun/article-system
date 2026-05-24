import type { Article, ArticleListClassNames } from "../types";

interface Props {
  articles: Article[];
  imageBasePath?: string;
  getArticleUrl: (article: Article) => string;
  classNames?: ArticleListClassNames;
  renderLink: (
    url: string,
    children: React.ReactNode,
    key: number
  ) => React.ReactNode;
}

export function ArticleList({
  articles,
  imageBasePath = "/article_imgs/",
  getArticleUrl,
  classNames = {},
  renderLink,
}: Props) {
  return (
    <div className={classNames.grid}>
      {articles.map((article) => {
        const [year, month, day] = article.latestUpdate.split("-").map(Number);
        return renderLink(
          getArticleUrl(article),
          <div className={classNames.card}>
            <img
              src={`${imageBasePath}${article.thumbnail}`}
              alt={article.title}
              className={classNames.cardImage}
            />
            <p className={classNames.cardTitle}>{article.title}</p>
            <p className={classNames.cardDate}>
              {year}年{month}月{day}日
            </p>
          </div>,
          article.id
        );
      })}
    </div>
  );
}

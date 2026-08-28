import type { Article, ArticleListClassNames } from "../types";
import { ClockIcon } from "../icons/ClockIcon";
import { cx } from "../cx";
import { formatDate } from "../formatDate";

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
    <div className={cx("as-grid", classNames.grid)}>
      {articles.map((article) => {
        const { year, month, day } = formatDate(article.latestUpdate);
        return renderLink(
          getArticleUrl(article),
          <div className={cx("as-card", classNames.card)}>
            <img
              src={`${imageBasePath}${article.thumbnail}`}
              alt={article.title}
              className={cx("as-card-image", classNames.cardImage)}
            />
            <p className={cx("as-card-title", classNames.cardTitle)}>{article.title}</p>
            <div className={cx("as-card-date", classNames.cardDate)}>
              <ClockIcon className={cx("as-card-date-icon", classNames.cardDateIcon)} />
              <span>{year}年{month}月{day}日</span>
            </div>
          </div>,
          article.id
        );
      })}
    </div>
  );
}

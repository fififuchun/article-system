import { useEffect } from "react";
import type { Article, ArticleListClassNames } from "../types";
import { ClockIcon } from "../icons/ClockIcon";
import { cx } from "../cx";
import { formatDate } from "../formatDate";
import { resolveImageSrc } from "../resolveImageSrc";
import { warnStylesheetMismatch } from "../stylesheetWarning";

interface Props {
  articles: Article[];
  imageBasePath?: string;
  getArticleUrl: (article: Article) => string;
  classNames?: ArticleListClassNames;
  renderLink: (
    url: string,
    children: React.ReactNode,
    key: string
  ) => React.ReactNode;
}

export function ArticleList({
  articles,
  imageBasePath = "/article_imgs/",
  getArticleUrl,
  classNames = {},
  renderLink,
}: Props) {
  // CSS の版の取り違えを知らせる（spec §10）。1ページに1回しか調べない
  useEffect(warnStylesheetMismatch, []);

  return (
    <div className={cx("as-grid", classNames.grid)}>
      {articles.map((article) => {
        const { year, month, day } = formatDate(article.latestUpdate);
        return renderLink(
          getArticleUrl(article),
          <div className={cx("as-card", classNames.card)}>
            <img
              src={resolveImageSrc(article.thumbnail, imageBasePath)}
              alt={article.title}
              className={cx("as-card-image", classNames.cardImage)}
            />
            <p className={cx("as-card-title", classNames.cardTitle)}>{article.title}</p>
            <div className={cx("as-card-date", classNames.cardDate)}>
              <ClockIcon className={cx("as-card-date-icon", classNames.cardDateIcon)} />
              <span>{year}年{month}月{day}日</span>
            </div>
          </div>,
          // 記事の身元に紐づける。並び順の index だと記事を足したときずれる（spec §3）
          article.slug
        );
      })}
    </div>
  );
}

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { Article, ArticleDetailClassNames } from "../types";

interface Props {
  article: Article;
  imageBasePath?: string;
  classNames?: ArticleDetailClassNames;
  dateLabel?: string;
}

export function ArticleDetail({
  article,
  imageBasePath = "/article_imgs/",
  classNames = {},
  dateLabel = "最終更新日時",
}: Props) {
  const [year, month, day] = article.date.split("-").map(Number);
  const [ly, lm, ld] = article.latestUpdate.split("-").map(Number);

  const mdComponents: Components = {
    h2: ({ children }) => (
      <div className={classNames.heading}>{children}</div>
    ),
    h3: ({ children }) => (
      <div className={classNames.subheading}>{children}</div>
    ),
    p: ({ children }) => (
      <div className={classNames.paragraph}>
        <p>{children}</p>
      </div>
    ),
    img: ({ src, alt }) => (
      <div className={classNames.image}>
        <img src={`${imageBasePath}${src}`} alt={alt ?? ""} />
      </div>
    ),
  };

  return (
    <div className={classNames.wrapper}>
      <div>
        <div>
          <p className={classNames.dateYear}>{year}</p>
          <p className={classNames.dateDay}>
            {month}/{day}
          </p>
        </div>
        <p className={classNames.title}>{article.title}</p>
      </div>

      <p className={classNames.latestUpdate}>
        {dateLabel}&nbsp;{ly}年{lm}月{ld}日
      </p>

      <img
        src={`${imageBasePath}${article.thumbnail}`}
        alt={article.title}
        className={classNames.thumbnail}
      />

      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {article.content}
      </ReactMarkdown>

      <p className={classNames.footer}>担当：{article.staff}</p>
    </div>
  );
}

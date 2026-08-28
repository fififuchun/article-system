import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { Components } from "react-markdown";
import type { Article, ArticleDetailClassNames } from "../types";
import { cx } from "../cx";
import { ClockIcon } from "../icons/ClockIcon";

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
      <h2 className={cx("as-heading", classNames.heading)}>{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className={cx("as-subheading", classNames.subheading)}>{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className={cx("as-subsubheading", classNames.subsubheading)}>{children}</h4>
    ),
    // 画像だけの行も markdown では段落になる。p でラップすると
    // <p><div> の不正な入れ子になり、SSR でハイドレーションエラーを起こす（spec §7-2）
    p: ({ children, node }) => {
      const onlyChild = node?.children.length === 1 ? node.children[0] : undefined;
      if (onlyChild?.type === "element" && onlyChild.tagName === "img") {
        return <>{children}</>;
      }

      return <p className={cx("as-paragraph", classNames.paragraph)}>{children}</p>;
    },
    img: ({ src, alt }) => (
      <div className={cx("as-image", classNames.image)}>
        <img src={`${imageBasePath}${src}`} alt={alt ?? ""} />
      </div>
    ),
  };

  return (
    <div className={cx("as-article", classNames.wrapper)}>
      <div className={cx("as-header", classNames.headerWrapper)}>
        <div className={cx("as-date", classNames.dateWrapper)}>
          <p className={cx("as-date-year", classNames.dateYear)}>{year}</p>
          <p className={cx("as-date-day", classNames.dateDay)}>{month}/{day}</p>
        </div>
        <p className={cx("as-title", classNames.title)}>{article.title}</p>
      </div>

      <div className={cx("as-latest-update", classNames.latestUpdate)}>
        <ClockIcon className={cx("as-date-icon", classNames.dateIcon)} />
        <span>{dateLabel}&nbsp;{ly}年{lm}月{ld}日</span>
      </div>

      <img
        src={`${imageBasePath}${article.thumbnail}`}
        alt={article.title}
        className={cx("as-thumbnail", classNames.thumbnail)}
      />

      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>
        {article.content}
      </ReactMarkdown>

      <p className={cx("as-footer", classNames.footer)}>担当：{article.staff}</p>
    </div>
  );
}

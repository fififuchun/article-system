import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { Components } from "react-markdown";
import type { Article, ArticleDetailClassNames } from "../types";
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
      <h2 className={classNames.heading}>{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className={classNames.subheading}>{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className={classNames.subsubheading}>{children}</h4>
    ),
    // 画像だけの行も markdown では段落になる。p でラップすると
    // <p><div> の不正な入れ子になり、SSR でハイドレーションエラーを起こす（spec §7-2）
    p: ({ children, node }) => {
      const onlyChild = node?.children.length === 1 ? node.children[0] : undefined;
      if (onlyChild?.type === "element" && onlyChild.tagName === "img") {
        return <>{children}</>;
      }

      return <p className={classNames.paragraph}>{children}</p>;
    },
    img: ({ src, alt }) => (
      <div className={classNames.image}>
        <img src={`${imageBasePath}${src}`} alt={alt ?? ""} />
      </div>
    ),
  };

  return (
    <div className={classNames.wrapper}>
      <div className={classNames.headerWrapper}>
        <div className={classNames.dateWrapper}>
          <p className={classNames.dateYear}>{year}</p>
          <p className={classNames.dateDay}>{month}/{day}</p>
        </div>
        <p className={classNames.title}>{article.title}</p>
      </div>

      <div className={classNames.latestUpdate}>
        <ClockIcon className={classNames.dateIcon} />
        <span>{dateLabel}&nbsp;{ly}年{lm}月{ld}日</span>
      </div>

      <img
        src={`${imageBasePath}${article.thumbnail}`}
        alt={article.title}
        className={classNames.thumbnail}
      />

      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>
        {article.content}
      </ReactMarkdown>

      <p className={classNames.footer}>担当：{article.staff}</p>
    </div>
  );
}

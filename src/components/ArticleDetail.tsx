import { useEffect } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { Components, UrlTransform } from "react-markdown";
import type { Article, ArticleDetailClassNames } from "../types";
import { cx } from "../cx";
import { formatDate } from "../formatDate";
import { resolveImageSrc } from "../resolveImageSrc";
import { warnStylesheetMismatch } from "../stylesheetWarning";

import { ClockIcon } from "../icons/ClockIcon";

/**
 * `blob:` の画像を通す（spec §7-3）。
 *
 * react-markdown の既定は http / https / mailto / tel 以外のプロトコルを
 * **空文字にします**。Studio がプレビューで差し替える blob URL もこれに
 * 当たるため、何もしないとドロップした画像が本文に出ません。
 *
 * 通すのは **画像の `src` だけ**です。リンクの `href` は既定のまま潰します。
 * `javascript:` を通すと、本文を書けるだけでスクリプトを走らせられます。
 */
const allowBlobImages: UrlTransform = (url, key, node) =>
  key === "src" && node.tagName === "img" && url.startsWith("blob:")
    ? url
    : defaultUrlTransform(url);

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
  const { year, month, day } = formatDate(article.date);
  const latest = formatDate(article.latestUpdate);

  // CSS の版の取り違えを知らせる（spec §10）。1ページに1回しか調べない
  useEffect(warnStylesheetMismatch, []);

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
    // 画像だけの行も markdown では段落になる。ブロックとして扱い、p では包まない。
    // p の中に div を入れると SSR でハイドレーションエラーになる（spec §7-2）
    p: ({ children, node }) => {
      const onlyChild = node?.children.length === 1 ? node.children[0] : undefined;
      if (onlyChild?.type === "element" && onlyChild.tagName === "img") {
        return <div className={cx("as-image", classNames.image)}>{children}</div>;
      }

      // テキストと混在する画像はインラインのまま p の中に置く（GitHub 準拠。spec §7）
      return <p className={cx("as-paragraph", classNames.paragraph)}>{children}</p>;
    },
    img: ({ src, alt }) => (
      <img src={resolveImageSrc(src ?? "", imageBasePath)} alt={alt ?? ""} />
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
        <span>{dateLabel}&nbsp;{latest.year}年{latest.month}月{latest.day}日</span>
      </div>

      {article.thumbnail && (
        <img
          src={resolveImageSrc(article.thumbnail, imageBasePath)}
          alt={article.title}
          className={cx("as-thumbnail", classNames.thumbnail)}
        />
      )}

      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={mdComponents}
        urlTransform={allowBlobImages}
      >
        {article.content}
      </ReactMarkdown>

      <p className={cx("as-footer", classNames.footer)}>担当：{article.staff}</p>
    </div>
  );
}

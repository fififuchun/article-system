import * as react_jsx_runtime from 'react/jsx-runtime';

interface Article {
    id: number;
    /** 拡張子付きファイル名。衝突検出と既存記事の編集に使う。URL には使わない（spec §3） */
    filename: string;
    title: string;
    date: string;
    latestUpdate: string;
    staff: string;
    thumbnail: string;
    content: string;
}
interface ArticleDetailClassNames {
    wrapper?: string;
    headerWrapper?: string;
    dateWrapper?: string;
    dateYear?: string;
    dateDay?: string;
    title?: string;
    latestUpdate?: string;
    dateIcon?: string;
    thumbnail?: string;
    heading?: string;
    subheading?: string;
    subsubheading?: string;
    paragraph?: string;
    image?: string;
    footer?: string;
}
interface ArticleListClassNames {
    grid?: string;
    card?: string;
    cardImage?: string;
    cardTitle?: string;
    cardDate?: string;
    cardDateIcon?: string;
}
/** ArticleStudio のクラス名（spec §9 のレイアウト図に対応） */
interface ArticleStudioClassNames {
    wrapper?: string;
    editorPane?: string;
    textarea?: string;
    previewPane?: string;
    tabs?: string;
    issues?: string;
    imagePane?: string;
    actions?: string;
}

interface Issue {
    level: "error";
    field?: string;
    message: string;
}
interface ValidateContext {
    /** ファイル名衝突の検出に使う既存記事 */
    articles?: Article[];
    /** 検証対象のファイル名 */
    filename?: string;
}
/**
 * md の文字列を検証して問題の一覧を返す。
 * 問題が無ければ空配列を返す。例外は投げない。
 */
declare function validateArticle(raw: string, context?: ValidateContext): Issue[];

declare function createArticles(rawFiles: Record<string, string>): Article[];

interface Props$2 {
    article: Article;
    imageBasePath?: string;
    classNames?: ArticleDetailClassNames;
    dateLabel?: string;
}
declare function ArticleDetail({ article, imageBasePath, classNames, dateLabel, }: Props$2): react_jsx_runtime.JSX.Element;

interface Props$1 {
    articles: Article[];
    imageBasePath?: string;
    getArticleUrl: (article: Article) => string;
    classNames?: ArticleListClassNames;
    renderLink: (url: string, children: React.ReactNode, key: number) => React.ReactNode;
}
declare function ArticleList({ articles, imageBasePath, getArticleUrl, classNames, renderLink, }: Props$1): react_jsx_runtime.JSX.Element;

interface Props {
    /** 衝突検出と一覧プレビューに使う既存記事 */
    articles?: Article[];
    /** localStorage の保存先を分ける（spec §9） */
    storageKey?: string;
    imageBasePath?: string;
    dateLabel?: string;
    classNames?: ArticleStudioClassNames;
    articleClassNames?: ArticleDetailClassNames;
}
declare function ArticleStudio({ articles, storageKey, imageBasePath, dateLabel, classNames, articleClassNames, }: Props): react_jsx_runtime.JSX.Element;

/**
 * アイコン共通の props（spec §11）。
 *
 * サイズは CSS で指定するため width / height は受け取りません。
 * 色は `fill="currentColor"` により CSS の `color` で変わります。
 */
interface IconProps {
    className?: string;
}

/** 右向き。他の向きは CSS の transform: rotate() で作る */
declare function ArrowIcon({ className }: IconProps): react_jsx_runtime.JSX.Element;

declare function ClockIcon({ className }: IconProps): react_jsx_runtime.JSX.Element;

declare function CloseIcon({ className }: IconProps): react_jsx_runtime.JSX.Element;

declare function CopyIcon({ className }: IconProps): react_jsx_runtime.JSX.Element;

declare function DownloadIcon({ className }: IconProps): react_jsx_runtime.JSX.Element;

declare function ExternalLinkIcon({ className }: IconProps): react_jsx_runtime.JSX.Element;

declare function ImageIcon({ className }: IconProps): react_jsx_runtime.JSX.Element;

declare function PersonIcon({ className }: IconProps): react_jsx_runtime.JSX.Element;

declare function TagIcon({ className }: IconProps): react_jsx_runtime.JSX.Element;

declare function WarningIcon({ className }: IconProps): react_jsx_runtime.JSX.Element;

export { ArrowIcon, type Article, ArticleDetail, type ArticleDetailClassNames, ArticleList, type ArticleListClassNames, ArticleStudio, type ArticleStudioClassNames, ClockIcon, CloseIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, type IconProps, ImageIcon, type Issue, PersonIcon, TagIcon, WarningIcon, createArticles, validateArticle };

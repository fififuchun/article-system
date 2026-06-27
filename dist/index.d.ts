import * as react_jsx_runtime from 'react/jsx-runtime';

interface Article {
    id: number;
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
interface ArticlePreviewClassNames {
    wrapper?: string;
    editorPane?: string;
    textarea?: string;
    previewPane?: string;
}

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
    imageBasePath?: string;
    dateLabel?: string;
    classNames?: ArticlePreviewClassNames;
    articleClassNames?: ArticleDetailClassNames;
    defaultValue?: string;
}
declare function ArticlePreview({ imageBasePath, dateLabel, classNames, articleClassNames, defaultValue, }: Props): react_jsx_runtime.JSX.Element;

declare function ClockIcon({ className }: {
    className?: string;
}): react_jsx_runtime.JSX.Element;

export { type Article, ArticleDetail, type ArticleDetailClassNames, ArticleList, type ArticleListClassNames, ArticlePreview, type ArticlePreviewClassNames, ClockIcon, createArticles };

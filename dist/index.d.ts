import * as react_jsx_runtime from 'react/jsx-runtime';

interface Article {
    /**
     * URL に使う識別子。記事の身元（spec §3）。
     *
     * フロントマターの `slug` 優先、無ければファイル名から拡張子を除いたもの。
     * **記事を足しても動きません。**
     */
    slug: string;
    /** 拡張子付きファイル名。衝突検出と既存記事の編集に使う。URL には使わない（spec §3） */
    filename: string;
    title: string;
    date: string;
    latestUpdate: string;
    staff: string;
    thumbnail: string;
    /**
     * 共有したときのカードに出る説明文（spec §18）。**任意です。**
     *
     * 書かなければ本文の冒頭から作ります。だから「空文字」と「書いていない」を
     * 区別する必要があり、他の項目と違って省略可能にしています。
     */
    description?: string;
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
    login?: string;
    dialog?: string;
}
/**
 * GitHub 連携の設定（spec §15）。
 *
 * 渡すと ArticleStudio がダウンロードではなくリポジトリへコミットします。
 * 渡さなければ挙動は変わりません。
 */
interface GitHubConfig {
    /** "owner/name" */
    repo: string;
    /** 既定 "main" */
    branch?: string;
    /** md の置き場所。既定 "src/articles" */
    mdDir?: string;
    /** 画像の置き場所。`imageBasePath`（表示用URL）とは別物。既定 "public/article_imgs" */
    imageDir?: string;
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

/**
 * 記事の slug を決める（spec §3）。
 *
 * フロントマターの `slug` 優先、無ければファイル名から拡張子を除いたもの。
 *
 * **`createArticles` と Vite プラグインの両方がこれを呼びます。** 片方だけで
 * 決めると、ブラウザ側とビルド側で違う URL になり、OGタグが別の記事を指します。
 * どちらも静かに起きるので、決め方は1か所にしか置きません（spec §18）。
 */
declare function resolveSlug(filename: string, frontmatterSlug?: string): string;

/**
 * 本文から共有用の説明文を作る（spec §18）。
 *
 * フロントマターに `description` が無いときの代わりです。マークダウンの
 * 記号を落として1行に畳み、上限で切り詰めます。
 *
 * **アンダースコアは落としません。** `0_1.png` のようなファイル名や識別子が
 * 本文に出てくるため、`_強調_` を拾うより壊さないほうを選びました。
 */
declare function buildDescription(content: string, maxLength?: number): string;

interface ArticleHeadOptions {
    /**
     * サイトの起点（`https://example.com`）。**必須です。**
     *
     * `og:image` は絶対URLでなければ無視されます。ドメインはライブラリから
     * 分からないため、渡してもらう必要があります（spec §18）。
     */
    siteUrl: string;
    /**
     * この記事のパス（`/article/2026-10-12`）。
     *
     * 日本語が入っていれば percent-encoding します。すでに encode されている
     * 部分は触りません（二重に encode すると別のパスを指します）。
     */
    path: string;
    /** 画像の置き場所のURL。既定 `/article_imgs/` */
    imageBasePath?: string;
    /** `og:site_name`。省略すると出しません */
    siteName?: string;
    /** 本文から説明文を作るときの上限 */
    descriptionLength?: number;
}
/**
 * 記事から `<head>` に入れるタグを作る（spec §18）。
 *
 * 共有したときのカード（Open Graph）と `<title>` を出します。文字列を返すだけで、
 * どこに置くかは呼び出し側の仕事です。
 */
declare function buildArticleHead(article: Article, options: ArticleHeadOptions): string;

interface Props$3 {
    article: Article;
    imageBasePath?: string;
    classNames?: ArticleDetailClassNames;
    dateLabel?: string;
}
declare function ArticleDetail({ article, imageBasePath, classNames, dateLabel, }: Props$3): react_jsx_runtime.JSX.Element;

interface Props$2 {
    articles: Article[];
    imageBasePath?: string;
    getArticleUrl: (article: Article) => string;
    classNames?: ArticleListClassNames;
    renderLink: (url: string, children: React.ReactNode, key: string) => React.ReactNode;
}
declare function ArticleList({ articles, imageBasePath, getArticleUrl, classNames, renderLink, }: Props$2): react_jsx_runtime.JSX.Element;

interface Props$1 {
    /**
     * 既存記事。**必須です。**
     *
     * 渡さないとファイル名の衝突を検出できず、既存記事が上書きで消えます（spec §6）。
     * 記事が0件のプロジェクトでも createArticles({}) の戻り値をそのまま渡してください。
     */
    articles: Article[];
    /** localStorage の保存先を分ける（spec §9） */
    storageKey?: string;
    imageBasePath?: string;
    dateLabel?: string;
    classNames?: ArticleStudioClassNames;
    articleClassNames?: ArticleDetailClassNames;
    /** 渡すとダウンロードではなくリポジトリへコミットする（spec §15） */
    github?: GitHubConfig;
}
/**
 * 記事を書く画面。
 *
 * `github` を渡すとトークンが必須になり、ダウンロードの代わりに
 * リポジトリへコミットします。渡さなければ挙動は変わりません（spec §15）。
 */
declare function ArticleStudio(props: Props$1): react_jsx_runtime.JSX.Element;

interface Props {
    articles: Article[];
    storageKey?: string;
    imageBasePath?: string;
    dateLabel?: string;
    classNames?: ArticleStudioClassNames;
    articleClassNames?: ArticleDetailClassNames;
    github?: GitHubConfig;
    /** 入り口のハッシュ。既定 `#/studio` */
    hashPath?: string;
}
/**
 * 執筆画面をハッシュで開く（spec §9 設置方法）。
 *
 * `App.tsx` に1行置けば `#/studio` で全画面の Studio が開きます。利用側が
 * ページを作って `<Route>` を定義する必要がありません。
 *
 * **一致しないときは何も描画しません。** だから置き場所はどこでも構いません。
 *
 * `<dialog>` を `showModal()` で開くのは、`z-index` の数字で殴らずに
 * トップレイヤーで最前面を取るためです。Esc で閉じられ、背後が `inert` に
 * なるのも付いてきます。
 */
declare function ArticleStudioRoute({ hashPath, ...props }: Props): react_jsx_runtime.JSX.Element | null;

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

export { ArrowIcon, type Article, ArticleDetail, type ArticleDetailClassNames, type ArticleHeadOptions, ArticleList, type ArticleListClassNames, ArticleStudio, type ArticleStudioClassNames, ArticleStudioRoute, ClockIcon, CloseIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, type GitHubConfig, type IconProps, ImageIcon, type Issue, PersonIcon, TagIcon, WarningIcon, buildArticleHead, buildDescription, createArticles, resolveSlug, validateArticle };

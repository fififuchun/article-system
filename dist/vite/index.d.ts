interface ArticleOgTagsOptions {
    /** サイトの起点（`https://example.com`）。必須（spec §18） */
    siteUrl: string;
    /** 記事の URL の形。`:slug` を必ず含める。例 `/article/:slug` */
    path: string;
    /** md の置き場所。`root` からの相対。既定 `src/articles` */
    articlesDir?: string;
    /** 画像の置き場所のURL。既定 `/article_imgs/` */
    imageBasePath?: string;
    /** `og:site_name` */
    siteName?: string;
    /** 本文から説明文を作るときの上限 */
    descriptionLength?: number;
}
/**
 * Vite プラグインの形（spec §18）。
 *
 * **`vite` に依存しません。** 型だけのために依存すると、利用側が Vite を
 * 上げるたびにこのライブラリのバージョンが問題になります。使うのは
 * `configResolved` と `closeBundle` の2つだけで、どちらも Vite 4 から
 * 変わっていません。
 */
interface ArticleOgTagsPlugin {
    name: string;
    apply: "build";
    configResolved(config: ResolvedConfigLike): void;
    closeBundle(): void;
}
interface ResolvedConfigLike {
    root: string;
    build: {
        outDir: string;
    };
}
/**
 * 記事ごとの HTML を出力先に書き出す Vite プラグイン（spec §18）。
 *
 * ```ts
 * // vite.config.ts
 * plugins: [react(), articleOgTags({
 *   siteUrl: "https://example.com",
 *   path: "/article/:slug",
 * })]
 * ```
 *
 * `npm run build` の最後に走り、`dist/article/{slug}/index.html` を作ります。
 * 中身は `dist/index.html` の `<head>` に記事のタグを入れただけのコピーで、
 * `<script>` はそのままなので人間が開いたときの挙動は変わりません。
 *
 * **問題があれば例外を投げてビルドを止めます。** OGタグは誰かが共有するまで
 * 壊れているか分からないため、黙って諦めさせません。
 */
declare function articleOgTags(options: ArticleOgTagsOptions): ArticleOgTagsPlugin;

export { type ArticleOgTagsOptions, type ArticleOgTagsPlugin, articleOgTags };

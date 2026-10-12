import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseFrontmatter } from "../parser";
import { resolveSlug } from "../resolveSlug";
import { buildArticleHead } from "../buildArticleHead";
import type { Article } from "../types";

export interface ArticleOgTagsOptions {
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
export interface ArticleOgTagsPlugin {
  name: string;
  apply: "build";
  configResolved(config: ResolvedConfigLike): void;
  closeBundle(): void;
}

interface ResolvedConfigLike {
  root: string;
  build: { outDir: string };
}

/** 記事として読むファイル。`_` 始まりは下書き（spec §4） */
function isArticleFile(filename: string): boolean {
  return filename.endsWith(".md") && !filename.startsWith("_");
}

/**
 * 元の `index.html` から、記事ごとに置き換える部分を取り除く。
 *
 * `<title>` が2つあると先に書かれたほうが使われ、`og:` が重複すると
 * どちらが拾われるか分かりません。**どちらも静かに間違った結果になる**ため、
 * 記事用のコピーからは先に消しておきます（トップページの `index.html`
 * そのものは変更しません）。
 */
function stripHead(html: string): string {
  return html
    .replace(/[ \t]*<title>[\s\S]*?<\/title>\n?/i, "")
    .replace(
      /[ \t]*<meta[^>]+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description)"[^>]*>\n?/gi,
      ""
    );
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
export function articleOgTags(options: ArticleOgTagsOptions): ArticleOgTagsPlugin {
  // ここで止めれば、ビルドを待たずに気づける
  if (!options.path.includes(":slug")) {
    throw new Error(
      `[article-system] path には :slug を含めてください（例: "/article/:slug"）。` +
        `受け取った値: ${options.path}`
    );
  }

  const articlesDir = options.articlesDir ?? "src/articles";
  let root = process.cwd();
  let outDir = "dist";

  return {
    name: "article-system:og-tags",
    // dev サーバーでは走らせない。書き出す先が無い
    apply: "build",

    configResolved(config) {
      root = config.root;
      // 絶対パスならそのまま返る
      outDir = resolve(config.root, config.build.outDir);
    },

    closeBundle() {
      const articlesPath = resolve(root, articlesDir);

      let filenames: string[];
      try {
        filenames = readdirSync(articlesPath).filter(isArticleFile);
      } catch {
        throw new Error(
          `[article-system] 記事のフォルダが読めませんでした: ${articlesPath}\n` +
            `articlesDir に md の置き場所を渡してください（既定は "src/articles"）。`
        );
      }

      // 0件は設定が間違っている証拠。黙って何も出さないと気づけない
      if (filenames.length === 0) {
        throw new Error(
          `[article-system] ${articlesPath} に md が1件もありません。\n` +
            `articlesDir を確認してください。`
        );
      }

      const indexPath = join(outDir, "index.html");
      let template: string;
      try {
        template = readFileSync(indexPath, "utf8");
      } catch {
        throw new Error(
          `[article-system] ${indexPath} が読めませんでした。\n` +
            `このプラグインはビルドの出力に index.html があることを前提にしています。`
        );
      }

      if (!template.includes("</head>")) {
        throw new Error(
          `[article-system] ${indexPath} に </head> がありません。タグを入れる場所が決められません。`
        );
      }

      const body = stripHead(template);

      for (const filename of filenames) {
        const raw = readFileSync(join(articlesPath, filename), "utf8");
        const { data, content } = parseFrontmatter(raw);
        const slug = resolveSlug(filename, data.slug);

        const article: Article = {
          slug,
          filename,
          title: data.title ?? "",
          date: data.date ?? "",
          latestUpdate: data.latestUpdate ?? "",
          staff: data.staff ?? "",
          thumbnail: data.thumbnail ?? "",
          description: data.description?.trim(),
          content,
        };

        // URL は encode し、フォルダ名は生のまま。静的ホスティングは
        // encode された URL を生のファイル名に対応付ける
        const urlPath = options.path.replace(":slug", slug);
        const head = buildArticleHead(article, {
          siteUrl: options.siteUrl,
          path: urlPath,
          imageBasePath: options.imageBasePath,
          siteName: options.siteName,
          descriptionLength: options.descriptionLength,
        });

        const html = body.replace(
          "</head>",
          `${head
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n")}\n  </head>`
        );

        const file = join(outDir, urlPath, "index.html");
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, html);
      }

      console.log(
        `[article-system] ${filenames.length} 件の記事に og タグを書き出しました`
      );
    },
  };
}

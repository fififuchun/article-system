import type { Article } from "./types";
import { buildDescription } from "./buildDescription";
import { resolveImageSrc } from "./resolveImageSrc";

export interface ArticleHeadOptions {
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
 * 属性値に入れる文字を escape する。
 *
 * **これが無いと `title: 夏の"更新"` で HTML が壊れます。** 属性は `"` で
 * 囲むため `"` と `&` は必須、`<` と `>` は念のため落とします。
 */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 絶対URLにする。
 *
 * **手で文字列を繋ぎません。** 繋ぐと、`imageBasePath` 自体が絶対URL
 * （CDN など）のときに `https://site/https://cdn/...` を作ってしまいます。
 * `URL` に任せると、絶対URLはそのまま、`//` から始まるものには scheme が付き、
 * 日本語は percent-encoding され、すでに `%XX` の部分は二重に encode されません。
 */
function absolute(src: string, siteUrl: string): string {
  return new URL(src, siteUrl).href;
}

function tag(name: "property" | "name", key: string, value: string): string {
  return `<meta ${name}="${key}" content="${escapeAttribute(value)}">`;
}

/**
 * 記事から `<head>` に入れるタグを作る（spec §18）。
 *
 * 共有したときのカード（Open Graph）と `<title>` を出します。文字列を返すだけで、
 * どこに置くかは呼び出し側の仕事です。
 */
export function buildArticleHead(article: Article, options: ArticleHeadOptions): string {
  const { siteUrl, path, imageBasePath = "/article_imgs/", siteName } = options;

  // 絶対URLでなければカードは出ない。黙って壊れるより止める（spec §18）
  if (!/^https?:\/\//.test(siteUrl)) {
    throw new Error(
      `[article-system] siteUrl は http:// か https:// から始まる絶対URLで渡してください。` +
        `og:image は絶対URLでないと無視されます。受け取った値: ${siteUrl}`
    );
  }

  // フロントマターに説明文の項目は持ちません。項目を増やすほど書くことが
   // 増えるため、常に本文から作ります（spec §18）
  const description = buildDescription(article.content, options.descriptionLength);

  // 表示に使うのと同じ解決をしてから絶対URLにする。別の判定を書くと
  // プレビューに出ている画像とカードの画像が食い違う（spec §18）
  const thumbnail = article.thumbnail.trim();
  const imageUrl = thumbnail ? absolute(resolveImageSrc(thumbnail, imageBasePath), siteUrl) : "";

  const url = absolute(path, siteUrl);

  const lines = [
    `<title>${escapeAttribute(article.title)}</title>`,
    // 同じ記事が複数のURLで開けることがある（末尾スラッシュの有無など）。
    // どれが本体かを1つに決める
    `<link rel="canonical" href="${escapeAttribute(url)}">`,
    tag("name", "description", description),
    tag("property", "og:type", "article"),
    tag("property", "og:title", article.title),
    tag("property", "og:description", description),
    tag("property", "og:url", url),
  ];

  if (imageUrl) lines.push(tag("property", "og:image", imageUrl));
  if (siteName) lines.push(tag("property", "og:site_name", siteName));

  // 画像が無いまま大きいカードを指定すると、各サービスで崩れて出る
  lines.push(tag("name", "twitter:card", imageUrl ? "summary_large_image" : "summary"));

  if (article.date) lines.push(tag("property", "article:published_time", article.date));
  if (article.latestUpdate) {
    lines.push(tag("property", "article:modified_time", article.latestUpdate));
  }

  return lines.join("\n");
}

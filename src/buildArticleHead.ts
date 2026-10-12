import type { Article } from "./types";
import { buildDescription } from "./buildDescription";
import { isAbsoluteImageSrc } from "./resolveImageSrc";

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
   * **渡された形のまま使います。** slug に日本語が入る場合、どう encode するかは
   * 呼び出し側の決め事です（ここでは URL に出せない文字だけを補います）。
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
 * URL に出せない文字だけを encode する。
 *
 * すでに `%E6` のようになっている部分は触りません。二重に encode すると
 * `%25E6` になり、別のパスを指します。
 */
function encodeUrlPath(path: string): string {
  return path.replace(/%(?![0-9A-Fa-f]{2})|[^\x21-\x7e]/g, (char) =>
    encodeURIComponent(char)
  );
}

/** 末尾の `/` を落として繋ぐ。`//` になると別のホストを指す */
function join(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
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

  const description =
    article.description?.trim() ||
    buildDescription(article.content, options.descriptionLength);

  const thumbnail = article.thumbnail.trim();
  const imageUrl = thumbnail
    ? isAbsoluteImageSrc(thumbnail)
      ? thumbnail
      : encodeUrlPath(join(siteUrl, join(imageBasePath, thumbnail)))
    : "";

  const lines = [
    `<title>${escapeAttribute(article.title)}</title>`,
    tag("name", "description", description),
    tag("property", "og:type", "article"),
    tag("property", "og:title", article.title),
    tag("property", "og:description", description),
    tag("property", "og:url", encodeUrlPath(join(siteUrl, path))),
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

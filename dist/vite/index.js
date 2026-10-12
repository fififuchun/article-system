// src/vite/articleOgTags.ts
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, join as join2, resolve } from "path";

// src/parser.ts
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };
  const data = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    data[key] = value;
  }
  return { data, content: match[2] };
}

// src/resolveSlug.ts
function resolveSlug(filename, frontmatterSlug) {
  return frontmatterSlug?.trim() || filename.replace(/\.md$/, "");
}

// src/buildDescription.ts
var MAX_LENGTH = 120;
function buildDescription(content, maxLength = MAX_LENGTH) {
  const text = content.replace(/```[\s\S]*?```/g, " ").replace(/~~~[\s\S]*?~~~/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<!--[\s\S]*?-->/g, " ").replace(/^[ \t]{0,3}([-*_])[ \t]*(\1[ \t]*){2,}$/gm, " ").replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, " ").replace(/^[ \t]{0,3}>[ \t]?/gm, " ").replace(/^[ \t]{0,3}[-*+][ \t]+/gm, " ").replace(/^[ \t]{0,3}\d+\.[ \t]+/gm, " ").replace(/^[ \t]*\|[ \t:|-]+\|[ \t]*$/gm, " ").replace(/^[ \t]*\|.*\|[ \t]*$/gm, (row) => row.replace(/\|/g, " ")).replace(/[*`~]/g, "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}\u2026`;
}

// src/resolveImageSrc.ts
var ABSOLUTE_URL = /^(?:(?:https?:)?\/\/|blob:|data:)/;
function isAbsoluteImageSrc(src) {
  return ABSOLUTE_URL.test(src);
}

// src/buildArticleHead.ts
function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function encodeUrlPath(path) {
  return path.replace(
    /%(?![0-9A-Fa-f]{2})|[^\x21-\x7e]/g,
    (char) => encodeURIComponent(char)
  );
}
function join(base, path) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
function tag(name, key, value) {
  return `<meta ${name}="${key}" content="${escapeAttribute(value)}">`;
}
function buildArticleHead(article, options) {
  const { siteUrl, path, imageBasePath = "/article_imgs/", siteName } = options;
  if (!/^https?:\/\//.test(siteUrl)) {
    throw new Error(
      `[article-system] siteUrl \u306F http:// \u304B https:// \u304B\u3089\u59CB\u307E\u308B\u7D76\u5BFEURL\u3067\u6E21\u3057\u3066\u304F\u3060\u3055\u3044\u3002og:image \u306F\u7D76\u5BFEURL\u3067\u306A\u3044\u3068\u7121\u8996\u3055\u308C\u307E\u3059\u3002\u53D7\u3051\u53D6\u3063\u305F\u5024: ${siteUrl}`
    );
  }
  const description = article.description?.trim() || buildDescription(article.content, options.descriptionLength);
  const thumbnail = article.thumbnail.trim();
  const imageUrl = thumbnail ? isAbsoluteImageSrc(thumbnail) ? thumbnail : encodeUrlPath(join(siteUrl, join(imageBasePath, thumbnail))) : "";
  const lines = [
    `<title>${escapeAttribute(article.title)}</title>`,
    tag("name", "description", description),
    tag("property", "og:type", "article"),
    tag("property", "og:title", article.title),
    tag("property", "og:description", description),
    tag("property", "og:url", encodeUrlPath(join(siteUrl, path)))
  ];
  if (imageUrl) lines.push(tag("property", "og:image", imageUrl));
  if (siteName) lines.push(tag("property", "og:site_name", siteName));
  lines.push(tag("name", "twitter:card", imageUrl ? "summary_large_image" : "summary"));
  if (article.date) lines.push(tag("property", "article:published_time", article.date));
  if (article.latestUpdate) {
    lines.push(tag("property", "article:modified_time", article.latestUpdate));
  }
  return lines.join("\n");
}

// src/vite/articleOgTags.ts
function isArticleFile(filename) {
  return filename.endsWith(".md") && !filename.startsWith("_");
}
function stripHead(html) {
  return html.replace(/[ \t]*<title>[\s\S]*?<\/title>\n?/i, "").replace(
    /[ \t]*<meta[^>]+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description)"[^>]*>\n?/gi,
    ""
  );
}
function articleOgTags(options) {
  if (!options.path.includes(":slug")) {
    throw new Error(
      `[article-system] path \u306B\u306F :slug \u3092\u542B\u3081\u3066\u304F\u3060\u3055\u3044\uFF08\u4F8B: "/article/:slug"\uFF09\u3002\u53D7\u3051\u53D6\u3063\u305F\u5024: ${options.path}`
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
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const articlesPath = resolve(root, articlesDir);
      let filenames;
      try {
        filenames = readdirSync(articlesPath).filter(isArticleFile);
      } catch {
        throw new Error(
          `[article-system] \u8A18\u4E8B\u306E\u30D5\u30A9\u30EB\u30C0\u304C\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F: ${articlesPath}
articlesDir \u306B md \u306E\u7F6E\u304D\u5834\u6240\u3092\u6E21\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u65E2\u5B9A\u306F "src/articles"\uFF09\u3002`
        );
      }
      if (filenames.length === 0) {
        throw new Error(
          `[article-system] ${articlesPath} \u306B md \u304C1\u4EF6\u3082\u3042\u308A\u307E\u305B\u3093\u3002
articlesDir \u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
        );
      }
      const indexPath = join2(outDir, "index.html");
      let template;
      try {
        template = readFileSync(indexPath, "utf8");
      } catch {
        throw new Error(
          `[article-system] ${indexPath} \u304C\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F\u3002
\u3053\u306E\u30D7\u30E9\u30B0\u30A4\u30F3\u306F\u30D3\u30EB\u30C9\u306E\u51FA\u529B\u306B index.html \u304C\u3042\u308B\u3053\u3068\u3092\u524D\u63D0\u306B\u3057\u3066\u3044\u307E\u3059\u3002`
        );
      }
      if (!template.includes("</head>")) {
        throw new Error(
          `[article-system] ${indexPath} \u306B </head> \u304C\u3042\u308A\u307E\u305B\u3093\u3002\u30BF\u30B0\u3092\u5165\u308C\u308B\u5834\u6240\u304C\u6C7A\u3081\u3089\u308C\u307E\u305B\u3093\u3002`
        );
      }
      const body = stripHead(template);
      for (const filename of filenames) {
        const raw = readFileSync(join2(articlesPath, filename), "utf8");
        const { data, content } = parseFrontmatter(raw);
        const slug = resolveSlug(filename, data.slug);
        const article = {
          slug,
          filename,
          title: data.title ?? "",
          date: data.date ?? "",
          latestUpdate: data.latestUpdate ?? "",
          staff: data.staff ?? "",
          thumbnail: data.thumbnail ?? "",
          description: data.description?.trim(),
          content
        };
        const urlPath = options.path.replace(":slug", slug);
        const head = buildArticleHead(article, {
          siteUrl: options.siteUrl,
          path: urlPath,
          imageBasePath: options.imageBasePath,
          siteName: options.siteName,
          descriptionLength: options.descriptionLength
        });
        const html = body.replace(
          "</head>",
          `${head.split("\n").map((line) => `    ${line}`).join("\n")}
  </head>`
        );
        const file = join2(outDir, urlPath, "index.html");
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, html);
      }
      console.log(
        `[article-system] ${filenames.length} \u4EF6\u306E\u8A18\u4E8B\u306B og \u30BF\u30B0\u3092\u66F8\u304D\u51FA\u3057\u307E\u3057\u305F`
      );
    }
  };
}
export {
  articleOgTags
};

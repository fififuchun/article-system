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

// src/levenshtein.ts
function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitution
      );
    }
    previous = current;
  }
  return previous[b.length];
}

// src/validate.ts
var REQUIRED_FIELDS = ["title", "date", "latestUpdate", "staff", "thumbnail"];
var TYPO_MAX_DISTANCE = 2;
var DATE_FIELDS = ["date", "latestUpdate"];
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function isQuoted(value) {
  if (value.length < 2) return false;
  const head = value[0];
  const tail = value[value.length - 1];
  return (head === '"' || head === "'") && head === tail;
}
function validateArticle(raw, context = {}) {
  const { data, content } = parseFrontmatter(raw);
  if (content === raw && raw.startsWith("---")) {
    return [
      {
        level: "error",
        message: "\u30D5\u30ED\u30F3\u30C8\u30DE\u30BF\u30FC\u304C --- \u3067\u9589\u3058\u3089\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u9589\u3058\u306A\u3044\u3068\u5168\u6587\u304C\u672C\u6587\u3068\u3057\u3066\u6271\u308F\u308C\u307E\u3059\u3002"
      }
    ];
  }
  const issues = [];
  for (const field of REQUIRED_FIELDS) {
    if ((data[field] ?? "").trim() === "") {
      issues.push({
        level: "error",
        field,
        message: `${field} \u304C\u5165\u529B\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002`
      });
    }
  }
  for (const [field, value] of Object.entries(data)) {
    if (isQuoted(value)) {
      issues.push({
        level: "error",
        field,
        message: `${field} \u306E\u5024\u304C\u5F15\u7528\u7B26\u3067\u56F2\u307E\u308C\u3066\u3044\u307E\u3059\u3002\u5F15\u7528\u7B26\u306F\u5024\u306E\u4E00\u90E8\u3068\u3057\u3066\u6271\u308F\u308C\u308B\u305F\u3081\u5916\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u73FE\u5728\u306E\u5024: ${value}`
      });
    }
  }
  for (const field of DATE_FIELDS) {
    const value = (data[field] ?? "").trim();
    if (value === "" || isQuoted(value)) continue;
    if (!DATE_PATTERN.test(value)) {
      issues.push({
        level: "error",
        field,
        message: `${field} \u306F YYYY-MM-DD \u306E\u5F62\u5F0F\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\uFF08\u4F8B: 2026-08-23\uFF09\u3002\u73FE\u5728\u306E\u5024: ${value}`
      });
    }
  }
  for (const field of Object.keys(data)) {
    if (REQUIRED_FIELDS.includes(field)) continue;
    let nearest = "";
    let nearestDistance = Infinity;
    for (const known of REQUIRED_FIELDS) {
      const distance = levenshtein(field, known);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = known;
      }
    }
    if (nearestDistance <= TYPO_MAX_DISTANCE) {
      issues.push({
        level: "error",
        field,
        message: `${field} \u306F\u65E2\u77E5\u306E\u9805\u76EE\u306B\u3042\u308A\u307E\u305B\u3093\u3002${nearest} \u306E\u8AA4\u308A\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u304B\u3002`
      });
    }
  }
  const date = (data.date ?? "").trim();
  const latestUpdate = (data.latestUpdate ?? "").trim();
  if (DATE_PATTERN.test(date) && DATE_PATTERN.test(latestUpdate) && latestUpdate < date) {
    issues.push({
      level: "error",
      field: "latestUpdate",
      message: `latestUpdate (${latestUpdate}) \u304C date (${date}) \u3088\u308A\u524D\u306B\u306A\u3063\u3066\u3044\u307E\u3059\u3002\u6700\u7D42\u7DE8\u96C6\u65E5\u306F\u516C\u958B\u65E5\u4EE5\u964D\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
    });
  }
  const { articles, filename } = context;
  if (filename && articles?.some((article) => article.filename === filename)) {
    issues.push({
      level: "error",
      message: `\u30D5\u30A1\u30A4\u30EB\u540D ${filename} \u306F\u65E2\u5B58\u306E\u8A18\u4E8B\u3068\u91CD\u8907\u3057\u3066\u3044\u307E\u3059\u3002\u3053\u306E\u307E\u307E\u4FDD\u5B58\u3059\u308B\u3068\u65E2\u5B58\u306E\u8A18\u4E8B\u304C\u4E0A\u66F8\u304D\u3055\u308C\u3066\u6D88\u3048\u307E\u3059\u3002`
    });
  }
  return issues;
}

// src/createArticles.ts
function createArticles(rawFiles) {
  return Object.entries(rawFiles).map(([path, raw]) => {
    const filename = path.split("/").pop() ?? path;
    if (filename.startsWith("_")) {
      throw new Error(
        `[article-system] \u4E0B\u66F8\u304D\u30D5\u30A1\u30A4\u30EB "${filename}" \u304C\u30D0\u30F3\u30C9\u30EB\u306B\u542B\u307E\u308C\u3066\u3044\u307E\u3059\u3002
\u672C\u6587\u304C\u516C\u958B\u3055\u308C\u3066\u3044\u307E\u3059\u3002import.meta.glob \u306E\u30D1\u30BF\u30FC\u30F3\u3092
  "../articles/[!_]*.md"
\u306B\u5909\u66F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
      );
    }
    const issues = validateArticle(raw);
    if (issues.length > 0) {
      console.warn(
        `[article-system] ${filename} \u306B\u554F\u984C\u304C\u3042\u308A\u307E\u3059:
` + issues.map((issue) => `  - ${issue.message}`).join("\n")
      );
    }
    const { data, content } = parseFrontmatter(raw);
    return {
      filename,
      title: data.title ?? "",
      date: data.date ?? "",
      latestUpdate: data.latestUpdate ?? "",
      staff: data.staff ?? "",
      thumbnail: data.thumbnail ?? "",
      content
    };
  }).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).map((article, index) => ({ ...article, id: index }));
}

// src/components/ArticleDetail.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

// src/cx.ts
function cx(...classes) {
  return classes.filter((className) => Boolean(className)).join(" ");
}

// src/formatDate.ts
function formatDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

// src/resolveImageSrc.ts
var ABSOLUTE_URL = /^(?:(?:https?:)?\/\/|blob:|data:)/;
function isAbsoluteImageSrc(src) {
  return ABSOLUTE_URL.test(src);
}
function resolveImageSrc(src, imageBasePath) {
  return isAbsoluteImageSrc(src) ? src : `${imageBasePath}${src}`;
}

// src/icons/ClockIcon.tsx
import { jsx } from "react/jsx-runtime";
function ClockIcon({ className }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
      "aria-hidden": "true",
      className,
      children: /* @__PURE__ */ jsx("path", { d: "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" })
    }
  );
}

// src/components/ArticleDetail.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function ArticleDetail({
  article,
  imageBasePath = "/article_imgs/",
  classNames = {},
  dateLabel = "\u6700\u7D42\u66F4\u65B0\u65E5\u6642"
}) {
  const { year, month, day } = formatDate(article.date);
  const latest = formatDate(article.latestUpdate);
  const mdComponents = {
    h2: ({ children }) => /* @__PURE__ */ jsx2("h2", { className: cx("as-heading", classNames.heading), children }),
    h3: ({ children }) => /* @__PURE__ */ jsx2("h3", { className: cx("as-subheading", classNames.subheading), children }),
    h4: ({ children }) => /* @__PURE__ */ jsx2("h4", { className: cx("as-subsubheading", classNames.subsubheading), children }),
    // 画像だけの行も markdown では段落になる。ブロックとして扱い、p では包まない。
    // p の中に div を入れると SSR でハイドレーションエラーになる（spec §7-2）
    p: ({ children, node }) => {
      const onlyChild = node?.children.length === 1 ? node.children[0] : void 0;
      if (onlyChild?.type === "element" && onlyChild.tagName === "img") {
        return /* @__PURE__ */ jsx2("div", { className: cx("as-image", classNames.image), children });
      }
      return /* @__PURE__ */ jsx2("p", { className: cx("as-paragraph", classNames.paragraph), children });
    },
    img: ({ src, alt }) => /* @__PURE__ */ jsx2("img", { src: resolveImageSrc(src ?? "", imageBasePath), alt: alt ?? "" })
  };
  return /* @__PURE__ */ jsxs("div", { className: cx("as-article", classNames.wrapper), children: [
    /* @__PURE__ */ jsxs("div", { className: cx("as-header", classNames.headerWrapper), children: [
      /* @__PURE__ */ jsxs("div", { className: cx("as-date", classNames.dateWrapper), children: [
        /* @__PURE__ */ jsx2("p", { className: cx("as-date-year", classNames.dateYear), children: year }),
        /* @__PURE__ */ jsxs("p", { className: cx("as-date-day", classNames.dateDay), children: [
          month,
          "/",
          day
        ] })
      ] }),
      /* @__PURE__ */ jsx2("p", { className: cx("as-title", classNames.title), children: article.title })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: cx("as-latest-update", classNames.latestUpdate), children: [
      /* @__PURE__ */ jsx2(ClockIcon, { className: cx("as-date-icon", classNames.dateIcon) }),
      /* @__PURE__ */ jsxs("span", { children: [
        dateLabel,
        "\xA0",
        latest.year,
        "\u5E74",
        latest.month,
        "\u6708",
        latest.day,
        "\u65E5"
      ] })
    ] }),
    article.thumbnail && /* @__PURE__ */ jsx2(
      "img",
      {
        src: resolveImageSrc(article.thumbnail, imageBasePath),
        alt: article.title,
        className: cx("as-thumbnail", classNames.thumbnail)
      }
    ),
    /* @__PURE__ */ jsx2(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkBreaks], components: mdComponents, children: article.content }),
    /* @__PURE__ */ jsxs("p", { className: cx("as-footer", classNames.footer), children: [
      "\u62C5\u5F53\uFF1A",
      article.staff
    ] })
  ] });
}

// src/components/ArticleList.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function ArticleList({
  articles,
  imageBasePath = "/article_imgs/",
  getArticleUrl,
  classNames = {},
  renderLink
}) {
  return /* @__PURE__ */ jsx3("div", { className: cx("as-grid", classNames.grid), children: articles.map((article) => {
    const { year, month, day } = formatDate(article.latestUpdate);
    return renderLink(
      getArticleUrl(article),
      /* @__PURE__ */ jsxs2("div", { className: cx("as-card", classNames.card), children: [
        /* @__PURE__ */ jsx3(
          "img",
          {
            src: resolveImageSrc(article.thumbnail, imageBasePath),
            alt: article.title,
            className: cx("as-card-image", classNames.cardImage)
          }
        ),
        /* @__PURE__ */ jsx3("p", { className: cx("as-card-title", classNames.cardTitle), children: article.title }),
        /* @__PURE__ */ jsxs2("div", { className: cx("as-card-date", classNames.cardDate), children: [
          /* @__PURE__ */ jsx3(ClockIcon, { className: cx("as-card-date-icon", classNames.cardDateIcon) }),
          /* @__PURE__ */ jsxs2("span", { children: [
            year,
            "\u5E74",
            month,
            "\u6708",
            day,
            "\u65E5"
          ] })
        ] })
      ] }),
      article.id
    );
  }) });
}

// src/components/ArticleStudio.tsx
import { useEffect, useState } from "react";

// src/icons/DownloadIcon.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function DownloadIcon({ className }) {
  return /* @__PURE__ */ jsxs3(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
      "aria-hidden": "true",
      className,
      children: [
        /* @__PURE__ */ jsx4("path", { d: "M11 3h2v9.17l3.59-3.58L18 10l-6 6-6-6 1.41-1.41L11 12.17V3z" }),
        /* @__PURE__ */ jsx4("path", { d: "M4 18h16v2H4z" })
      ]
    }
  );
}

// src/icons/WarningIcon.tsx
import { jsx as jsx5 } from "react/jsx-runtime";
function WarningIcon({ className }) {
  return /* @__PURE__ */ jsx5(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
      "aria-hidden": "true",
      className,
      children: /* @__PURE__ */ jsx5(
        "path",
        {
          fillRule: "evenodd",
          d: "M12 2l11 19H1L12 2zm-1 7v6h2V9h-2zm0 8v2h2v-2h-2z"
        }
      )
    }
  );
}

// src/studio/buildFilename.ts
var FORBIDDEN = /[/\\:*?"<>|]/g;
var MAX_TITLE_LENGTH = 50;
function sanitizeTitle(title) {
  return title.replace(FORBIDDEN, "").trim().replace(/\s+/g, "-").slice(0, MAX_TITLE_LENGTH).replace(/-+$/, "");
}
function buildFilename(date, title, options = {}) {
  const safeTitle = sanitizeTitle(title);
  const base = safeTitle ? `${date}-${safeTitle}` : date;
  return `${options.draft ? "_" : ""}${base}.md`;
}

// src/studio/buildDraftArticle.ts
function buildDraftArticle(raw, articles = []) {
  const { data, content } = parseFrontmatter(raw);
  const date = data.date ?? "";
  const title = data.title ?? "";
  return {
    // date 昇順に並べたとき何番目に入るか。同じ日付の記事より後ろに付く
    id: articles.filter((article) => article.date <= date).length,
    filename: buildFilename(date, title),
    title,
    date,
    latestUpdate: data.latestUpdate ?? "",
    staff: data.staff ?? "",
    thumbnail: data.thumbnail ?? "",
    content
  };
}

// src/studio/buildTemplate.ts
function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function buildTemplate(today = /* @__PURE__ */ new Date()) {
  const date = toDateString(today);
  return [
    "---",
    "title:",
    `date: ${date}`,
    `latestUpdate: ${date}`,
    "staff:",
    "thumbnail:",
    "---",
    "",
    "## \u898B\u51FA\u3057",
    "",
    "\u672C\u6587\u3092\u3053\u3053\u306B\u66F8\u304D\u307E\u3059\u3002",
    ""
  ].join("\n");
}

// src/studio/downloadFile.ts
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function downloadMarkdown(filename, markdown) {
  downloadBlob(filename, new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
}

// src/studio/renameImage.ts
function renameImageInMarkdown(markdown, from, to) {
  return markdown.split(`](${from})`).join(`](${to})`);
}

// src/studio/collectImageNames.ts
var IMAGE_SYNTAX = /!\[[^\]]*\]\(([^)]*)\)/g;
function collectImageNames(markdown, thumbnail) {
  const names = [...markdown.matchAll(IMAGE_SYNTAX)].map((match) => match[1]);
  return [.../* @__PURE__ */ new Set([...names, thumbnail])].filter(
    (name) => name !== "" && !isAbsoluteImageSrc(name)
  );
}

// src/studio/draftStorage.ts
var PREFIX = "as-studio-draft";
function draftKey(storageKey = "default") {
  return `${PREFIX}:${storageKey}`;
}
function saveDraft(storageKey, raw) {
  try {
    localStorage.setItem(draftKey(storageKey), raw);
  } catch {
  }
}
function loadDraft(storageKey) {
  try {
    return localStorage.getItem(draftKey(storageKey));
  } catch {
    return null;
  }
}

// src/components/ArticleStudio.tsx
import { jsx as jsx6, jsxs as jsxs4 } from "react/jsx-runtime";
var LIST_PREVIEW_COUNT = 6;
function ArticleStudio({
  articles,
  storageKey,
  imageBasePath,
  dateLabel,
  classNames = {},
  articleClassNames
}) {
  const [raw, setRaw] = useState(() => loadDraft(storageKey) ?? buildTemplate());
  const [tab, setTab] = useState("detail");
  const [issues, setIssues] = useState([]);
  const [images, setImages] = useState([]);
  const [missingImages, setMissingImages] = useState({});
  const [placementPending, setPlacementPending] = useState(false);
  useEffect(() => {
    saveDraft(storageKey, raw);
  }, [storageKey, raw]);
  const draft = buildDraftArticle(raw, articles);
  const basePath = imageBasePath ?? "/article_imgs/";
  const probeNames = collectImageNames(draft.content, draft.thumbnail).filter(
    (name) => !images.some((image) => image.name === name)
  );
  const toPreviewSrc = (value) => images.reduce((text, image) => text.split(image.name).join(image.url), value);
  const previewArticle = {
    ...draft,
    thumbnail: toPreviewSrc(draft.thumbnail),
    content: toPreviewSrc(draft.content)
  };
  const startNewArticle = () => {
    if (!window.confirm("\u7DE8\u96C6\u4E2D\u306E\u5185\u5BB9\u3092\u6D88\u3057\u3066\u65B0\u3057\u304F\u66F8\u304D\u59CB\u3081\u307E\u3059\u3002\u3088\u308D\u3057\u3044\u3067\u3059\u304B\uFF1F")) return;
    setRaw(buildTemplate());
    setIssues([]);
  };
  const downloadImage = (image) => {
    downloadBlob(image.name, image.file);
  };
  const renameImage = (index, nextName) => {
    const target = images[index];
    setImages(images.map((image, i) => i === index ? { ...image, name: nextName } : image));
    setRaw(renameImageInMarkdown(raw, target.name, nextName));
  };
  const handleDrop = (event) => {
    const dropped = Array.from(event.dataTransfer?.files ?? []).filter(
      (file) => file.type.startsWith("image/")
    );
    if (dropped.length === 0) return;
    event.preventDefault();
    const added = dropped.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      file
    }));
    setImages((current) => [...current, ...added]);
    setPlacementPending(false);
    const markdown = added.map((image) => `![](${image.name})`).join("\n\n");
    setRaw(`${raw}

${markdown}
`);
  };
  const listPreview = [...articles, draft].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0).slice(0, LIST_PREVIEW_COUNT);
  const downloadDraft = () => {
    downloadMarkdown(buildFilename(draft.date, draft.title, { draft: true }), raw);
  };
  const downloadForPublish = () => {
    const filename = buildFilename(draft.date, draft.title);
    const missing = probeNames.filter((name) => missingImages[name]).map((name) => ({
      level: "error",
      message: `\u753B\u50CF ${name} \u304C ${basePath} \u306B\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002\u540D\u524D\u3092\u78BA\u304B\u3081\u3066\u304F\u3060\u3055\u3044\u3002`
    }));
    const found = [...validateArticle(raw, { articles, filename }), ...missing];
    setIssues(found);
    if (found.length > 0) return;
    downloadMarkdown(filename, raw);
    setPlacementPending(images.length > 0);
  };
  return /* @__PURE__ */ jsxs4("div", { className: cx("as-studio", classNames.wrapper), children: [
    /* @__PURE__ */ jsxs4(
      "div",
      {
        className: cx("as-studio-editor", classNames.editorPane),
        onDrop: handleDrop,
        onDragOver: (event) => event.preventDefault(),
        children: [
          /* @__PURE__ */ jsx6(
            "textarea",
            {
              className: cx("as-studio-textarea", classNames.textarea),
              value: raw,
              onChange: (event) => setRaw(event.target.value),
              spellCheck: false
            }
          ),
          images.length > 0 && /* @__PURE__ */ jsxs4("div", { className: cx("as-studio-images", classNames.imagePane), children: [
            placementPending && /* @__PURE__ */ jsxs4("p", { className: "as-studio-images-note", children: [
              "\u4EE5\u4E0B\u306E\u753B\u50CF\u3092 ",
              basePath,
              " \u306B\u914D\u7F6E\u3057\u3066\u304F\u3060\u3055\u3044\u3002md \u3060\u3051\u3067\u306F\u8868\u793A\u3055\u308C\u307E\u305B\u3093\u3002"
            ] }),
            /* @__PURE__ */ jsx6("ul", { children: images.map((image, index) => /* @__PURE__ */ jsxs4("li", { children: [
              /* @__PURE__ */ jsx6("img", { src: image.url, alt: "" }),
              /* @__PURE__ */ jsx6(
                "input",
                {
                  type: "text",
                  "aria-label": "\u753B\u50CF\u306E\u540D\u524D",
                  value: image.name,
                  onChange: (event) => renameImage(index, event.target.value)
                }
              ),
              /* @__PURE__ */ jsx6(
                "button",
                {
                  type: "button",
                  "aria-label": `${image.name} \u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9`,
                  onClick: () => downloadImage(image),
                  children: /* @__PURE__ */ jsx6(DownloadIcon, { className: "as-studio-image-download-icon" })
                }
              ),
              placementPending && /* @__PURE__ */ jsx6("span", { className: "as-studio-image-pending", children: "\u672A\u914D\u7F6E" })
            ] }, image.url)) })
          ] }),
          issues.length > 0 && /* @__PURE__ */ jsx6("div", { className: cx("as-studio-issues", classNames.issues), role: "alert", children: /* @__PURE__ */ jsx6("ul", { children: issues.map((issue, index) => /* @__PURE__ */ jsxs4("li", { children: [
            /* @__PURE__ */ jsx6(WarningIcon, { className: "as-studio-issue-icon" }),
            /* @__PURE__ */ jsx6("span", { children: issue.message })
          ] }, index)) }) }),
          /* @__PURE__ */ jsxs4("div", { className: cx("as-studio-actions", classNames.actions), children: [
            /* @__PURE__ */ jsx6("button", { type: "button", onClick: downloadForPublish, children: "\u672C\u756A\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9" }),
            /* @__PURE__ */ jsx6("button", { type: "button", onClick: downloadDraft, children: "\u4E0B\u66F8\u304D\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9" }),
            /* @__PURE__ */ jsx6("button", { type: "button", onClick: startNewArticle, children: "\u65B0\u3057\u304F\u66F8\u304F" })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx6("div", { hidden: true, children: probeNames.map((name) => /* @__PURE__ */ jsx6(
      "img",
      {
        src: resolveImageSrc(name, basePath),
        alt: "",
        onError: () => setMissingImages((current) => ({ ...current, [name]: true })),
        onLoad: () => setMissingImages((current) => ({ ...current, [name]: false }))
      },
      name
    )) }),
    /* @__PURE__ */ jsxs4("div", { className: cx("as-studio-preview", classNames.previewPane), children: [
      /* @__PURE__ */ jsxs4("div", { className: cx("as-studio-tabs", classNames.tabs), role: "tablist", children: [
        /* @__PURE__ */ jsx6("button", { type: "button", role: "tab", "aria-selected": tab === "detail", onClick: () => setTab("detail"), children: "\u8A73\u7D30" }),
        /* @__PURE__ */ jsx6("button", { type: "button", role: "tab", "aria-selected": tab === "list", onClick: () => setTab("list"), children: "\u4E00\u89A7" })
      ] }),
      tab === "detail" ? /* @__PURE__ */ jsx6(
        ArticleDetail,
        {
          article: previewArticle,
          imageBasePath,
          dateLabel,
          classNames: articleClassNames
        }
      ) : /* @__PURE__ */ jsx6(
        ArticleList,
        {
          articles: listPreview,
          imageBasePath,
          getArticleUrl: () => "#",
          renderLink: (_url, children, key) => /* @__PURE__ */ jsx6("div", { children }, key)
        }
      )
    ] })
  ] });
}

// src/icons/ArrowIcon.tsx
import { jsx as jsx7 } from "react/jsx-runtime";
function ArrowIcon({ className }) {
  return /* @__PURE__ */ jsx7(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
      "aria-hidden": "true",
      className,
      children: /* @__PURE__ */ jsx7("path", { d: "M4 11h12.17l-3.58-3.59L14 6l6 6-6 6-1.41-1.41L16.17 13H4z" })
    }
  );
}

// src/icons/CloseIcon.tsx
import { jsx as jsx8 } from "react/jsx-runtime";
function CloseIcon({ className }) {
  return /* @__PURE__ */ jsx8(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
      "aria-hidden": "true",
      className,
      children: /* @__PURE__ */ jsx8("path", { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" })
    }
  );
}

// src/icons/CopyIcon.tsx
import { jsx as jsx9, jsxs as jsxs5 } from "react/jsx-runtime";
function CopyIcon({ className }) {
  return /* @__PURE__ */ jsxs5(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
      "aria-hidden": "true",
      className,
      children: [
        /* @__PURE__ */ jsx9("path", { d: "M8 2h10a2 2 0 012 2v10h-2V4H8z" }),
        /* @__PURE__ */ jsx9("path", { fillRule: "evenodd", d: "M4 6h12v14H4V6zm2 2v10h8V8z" })
      ]
    }
  );
}

// src/icons/ExternalLinkIcon.tsx
import { jsx as jsx10, jsxs as jsxs6 } from "react/jsx-runtime";
function ExternalLinkIcon({ className }) {
  return /* @__PURE__ */ jsxs6(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
      "aria-hidden": "true",
      className,
      children: [
        /* @__PURE__ */ jsx10("path", { d: "M14 3h7v7h-2V6.41l-8.29 8.3-1.42-1.42L17.59 5H14z" }),
        /* @__PURE__ */ jsx10("path", { d: "M19 13v6H5V5h6V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-6z" })
      ]
    }
  );
}

// src/icons/ImageIcon.tsx
import { jsx as jsx11, jsxs as jsxs7 } from "react/jsx-runtime";
function ImageIcon({ className }) {
  return /* @__PURE__ */ jsxs7(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
      "aria-hidden": "true",
      className,
      children: [
        /* @__PURE__ */ jsx11("path", { fillRule: "evenodd", d: "M2 4h20v16H2V4zm2 2v12h16V6H4z" }),
        /* @__PURE__ */ jsx11("circle", { cx: "8", cy: "10", r: "1.75" }),
        /* @__PURE__ */ jsx11("path", { d: "M5 17l4-5 3 3.5L15 12l4 5H5z" })
      ]
    }
  );
}

// src/icons/PersonIcon.tsx
import { jsx as jsx12, jsxs as jsxs8 } from "react/jsx-runtime";
function PersonIcon({ className }) {
  return /* @__PURE__ */ jsxs8(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
      "aria-hidden": "true",
      className,
      children: [
        /* @__PURE__ */ jsx12("circle", { cx: "12", cy: "7.5", r: "3.75" }),
        /* @__PURE__ */ jsx12("path", { d: "M12 13.5c-4.14 0-7.5 2.35-7.5 5.25V20h15v-1.25c0-2.9-3.36-5.25-7.5-5.25z" })
      ]
    }
  );
}

// src/icons/TagIcon.tsx
import { jsx as jsx13 } from "react/jsx-runtime";
function TagIcon({ className }) {
  return /* @__PURE__ */ jsx13(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
      "aria-hidden": "true",
      className,
      children: /* @__PURE__ */ jsx13(
        "path",
        {
          fillRule: "evenodd",
          d: "M4 3h7.17c.53 0 1.04.21 1.41.59l8.83 8.83a2 2 0 0 1 0 2.83l-6.17 6.17a2 2 0 0 1-2.83 0L3.59 12.58A2 2 0 0 1 3 11.17V4a1 1 0 0 1 1-1zm3.25 2.5a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5z"
        }
      )
    }
  );
}
export {
  ArrowIcon,
  ArticleDetail,
  ArticleList,
  ArticleStudio,
  ClockIcon,
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  ImageIcon,
  PersonIcon,
  TagIcon,
  WarningIcon,
  createArticles,
  validateArticle
};

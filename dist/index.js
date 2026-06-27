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

// src/createArticles.ts
function createArticles(rawFiles) {
  return Object.values(rawFiles).map((raw) => {
    const { data, content } = parseFrontmatter(raw);
    return {
      title: data.title ?? "",
      date: data.date ?? "",
      latestUpdate: data.latestUpdate ?? "",
      staff: data.staff ?? "",
      thumbnail: data.thumbnail ?? "",
      content
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((article, index) => ({ ...article, id: index }));
}

// src/components/ArticleDetail.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

// src/icons/ClockIcon.tsx
import { jsx } from "react/jsx-runtime";
function ClockIcon({ className }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
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
  const [year, month, day] = article.date.split("-").map(Number);
  const [ly, lm, ld] = article.latestUpdate.split("-").map(Number);
  const mdComponents = {
    h2: ({ children }) => /* @__PURE__ */ jsx2("div", { className: classNames.heading, children }),
    h3: ({ children }) => /* @__PURE__ */ jsx2("div", { className: classNames.subheading, children }),
    h4: ({ children }) => /* @__PURE__ */ jsx2("div", { className: classNames.subsubheading, children }),
    p: ({ children }) => /* @__PURE__ */ jsx2("div", { className: classNames.paragraph, children: /* @__PURE__ */ jsx2("p", { children }) }),
    img: ({ src, alt }) => /* @__PURE__ */ jsx2("div", { className: classNames.image, children: /* @__PURE__ */ jsx2("img", { src: `${imageBasePath}${src}`, alt: alt ?? "" }) })
  };
  return /* @__PURE__ */ jsxs("div", { className: classNames.wrapper, children: [
    /* @__PURE__ */ jsxs("div", { className: classNames.headerWrapper, children: [
      /* @__PURE__ */ jsxs("div", { className: classNames.dateWrapper, children: [
        /* @__PURE__ */ jsx2("p", { className: classNames.dateYear, children: year }),
        /* @__PURE__ */ jsxs("p", { className: classNames.dateDay, children: [
          month,
          "/",
          day
        ] })
      ] }),
      /* @__PURE__ */ jsx2("p", { className: classNames.title, children: article.title })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: classNames.latestUpdate, children: [
      /* @__PURE__ */ jsx2(ClockIcon, { className: classNames.dateIcon }),
      /* @__PURE__ */ jsxs("span", { children: [
        dateLabel,
        "\xA0",
        ly,
        "\u5E74",
        lm,
        "\u6708",
        ld,
        "\u65E5"
      ] })
    ] }),
    /* @__PURE__ */ jsx2(
      "img",
      {
        src: `${imageBasePath}${article.thumbnail}`,
        alt: article.title,
        className: classNames.thumbnail
      }
    ),
    /* @__PURE__ */ jsx2(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkBreaks], components: mdComponents, children: article.content }),
    /* @__PURE__ */ jsxs("p", { className: classNames.footer, children: [
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
  return /* @__PURE__ */ jsx3("div", { className: classNames.grid, children: articles.map((article) => {
    const [year, month, day] = article.latestUpdate.split("-").map(Number);
    return renderLink(
      getArticleUrl(article),
      /* @__PURE__ */ jsxs2("div", { className: classNames.card, children: [
        /* @__PURE__ */ jsx3(
          "img",
          {
            src: `${imageBasePath}${article.thumbnail}`,
            alt: article.title,
            className: classNames.cardImage
          }
        ),
        /* @__PURE__ */ jsx3("p", { className: classNames.cardTitle, children: article.title }),
        /* @__PURE__ */ jsxs2("div", { className: classNames.cardDate, children: [
          /* @__PURE__ */ jsx3(ClockIcon, { className: classNames.cardDateIcon }),
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

// src/components/ArticlePreview.tsx
import { useState } from "react";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function ArticlePreview({
  imageBasePath = "/article_imgs/",
  dateLabel = "\u6700\u7D42\u66F4\u65B0\u65E5\u6642",
  classNames = {},
  articleClassNames = {},
  defaultValue = ""
}) {
  const [raw, setRaw] = useState(defaultValue);
  const { data, content } = parseFrontmatter(raw);
  const article = {
    id: 0,
    title: data.title ?? "",
    date: data.date ?? "",
    latestUpdate: data.latestUpdate ?? "",
    staff: data.staff ?? "",
    thumbnail: data.thumbnail ?? "",
    content
  };
  return /* @__PURE__ */ jsxs3("div", { className: classNames.wrapper, children: [
    /* @__PURE__ */ jsx4("div", { className: classNames.editorPane, children: /* @__PURE__ */ jsx4(
      "textarea",
      {
        className: classNames.textarea,
        value: raw,
        onChange: (e) => setRaw(e.target.value),
        spellCheck: false
      }
    ) }),
    /* @__PURE__ */ jsx4("div", { className: classNames.previewPane, children: /* @__PURE__ */ jsx4(
      ArticleDetail,
      {
        article,
        imageBasePath,
        dateLabel,
        classNames: articleClassNames
      }
    ) })
  ] });
}
export {
  ArticleDetail,
  ArticleList,
  ArticlePreview,
  ClockIcon,
  createArticles
};

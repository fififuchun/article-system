// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ArticleList } from "./ArticleList";
import type { Article } from "../types";

afterEach(cleanup);

const articles: Article[] = [
  {
    id: 0,
    filename: "2026-08-23-a.md",
    title: "記事タイトル",
    date: "2026-08-23",
    latestUpdate: "2026-08-24",
    staff: "田中 花子",
    thumbnail: "art_0.webp",
    content: "本文",
  },
];

function renderList(classNames?: Parameters<typeof ArticleList>[0]["classNames"]) {
  return render(
    <ArticleList
      articles={articles}
      getArticleUrl={(article) => `/blog/${article.id}`}
      renderLink={(url, children, key) => (
        <a key={key} href={url}>
          {children}
        </a>
      )}
      classNames={classNames}
    />
  );
}

describe("ArticleList — as- クラスの常時付与", () => {
  // spec §8 の DOM 構造
  it.each([
    "as-grid",
    "as-card",
    "as-card-image",
    "as-card-title",
    "as-card-date",
    "as-card-date-icon",
  ])("classNames 未指定でも %s が付く", (className) => {
    const { container } = renderList();

    expect(container.querySelector(`.${className}`)).not.toBeNull();
  });

  it("classNames を渡すと as- クラスに追記される", () => {
    const { container } = renderList({ grid: "my-grid", card: "my-card", cardTitle: "my-title" });

    expect(container.querySelector(".as-grid")?.className).toBe("as-grid my-grid");
    expect(container.querySelector(".as-card")?.className).toBe("as-card my-card");
    expect(container.querySelector(".as-card-title")?.className).toBe("as-card-title my-title");
  });

  it("classNames 未指定なら余分な空白が入らない", () => {
    const { container } = renderList();

    expect(container.querySelector(".as-grid")?.className).toBe("as-grid");
  });
});

describe("ArticleList — 描画内容", () => {
  it("renderLink が返すリンクで各カードを包む", () => {
    const { container } = renderList();

    expect(container.querySelector("a")?.getAttribute("href")).toBe("/blog/0");
  });

  it("カードに表示する日付は latestUpdate を使う", () => {
    const { container } = renderList();

    expect(container.querySelector(".as-card-date")?.textContent).toContain("2026年8月24日");
  });
});

describe("ArticleList — 日付の表示", () => {
  it("latestUpdate を 年月日 で表示する", () => {
    const { container } = renderList();

    expect(container.querySelector(".as-card-date")?.textContent).toBe("2026年8月24日");
  });
});

describe("ArticleList — 画像のパス", () => {
  const cardImageSrc = (container: HTMLElement) =>
    container.querySelector(".as-card-image")?.getAttribute("src");

  it("相対パスの thumbnail には imageBasePath を前置する", () => {
    const { container } = render(
      <ArticleList
        articles={articles}
        imageBasePath="/imgs/"
        getArticleUrl={(a) => `/blog/${a.id}`}
        renderLink={(url, children, key) => (
          <a key={key} href={url}>
            {children}
          </a>
        )}
      />
    );

    expect(cardImageSrc(container)).toBe("/imgs/art_0.webp");
  });

  it("絶対URLの thumbnail は素通しする", () => {
    const { container } = render(
      <ArticleList
        articles={[{ ...articles[0], thumbnail: "https://example.com/thumb.webp" }]}
        imageBasePath="/imgs/"
        getArticleUrl={(a) => `/blog/${a.id}`}
        renderLink={(url, children, key) => (
          <a key={key} href={url}>
            {children}
          </a>
        )}
      />
    );

    expect(cardImageSrc(container)).toBe("https://example.com/thumb.webp");
  });
});

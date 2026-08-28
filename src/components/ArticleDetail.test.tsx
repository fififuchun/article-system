// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ArticleDetail } from "./ArticleDetail";
import type { Article } from "../types";

afterEach(cleanup);

const article: Article = {
  id: 0,
  filename: "2026-08-23-a.md",
  title: "記事タイトル",
  date: "2026-08-23",
  latestUpdate: "2026-08-24",
  staff: "田中 花子",
  thumbnail: "art_0.webp",
  content: "## 見出し\n\n本文...",
};

describe("ArticleDetail", () => {
  it("記事タイトルと本文を描画する", () => {
    render(<ArticleDetail article={article} />);

    expect(screen.getByText("記事タイトル")).toBeDefined();
    expect(screen.getByText("見出し")).toBeDefined();
  });
});

describe("ArticleDetail — 見出しのタグ", () => {
  it.each([
    ["##", "H2"],
    ["###", "H3"],
    ["####", "H4"],
  ])("%s を %s で描画する", (marker, tag) => {
    render(<ArticleDetail article={{ ...article, content: `${marker} 見出しテキスト` }} />);

    expect(screen.getByText("見出しテキスト").tagName).toBe(tag);
  });

  it("見出しに classNames を渡せる", () => {
    render(
      <ArticleDetail
        article={{ ...article, content: "## 見出しテキスト" }}
        classNames={{ heading: "my-heading" }}
      />
    );

    expect(screen.getByText("見出しテキスト").className).toContain("my-heading");
  });

  it("小見出しに classNames を渡せる", () => {
    render(
      <ArticleDetail
        article={{ ...article, content: "### 見出しテキスト" }}
        classNames={{ subheading: "my-subheading" }}
      />
    );

    expect(screen.getByText("見出しテキスト").className).toContain("my-subheading");
  });

  // spec §7-1: 記事の見出しは h2 から始まるのを正常とする
  it("記事タイトルは h1 にしない", () => {
    const { container } = render(<ArticleDetail article={article} />);

    expect(container.querySelector("h1")).toBeNull();
  });
});

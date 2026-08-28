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

describe("ArticleDetail — 段落と画像の入れ子", () => {
  it("段落を p 1段で描画する", () => {
    render(<ArticleDetail article={{ ...article, content: "本文テキスト" }} />);

    expect(screen.getByText("本文テキスト").tagName).toBe("P");
  });

  it("段落の classNames は p 自身に付く", () => {
    render(
      <ArticleDetail
        article={{ ...article, content: "本文テキスト" }}
        classNames={{ paragraph: "my-paragraph" }}
      />
    );

    expect(screen.getByText("本文テキスト").className).toContain("my-paragraph");
  });

  it("画像だけの行を p でラップしない", () => {
    const { container } = render(
      <ArticleDetail article={{ ...article, content: "![](art_1.webp)" }} />
    );

    const bodyImage = Array.from(container.querySelectorAll("img")).find((image) =>
      image.getAttribute("src")?.includes("art_1")
    );

    expect(bodyImage).toBeDefined();
    expect(bodyImage?.closest("p")).toBeNull();
  });

  it("画像は classNames.image のラッパーに包まれる", () => {
    const { container } = render(
      <ArticleDetail
        article={{ ...article, content: "![](art_1.webp)" }}
        classNames={{ image: "my-image" }}
      />
    );

    const bodyImage = Array.from(container.querySelectorAll("img")).find((image) =>
      image.getAttribute("src")?.includes("art_1")
    );

    expect(bodyImage?.parentElement?.className).toContain("my-image");
  });

  // spec §7-2: SSR ではブラウザが p を自動で閉じ、ハイドレーションエラーになる。
  // React の入れ子警告は同じパターンにつき一度しか出ないため、
  // console.error を覗く検査は実行順に依存する。構造そのものを見る
  it("p の中に div を入れない", () => {
    const { container } = render(
      <ArticleDetail article={{ ...article, content: "![](art_1.webp)" }} />
    );

    expect(container.querySelector("p div")).toBeNull();
  });

  it("テキストの段落と画像の行が混在しても両方描画される", () => {
    const { container } = render(
      <ArticleDetail article={{ ...article, content: "本文テキスト\n\n![](art_1.webp)" }} />
    );

    expect(screen.getByText("本文テキスト").tagName).toBe("P");
    expect(
      Array.from(container.querySelectorAll("img")).some((image) =>
        image.getAttribute("src")?.includes("art_1")
      )
    ).toBe(true);
  });
});

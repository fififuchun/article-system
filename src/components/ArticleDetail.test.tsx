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

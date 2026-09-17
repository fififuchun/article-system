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

describe("ArticleDetail — as- クラスの常時付与", () => {
  const content = "## 見出し\n\n### 小見出し\n\n#### 小小見出し\n\n本文...\n\n![](art_1.webp)";

  // spec §7 の DOM 構造
  it.each([
    "as-article",
    "as-header",
    "as-date",
    "as-date-year",
    "as-date-day",
    "as-title",
    "as-latest-update",
    "as-date-icon",
    "as-thumbnail",
    "as-heading",
    "as-subheading",
    "as-subsubheading",
    "as-paragraph",
    "as-image",
    "as-footer",
  ])("classNames 未指定でも %s が付く", (className) => {
    const { container } = render(<ArticleDetail article={{ ...article, content }} />);

    expect(container.querySelector(`.${className}`)).not.toBeNull();
  });

  it("classNames を渡すと as- クラスに追記される", () => {
    const { container } = render(
      <ArticleDetail
        article={{ ...article, content }}
        classNames={{ wrapper: "my-article", heading: "my-heading", footer: "my-footer" }}
      />
    );

    expect(container.querySelector(".as-article")?.className).toBe("as-article my-article");
    expect(container.querySelector(".as-heading")?.className).toBe("as-heading my-heading");
    expect(container.querySelector(".as-footer")?.className).toBe("as-footer my-footer");
  });

  it("classNames 未指定なら余分な空白が入らない", () => {
    const { container } = render(<ArticleDetail article={{ ...article, content }} />);

    expect(container.querySelector(".as-article")?.className).toBe("as-article");
  });
});

describe("ArticleDetail — サムネイル", () => {
  it("thumbnail が空ならサムネイルを描画しない", () => {
    const { container } = render(
      <ArticleDetail article={{ ...article, thumbnail: "" }} />
    );

    expect(container.querySelector(".as-thumbnail")).toBeNull();
  });

  it("thumbnail があれば imageBasePath を前置して描画する", () => {
    const { container } = render(
      <ArticleDetail article={article} imageBasePath="/imgs/" />
    );

    const thumbnail = container.querySelector(".as-thumbnail");

    expect(thumbnail?.getAttribute("src")).toBe("/imgs/art_0.webp");
  });

  it("サムネイルの alt に記事タイトルを使う", () => {
    const { container } = render(<ArticleDetail article={article} />);

    expect(container.querySelector(".as-thumbnail")?.getAttribute("alt")).toBe("記事タイトル");
  });

  it("thumbnail が空でも本文中の画像は描画する", () => {
    const { container } = render(
      <ArticleDetail article={{ ...article, thumbnail: "", content: "![](art_1.webp)" }} />
    );

    expect(container.querySelector(".as-image img")).not.toBeNull();
  });

  it("thumbnail が空でも他の要素は描画する", () => {
    const { container } = render(
      <ArticleDetail article={{ ...article, thumbnail: "" }} />
    );

    expect(container.querySelector(".as-title")).not.toBeNull();
    expect(container.querySelector(".as-footer")).not.toBeNull();
  });
});

describe("ArticleDetail — 絶対URLの画像", () => {
  const bodyImageSrc = (container: HTMLElement) =>
    container.querySelector(".as-image img")?.getAttribute("src");

  it.each([
    "http://example.com/a.webp",
    "https://example.com/a.webp",
    "//example.com/a.webp",
  ])("本文の %s は imageBasePath を前置せず素通しする", (src) => {
    const { container } = render(
      <ArticleDetail
        article={{ ...article, content: `![](${src})` }}
        imageBasePath="/imgs/"
      />
    );

    expect(bodyImageSrc(container)).toBe(src);
  });

  it("本文の相対パスには imageBasePath を前置する", () => {
    const { container } = render(
      <ArticleDetail
        article={{ ...article, content: "![](art_1.webp)" }}
        imageBasePath="/imgs/"
      />
    );

    expect(bodyImageSrc(container)).toBe("/imgs/art_1.webp");
  });

  it("サムネイルが絶対URLなら素通しする", () => {
    const { container } = render(
      <ArticleDetail
        article={{ ...article, thumbnail: "https://example.com/thumb.webp" }}
        imageBasePath="/imgs/"
      />
    );

    expect(container.querySelector(".as-thumbnail")?.getAttribute("src")).toBe(
      "https://example.com/thumb.webp"
    );
  });

  it("パスの途中に http を含むだけの相対パスは素通ししない", () => {
    const { container } = render(
      <ArticleDetail
        article={{ ...article, content: "![](my-http-image.webp)" }}
        imageBasePath="/imgs/"
      />
    );

    expect(bodyImageSrc(container)).toBe("/imgs/my-http-image.webp");
  });
});

describe("ArticleDetail — 日付の表示", () => {
  it("date を年と 月/日 に分けて表示する", () => {
    const { container } = render(<ArticleDetail article={article} />);

    expect(container.querySelector(".as-date-year")?.textContent).toBe("2026");
    expect(container.querySelector(".as-date-day")?.textContent).toBe("8/23");
  });

  it("latestUpdate をラベル付きで表示する", () => {
    const { container } = render(<ArticleDetail article={article} />);

    expect(container.querySelector(".as-latest-update")?.textContent).toContain(
      "2026年8月24日"
    );
  });

  it("dateLabel を差し替えられる", () => {
    const { container } = render(<ArticleDetail article={article} dateLabel="更新" />);

    expect(container.querySelector(".as-latest-update")?.textContent).toContain("更新");
  });

  // spec §9: 形式違反はプレビューが壊れて見えることで気づく仕組みになっている
  it("不正な date は整形せず壊れた表示のままにする", () => {
    const { container } = render(
      <ArticleDetail article={{ ...article, date: "2026/08/23" }} />
    );

    expect(container.querySelector(".as-date-year")?.textContent).toBe("NaN");
    expect(container.querySelector(".as-date-day")?.textContent).toBe("/");
  });
});

describe("ArticleDetail — 文中の画像（GitHub 準拠）", () => {
  const bodyImage = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("img")).find((image) =>
      image.getAttribute("src")?.includes("art_1")
    );

  it("テキストと混在する画像は p の中に置く", () => {
    const { container } = render(
      <ArticleDetail article={{ ...article, content: "本文テキスト ![](art_1.webp)" }} />
    );

    expect(bodyImage(container)?.closest("p")).not.toBeNull();
  });

  it("テキストと混在する画像を as-image で包まない", () => {
    const { container } = render(
      <ArticleDetail article={{ ...article, content: "本文テキスト ![](art_1.webp)" }} />
    );

    expect(bodyImage(container)?.parentElement?.className).not.toContain("as-image");
  });

  it("混在した段落にも as-paragraph が付く", () => {
    const { container } = render(
      <ArticleDetail article={{ ...article, content: "本文テキスト ![](art_1.webp)" }} />
    );

    expect(bodyImage(container)?.closest("p")?.className).toContain("as-paragraph");
  });

  it("混在した段落でも p の中に div を入れない", () => {
    const { container } = render(
      <ArticleDetail article={{ ...article, content: "本文テキスト ![](art_1.webp)" }} />
    );

    expect(container.querySelector("p div")).toBeNull();
  });

  it("画像だけの行は従来どおり as-image のブロックにする", () => {
    const { container } = render(
      <ArticleDetail article={{ ...article, content: "![](art_1.webp)" }} />
    );

    expect(bodyImage(container)?.parentElement?.className).toContain("as-image");
    expect(bodyImage(container)?.closest("p")).toBeNull();
  });
});

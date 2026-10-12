import { describe, it, expect } from "vitest";
import { buildArticleHead } from "./buildArticleHead";
import type { Article } from "./types";

const article: Article = {
  slug: "2026-10-12",
  filename: "2026-10-12-夏の更新.md",
  title: "夏の更新",
  date: "2026-10-12",
  latestUpdate: "2026-10-13",
  staff: "田中 花子",
  thumbnail: "2026/10-12/0_1.png",
  content: "本文テキストです。",
};

const options = { siteUrl: "https://example.com", path: "/article/2026-10-12" };

/** content="..." の中身を取り出す */
const content = (head: string, key: string) =>
  head.match(new RegExp(`(?:property|name)="${key}" content="([^"]*)"`))?.[1];

describe("buildArticleHead — 基本のタグ", () => {
  it("title を出す", () => {
    expect(buildArticleHead(article, options)).toContain("<title>夏の更新</title>");
  });

  it("og:title に記事タイトルを入れる", () => {
    expect(content(buildArticleHead(article, options), "og:title")).toBe("夏の更新");
  });

  it("og:type を article にする", () => {
    expect(content(buildArticleHead(article, options), "og:type")).toBe("article");
  });

  it("og:url を絶対URLにする", () => {
    expect(content(buildArticleHead(article, options), "og:url")).toBe(
      "https://example.com/article/2026-10-12"
    );
  });

  it("日付を出す", () => {
    const head = buildArticleHead(article, options);

    expect(content(head, "article:published_time")).toBe("2026-10-12");
    expect(content(head, "article:modified_time")).toBe("2026-10-13");
  });

  it("siteName を渡すと og:site_name を出す", () => {
    const head = buildArticleHead(article, { ...options, siteName: "私のブログ" });

    expect(content(head, "og:site_name")).toBe("私のブログ");
  });

  it("siteName を渡さなければ og:site_name を出さない", () => {
    expect(buildArticleHead(article, options)).not.toContain("og:site_name");
  });
});

// og:image が絶対URLでないと、どのサービスも無視する（spec §18）
describe("buildArticleHead — og:image", () => {
  it("相対パスを絶対URLにする", () => {
    expect(content(buildArticleHead(article, options), "og:image")).toBe(
      "https://example.com/article_imgs/2026/10-12/0_1.png"
    );
  });

  it("imageBasePath を差し替えられる", () => {
    const head = buildArticleHead(article, { ...options, imageBasePath: "/imgs/" });

    expect(content(head, "og:image")).toBe(
      "https://example.com/imgs/2026/10-12/0_1.png"
    );
  });

  it("絶対URLのサムネイルはそのまま使う", () => {
    const head = buildArticleHead(
      { ...article, thumbnail: "https://cdn.example.net/a.png" },
      options
    );

    expect(content(head, "og:image")).toBe("https://cdn.example.net/a.png");
  });

  it("siteUrl の末尾のスラッシュで // を作らない", () => {
    const head = buildArticleHead(article, {
      ...options,
      siteUrl: "https://example.com/",
    });

    expect(content(head, "og:image")).toBe(
      "https://example.com/article_imgs/2026/10-12/0_1.png"
    );
    expect(content(head, "og:url")).toBe("https://example.com/article/2026-10-12");
  });

  it("サムネイルが無ければ og:image を出さない", () => {
    expect(buildArticleHead({ ...article, thumbnail: "" }, options)).not.toContain(
      "og:image"
    );
  });

  // 画像が無いまま大きいカードを指定すると各サービスで崩れる
  it("サムネイルが無ければ小さいカードにする", () => {
    const head = buildArticleHead({ ...article, thumbnail: "" }, options);

    expect(content(head, "twitter:card")).toBe("summary");
  });

  it("サムネイルがあれば大きいカードにする", () => {
    expect(content(buildArticleHead(article, options), "twitter:card")).toBe(
      "summary_large_image"
    );
  });
});

describe("buildArticleHead — 説明文", () => {
  it("description があればそれを使う", () => {
    const head = buildArticleHead({ ...article, description: "手で書いた説明" }, options);

    expect(content(head, "og:description")).toBe("手で書いた説明");
  });

  it("description が無ければ本文から作る", () => {
    expect(content(buildArticleHead(article, options), "og:description")).toBe(
      "本文テキストです。"
    );
  });

  it("description が空なら本文から作る", () => {
    const head = buildArticleHead({ ...article, description: "   " }, options);

    expect(content(head, "og:description")).toBe("本文テキストです。");
  });

  // 検索結果にも出る。og と同じものを入れる
  it("name=description にも同じものを入れる", () => {
    const head = buildArticleHead(article, options);

    expect(content(head, "description")).toBe(content(head, "og:description"));
  });
});

// これが無いと title に引用符が入るだけで HTML が壊れる（spec §18）
describe("buildArticleHead — escape", () => {
  it("引用符を escape する", () => {
    const head = buildArticleHead({ ...article, title: '夏の"更新"' }, options);

    expect(head).toContain('content="夏の&quot;更新&quot;"');
  });

  it("タイトルの引用符でタグを閉じさせない", () => {
    const head = buildArticleHead(
      { ...article, title: '" /><script>alert(1)</script>' },
      options
    );

    expect(head).not.toContain("<script>");
  });

  it("アンパサンドを escape する", () => {
    const head = buildArticleHead({ ...article, title: "A & B" }, options);

    expect(content(head, "og:title")).toBe("A &amp; B");
  });

  it("説明文も escape する", () => {
    const head = buildArticleHead({ ...article, description: 'a"b' }, options);

    expect(head).toContain('content="a&quot;b"');
  });

  it("title タグの中身も escape する", () => {
    const head = buildArticleHead({ ...article, title: "<b>夏</b>" }, options);

    expect(head).toContain("<title>&lt;b&gt;夏&lt;/b&gt;</title>");
  });
});

describe("buildArticleHead — URL に出せない文字", () => {
  it("日本語の slug を encode する", () => {
    const head = buildArticleHead(article, {
      ...options,
      path: "/article/2026-10-10-日本語の記事",
    });

    expect(content(head, "og:url")).toBe(
      "https://example.com/article/2026-10-10-%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%81%AE%E8%A8%98%E4%BA%8B"
    );
  });

  // 二重に encode すると %25E6 になり、別のパスを指す
  it("すでに encode されていれば触らない", () => {
    const head = buildArticleHead(article, {
      ...options,
      path: "/article/%E6%97%A5",
    });

    expect(content(head, "og:url")).toBe("https://example.com/article/%E6%97%A5");
  });

  it("日本語のサムネイルも encode する", () => {
    const head = buildArticleHead({ ...article, thumbnail: "2026/10-12/海.png" }, options);

    expect(content(head, "og:image")).toBe(
      "https://example.com/article_imgs/2026/10-12/%E6%B5%B7.png"
    );
  });

  it("スラッシュは encode しない", () => {
    expect(content(buildArticleHead(article, options), "og:image")).toContain(
      "/article_imgs/2026/10-12/"
    );
  });
});

// 黙って壊れたタグを出すより止める（spec §18）
describe("buildArticleHead — siteUrl の検査", () => {
  it.each(["", "example.com", "/", "ftp://example.com"])(
    "絶対URLでなければ例外を投げる（%s）",
    (siteUrl) => {
      expect(() => buildArticleHead(article, { ...options, siteUrl })).toThrow(/siteUrl/);
    }
  );

  it("http でも通す", () => {
    expect(() =>
      buildArticleHead(article, { ...options, siteUrl: "http://localhost:5173" })
    ).not.toThrow();
  });
});

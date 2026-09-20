import { describe, it, expect } from "vitest";
import { resolveGitHubConfig } from "./resolveConfig";

describe("resolveGitHubConfig", () => {
  it("repo をそのまま通す", () => {
    expect(resolveGitHubConfig({ repo: "me/blog" }).repo).toBe("me/blog");
  });

  // spec §15: 既定は §2 の構成に合わせる
  it("省略した項目に spec §15 の既定値を入れる", () => {
    const resolved = resolveGitHubConfig({ repo: "me/blog" });

    expect(resolved.branch).toBe("main");
    expect(resolved.mdDir).toBe("src/articles");
    expect(resolved.imageDir).toBe("public/article_imgs");
  });

  it("渡した項目は既定値より優先する", () => {
    const resolved = resolveGitHubConfig({
      repo: "me/blog",
      branch: "draft",
      mdDir: "content",
      imageDir: "static/img",
    });

    expect(resolved.branch).toBe("draft");
    expect(resolved.mdDir).toBe("content");
    expect(resolved.imageDir).toBe("static/img");
  });

  // パスを組み立てるときに // や 末尾スラッシュで崩れないようにする
  it.each([
    ["/src/articles", "src/articles"],
    ["src/articles/", "src/articles"],
    ["/src/articles/", "src/articles"],
  ])("mdDir の前後のスラッシュを落とす（%s）", (given, expected) => {
    expect(resolveGitHubConfig({ repo: "me/blog", mdDir: given }).mdDir).toBe(expected);
  });

  it("imageDir の前後のスラッシュも落とす", () => {
    const resolved = resolveGitHubConfig({
      repo: "me/blog",
      imageDir: "/public/article_imgs/",
    });

    expect(resolved.imageDir).toBe("public/article_imgs");
  });

  // 空文字は「省略」と同じ扱いにする。既定が消えると不明なパスに書き込む
  it("空文字を渡しても既定値に戻す", () => {
    const resolved = resolveGitHubConfig({
      repo: "me/blog",
      branch: "",
      mdDir: "",
      imageDir: "",
    });

    expect(resolved.branch).toBe("main");
    expect(resolved.mdDir).toBe("src/articles");
    expect(resolved.imageDir).toBe("public/article_imgs");
  });
});

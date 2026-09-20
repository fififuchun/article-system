import { describe, it, expect } from "vitest";
import { resolveGitHubConfig } from "./resolveConfig";

const here = { origin: "https://example.com", pathname: "/studio" };

describe("resolveGitHubConfig", () => {
  it("clientId と repo をそのまま通す", () => {
    const resolved = resolveGitHubConfig({ clientId: "Iv1.abc", repo: "me/blog" }, here);

    expect(resolved.clientId).toBe("Iv1.abc");
    expect(resolved.repo).toBe("me/blog");
  });

  // spec §15: 既定は §2 の構成に合わせる
  it("省略した項目に spec §15 の既定値を入れる", () => {
    const resolved = resolveGitHubConfig({ clientId: "Iv1.abc", repo: "me/blog" }, here);

    expect(resolved.branch).toBe("main");
    expect(resolved.mdDir).toBe("src/articles");
    expect(resolved.imageDir).toBe("public/article_imgs");
  });

  it("渡した項目は既定値より優先する", () => {
    const resolved = resolveGitHubConfig(
      {
        clientId: "Iv1.abc",
        repo: "me/blog",
        branch: "draft",
        mdDir: "content",
        imageDir: "static/img",
      },
      here
    );

    expect(resolved.branch).toBe("draft");
    expect(resolved.mdDir).toBe("content");
    expect(resolved.imageDir).toBe("static/img");
  });

  // spec §15: 既定は現在のページURL（origin + pathname）
  it("redirectUri の既定は現在のページURLになる", () => {
    const resolved = resolveGitHubConfig({ clientId: "Iv1.abc", repo: "me/blog" }, here);

    expect(resolved.redirectUri).toBe("https://example.com/studio");
  });

  it("redirectUri を渡せば上書きできる", () => {
    const resolved = resolveGitHubConfig(
      { clientId: "Iv1.abc", repo: "me/blog", redirectUri: "https://other.example/cb" },
      here
    );

    expect(resolved.redirectUri).toBe("https://other.example/cb");
  });

  // 既定のURLに ?code= が残っていると、交換済みの code を再送してしまう
  it("既定の redirectUri にクエリやハッシュを含めない", () => {
    const resolved = resolveGitHubConfig(
      { clientId: "Iv1.abc", repo: "me/blog" },
      { origin: "https://example.com", pathname: "/studio" }
    );

    expect(resolved.redirectUri).not.toContain("?");
    expect(resolved.redirectUri).not.toContain("#");
  });

  // パスを組み立てるときに // や 末尾スラッシュで崩れないようにする
  it.each([
    ["/src/articles", "src/articles"],
    ["src/articles/", "src/articles"],
    ["/src/articles/", "src/articles"],
  ])("mdDir の前後のスラッシュを落とす（%s）", (given, expected) => {
    const resolved = resolveGitHubConfig(
      { clientId: "Iv1.abc", repo: "me/blog", mdDir: given },
      here
    );

    expect(resolved.mdDir).toBe(expected);
  });

  it("imageDir の前後のスラッシュも落とす", () => {
    const resolved = resolveGitHubConfig(
      { clientId: "Iv1.abc", repo: "me/blog", imageDir: "/public/article_imgs/" },
      here
    );

    expect(resolved.imageDir).toBe("public/article_imgs");
  });

  // 空文字は「省略」と同じ扱いにする。既定が消えると不明なパスに書き込む
  it("空文字を渡しても既定値に戻す", () => {
    const resolved = resolveGitHubConfig(
      { clientId: "Iv1.abc", repo: "me/blog", branch: "", mdDir: "", imageDir: "" },
      here
    );

    expect(resolved.branch).toBe("main");
    expect(resolved.mdDir).toBe("src/articles");
    expect(resolved.imageDir).toBe("public/article_imgs");
  });
});

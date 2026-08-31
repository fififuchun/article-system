// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ArticleStudio } from "./ArticleStudio";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const textarea = () => screen.getByRole("textbox") as HTMLTextAreaElement;

describe("ArticleStudio — 骨組み", () => {
  it("props を省略しても描画できる", () => {
    const { container } = render(<ArticleStudio />);

    expect(container.querySelector(".as-studio")).not.toBeNull();
  });

  it("textarea に雛形を入れて起動する", () => {
    render(<ArticleStudio />);

    expect(textarea().value).toContain("title:");
    expect(textarea().value).toContain("## 見出し");
  });

  it("入力した内容が textarea に反映される", () => {
    render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: "書き換えた本文" } });

    expect(textarea().value).toBe("書き換えた本文");
  });

  it("空にしてもテンプレートを再挿入しない（spec §9）", () => {
    render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: "" } });

    expect(textarea().value).toBe("");
  });

  it.each(["as-studio", "as-studio-editor", "as-studio-textarea"])(
    "classNames 未指定でも %s が付く",
    (className) => {
      const { container } = render(<ArticleStudio />);

      expect(container.querySelector(`.${className}`)).not.toBeNull();
    }
  );

  it("classNames を渡すと as- クラスに追記される", () => {
    const { container } = render(
      <ArticleStudio classNames={{ wrapper: "my-studio", textarea: "my-textarea" }} />
    );

    expect(container.querySelector(".as-studio")?.className).toBe("as-studio my-studio");
    expect(container.querySelector(".as-studio-textarea")?.className).toBe(
      "as-studio-textarea my-textarea"
    );
  });
});

describe("ArticleStudio — 下書きの自動保存", () => {
  it("入力のたびに localStorage へ保存する", () => {
    render(<ArticleStudio storageKey="my-blog" />);

    fireEvent.change(textarea(), { target: { value: "書きかけの本文" } });

    expect(localStorage.getItem("as-studio-draft:my-blog")).toBe("書きかけの本文");
  });

  it("storageKey ごとに保存先が分かれる", () => {
    render(<ArticleStudio storageKey="another-site" />);

    fireEvent.change(textarea(), { target: { value: "別プロジェクトの本文" } });

    expect(localStorage.getItem("as-studio-draft:my-blog")).toBeNull();
    expect(localStorage.getItem("as-studio-draft:another-site")).toBe("別プロジェクトの本文");
  });

  it("storageKey 未指定なら既定のキーに保存する", () => {
    render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: "既定の本文" } });

    expect(localStorage.getItem("as-studio-draft:default")).toBe("既定の本文");
  });

  it("空にした状態も保存する（意図的に消したものを戻さない）", () => {
    render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: "" } });

    expect(localStorage.getItem("as-studio-draft:default")).toBe("");
  });

  it("localStorage が使えなくても落ちない", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => {
      render(<ArticleStudio />);
      fireEvent.change(textarea(), { target: { value: "本文" } });
    }).not.toThrow();

    setItem.mockRestore();
  });
});

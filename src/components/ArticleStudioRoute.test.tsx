// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { ArticleStudioRoute } from "./ArticleStudioRoute";

afterEach(cleanup);

const at = (hash: string) => window.history.replaceState({}, "", `/some/page${hash}`);

let shown: number;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  at("");
  shown = 0;

  // jsdom 26 は showModal / close を実装していない（spec §9 設置方法）
  HTMLDialogElement.prototype.showModal = function () {
    shown += 1;
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const mount = () => render(<ArticleStudioRoute articles={[]} />);

describe("ArticleStudioRoute — 一致しないとき", () => {
  it("何も描画しない", () => {
    const { container } = mount();

    expect(container.innerHTML).toBe("");
  });

  // 読者が普通に見ているだけでは出てこない
  it("別のハッシュでも描画しない", () => {
    at("#/blog");

    const { container } = mount();

    expect(container.innerHTML).toBe("");
  });

  it("showModal を呼ばない", () => {
    mount();

    expect(shown).toBe(0);
  });

  // 利用側のルーティングを邪魔しないため
  it("ハッシュを書き換えない", () => {
    at("#/blog");
    mount();

    expect(window.location.hash).toBe("#/blog");
  });
});

describe("ArticleStudioRoute — 一致したとき", () => {
  beforeEach(() => at("#/studio"));

  it("dialog を描画する", () => {
    const { container } = mount();

    expect(container.querySelector("dialog")).not.toBeNull();
  });

  // z-index ではなくトップレイヤーで最前面を取る（spec §9 設置方法）
  it("showModal で開く", () => {
    mount();

    expect(shown).toBe(1);
  });

  it("中に Studio を描画する", () => {
    const { container } = mount();

    expect(container.querySelector(".as-studio-textarea")).not.toBeNull();
  });

  it("閉じるボタンを置く", () => {
    const { container } = mount();

    expect(container.querySelector(".as-studio-dialog-close")).not.toBeNull();
  });

  it("as-studio-dialog が付く", () => {
    const { container } = mount();

    expect(container.querySelector(".as-studio-dialog")).not.toBeNull();
  });
});

describe("ArticleStudioRoute — ハッシュの変化", () => {
  it("一致するハッシュに変わると開く", () => {
    const { container } = mount();
    expect(container.innerHTML).toBe("");

    at("#/studio");
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(container.querySelector("dialog")).not.toBeNull();
    expect(shown).toBe(1);
  });

  it("離れると閉じる", () => {
    at("#/studio");
    const { container } = mount();

    at("#/blog");
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(container.innerHTML).toBe("");
  });

  // 開いているあいだに二重で showModal を呼ぶと例外になるブラウザがある
  it("開いたままなら showModal を呼び直さない", () => {
    at("#/studio");
    mount();

    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(shown).toBe(1);
  });
});

describe("ArticleStudioRoute — Studio への受け渡し", () => {
  beforeEach(() => at("#/studio"));

  it("github を渡すとトークンの関門が出る", () => {
    const { container } = render(
      <ArticleStudioRoute articles={[]} github={{ repo: "me/blog" }} />
    );

    expect(container.querySelector(".as-studio-login")).not.toBeNull();
    expect(container.querySelector(".as-studio-textarea")).toBeNull();
  });

  it("storageKey を渡せる", () => {
    localStorage.setItem("as-studio-draft:my-blog", "保存してあった下書き");

    const { container } = render(
      <ArticleStudioRoute articles={[]} storageKey="my-blog" />
    );

    expect(
      (container.querySelector(".as-studio-textarea") as HTMLTextAreaElement).value
    ).toBe("保存してあった下書き");
  });
});

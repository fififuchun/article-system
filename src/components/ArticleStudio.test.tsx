// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ArticleStudio } from "./ArticleStudio";
import type { Article } from "../types";

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

describe("ArticleStudio — 下書きの復帰", () => {
  it("保存された下書きがあればテンプレートではなくそれを出す", () => {
    localStorage.setItem("as-studio-draft:my-blog", "前回の続き");

    render(<ArticleStudio storageKey="my-blog" />);

    expect(textarea().value).toBe("前回の続き");
  });

  // spec §9: 意図的に消したものを勝手に戻すと操作を奪うことになる
  it("空文字で保存されていればテンプレートを再挿入しない", () => {
    localStorage.setItem("as-studio-draft:my-blog", "");

    render(<ArticleStudio storageKey="my-blog" />);

    expect(textarea().value).toBe("");
  });

  it("保存が無ければテンプレートを出す", () => {
    render(<ArticleStudio storageKey="my-blog" />);

    expect(textarea().value).toContain("## 見出し");
  });

  it("別の storageKey の下書きは読まない", () => {
    localStorage.setItem("as-studio-draft:another-site", "別プロジェクトの本文");

    render(<ArticleStudio storageKey="my-blog" />);

    expect(textarea().value).toContain("## 見出し");
  });

  it("localStorage が読めなくてもテンプレートで起動する", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    render(<ArticleStudio />);

    expect(textarea().value).toContain("## 見出し");
    getItem.mockRestore();
  });
});

const sampleMd = [
  "---",
  "title: 夏の更新",
  "date: 2026-08-23",
  "latestUpdate: 2026-08-24",
  "staff: 田中 花子",
  "thumbnail: art_0.webp",
  "---",
  "",
  "## 見出しテキスト",
  "",
  "本文テキスト",
].join("\n");

describe("ArticleStudio — 詳細プレビュー", () => {
  it("プレビュー領域に as-studio-preview が付く", () => {
    const { container } = render(<ArticleStudio />);

    expect(container.querySelector(".as-studio-preview")).not.toBeNull();
  });

  // spec §9: ArticleDetail をそのまま使うことで本番との一致を構造的に保証する
  it("ArticleDetail をそのまま描画する", () => {
    const { container } = render(<ArticleStudio />);

    expect(container.querySelector(".as-studio-preview .as-article")).not.toBeNull();
  });

  it("編集内容がプレビューに反映される", () => {
    const { container } = render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });

    expect(container.querySelector(".as-title")?.textContent).toBe("夏の更新");
    expect(container.querySelector(".as-heading")?.textContent).toBe("見出しテキスト");
  });

  it("入力を変えるとプレビューも変わる", () => {
    const { container } = render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.change(textarea(), {
      target: { value: sampleMd.replace("夏の更新", "冬の更新") },
    });

    expect(container.querySelector(".as-title")?.textContent).toBe("冬の更新");
  });

  it("imageBasePath をプレビューに渡す", () => {
    const { container } = render(<ArticleStudio imageBasePath="/imgs/" />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });

    expect(container.querySelector(".as-thumbnail")?.getAttribute("src")).toBe(
      "/imgs/art_0.webp"
    );
  });

  it("dateLabel をプレビューに渡す", () => {
    const { container } = render(<ArticleStudio dateLabel="更新" />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });

    expect(container.querySelector(".as-latest-update")?.textContent).toContain("更新");
  });

  it("articleClassNames をプレビューの記事に渡す", () => {
    const { container } = render(
      <ArticleStudio articleClassNames={{ title: "my-title" }} />
    );

    fireEvent.change(textarea(), { target: { value: sampleMd } });

    expect(container.querySelector(".as-title")?.className).toBe("as-title my-title");
  });

  it("classNames.previewPane が as- クラスに追記される", () => {
    const { container } = render(<ArticleStudio classNames={{ previewPane: "my-preview" }} />);

    expect(container.querySelector(".as-studio-preview")?.className).toBe(
      "as-studio-preview my-preview"
    );
  });
});

describe("ArticleStudio — プレビューのタブ", () => {
  const tab = (name: string) => screen.getByRole("tab", { name });

  it("詳細と一覧のタブがある", () => {
    render(<ArticleStudio />);

    expect(tab("詳細")).toBeDefined();
    expect(tab("一覧")).toBeDefined();
  });

  it("既定では詳細を選ぶ", () => {
    const { container } = render(<ArticleStudio />);

    expect(tab("詳細").getAttribute("aria-selected")).toBe("true");
    expect(tab("一覧").getAttribute("aria-selected")).toBe("false");
    expect(container.querySelector(".as-article")).not.toBeNull();
    expect(container.querySelector(".as-grid")).toBeNull();
  });

  it("一覧タブを押すと一覧に切り替わる", () => {
    const { container } = render(<ArticleStudio />);

    fireEvent.click(tab("一覧"));

    expect(container.querySelector(".as-grid")).not.toBeNull();
    expect(container.querySelector(".as-article")).toBeNull();
  });

  it("詳細タブに戻せる", () => {
    const { container } = render(<ArticleStudio />);

    fireEvent.click(tab("一覧"));
    fireEvent.click(tab("詳細"));

    expect(container.querySelector(".as-article")).not.toBeNull();
    expect(container.querySelector(".as-grid")).toBeNull();
  });

  it("選択状態が aria-selected に出る", () => {
    render(<ArticleStudio />);

    fireEvent.click(tab("一覧"));

    expect(tab("一覧").getAttribute("aria-selected")).toBe("true");
    expect(tab("詳細").getAttribute("aria-selected")).toBe("false");
  });

  it("タブを切り替えても編集内容は保たれる", () => {
    render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.click(tab("一覧"));
    fireEvent.click(tab("詳細"));

    expect(textarea().value).toBe(sampleMd);
  });

  it("classNames.tabs が as- クラスに追記される", () => {
    const { container } = render(<ArticleStudio classNames={{ tabs: "my-tabs" }} />);

    expect(container.querySelector(".as-studio-tabs")?.className).toBe(
      "as-studio-tabs my-tabs"
    );
  });

  it("一覧プレビューは遷移させない", () => {
    const { container } = render(<ArticleStudio />);

    fireEvent.click(tab("一覧"));

    expect(container.querySelector(".as-grid a")).toBeNull();
  });
});

function existing(date: string, title: string): Article {
  return {
    id: 0,
    filename: `${date}.md`,
    title,
    date,
    latestUpdate: date,
    staff: "担当",
    thumbnail: "art.webp",
    content: "本文",
  };
}

describe("ArticleStudio — 一覧プレビューの中身", () => {
  const openList = () => fireEvent.click(screen.getByRole("tab", { name: "一覧" }));
  const titles = (container: HTMLElement) =>
    Array.from(container.querySelectorAll(".as-card-title")).map((el) => el.textContent);

  it("既存記事に編集中の記事を混ぜる", () => {
    const { container } = render(
      <ArticleStudio articles={[existing("2026-01-01", "去年の記事")]} />
    );

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    openList();

    expect(titles(container)).toContain("去年の記事");
    expect(titles(container)).toContain("夏の更新");
  });

  // spec §9: 新規記事を含めて日付の新しい順
  it("日付の新しい順に並べる", () => {
    const { container } = render(
      <ArticleStudio
        articles={[existing("2026-01-01", "古い"), existing("2026-12-01", "新しい")]}
      />
    );

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    openList();

    expect(titles(container)).toEqual(["新しい", "夏の更新", "古い"]);
  });

  it("直近6件までに絞る", () => {
    const articles = Array.from({ length: 10 }, (_, index) =>
      existing(`2026-01-${String(index + 1).padStart(2, "0")}`, `記事${index + 1}`)
    );
    const { container } = render(<ArticleStudio articles={articles} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    openList();

    expect(titles(container)).toHaveLength(6);
  });

  it("6件に絞っても新しい順は保たれる", () => {
    const articles = Array.from({ length: 10 }, (_, index) =>
      existing(`2026-01-${String(index + 1).padStart(2, "0")}`, `記事${index + 1}`)
    );
    const { container } = render(<ArticleStudio articles={articles} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    openList();

    expect(titles(container)).toEqual([
      "夏の更新",
      "記事10",
      "記事9",
      "記事8",
      "記事7",
      "記事6",
    ]);
  });

  it("既存記事が無くても編集中の記事だけ出す", () => {
    const { container } = render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    openList();

    expect(titles(container)).toEqual(["夏の更新"]);
  });

  it("同じ日付の既存記事より後ろに入る", () => {
    const { container } = render(
      <ArticleStudio articles={[existing("2026-08-23", "同じ日の記事")]} />
    );

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    openList();

    expect(titles(container)).toEqual(["同じ日の記事", "夏の更新"]);
  });
});

describe("ArticleStudio — 下書きダウンロード", () => {
  beforeEach(() => {
    // jsdom に無い API。ダウンロードの中身は検証せず（フェーズ6の方針）、
    // クリックが例外にならないようにするだけ
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  const draftButton = () => screen.getByRole("button", { name: /下書き/ });

  it("下書きダウンロードのボタンがある", () => {
    render(<ArticleStudio />);

    expect(draftButton()).toBeDefined();
  });

  it("操作領域に as-studio-actions が付く", () => {
    const { container } = render(<ArticleStudio />);

    expect(container.querySelector(".as-studio-actions")).not.toBeNull();
  });

  it("classNames.actions が as- クラスに追記される", () => {
    const { container } = render(<ArticleStudio classNames={{ actions: "my-actions" }} />);

    expect(container.querySelector(".as-studio-actions")?.className).toBe(
      "as-studio-actions my-actions"
    );
  });

  // spec §9: 下書きは押した後もそのまま留まる
  it("押しても編集内容がそのまま残る", () => {
    render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.click(draftButton());

    expect(textarea().value).toBe(sampleMd);
  });

  // spec §9: 下書きは検証しない
  it("必須項目が欠けていても押せる", () => {
    render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: "---\ntitle:\n---\n\n本文" } });

    expect(() => fireEvent.click(draftButton())).not.toThrow();
    expect((draftButton() as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("ArticleStudio — 本番ダウンロード", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  const publishButton = () => screen.getByRole("button", { name: /本番/ });

  it("本番ダウンロードのボタンがある", () => {
    render(<ArticleStudio />);

    expect(publishButton()).toBeDefined();
  });

  it("下書きとは別のボタンになっている", () => {
    render(<ArticleStudio />);

    expect(publishButton()).not.toBe(screen.getByRole("button", { name: /下書き/ }));
  });

  // spec §9: エラーがゼロでないと出せない
  it("検証を通ればテンプレートに戻る", () => {
    render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.click(publishButton());

    expect(textarea().value).toContain("## 見出し");
    expect(textarea().value).not.toContain("夏の更新");
  });

  it("必須項目が欠けていればテンプレートに戻らない", () => {
    const broken = sampleMd.replace("staff: 田中 花子", "staff:");
    render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: broken } });
    fireEvent.click(publishButton());

    expect(textarea().value).toBe(broken);
  });

  it("日付の形式が違えばテンプレートに戻らない", () => {
    const broken = sampleMd.replace("date: 2026-08-23", "date: 2026/08/23");
    render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: broken } });
    fireEvent.click(publishButton());

    expect(textarea().value).toBe(broken);
  });

  // spec §6: 既存記事が物理的に上書きされ消えるのを防ぐ
  it("既存記事とファイル名が衝突すればテンプレートに戻らない", () => {
    const articles = [existing("2026-08-23", "夏の更新")];
    articles[0].filename = "2026-08-23-夏の更新.md";
    render(<ArticleStudio articles={articles} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.click(publishButton());

    expect(textarea().value).toBe(sampleMd);
  });
});

describe("ArticleStudio — 検証結果の表示", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  const publish = () => fireEvent.click(screen.getByRole("button", { name: /本番/ }));
  const broken = sampleMd.replace("staff: 田中 花子", "staff:");

  // spec §9: 起動直後から必須項目の欠落が出続けると本当の間違いを見落とす
  it("起動直後は検証結果を出さない", () => {
    const { container } = render(<ArticleStudio />);

    expect(container.querySelector(".as-studio-issues")).toBeNull();
  });

  it("執筆中は検証結果を出さない", () => {
    const { container } = render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: broken } });

    expect(container.querySelector(".as-studio-issues")).toBeNull();
  });

  it("本番ダウンロードを押すと問題を一覧で出す", () => {
    const { container } = render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: broken } });
    publish();

    expect(container.querySelector(".as-studio-issues")).not.toBeNull();
  });

  it("問題の内容を文言で出す", () => {
    const { container } = render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: broken } });
    publish();

    expect(container.querySelector(".as-studio-issues")?.textContent).toContain("staff");
  });

  it("問題の数だけ項目を出す", () => {
    const { container } = render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: "---\ntitle:\n---\n\n本文" } });
    publish();

    expect(container.querySelectorAll(".as-studio-issues li").length).toBeGreaterThan(1);
  });

  it("問題が解消して押し直すと消える", () => {
    const { container } = render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: broken } });
    publish();
    fireEvent.change(textarea(), { target: { value: sampleMd } });
    publish();

    expect(container.querySelector(".as-studio-issues")).toBeNull();
  });

  // spec §9: 下書きは検証しない
  it("下書きダウンロードでは検証結果を出さない", () => {
    const { container } = render(<ArticleStudio />);

    fireEvent.change(textarea(), { target: { value: broken } });
    fireEvent.click(screen.getByRole("button", { name: /下書き/ }));

    expect(container.querySelector(".as-studio-issues")).toBeNull();
  });

  it("classNames.issues が as- クラスに追記される", () => {
    const { container } = render(<ArticleStudio classNames={{ issues: "my-issues" }} />);

    fireEvent.change(textarea(), { target: { value: broken } });
    publish();

    expect(container.querySelector(".as-studio-issues")?.className).toBe(
      "as-studio-issues my-issues"
    );
  });
});

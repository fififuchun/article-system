// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { saveToken } from "../github/tokenStorage";
import { loadImages, saveImages } from "../studio/imageStorage";
import { verifyToken } from "../github/verifyToken";

import {
  commitArticle,
  ArticleExistsError,
  ImageExistsError,
} from "../github/commitArticle";
import { GitHubApiError } from "../github/api";

// IndexedDB は jsdom に無く、fake-indexeddb は jsdom の Blob を往復できない
// （往復すると空の {} になる）。保存層そのものは imageStorage.test.ts が
// node 環境で検証する。ここで見るのは受け渡し（spec §14）
vi.mock("../studio/imageStorage", () => ({
  loadImages: vi.fn(),
  saveImages: vi.fn(),
}));
vi.mock("../github/verifyToken", () => ({ verifyToken: vi.fn() }));
vi.mock("../github/commitArticle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../github/commitArticle")>()),
  commitArticle: vi.fn(),
}));
import { ArticleStudio } from "./ArticleStudio";
import type { Article } from "../types";

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.mocked(loadImages).mockReset();
  vi.mocked(loadImages).mockResolvedValue([]);
  vi.mocked(saveImages).mockReset();
  vi.mocked(saveImages).mockResolvedValue(true);
  // jsdom は img.src を設定しても読み込みイベントを発火しない。
  // 画像は「読み込めた」ものとして扱い、存在確認そのものは検証しない
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
  );
});

afterEach(() => vi.unstubAllGlobals());

const textarea = () => screen.getByRole("textbox") as HTMLTextAreaElement;

describe("ArticleStudio — 骨組み", () => {
  it("props を省略しても描画できる", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    expect(container.querySelector(".as-studio")).not.toBeNull();
  });

  it("textarea に雛形を入れて起動する", () => {
    render(<ArticleStudio articles={[]} />);

    expect(textarea().value).toContain("title:");
    expect(textarea().value).toContain("## 見出し");
  });

  it("入力した内容が textarea に反映される", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: "書き換えた本文" } });

    expect(textarea().value).toBe("書き換えた本文");
  });

  it("空にしてもテンプレートを再挿入しない（spec §9）", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: "" } });

    expect(textarea().value).toBe("");
  });

  it.each(["as-studio", "as-studio-editor", "as-studio-textarea"])(
    "classNames 未指定でも %s が付く",
    (className) => {
      const { container } = render(<ArticleStudio articles={[]} />);

      expect(container.querySelector(`.${className}`)).not.toBeNull();
    }
  );

  it("classNames を渡すと as- クラスに追記される", () => {
    const { container } = render(
      <ArticleStudio articles={[]} classNames={{ wrapper: "my-studio", textarea: "my-textarea" }} />
    );

    expect(container.querySelector(".as-studio")?.className).toBe("as-studio my-studio");
    expect(container.querySelector(".as-studio-textarea")?.className).toBe(
      "as-studio-textarea my-textarea"
    );
  });
});

describe("ArticleStudio — 下書きの自動保存", () => {
  it("入力のたびに localStorage へ保存する", () => {
    render(<ArticleStudio articles={[]} storageKey="my-blog" />);

    fireEvent.change(textarea(), { target: { value: "書きかけの本文" } });

    expect(localStorage.getItem("as-studio-draft:my-blog")).toBe("書きかけの本文");
  });

  it("storageKey ごとに保存先が分かれる", () => {
    render(<ArticleStudio articles={[]} storageKey="another-site" />);

    fireEvent.change(textarea(), { target: { value: "別プロジェクトの本文" } });

    expect(localStorage.getItem("as-studio-draft:my-blog")).toBeNull();
    expect(localStorage.getItem("as-studio-draft:another-site")).toBe("別プロジェクトの本文");
  });

  it("storageKey 未指定なら既定のキーに保存する", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: "既定の本文" } });

    expect(localStorage.getItem("as-studio-draft:default")).toBe("既定の本文");
  });

  it("空にした状態も保存する（意図的に消したものを戻さない）", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: "" } });

    expect(localStorage.getItem("as-studio-draft:default")).toBe("");
  });

  it("localStorage が使えなくても落ちない", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => {
      render(<ArticleStudio articles={[]} />);
      fireEvent.change(textarea(), { target: { value: "本文" } });
    }).not.toThrow();

    setItem.mockRestore();
  });
});

describe("ArticleStudio — 下書きの復帰", () => {
  it("保存された下書きがあればテンプレートではなくそれを出す", () => {
    localStorage.setItem("as-studio-draft:my-blog", "前回の続き");

    render(<ArticleStudio articles={[]} storageKey="my-blog" />);

    expect(textarea().value).toBe("前回の続き");
  });

  // spec §9: 意図的に消したものを勝手に戻すと操作を奪うことになる
  it("空文字で保存されていればテンプレートを再挿入しない", () => {
    localStorage.setItem("as-studio-draft:my-blog", "");

    render(<ArticleStudio articles={[]} storageKey="my-blog" />);

    expect(textarea().value).toBe("");
  });

  it("保存が無ければテンプレートを出す", () => {
    render(<ArticleStudio articles={[]} storageKey="my-blog" />);

    expect(textarea().value).toContain("## 見出し");
  });

  it("別の storageKey の下書きは読まない", () => {
    localStorage.setItem("as-studio-draft:another-site", "別プロジェクトの本文");

    render(<ArticleStudio articles={[]} storageKey="my-blog" />);

    expect(textarea().value).toContain("## 見出し");
  });

  it("localStorage が読めなくてもテンプレートで起動する", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    render(<ArticleStudio articles={[]} />);

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
    const { container } = render(<ArticleStudio articles={[]} />);

    expect(container.querySelector(".as-studio-preview")).not.toBeNull();
  });

  // spec §9: ArticleDetail をそのまま使うことで本番との一致を構造的に保証する
  it("ArticleDetail をそのまま描画する", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    expect(container.querySelector(".as-studio-preview .as-article")).not.toBeNull();
  });

  it("編集内容がプレビューに反映される", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });

    expect(container.querySelector(".as-title")?.textContent).toBe("夏の更新");
    expect(container.querySelector(".as-heading")?.textContent).toBe("見出しテキスト");
  });

  it("入力を変えるとプレビューも変わる", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.change(textarea(), {
      target: { value: sampleMd.replace("夏の更新", "冬の更新") },
    });

    expect(container.querySelector(".as-title")?.textContent).toBe("冬の更新");
  });

  it("imageBasePath をプレビューに渡す", () => {
    const { container } = render(<ArticleStudio articles={[]} imageBasePath="/imgs/" />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });

    expect(container.querySelector(".as-thumbnail")?.getAttribute("src")).toBe(
      "/imgs/art_0.webp"
    );
  });

  it("dateLabel をプレビューに渡す", () => {
    const { container } = render(<ArticleStudio articles={[]} dateLabel="更新" />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });

    expect(container.querySelector(".as-latest-update")?.textContent).toContain("更新");
  });

  it("articleClassNames をプレビューの記事に渡す", () => {
    const { container } = render(
      <ArticleStudio articles={[]} articleClassNames={{ title: "my-title" }} />
    );

    fireEvent.change(textarea(), { target: { value: sampleMd } });

    expect(container.querySelector(".as-title")?.className).toBe("as-title my-title");
  });

  it("classNames.previewPane が as- クラスに追記される", () => {
    const { container } = render(<ArticleStudio articles={[]} classNames={{ previewPane: "my-preview" }} />);

    expect(container.querySelector(".as-studio-preview")?.className).toBe(
      "as-studio-preview my-preview"
    );
  });
});

describe("ArticleStudio — プレビューのタブ", () => {
  const tab = (name: string) => screen.getByRole("tab", { name });

  it("詳細と一覧のタブがある", () => {
    render(<ArticleStudio articles={[]} />);

    expect(tab("詳細")).toBeDefined();
    expect(tab("一覧")).toBeDefined();
  });

  it("既定では詳細を選ぶ", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    expect(tab("詳細").getAttribute("aria-selected")).toBe("true");
    expect(tab("一覧").getAttribute("aria-selected")).toBe("false");
    expect(container.querySelector(".as-article")).not.toBeNull();
    expect(container.querySelector(".as-grid")).toBeNull();
  });

  it("一覧タブを押すと一覧に切り替わる", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.click(tab("一覧"));

    expect(container.querySelector(".as-grid")).not.toBeNull();
    expect(container.querySelector(".as-article")).toBeNull();
  });

  it("詳細タブに戻せる", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.click(tab("一覧"));
    fireEvent.click(tab("詳細"));

    expect(container.querySelector(".as-article")).not.toBeNull();
    expect(container.querySelector(".as-grid")).toBeNull();
  });

  it("選択状態が aria-selected に出る", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.click(tab("一覧"));

    expect(tab("一覧").getAttribute("aria-selected")).toBe("true");
    expect(tab("詳細").getAttribute("aria-selected")).toBe("false");
  });

  it("タブを切り替えても編集内容は保たれる", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.click(tab("一覧"));
    fireEvent.click(tab("詳細"));

    expect(textarea().value).toBe(sampleMd);
  });

  it("classNames.tabs が as- クラスに追記される", () => {
    const { container } = render(<ArticleStudio articles={[]} classNames={{ tabs: "my-tabs" }} />);

    expect(container.querySelector(".as-studio-tabs")?.className).toBe(
      "as-studio-tabs my-tabs"
    );
  });

  it("一覧プレビューは遷移させない", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.click(tab("一覧"));

    expect(container.querySelector(".as-grid a")).toBeNull();
  });
});

function existing(date: string, title: string): Article {
  return {
    slug: `${date}-${title}`,
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
    const { container } = render(<ArticleStudio articles={[]} />);

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
    render(<ArticleStudio articles={[]} />);

    expect(draftButton()).toBeDefined();
  });

  it("操作領域に as-studio-actions が付く", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    expect(container.querySelector(".as-studio-actions")).not.toBeNull();
  });

  it("classNames.actions が as- クラスに追記される", () => {
    const { container } = render(<ArticleStudio articles={[]} classNames={{ actions: "my-actions" }} />);

    expect(container.querySelector(".as-studio-actions")?.className).toBe(
      "as-studio-actions my-actions"
    );
  });

  // spec §9: 下書きは押した後もそのまま留まる
  it("押しても編集内容がそのまま残る", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.click(draftButton());

    expect(textarea().value).toBe(sampleMd);
  });

  // spec §9: 下書きは検証しない
  it("必須項目が欠けていても押せる", () => {
    render(<ArticleStudio articles={[]} />);

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

  // 画像の確認が非同期なので、状態が落ち着くまで待つ
  const publish = async () => {
    await act(async () => {
      fireEvent.click(publishButton());
    });
  };

  it("本番ダウンロードのボタンがある", () => {
    render(<ArticleStudio articles={[]} />);

    expect(publishButton()).toBeDefined();
  });

  it("下書きとは別のボタンになっている", () => {
    render(<ArticleStudio articles={[]} />);

    expect(publishButton()).not.toBe(screen.getByRole("button", { name: /下書き/ }));
  });

  // 消したいときは消せばよいので、出した後もそのまま残す
  it("検証を通っても編集内容はそのまま残る", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.click(publishButton());

    expect(textarea().value).toBe(sampleMd);
  });

  it("日付の形式が違えば出力を止める", async () => {
    const broken = sampleMd.replace("date: 2026-08-23", "date: 2026/08/23");
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: broken } });
    await publish();

    expect(container.querySelector(".as-studio-issues")?.textContent).toContain(
      "YYYY-MM-DD"
    );
  });

  // spec §6: 既存記事が物理的に上書きされ消えるのを防ぐ
  it("既存記事とファイル名が衝突すれば出力を止める", async () => {
    const articles = [existing("2026-08-23", "夏の更新")];
    articles[0].filename = "2026-08-23-夏の更新.md";
    const { container } = render(<ArticleStudio articles={articles} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    expect(container.querySelector(".as-studio-issues")?.textContent).toContain(
      "重複"
    );
  });
});

describe("ArticleStudio — 検証結果の表示", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  // 画像の確認が非同期なので、状態が落ち着くまで待つ
  const publish = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /本番/ }));
    });
  };
  const broken = sampleMd.replace("staff: 田中 花子", "staff:");

  // spec §9: 起動直後から必須項目の欠落が出続けると本当の間違いを見落とす
  it("起動直後は検証結果を出さない", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    expect(container.querySelector(".as-studio-issues")).toBeNull();
  });

  it("執筆中は検証結果を出さない", async () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: broken } });

    expect(container.querySelector(".as-studio-issues")).toBeNull();
  });

  it("本番ダウンロードを押すと問題を一覧で出す", async () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: broken } });
    await publish();

    expect(container.querySelector(".as-studio-issues")).not.toBeNull();
  });

  it("問題の内容を文言で出す", async () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: broken } });
    await publish();

    expect(container.querySelector(".as-studio-issues")?.textContent).toContain("staff");
  });

  it("問題の数だけ項目を出す", async () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: "---\ntitle:\n---\n\n本文" } });
    await publish();

    expect(container.querySelectorAll(".as-studio-issues li").length).toBeGreaterThan(1);
  });

  it("問題が解消して押し直すと消える", async () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: broken } });
    await publish();
    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    expect(container.querySelector(".as-studio-issues")).toBeNull();
  });

  // spec §9: 下書きは検証しない
  it("下書きダウンロードでは検証結果を出さない", async () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: broken } });
    fireEvent.click(screen.getByRole("button", { name: /下書き/ }));

    expect(container.querySelector(".as-studio-issues")).toBeNull();
  });

  it("classNames.issues が as- クラスに追記される", async () => {
    const { container } = render(<ArticleStudio articles={[]} classNames={{ issues: "my-issues" }} />);

    fireEvent.change(textarea(), { target: { value: broken } });
    await publish();

    expect(container.querySelector(".as-studio-issues")?.className).toBe(
      "as-studio-issues my-issues"
    );
  });
});

describe("ArticleStudio — 新しく書く", () => {
  const newButton = () => screen.getByRole("button", { name: /新しく書く/ });

  it("ボタンがある", () => {
    render(<ArticleStudio articles={[]} />);

    expect(newButton()).toBeDefined();
  });

  it("確認を挟む", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ArticleStudio articles={[]} />);

    fireEvent.click(newButton());

    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("承諾したらテンプレートに戻る", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.click(newButton());

    expect(textarea().value).toContain("## 見出し");
    expect(textarea().value).not.toContain("夏の更新");
    confirmSpy.mockRestore();
  });

  // 自動では決して消さない（spec §9）
  it("断ったら編集内容がそのまま残る", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.click(newButton());

    expect(textarea().value).toBe(sampleMd);
    confirmSpy.mockRestore();
  });

  it("戻したテンプレートの日付は今日になる", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.click(newButton());

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    expect(textarea().value).toContain(`date: ${today}`);
    confirmSpy.mockRestore();
  });
});

describe("ArticleStudio — 編集中の記事を一覧から落とさない", () => {
  const openList = () => fireEvent.click(screen.getByRole("tab", { name: "一覧" }));
  const titles = (container: HTMLElement) =>
    Array.from(container.querySelectorAll(".as-card-title")).map((el) => el.textContent);

  const tenArticles = () =>
    Array.from({ length: 10 }, (_, index) =>
      existing(`2026-01-${String(index + 1).padStart(2, "0")}`, `記事${index + 1}`)
    );

  // spec §3 の「id がずれる」を確認したい場面でこそ見えなくなっては困る
  it("すべての既存記事より古くても一覧に出る", () => {
    const { container } = render(<ArticleStudio articles={tenArticles()} />);

    fireEvent.change(textarea(), {
      target: { value: sampleMd.replace("date: 2026-08-23", "date: 2025-01-01") },
    });
    openList();

    expect(titles(container)).toContain("夏の更新");
  });

  it("古い日付でも6件を超えない", () => {
    const { container } = render(<ArticleStudio articles={tenArticles()} />);

    fireEvent.change(textarea(), {
      target: { value: sampleMd.replace("date: 2026-08-23", "date: 2025-01-01") },
    });
    openList();

    expect(titles(container)).toHaveLength(6);
  });

  it("古い日付なら日付順どおり末尾に置く", () => {
    const { container } = render(<ArticleStudio articles={tenArticles()} />);

    fireEvent.change(textarea(), {
      target: { value: sampleMd.replace("date: 2026-08-23", "date: 2025-01-01") },
    });
    openList();

    expect(titles(container)?.at(-1)).toBe("夏の更新");
  });

  it("既存記事が5件以下ならすべて出る", () => {
    const articles = [existing("2026-01-01", "A"), existing("2026-02-01", "B")];
    const { container } = render(<ArticleStudio articles={articles} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    openList();

    expect(titles(container)).toEqual(["夏の更新", "B", "A"]);
  });
});

// spec §9: 出したあとどの URL で公開されるかを、書いている最中に見せる
describe("ArticleStudio — URL の予告", () => {
  const openList = () => fireEvent.click(screen.getByRole("tab", { name: "一覧" }));
  const badge = (container: HTMLElement) =>
    container.querySelector(".as-studio-slug-preview")?.textContent;

  beforeEach(() => localStorage.clear());

  it("編集中の記事のカードに slug を出す", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    openList();

    expect(badge(container)).toContain("2026-08-23-夏の更新");
  });

  it("フロントマターの slug を出す", () => {
    const withSlug = sampleMd.replace("title: 夏の更新", "title: 夏の更新\nslug: summer-update");
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: withSlug } });
    openList();

    expect(badge(container)).toContain("summer-update");
  });

  // id の番号ではなく URL になることが伝わる文言にする
  it("URL だと分かる文言にする", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    openList();

    expect(badge(container)).toContain("URL");
  });

  it("既存記事のカードには出さない", () => {
    const articles = [existing("2026-01-01", "A")];
    const { container } = render(<ArticleStudio articles={articles} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    openList();

    expect(container.querySelectorAll(".as-studio-slug-preview")).toHaveLength(1);
  });

  it("既存記事と slug が重なっても編集中の記事にだけ出す", () => {
    const clashing = existing("2026-01-01", "A");
    clashing.slug = "2026-08-23-夏の更新"; // 編集中の記事と同じになる
    const { container } = render(<ArticleStudio articles={[clashing]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    openList();

    expect(container.querySelectorAll(".as-studio-slug-preview")).toHaveLength(1);
  });

  it("詳細タブには出さない", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });

    expect(container.querySelector(".as-studio-slug-preview")).toBeNull();
  });
});

// spec §15: GitHub 連携は `github` を渡したときだけ有効になる。
// 渡さない利用側の挙動は一切変えない。フェーズ9でここが落ちたら
// v1 の利用者を壊している
describe("ArticleStudio — github を渡さないとき（spec §15）", () => {
  let downloads: string[];
  let fetchSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
    sessionStorage.clear();

    // ダウンロードが実際に走ったかを download 属性で捕まえる
    downloads = [];
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });

    // GitHub を叩かないことを確かめるため。呼ばれたら落ちる
    fetchSpy = vi.fn(() => {
      throw new Error("github を渡していないのに fetch が呼ばれた");
    });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => clickSpy.mockRestore());

  const publish = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /本番/ }));
    });
  };

  it("操作帯のボタンは3つで、文言が変わらない", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    const labels = Array.from(
      container.querySelectorAll(".as-studio-actions button")
    ).map((button) => button.textContent);

    expect(labels).toEqual(["本番ダウンロード", "下書きダウンロード", "新しく書く"]);
  });

  it("ログインを促さず、編集画面をそのまま出す", () => {
    render(<ArticleStudio articles={[]} />);

    expect(textarea()).toBeDefined();
    expect(screen.queryByRole("button", { name: /ログイン/ })).toBeNull();
  });

  it("本番ボタンで md をダウンロードし、通信しない", async () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    expect(downloads).toEqual(["2026-08-23-夏の更新.md"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("下書きボタンで md をダウンロードし、通信しない", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    fireEvent.click(screen.getByRole("button", { name: /下書き/ }));

    expect(downloads).toEqual(["_2026-08-23-夏の更新.md"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sessionStorage に何も書かない", async () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    expect(sessionStorage.length).toBe(0);
  });
});

// spec §15: github を渡したら、トークンを入れるまで編集画面を出さない
describe("ArticleStudio — github を渡したとき（spec §15）", () => {
  const github = { repo: "me/blog" };

  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(verifyToken).mockReset();
    vi.mocked(verifyToken).mockResolvedValue(undefined);
  });

  const signedIn = () => saveToken(undefined, { accessToken: "github_pat_secret" });
  const tokenInput = () => screen.getByLabelText(/トークン/) as HTMLInputElement;
  const paste = async (value: string) => {
    fireEvent.change(tokenInput(), { target: { value } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /保存|使う|続ける/ }));
    });
  };

  it("トークンが無ければ編集画面を出さない", () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    expect(container.querySelector(".as-studio-textarea")).toBeNull();
  });

  it("トークンの入力欄を出す", () => {
    render(<ArticleStudio articles={[]} github={github} />);

    expect(tokenInput()).toBeDefined();
  });

  // 肩越しに見られても読めないようにする（spec §15）
  it("入力欄を伏せ字にする", () => {
    render(<ArticleStudio articles={[]} github={github} />);

    expect(tokenInput().type).toBe("password");
  });

  it("関門に as-studio-login が付く", () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    expect(container.querySelector(".as-studio-login")).not.toBeNull();
  });

  it("classNames.login が as- クラスに追記される", () => {
    const { container } = render(
      <ArticleStudio articles={[]} github={github} classNames={{ login: "my-login" }} />
    );

    expect(container.querySelector(".as-studio-login")?.className).toBe(
      "as-studio-login my-login"
    );
  });

  it("貼って保存すると対象リポジトリで検証する", async () => {
    render(<ArticleStudio articles={[]} github={github} />);

    await paste("github_pat_secret");

    expect(vi.mocked(verifyToken)).toHaveBeenCalledWith("github_pat_secret", "me/blog");
  });

  it("検証を通ると編集画面に変わる", async () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    await paste("github_pat_secret");

    expect(container.querySelector(".as-studio-textarea")).not.toBeNull();
    expect(container.querySelector(".as-studio-login")).toBeNull();
  });

  it("検証に失敗したら理由を出し、編集画面を出さない", async () => {
    vi.mocked(verifyToken).mockRejectedValue(new Error("トークンが無効です。"));
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    await paste("github_pat_bad");

    expect(container.querySelector(".as-studio-login")?.textContent).toContain(
      "トークンが無効です。"
    );
    expect(container.querySelector(".as-studio-textarea")).toBeNull();
  });

  it("保存済みのトークンがあれば最初から編集画面を出す", () => {
    signedIn();

    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    expect(container.querySelector(".as-studio-textarea")).not.toBeNull();
    expect(container.querySelector(".as-studio-login")).toBeNull();
  });

  it("トークンがあれば下書きの復帰も今までどおり動く", () => {
    signedIn();
    localStorage.setItem("as-studio-draft:default", "保存してあった下書き");

    render(<ArticleStudio articles={[]} github={github} />);

    expect(textarea().value).toBe("保存してあった下書き");
  });

  // トークンは戻り値以外に出さない（spec §15）
  it("保存したトークンを画面に出さない", async () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    await paste("github_pat_secret");

    expect(container.innerHTML).not.toContain("github_pat_secret");
  });
});

// spec §15: トークンがあるとき、本番はダウンロードではなく投稿（プッシュまで）になる
describe("ArticleStudio — 投稿（spec §15）", () => {
  const github = { repo: "me/blog" };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    saveToken(undefined, { accessToken: "github_pat_secret" });
    vi.mocked(verifyToken).mockResolvedValue(undefined);
    vi.mocked(commitArticle).mockReset();
    // 確認は別の describe で検証する。ここでは通す
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(commitArticle).mockResolvedValue("commit-new");
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  const publishButton = () => screen.getByRole("button", { name: /投稿/ });
  const publish = async () => {
    await act(async () => {
      fireEvent.click(publishButton());
    });
  };

  // 「コミット」ではプッシュまで済むことが伝わらない（spec §15）
  it("ボタンの文言が投稿に変わる", () => {
    render(<ArticleStudio articles={[]} github={github} />);

    expect(publishButton().textContent).toBe("投稿");
  });

  // 下書きはコミットしない（spec §15）
  it("下書きボタンはダウンロードのまま", () => {
    render(<ArticleStudio articles={[]} github={github} />);

    expect(screen.getByRole("button", { name: /下書き/ }).textContent).toBe(
      "下書きダウンロード"
    );
  });

  it("押すとコミットする", async () => {
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    expect(vi.mocked(commitArticle)).toHaveBeenCalledOnce();
  });

  it("ファイル名と本文とメッセージを渡す", async () => {
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    const payload = vi.mocked(commitArticle).mock.calls[0][0];
    expect(payload.filename).toBe("2026-08-23-夏の更新.md");
    expect(payload.markdown).toBe(sampleMd);
    expect(payload.message).toBe("記事を追加: 夏の更新");
  });

  it("トークンと解決済みの設定を渡す", async () => {
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    const payload = vi.mocked(commitArticle).mock.calls[0][0];
    expect(payload.token).toBe("github_pat_secret");
    expect(payload.config).toEqual({
      repo: "me/blog",
      branch: "main",
      mdDir: "src/articles",
      imageDir: "public/article_imgs",
    });
  });

  // 検証を通らないものはコミットしない（spec §9）
  it("検証で止まればコミットしない", async () => {
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(textarea(), { target: { value: "---\ntitle:\n---\n\n本文" } });
    await publish();

    expect(vi.mocked(commitArticle)).not.toHaveBeenCalled();
  });

  // 投稿が済んだら次の記事に移る（詳細は「投稿した後」の describe）
  it("投稿すると雛形に戻る", async () => {
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    expect(textarea().value).not.toBe(sampleMd);
  });

  it("コミットのときは md をダウンロードしない", async () => {
    const clicked: string[] = [];
    const spy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this.download);
      });

    render(<ArticleStudio articles={[]} github={github} />);
    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    expect(clicked).toEqual([]);
    spy.mockRestore();
  });
});

// spec §15: articles はビルド時のスナップショットなので、同じセッションで
// 先にコミットした記事は載っていない。最新ツリー由来の衝突を必ず見せる
describe("ArticleStudio — 衝突は最新ツリーで見る（spec §15）", () => {
  const github = { repo: "me/blog" };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    saveToken(undefined, { accessToken: "github_pat_secret" });
    vi.mocked(verifyToken).mockResolvedValue(undefined);
    vi.mocked(commitArticle).mockReset();
    // 確認は別の describe で検証する。ここでは通す
    vi.spyOn(window, "confirm").mockReturnValue(true);
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  const issues = (container: HTMLElement) =>
    container.querySelector(".as-studio-issues")?.textContent ?? "";

  const publish = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /投稿/ }));
    });
  };

  it("articles に無くてもツリーにあれば理由を出す", async () => {
    vi.mocked(commitArticle).mockRejectedValue(
      new ArticleExistsError("src/articles/2026-08-23-夏の更新.md")
    );
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    expect(issues(container)).toContain("2026-08-23-夏の更新.md");
    expect(issues(container)).toContain("既にあります");
  });

  it("画像の衝突も理由を出す", async () => {
    vi.mocked(commitArticle).mockRejectedValue(new ImageExistsError(["IMG_1234.jpg"]));
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    expect(issues(container)).toContain("IMG_1234.jpg");
  });

  it("衝突しても編集内容は残る", async () => {
    vi.mocked(commitArticle).mockRejectedValue(
      new ArticleExistsError("src/articles/2026-08-23-夏の更新.md")
    );
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    expect(textarea().value).toBe(sampleMd);
  });

  // articles でも先に捕まえる。こちらは通信する前に止められる（spec §6）
  it("articles で捕まえられるならコミットまで行かない", async () => {
    const existing2 = existing("2026-08-23", "夏の更新");
    existing2.filename = "2026-08-23-夏の更新.md";
    const { container } = render(
      <ArticleStudio articles={[existing2]} github={github} />
    );

    fireEvent.change(textarea(), { target: { value: sampleMd } });
    await publish();

    expect(vi.mocked(commitArticle)).not.toHaveBeenCalled();
    expect(issues(container)).not.toBe("");
  });
});

// spec §15: 黙ってダウンロードに落とさない。書いたものは必ず持ち帰れるようにする
describe("ArticleStudio — コミットに失敗したとき（spec §15）", () => {
  const github = { repo: "me/blog" };
  let downloads: string[];
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    saveToken(undefined, { accessToken: "github_pat_secret" });
    vi.mocked(verifyToken).mockResolvedValue(undefined);
    vi.mocked(commitArticle).mockReset();
    // 確認は別の describe で検証する。ここでは通す
    vi.spyOn(window, "confirm").mockReturnValue(true);
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();

    downloads = [];
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
  });

  afterEach(() => clickSpy.mockRestore());

  const publish = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /投稿/ }));
    });
  };

  const write = () => fireEvent.change(textarea(), { target: { value: sampleMd } });
  const fallbackButton = () => screen.queryByRole("button", { name: "代わりにダウンロード" });

  it("通信できなければ理由を出す", async () => {
    vi.mocked(commitArticle).mockRejectedValue(
      new GitHubApiError("GitHub に接続できませんでした。通信状態を確かめてください。", "network", 0)
    );
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    write();
    await publish();

    expect(container.querySelector(".as-studio-issues")?.textContent).toContain(
      "接続できませんでした"
    );
  });

  it("失敗したら「代わりにダウンロード」を出す", async () => {
    vi.mocked(commitArticle).mockRejectedValue(
      new GitHubApiError("壊れました", "other", 500)
    );
    render(<ArticleStudio articles={[]} github={github} />);

    write();
    await publish();

    expect(fallbackButton()).not.toBeNull();
  });

  it("そのボタンで md をダウンロードできる", async () => {
    vi.mocked(commitArticle).mockRejectedValue(
      new GitHubApiError("壊れました", "other", 500)
    );
    render(<ArticleStudio articles={[]} github={github} />);

    write();
    await publish();
    fireEvent.click(fallbackButton()!);

    expect(downloads).toEqual(["2026-08-23-夏の更新.md"]);
  });

  // 黙って落とさない（spec §15）。コミットされたと勘違いされる
  it("失敗しても自動ではダウンロードしない", async () => {
    vi.mocked(commitArticle).mockRejectedValue(
      new GitHubApiError("壊れました", "other", 500)
    );
    render(<ArticleStudio articles={[]} github={github} />);

    write();
    await publish();

    expect(downloads).toEqual([]);
  });

  it("成功したときは出さない", async () => {
    vi.mocked(commitArticle).mockResolvedValue("commit-new");
    render(<ArticleStudio articles={[]} github={github} />);

    write();
    await publish();

    expect(fallbackButton()).toBeNull();
  });

  it("やり直して通ればボタンが消える", async () => {
    vi.mocked(commitArticle).mockRejectedValue(
      new GitHubApiError("壊れました", "other", 500)
    );
    render(<ArticleStudio articles={[]} github={github} />);

    write();
    await publish();
    vi.mocked(commitArticle).mockResolvedValue("commit-new");
    await publish();

    expect(fallbackButton()).toBeNull();
  });
});

describe("ArticleStudio — トークンが失効したとき（spec §15）", () => {
  const github = { repo: "me/blog" };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    saveToken(undefined, { accessToken: "github_pat_secret" });
    vi.mocked(verifyToken).mockResolvedValue(undefined);
    vi.mocked(commitArticle).mockReset();
    // 確認は別の describe で検証する。ここでは通す
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(commitArticle).mockRejectedValue(
      new GitHubApiError("Bad credentials", "unauthorized", 401)
    );
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  const publish = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /投稿/ }));
    });
  };

  const write = () => fireEvent.change(textarea(), { target: { value: sampleMd } });
  const resetButton = () => screen.queryByRole("button", { name: "トークンを入れ直す" });

  // GitHub の英語をそのまま出しても伝わらない
  it("日本語で理由を伝える", async () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    write();
    await publish();

    expect(container.querySelector(".as-studio-issues")?.textContent).toContain("トークン");
  });

  it("「トークンを入れ直す」を出す", async () => {
    render(<ArticleStudio articles={[]} github={github} />);

    write();
    await publish();

    expect(resetButton()).not.toBeNull();
  });

  // 先に破棄すると、書いたものをダウンロードする機会が消える（spec §15）
  it("押されるまでは編集画面のまま", async () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    write();
    await publish();

    expect(container.querySelector(".as-studio-textarea")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "代わりにダウンロード" })).not.toBeNull();
  });

  it("押すと入力画面に戻る", async () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    write();
    await publish();
    await act(async () => {
      fireEvent.click(resetButton()!);
    });

    expect(container.querySelector(".as-studio-login")).not.toBeNull();
    expect(container.querySelector(".as-studio-textarea")).toBeNull();
  });

  it("401 以外では出さない", async () => {
    vi.mocked(commitArticle).mockRejectedValue(
      new GitHubApiError("壊れました", "other", 500)
    );
    render(<ArticleStudio articles={[]} github={github} />);

    write();
    await publish();

    expect(resetButton()).toBeNull();
  });
});

// spec §15: 画像は同じコミットに入るので、置いてもらう必要がない
describe("ArticleStudio — コミット後の画像の扱い（spec §15）", () => {
  const github = { repo: "me/blog" };

  // 画像を入れると名前の入力欄が増えるので、textbox ロールでは一意に取れない
  const md = () => document.querySelector(".as-studio-textarea") as HTMLTextAreaElement;

  const drop = () => {
    const file = new File(["x"], "art_0.webp", { type: "image/webp" });
    fireEvent.drop(document.querySelector(".as-studio-editor")!, {
      dataTransfer: { files: [file] },
    });
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    saveToken(undefined, { accessToken: "github_pat_secret" });
    vi.mocked(verifyToken).mockResolvedValue(undefined);
    vi.mocked(commitArticle).mockReset();
    // 確認は別の describe で検証する。ここでは通す
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(commitArticle).mockResolvedValue("commit-new");
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  const publish = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /投稿|本番/ }));
    });
  };

  it("ドロップした画像を日付のフォルダ付きでコミットに渡す", async () => {
    render(<ArticleStudio articles={[]} github={github} />);

    // 先に date を確定させてからドロップする（spec §9 画像）
    fireEvent.change(md(), { target: { value: sampleMd } });
    drop();
    await publish();

    const payload = vi.mocked(commitArticle).mock.calls[0][0];
    expect(payload.images?.map((image) => image.name)).toEqual([
      "2026/08-23/art_0.webp",
    ]);
  });

  it("配置をお願いする案内を出さない", async () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    drop();
    fireEvent.change(md(), { target: { value: sampleMd } });
    await publish();

    expect(container.querySelector(".as-studio-images-note")).toBeNull();
    expect(container.querySelector(".as-studio-image-pending")).toBeNull();
  });

  // github を渡さない場合は今までどおり案内する（spec §9）
  it("github を渡さなければ今までどおり案内する", async () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    drop();
    fireEvent.change(md(), { target: { value: sampleMd } });
    await publish();

    expect(container.querySelector(".as-studio-images-note")).not.toBeNull();
  });
});

// spec §6: ドロップした画像はサーバーに無くて当然。存在確認の対象にしない
describe("ArticleStudio — 画像の存在確認（回帰）", () => {
  const md = () => document.querySelector(".as-studio-textarea") as HTMLTextAreaElement;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  const drop = (name: string) => {
    const file = new File(["x"], name, { type: "image/webp" });
    fireEvent.drop(document.querySelector(".as-studio-editor")!, {
      dataTransfer: { files: [file] },
    });
  };

  it("ドロップした画像は存在を確かめない", async () => {
    const probed: string[] = [];
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(value: string) {
          probed.push(value);
          queueMicrotask(() => this.onload?.());
        }
      }
    );

    const { container } = render(<ArticleStudio articles={[]} />);

    // サムネイルはフォルダ込みの名前で指す（spec §9 画像）
    fireEvent.change(md(), {
      target: {
        value: sampleMd.replace(
          "thumbnail: art_0.webp",
          "thumbnail: 2026/08-23/art_0.webp"
        ),
      },
    });
    drop("art_0.webp");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /本番/ }));
    });

    expect(probed.some((src) => src.includes("art_0.webp"))).toBe(false);
    expect(container.querySelector(".as-studio-issues")).toBeNull();
  });
});

// トークンの作り方が分からないと何もできない。関門画面で案内する
describe("ArticleStudio — トークンの作り方の案内", () => {
  const github = { repo: "me/blog" };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  const steps = (container: HTMLElement) =>
    Array.from(container.querySelectorAll(".as-studio-login-steps li")).map(
      (item) => item.textContent ?? ""
    );

  it("発行ページへのリンクを置く", () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    const link = container.querySelector(
      'a[href="https://github.com/settings/personal-access-tokens/new"]'
    );

    expect(link).not.toBeNull();
  });

  // 書きかけを残したまま遷移されると、戻ってくる保証がない
  it("リンクは別のタブで開く", () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    const link = container.querySelector(".as-studio-login-steps a") as HTMLAnchorElement;

    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });

  it("番号付きの手順にする", () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    expect(container.querySelector("ol.as-studio-login-steps")).not.toBeNull();
    expect(steps(container).length).toBeGreaterThanOrEqual(4);
  });

  // どのリポジトリを選ぶのか分からないと間違える
  it("手順の中に対象リポジトリ名を出す", () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    expect(steps(container).join("")).toContain("me/blog");
  });

  it("必要な権限を手順に書く", () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    const text = steps(container).join("");
    expect(text).toContain("Contents");
    expect(text).toContain("Read and write");
  });
});

// spec §3: 同じ日に2本目を書くとき連番が付く
describe("ArticleStudio — 雛形の slug", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const md = () => document.querySelector(".as-studio-textarea") as HTMLTextAreaElement;
  // toISOString() は UTC なのでローカル日付とずれる。buildTemplate と同じ出し方にする
  const today = (() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  })();

  it("雛形に slug が入る", () => {
    render(<ArticleStudio articles={[]} />);

    expect(md().value).toContain(`slug: ${today}`);
  });

  // URL に日本語が入らない既定にするため（spec §3）
  it("既定の slug に日本語を含まない", () => {
    render(<ArticleStudio articles={[]} />);

    const slug = md().value.match(/^slug: (.*)$/m)?.[1] ?? "";
    expect(slug).toMatch(/^[\x20-\x7e]+$/);
  });

  it("既存記事と同じ日なら連番を付ける", () => {
    const taken = existing(today, "先に書いた記事");
    taken.slug = today;

    render(<ArticleStudio articles={[taken]} />);

    expect(md().value).toContain(`slug: ${today}-2`);
  });
});

// spec §9 画像: 平らに置くと別の記事と名前が衝突してコミットが止まる
describe("ArticleStudio — 画像を日付のフォルダに入れる", () => {
  const md = () => document.querySelector(".as-studio-textarea") as HTMLTextAreaElement;

  const drop = (name: string) => {
    const file = new File(["x"], name, { type: "image/webp" });
    fireEvent.drop(document.querySelector(".as-studio-editor")!, {
      dataTransfer: { files: [file] },
    });
  };

  const dated = (date: string) => sampleMd.replace("date: 2026-08-23", `date: ${date}`);

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  it("本文に年と月日のフォルダ付きで入る", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: dated("2026-10-12") } });
    drop("0_1.png");

    expect(md().value).toContain("![](2026/10-12/0_1.png)");
  });

  it("画像の名前欄にもフォルダ付きで出る", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: dated("2026-10-12") } });
    drop("0_1.png");

    expect((screen.getByLabelText("画像の名前") as HTMLInputElement).value).toBe(
      "2026/10-12/0_1.png"
    );
  });

  // date が空のままドロップされることがある
  it("date が書かれていなければフォルダを付けない", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: "---\ntitle: a\n---\n\n本文" } });
    drop("0_1.png");

    expect(md().value).toContain("![](0_1.png)");
  });

  it("日付が変われば入るフォルダも変わる", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: dated("2025-01-05") } });
    drop("a.png");

    expect(md().value).toContain("![](2025/01-05/a.png)");
  });

  // フォルダごと書き換えられる（spec §9 画像）
  it("名前を書き換えると本文も追随する", () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: dated("2026-10-12") } });
    drop("0_1.png");
    fireEvent.change(screen.getByLabelText("画像の名前"), {
      target: { value: "2026/10-12/海.png" },
    });

    expect(md().value).toContain("![](2026/10-12/海.png)");
  });
});

// spec §15: 投稿は公開そのもので、この画面に取り消す手段が無い。
// 押し間違いを止める最後の砦なので、検証を通った後に必ず挟む
describe("ArticleStudio — 投稿の確認（spec §15）", () => {
  const github = { repo: "me/blog" };

  let confirmed: string[];

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    saveToken(undefined, { accessToken: "github_pat_secret" });
    vi.mocked(verifyToken).mockResolvedValue(undefined);
    vi.mocked(commitArticle).mockReset();
    vi.mocked(commitArticle).mockResolvedValue("commit-new");
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
    confirmed = [];
  });

  const answer = (reply: boolean) => {
    const spy = vi.spyOn(window, "confirm");
    // 他の describe が貼った spy が残っていると呼び出し回数が積み上がる
    spy.mockReset();
    spy.mockImplementation((message) => {
      confirmed.push(String(message));
      return reply;
    });
    return spy;
  };

  const md = () => document.querySelector(".as-studio-textarea") as HTMLTextAreaElement;

  const publish = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /投稿/ }));
    });
  };

  it("確認を出す", async () => {
    const spy = answer(true);
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: sampleMd } });
    await publish();

    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("断ると投稿しない", async () => {
    const spy = answer(false);
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: sampleMd } });
    await publish();

    expect(vi.mocked(commitArticle)).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("承諾すると投稿する", async () => {
    const spy = answer(true);
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: sampleMd } });
    await publish();

    expect(vi.mocked(commitArticle)).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  // 断ったのに消えていたら、確認の意味が無い
  it("断っても編集内容は残る", async () => {
    const spy = answer(false);
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: sampleMd } });
    await publish();

    expect(md().value).toBe(sampleMd);
    spy.mockRestore();
  });

  // 「よろしいですか」だけでは何が出ていくのか分からない
  it("何が出ていくのかを確認の文に並べる", async () => {
    const spy = answer(false);
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: sampleMd } });
    await publish();

    expect(confirmed[0]).toContain("夏の更新");
    expect(confirmed[0]).toContain("2026-08-23-夏の更新.md");
    expect(confirmed[0]).toContain("取り消せません");
    spy.mockRestore();
  });

  it("画像の件数を確認の文に出す", async () => {
    const spy = answer(false);
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: sampleMd } });
    fireEvent.drop(document.querySelector(".as-studio-editor")!, {
      dataTransfer: { files: [new File(["x"], "art_0.webp", { type: "image/webp" })] },
    });
    await publish();

    expect(confirmed[0]).toContain("1 件");
    spy.mockRestore();
  });

  // 直すところがあるのに確認を出されても判断できない（spec §9）
  it("検証で止まるときは確認を出さない", async () => {
    const spy = answer(true);
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: "---\ntitle:\n---\n\n本文" } });
    await publish();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  // ダウンロードは取り返しがつく。確認で止めない（spec §9）
  it("github を渡さなければ確認を出さない", async () => {
    const spy = answer(true);
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: sampleMd } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /本番/ }));
    });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// spec §9: 投稿が済んだ記事を残しておくと、次の記事を書くたびに
// 手で消すことになる。失敗したときだけは残す
describe("ArticleStudio — 投稿した後（spec §9 §15）", () => {
  const github = { repo: "me/blog" };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    saveToken(undefined, { accessToken: "github_pat_secret" });
    vi.mocked(verifyToken).mockResolvedValue(undefined);
    vi.mocked(commitArticle).mockReset();
    vi.mocked(commitArticle).mockResolvedValue("commit-new");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  const md = () => document.querySelector(".as-studio-textarea") as HTMLTextAreaElement;

  // toISOString() は UTC なのでローカル日付とずれる
  const today = (() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  })();

  const filled = (slug: string) =>
    [
      "---",
      "title: 今日の記事",
      `slug: ${slug}`,
      `date: ${today}`,
      `latestUpdate: ${today}`,
      "staff: 田中 花子",
      "thumbnail: art_0.webp",
      "---",
      "",
      "本文",
    ].join("\n");

  const publish = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /投稿/ }));
    });
  };

  it("雛形に戻る", async () => {
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: sampleMd } });
    await publish();

    expect(md().value).toContain("title:\n");
    expect(md().value).toContain(`date: ${today}`);
    expect(md().value).not.toContain("夏の更新");
  });

  // 投稿済みの画像を持ち越すと、次のコミットで同名衝突になる（spec §15）
  it("画像欄が空になる", async () => {
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: sampleMd } });
    fireEvent.drop(document.querySelector(".as-studio-editor")!, {
      dataTransfer: { files: [new File(["x"], "art_0.webp", { type: "image/webp" })] },
    });
    await publish();

    expect(container.querySelector(".as-studio-images")).toBeNull();
  });

  // articles はビルド時のスナップショットなので、投稿した記事は載っていない。
  // 数えないと同じ日の2本目が同じ URL になる（spec §3）
  it("同じ日の2本目には連番が付く", async () => {
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: filled(today) } });
    await publish();

    expect(md().value).toContain(`slug: ${today}-2`);
  });

  it("3本目には -3 が付く", async () => {
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: filled(today) } });
    await publish();
    fireEvent.change(md(), { target: { value: filled(`${today}-2`) } });
    await publish();

    expect(md().value).toContain(`slug: ${today}-3`);
  });

  // 失敗したのに消えていたら書いたものが戻らない（spec §15）
  it("投稿に失敗したら編集内容を残す", async () => {
    vi.mocked(commitArticle).mockRejectedValue(new Error("通信できませんでした。"));
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: sampleMd } });
    await publish();

    expect(md().value).toBe(sampleMd);
  });

  it("投稿に失敗したら画像も残す", async () => {
    vi.mocked(commitArticle).mockRejectedValue(new Error("通信できませんでした。"));
    const { container } = render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: sampleMd } });
    fireEvent.drop(document.querySelector(".as-studio-editor")!, {
      dataTransfer: { files: [new File(["x"], "art_0.webp", { type: "image/webp" })] },
    });
    await publish();

    expect(container.querySelector(".as-studio-images")).not.toBeNull();
  });

  // ダウンロードは「置いてください」の案内が要るので畳まない（spec §9）
  it("github を渡さなければ編集内容はそのまま残る", async () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: sampleMd } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /本番/ }));
    });

    expect(md().value).toBe(sampleMd);
  });
});

// spec §9: 仮登録した画像は md にファイル名で書かれ、プレビューだけ blob URL に
// 差し替える。md の文字列しか見ていなかったため、描画が壊れていても通っていた
describe("ArticleStudio — ドロップした画像のプレビュー（spec §9）", () => {
  const blob = "blob:http://localhost/uuid-1";

  beforeEach(() => {
    localStorage.clear();
    URL.createObjectURL = vi.fn(() => blob);
    URL.revokeObjectURL = vi.fn();
  });

  const md = () => document.querySelector(".as-studio-textarea") as HTMLTextAreaElement;

  const dated = (date: string, thumbnail = "") =>
    [
      "---",
      "title: 夏の更新",
      `date: ${date}`,
      `latestUpdate: ${date}`,
      "staff: 田中 花子",
      `thumbnail: ${thumbnail}`,
      "---",
      "",
      "本文",
    ].join("\n");

  const drop = (name: string) => {
    fireEvent.drop(document.querySelector(".as-studio-editor")!, {
      dataTransfer: { files: [new File(["x"], name, { type: "image/png" })] },
    });
  };

  it("本文に出る", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: dated("2026-10-12") } });
    drop("0_1.png");

    expect(
      container.querySelector(".as-studio-preview .as-image img")?.getAttribute("src")
    ).toBe(blob);
  });

  // imageBasePath を前置すると壊れたパスになる
  it("imageBasePath を前置しない", () => {
    const { container } = render(
      <ArticleStudio articles={[]} imageBasePath="/imgs/" />
    );

    fireEvent.change(md(), { target: { value: dated("2026-10-12") } });
    drop("0_1.png");

    expect(
      container.querySelector(".as-studio-preview .as-image img")?.getAttribute("src")
    ).toBe(blob);
  });

  it("サムネイルに指定しても出る", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: dated("2026-10-12") } });
    drop("0_1.png");
    // 画像欄に出ている名前をそのまま thumbnail に書く（spec §9 画像）
    fireEvent.change(md(), {
      target: { value: dated("2026-10-12", "2026/10-12/0_1.png") },
    });

    expect(container.querySelector(".as-thumbnail")?.getAttribute("src")).toBe(blob);
  });

  it("名前を書き換えても出続ける", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: dated("2026-10-12") } });
    drop("0_1.png");
    fireEvent.change(screen.getByLabelText("画像の名前"), {
      target: { value: "2026/10-12/umi.png" },
    });

    expect(
      container.querySelector(".as-studio-preview .as-image img")?.getAttribute("src")
    ).toBe(blob);
  });

  it("一覧プレビューのカードにも出る", () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: dated("2026-10-12") } });
    drop("0_1.png");
    fireEvent.change(md(), {
      target: { value: dated("2026-10-12", "2026/10-12/0_1.png") },
    });
    fireEvent.click(screen.getByRole("tab", { name: "一覧" }));

    expect(container.querySelector(".as-card-image")?.getAttribute("src")).toBe(blob);
  });
});

// spec §9: blob URL はリロードで切れる。実体を IndexedDB から戻す。
// 戻らないと見えないだけでなく、存在確認が 404 になって投稿も止まる
describe("ArticleStudio — 画像がリロードでも残る（spec §9）", () => {
  const blob = "blob:http://localhost/u1";

  beforeEach(() => {
    localStorage.clear();
    URL.createObjectURL = vi.fn(() => blob);
    URL.revokeObjectURL = vi.fn();
  });

  const md = () => document.querySelector(".as-studio-textarea") as HTMLTextAreaElement;

  const body = [
    "---",
    "title: 夏の更新",
    "date: 2026-10-12",
    "latestUpdate: 2026-10-12",
    "staff: 田中 花子",
    "thumbnail: 2026/10-12/0_1.png",
    "---",
    "",
    "![](2026/10-12/0_1.png)",
  ].join("\n");

  const drop = (name: string) => {
    fireEvent.drop(document.querySelector(".as-studio-editor")!, {
      dataTransfer: { files: [new File(["x"], name, { type: "image/png" })] },
    });
  };

  /** リロード相当。下書きは localStorage、画像は IndexedDB から戻る */
  const reload = async () => {
    localStorage.setItem("as-studio-draft:default", body);
    vi.mocked(loadImages).mockResolvedValue([
      { name: "2026/10-12/0_1.png", blob: new Blob(["x"], { type: "image/png" }) },
    ]);

    const rendered = render(<ArticleStudio articles={[]} />);
    // 復帰は非同期
    await act(async () => {});
    return rendered;
  };

  const savedNames = () => {
    const calls = vi.mocked(saveImages).mock.calls;
    return calls[calls.length - 1]?.[1].map((image) => image.name);
  };

  it("ドロップすると保存される", async () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: body } });
    drop("0_1.png");
    await act(async () => {});

    expect(savedNames()).toEqual(["2026/10-12/0_1.png"]);
  });

  // 名前だけ保存しても復帰できない。実体をそのまま渡す
  it("実体をそのまま渡す", async () => {
    const file = new File(["x"], "0_1.png", { type: "image/png" });
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: body } });
    fireEvent.drop(document.querySelector(".as-studio-editor")!, {
      dataTransfer: { files: [file] },
    });
    await act(async () => {});

    const calls = vi.mocked(saveImages).mock.calls;
    expect(calls[calls.length - 1][1][0].blob).toBe(file);
  });

  it("名前を書き換えると保存も追随する", async () => {
    render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: body } });
    drop("0_1.png");
    fireEvent.change(screen.getByLabelText("画像の名前"), {
      target: { value: "2026/10-12/umi.png" },
    });
    await act(async () => {});

    expect(savedNames()).toEqual(["2026/10-12/umi.png"]);
  });

  it("storageKey で保存先を分ける", async () => {
    render(<ArticleStudio articles={[]} storageKey="my-blog" />);

    fireEvent.change(md(), { target: { value: body } });
    drop("0_1.png");
    await act(async () => {});

    expect(vi.mocked(saveImages).mock.calls[0][0]).toBe("my-blog");
    expect(vi.mocked(loadImages)).toHaveBeenCalledWith("my-blog");
  });

  it("リロードすると画像欄に戻る", async () => {
    await reload();

    expect((screen.getByLabelText("画像の名前") as HTMLInputElement).value).toBe(
      "2026/10-12/0_1.png"
    );
  });

  it("戻した画像がプレビューに出る", async () => {
    const { container } = await reload();

    expect(
      container.querySelector(".as-studio-preview .as-image img")?.getAttribute("src")
    ).toBe(blob);
  });

  // 戻らないと「画像が見つかりません」で投稿が止まる
  it("戻した画像は存在確認の対象にならない", async () => {
    const probed: string[] = [];
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(value: string) {
          probed.push(value);
          // 実体はサーバーに無い
          queueMicrotask(() => this.onerror?.());
        }
      }
    );

    const { container } = await reload();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /本番/ }));
    });

    expect(probed.some((src) => src.includes("0_1.png"))).toBe(false);
    expect(container.querySelector(".as-studio-issues")).toBeNull();
  });

  // 空で上書きすると、戻る前に保存済みが消える
  it("開いただけでは保存しない", async () => {
    render(<ArticleStudio articles={[]} />);
    await act(async () => {});

    expect(vi.mocked(saveImages)).not.toHaveBeenCalled();
  });

  // 戻している間にドロップされた分を消さない
  it("復帰より先にドロップされていたら上書きしない", async () => {
    let resolveLoad: (images: { name: string; blob: Blob }[]) => void = () => {};
    vi.mocked(loadImages).mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      })
    );

    render(<ArticleStudio articles={[]} />);
    fireEvent.change(md(), { target: { value: body } });
    drop("new.png");
    await act(async () => {
      resolveLoad([{ name: "old.png", blob: new Blob(["x"]) }]);
    });

    expect(
      Array.from(document.querySelectorAll<HTMLInputElement>("[aria-label='画像の名前']")).map(
        (input) => input.value
      )
    ).toEqual(["2026/10-12/new.png"]);
  });
});

// spec §9: 持ち越すと次の記事に混ざる。保存した分も捨てないとリロードで戻ってくる
describe("ArticleStudio — 画像を捨てるとき（spec §9）", () => {
  const github = { repo: "me/blog" };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    saveToken(undefined, { accessToken: "github_pat_secret" });
    vi.mocked(verifyToken).mockResolvedValue(undefined);
    vi.mocked(commitArticle).mockReset();
    vi.mocked(commitArticle).mockResolvedValue("commit-new");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  const md = () => document.querySelector(".as-studio-textarea") as HTMLTextAreaElement;

  const sample = [
    "---",
    "title: 夏の更新",
    "date: 2026-08-23",
    "latestUpdate: 2026-08-24",
    "staff: 田中 花子",
    "thumbnail: 2026/08-23/art_0.webp",
    "---",
    "",
    "本文",
  ].join("\n");

  const drop = () => {
    fireEvent.drop(document.querySelector(".as-studio-editor")!, {
      dataTransfer: { files: [new File(["x"], "art_0.webp", { type: "image/webp" })] },
    });
  };

  /** 最後に保存された画像の名前 */
  const savedNames = () => {
    const calls = vi.mocked(saveImages).mock.calls;
    return calls[calls.length - 1]?.[1].map((image) => image.name);
  };

  it("投稿に成功すると保存した画像を捨てる", async () => {
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: sample } });
    drop();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /投稿/ }));
    });

    expect(savedNames()).toEqual([]);
  });

  // 失敗したら貼り直しが要らないよう残す（spec §15）
  it("投稿に失敗したら捨てない", async () => {
    vi.mocked(commitArticle).mockRejectedValue(new Error("通信できませんでした。"));
    render(<ArticleStudio articles={[]} github={github} />);

    fireEvent.change(md(), { target: { value: sample } });
    drop();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /投稿/ }));
    });

    expect(savedNames()).toEqual(["2026/08-23/art_0.webp"]);
  });

  it("「新しく書く」で捨てる", async () => {
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: sample } });
    drop();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "新しく書く" }));
    });

    expect(savedNames()).toEqual([]);
    expect(container.querySelector(".as-studio-images")).toBeNull();
  });

  it("「新しく書く」を断ったら捨てない", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { container } = render(<ArticleStudio articles={[]} />);

    fireEvent.change(md(), { target: { value: sample } });
    drop();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "新しく書く" }));
    });

    expect(savedNames()).toEqual(["2026/08-23/art_0.webp"]);
    expect(container.querySelector(".as-studio-images")).not.toBeNull();
  });
});

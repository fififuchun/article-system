import { describe, it, expect } from "vitest";
import { buildFilename } from "./buildFilename";

describe("buildFilename", () => {
  it("日付とタイトルを連結する", () => {
    expect(buildFilename("2026-08-23", "夏の更新")).toBe("2026-08-23-夏の更新.md");
  });

  it("下書きは _ を接頭に付ける", () => {
    expect(buildFilename("2026-08-23", "夏の更新", { draft: true })).toBe(
      "_2026-08-23-夏の更新.md"
    );
  });

  it("日本語はそのまま残す", () => {
    expect(buildFilename("2026-08-23", "【快挙】鉄道模型の甲子園")).toBe(
      "2026-08-23-【快挙】鉄道模型の甲子園.md"
    );
  });

  it.each(["/", "\\", ":", "*", "?", '"', "<", ">", "|"])(
    "ファイルシステムで使えない文字 %s を除去する",
    (char) => {
      expect(buildFilename("2026-08-23", `記事${char}その1`)).toBe(
        "2026-08-23-記事その1.md"
      );
    }
  );

  it("空白をハイフンに変える", () => {
    expect(buildFilename("2026-08-23", "夏の 更新")).toBe("2026-08-23-夏の-更新.md");
  });

  it("全角スペースもハイフンに変える", () => {
    expect(buildFilename("2026-08-23", "夏の　更新")).toBe("2026-08-23-夏の-更新.md");
  });

  it("連続した空白はハイフン1つにまとめる", () => {
    expect(buildFilename("2026-08-23", "夏の   更新")).toBe("2026-08-23-夏の-更新.md");
  });

  it("前後の空白を落とす", () => {
    expect(buildFilename("2026-08-23", "  夏の更新  ")).toBe("2026-08-23-夏の更新.md");
  });

  it("タイトル部分を50文字までに切り詰める", () => {
    const title = "あ".repeat(80);

    expect(buildFilename("2026-08-23", title)).toBe(`2026-08-23-${"あ".repeat(50)}.md`);
  });

  // 下書きダウンロードは検証しないため title が空でも出せてしまう
  it("タイトルが空なら日付だけにする", () => {
    expect(buildFilename("2026-08-23", "")).toBe("2026-08-23.md");
  });

  it("タイトルが空の下書きも日付だけにする", () => {
    expect(buildFilename("2026-08-23", "", { draft: true })).toBe("_2026-08-23.md");
  });

  it("除去した結果が空になるタイトルも日付だけにする", () => {
    expect(buildFilename("2026-08-23", "///")).toBe("2026-08-23.md");
  });

  it("末尾がハイフンで終わらない", () => {
    expect(buildFilename("2026-08-23", "夏の更新 ")).toBe("2026-08-23-夏の更新.md");
  });
});

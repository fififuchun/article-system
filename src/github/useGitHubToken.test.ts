// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGitHubToken } from "./useGitHubToken";
import { verifyToken } from "./verifyToken";
import { loadToken, saveToken } from "./tokenStorage";

vi.mock("./verifyToken", () => ({ verifyToken: vi.fn() }));

const mount = () => renderHook(() => useGitHubToken("me/blog", "blog"));

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(verifyToken).mockReset();
  vi.mocked(verifyToken).mockResolvedValue(undefined);
});

describe("useGitHubToken — 初期状態", () => {
  it("保存が無ければ missing", () => {
    const { result } = mount();

    expect(result.current.status).toBe("missing");
    expect(result.current.token).toBeNull();
  });

  it("保存があれば ready で読み出す", () => {
    saveToken("blog", { accessToken: "github_pat_secret" });

    const { result } = mount();

    expect(result.current.status).toBe("ready");
    expect(result.current.token).toBe("github_pat_secret");
  });

  // 貼った時点で確かめてある。失効はコミット時の 401 で気づく（spec §15）
  it("保存済みのトークンを読み込み時に検証し直さない", () => {
    saveToken("blog", { accessToken: "github_pat_secret" });

    mount();

    expect(vi.mocked(verifyToken)).not.toHaveBeenCalled();
  });
});

describe("useGitHubToken — submit", () => {
  it("対象リポジトリで検証する", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.submit("github_pat_secret");
    });

    expect(vi.mocked(verifyToken)).toHaveBeenCalledWith("github_pat_secret", "me/blog");
  });

  it("通ったら保存して ready になる", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.submit("github_pat_secret");
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.token).toBe("github_pat_secret");
    expect(loadToken("blog")?.accessToken).toBe("github_pat_secret");
  });

  // 貼り付けで前後に空白が入ることがある
  it("前後の空白を落とす", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.submit("  github_pat_secret\n");
    });

    expect(vi.mocked(verifyToken)).toHaveBeenCalledWith("github_pat_secret", "me/blog");
    expect(result.current.token).toBe("github_pat_secret");
  });

  it("検証のあいだは verifying", async () => {
    vi.mocked(verifyToken).mockReturnValue(new Promise(() => {}));
    const { result } = mount();

    act(() => {
      void result.current.submit("github_pat_secret");
    });

    await waitFor(() => expect(result.current.status).toBe("verifying"));
  });

  it("空文字は通信せずに断る", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.submit("   ");
    });

    expect(vi.mocked(verifyToken)).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
  });
});

describe("useGitHubToken — 検証に失敗したとき", () => {
  beforeEach(() => {
    vi.mocked(verifyToken).mockRejectedValue(new Error("トークンが無効です。"));
  });

  it("理由を持つ", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.submit("github_pat_bad");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("トークンが無効です。");
  });

  // 通らなかったトークンを残すと、次のリロードで通った気になる
  it("保存しない", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.submit("github_pat_bad");
    });

    expect(loadToken("blog")).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it("やり直して通れば error が消える", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.submit("github_pat_bad");
    });

    vi.mocked(verifyToken).mockResolvedValue(undefined);
    await act(async () => {
      await result.current.submit("github_pat_good");
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.error).toBeNull();
  });
});

describe("useGitHubToken — clear", () => {
  it("保存を消して missing に戻す", async () => {
    saveToken("blog", { accessToken: "github_pat_secret" });
    const { result } = mount();

    act(() => result.current.clear());

    expect(result.current.status).toBe("missing");
    expect(result.current.token).toBeNull();
    expect(loadToken("blog")).toBeNull();
  });
});

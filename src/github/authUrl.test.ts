import { describe, it, expect } from "vitest";
import { buildAuthorizeUrl, createState, GITHUB_AUTHORIZE_URL } from "./authUrl";

const params = {
  clientId: "Iv1.abc",
  redirectUri: "https://example.com/studio",
  state: "st4te",
  codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
};

const query = (overrides = {}) =>
  new URL(buildAuthorizeUrl({ ...params, ...overrides })).searchParams;

describe("buildAuthorizeUrl", () => {
  it("GitHub の認可エンドポイントに向ける", () => {
    const url = new URL(buildAuthorizeUrl(params));

    expect(`${url.origin}${url.pathname}`).toBe(GITHUB_AUTHORIZE_URL);
  });

  it.each([
    ["client_id", "Iv1.abc"],
    ["redirect_uri", "https://example.com/studio"],
    ["state", "st4te"],
    ["code_challenge", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"],
  ])("%s を渡した値のまま載せる", (key, expected) => {
    expect(query().get(key)).toBe(expected);
  });

  // S256 以外（plain）を許すと PKCE の意味が無くなる
  it("code_challenge_method は S256 固定", () => {
    expect(query().get("code_challenge_method")).toBe("S256");
  });

  // client secret はブラウザに置かない（spec §15）
  it("secret を載せない", () => {
    expect(buildAuthorizeUrl(params)).not.toContain("client_secret");
  });

  it("redirect_uri をエスケープする", () => {
    const url = buildAuthorizeUrl({
      ...params,
      redirectUri: "https://example.com/studio?a=1&b=2",
    });

    expect(url).not.toContain("studio?a=1&b=2");
    expect(new URL(url).searchParams.get("redirect_uri")).toBe(
      "https://example.com/studio?a=1&b=2"
    );
  });
});

describe("createState", () => {
  // 固定値だと、他サイトが仕込んだ code を掴まされる
  it("呼ぶたびに違う値になる", () => {
    const values = new Set(Array.from({ length: 20 }, () => createState()));

    expect(values.size).toBe(20);
  });

  it("URLで安全な文字だけを使う", () => {
    expect(createState()).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  // 総当たりで当てられない長さ
  it("十分な長さがある", () => {
    expect(createState().length).toBeGreaterThanOrEqual(22);
  });
});

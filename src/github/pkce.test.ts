import { describe, it, expect } from "vitest";
import { createCodeVerifier, createCodeChallenge } from "./pkce";

describe("createCodeVerifier", () => {
  // RFC 7636: 43〜128文字の unreserved 文字
  it("43文字以上128文字以下になる", () => {
    const verifier = createCodeVerifier();

    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it("URLで安全な文字だけを使う", () => {
    expect(createCodeVerifier()).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  // 使い回すと、盗まれた code をそのまま交換されうる
  it("呼ぶたびに違う値になる", () => {
    const values = new Set(Array.from({ length: 20 }, () => createCodeVerifier()));

    expect(values.size).toBe(20);
  });
});

describe("createCodeChallenge", () => {
  // RFC 7636 付録B の検証ベクタ
  it("RFC 7636 の例と一致する", async () => {
    const challenge = await createCodeChallenge(
      "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    );

    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  // base64 のままだと + / = がURLで壊れる
  it("base64url で返す（+ / = を含まない）", async () => {
    const challenge = await createCodeChallenge(createCodeVerifier());

    expect(challenge).not.toMatch(/[+/=]/);
  });

  it("同じ verifier からは同じ challenge になる", async () => {
    const verifier = createCodeVerifier();

    expect(await createCodeChallenge(verifier)).toBe(await createCodeChallenge(verifier));
  });
});

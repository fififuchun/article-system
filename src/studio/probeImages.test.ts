// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { findMissingImages } from "./probeImages";

/** 読み込みの成否を名前で決める Image のふりをするクラス */
function stubImage(missing: string[]) {
  return class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      queueMicrotask(() => {
        const fails = missing.some((name) => value.endsWith(name));
        if (fails) this.onerror?.();
        else this.onload?.();
      });
    }
  } as unknown as typeof Image;
}

afterEach(() => vi.unstubAllGlobals());

describe("findMissingImages", () => {
  it("読み込めなかった名前だけを返す", async () => {
    vi.stubGlobal("Image", stubImage(["missing.webp"]));

    const missing = await findMissingImages(["ok.webp", "missing.webp"], "/imgs/");

    expect(missing).toEqual(["missing.webp"]);
  });

  it("すべて読み込めれば空配列", async () => {
    vi.stubGlobal("Image", stubImage([]));

    expect(await findMissingImages(["a.webp", "b.webp"], "/imgs/")).toEqual([]);
  });

  it("名前が無ければ何も読み込まない", async () => {
    const Ctor = vi.fn();
    vi.stubGlobal("Image", Ctor);

    expect(await findMissingImages([], "/imgs/")).toEqual([]);
    expect(Ctor).not.toHaveBeenCalled();
  });

  it("imageBasePath を前置して読み込む", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(value: string) {
          seen.push(value);
          queueMicrotask(() => this.onload?.());
        }
      }
    );

    await findMissingImages(["a.webp"], "/imgs/");

    expect(seen).toEqual(["/imgs/a.webp"]);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { imagesKey, loadImages, saveImages } from "./imageStorage";

// テストごとにデータベースを作り直す
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
});

const png = (text: string) => new Blob([text], { type: "image/png" });

describe("imagesKey", () => {
  it("storageKey で分ける", () => {
    expect(imagesKey("my-blog")).toBe("as-studio-images:my-blog");
  });

  it("未指定なら default", () => {
    expect(imagesKey()).toBe("as-studio-images:default");
  });
});

describe("imageStorage", () => {
  it("保存した画像を読み戻せる", async () => {
    await saveImages(undefined, [{ name: "2026/10-12/0_1.png", blob: png("ほんたい") }]);

    const loaded = await loadImages();

    expect(loaded.map((image) => image.name)).toEqual(["2026/10-12/0_1.png"]);
    expect(await loaded[0].blob.text()).toBe("ほんたい");
  });

  it("MIME タイプも保つ", async () => {
    await saveImages(undefined, [{ name: "a.png", blob: png("x") }]);

    expect((await loadImages())[0].blob.type).toBe("image/png");
  });

  it("複数枚を順番どおりに保つ", async () => {
    await saveImages(undefined, [
      { name: "a.png", blob: png("1") },
      { name: "b.png", blob: png("2") },
    ]);

    expect((await loadImages()).map((image) => image.name)).toEqual(["a.png", "b.png"]);
  });

  it("保存していなければ空配列", async () => {
    expect(await loadImages()).toEqual([]);
  });

  it("保存するたびに置き換わる", async () => {
    await saveImages(undefined, [{ name: "a.png", blob: png("1") }]);
    await saveImages(undefined, [{ name: "b.png", blob: png("2") }]);

    expect((await loadImages()).map((image) => image.name)).toEqual(["b.png"]);
  });

  // 投稿したら捨てる（spec §9）
  it("空配列を保存すると消える", async () => {
    await saveImages(undefined, [{ name: "a.png", blob: png("1") }]);
    await saveImages(undefined, []);

    expect(await loadImages()).toEqual([]);
  });

  it("storageKey ごとに分かれる", async () => {
    await saveImages("blog-a", [{ name: "a.png", blob: png("1") }]);
    await saveImages("blog-b", [{ name: "b.png", blob: png("2") }]);

    expect((await loadImages("blog-a")).map((image) => image.name)).toEqual(["a.png"]);
    expect((await loadImages("blog-b")).map((image) => image.name)).toEqual(["b.png"]);
  });

  it("保存できたら true を返す", async () => {
    expect(await saveImages(undefined, [{ name: "a.png", blob: png("1") }])).toBe(true);
  });
});

// プライベートブラウジングや容量超過。保存できないだけで執筆は続けられる
describe("imageStorage — 使えない環境", () => {
  it("IndexedDB が無ければ false を返す", async () => {
    vi.stubGlobal("indexedDB", undefined);

    expect(await saveImages(undefined, [{ name: "a.png", blob: png("1") }])).toBe(false);
  });

  it("IndexedDB が無ければ空配列を返す", async () => {
    vi.stubGlobal("indexedDB", undefined);

    expect(await loadImages()).toEqual([]);
  });

  it("open が失敗しても落ちない", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new Error("拒否されました");
      },
    });

    expect(await saveImages(undefined, [{ name: "a.png", blob: png("1") }])).toBe(false);
    expect(await loadImages()).toEqual([]);
  });
});

// 版が違う・手で触られた値で落とさない
describe("imageStorage — 壊れた値", () => {
  it("配列でなければ空配列を返す", async () => {
    await saveImages(undefined, []);
    // 保存場所に別の形のものを入れる
    const db: IDBDatabase = await new Promise((resolve) => {
      const request = indexedDB.open("as-studio-images", 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const transaction = db.transaction("drafts", "readwrite");
      transaction.objectStore("drafts").put("ただの文字列", imagesKey());
      transaction.oncomplete = () => resolve();
    });
    db.close();

    expect(await loadImages()).toEqual([]);
  });

  it("形の違う要素だけを落とす", async () => {
    await saveImages(undefined, []);
    const db: IDBDatabase = await new Promise((resolve) => {
      const request = indexedDB.open("as-studio-images", 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const transaction = db.transaction("drafts", "readwrite");
      transaction
        .objectStore("drafts")
        .put(
          [{ name: "a.png", blob: png("1") }, { name: "b.png" }, { blob: png("2") }],
          imagesKey()
        );
      transaction.oncomplete = () => resolve();
    });
    db.close();

    expect((await loadImages()).map((image) => image.name)).toEqual(["a.png"]);
  });
});

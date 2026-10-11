const DB_NAME = "as-studio-images";
const STORE = "drafts";
const PREFIX = "as-studio-images";

/**
 * 保存した画像1件（spec §9）。
 *
 * `name` が md に書かれる名前です。`Blob` の側には名前を持たせません。
 * IndexedDB の構造化クローンは実装によって `File` を `Blob` に落とすため、
 * 名前を往復させると環境ごとに結果が変わります。
 */
export interface StoredImage {
  name: string;
  blob: Blob;
}

/** 画像の保存先キー。下書きと同じく `storageKey` で分ける（spec §9） */
export function imagesKey(storageKey = "default"): string {
  return `${PREFIX}:${storageKey}`;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // 別のタブが古い版を開いたままだと upgrade が始まらない
    request.onblocked = () => reject(new Error("IndexedDB がブロックされています。"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await open();

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      // 容量超過は request ではなく transaction の abort で来ることがある
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

/** 保存された値かを確かめる。版が違う・手で触られた値で落とさない */
function isStoredImage(value: unknown): value is StoredImage {
  if (typeof value !== "object" || value === null) return false;
  const image = value as Partial<StoredImage>;
  return typeof image.name === "string" && image.blob instanceof Blob;
}

/**
 * 画像を保存する。**保存できたかを返します。**
 *
 * 黙って失敗すると「リロードしても残る」と誤解したまま書き続けることに
 * なるため、呼び出し側に伝えます（spec §9）。
 */
export async function saveImages(
  storageKey: string | undefined,
  images: StoredImage[]
): Promise<boolean> {
  try {
    // Blob をそのまま入れる。base64 にすると容量が約1.37倍になり、
    // localStorage の上限（数MB）では写真1枚で溢れる
    await withStore("readwrite", (store) =>
      store.put(
        images.map(({ name, blob }) => ({ name, blob })),
        imagesKey(storageKey)
      )
    );
    return true;
  } catch {
    // プライベートブラウジング・容量超過・IndexedDB が無い環境。
    // 保存できないだけで執筆は続けられる
    return false;
  }
}

/** 保存した画像を読む。無ければ空配列 */
export async function loadImages(storageKey?: string): Promise<StoredImage[]> {
  try {
    const stored = await withStore<unknown>("readonly", (store) =>
      store.get(imagesKey(storageKey))
    );

    return Array.isArray(stored) ? stored.filter(isStoredImage) : [];
  } catch {
    return [];
  }
}

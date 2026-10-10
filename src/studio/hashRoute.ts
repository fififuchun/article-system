/**
 * ハッシュで Studio の入り口を判定する（spec §9 設置方法）。
 *
 * `#` より後ろは**サーバーに送られず、react-router の `<Route path>` も見ません**。
 * そのため利用側のルーティング設定に手を入れずに済みます。
 */

/**
 * 書き方の揺れを揃える。
 *
 * 利用側が `#/studio` / `/studio` / `studio` のどう書いても同じに扱います。
 */
export function normalizeHashPath(hashPath: string): string {
  const withoutHash = hashPath.replace(/^#/, "");
  const withSlash = withoutHash.startsWith("/") ? withoutHash : `/${withoutHash}`;

  return `#${withSlash}`;
}

/** 末尾のスラッシュを落とす。`#/studio` と `#/studio/` を同じ扱いにする */
function trimTrailingSlash(hash: string): string {
  return hash.length > 2 ? hash.replace(/\/+$/, "") : hash;
}

/**
 * いまのハッシュが入り口と一致するか。
 *
 * **前方一致では開きません。** `#/studios` のような別のページで
 * Studio が出てくると邪魔になります。
 */
export function matchesHash(hashPath: string): boolean {
  return (
    trimTrailingSlash(window.location.hash) === trimTrailingSlash(normalizeHashPath(hashPath))
  );
}

/**
 * ハッシュを消して元の画面に戻す。
 *
 * `replaceState` を使うのは履歴を増やさないためです。`pushState` だと
 * 戻るボタンで `#/studio` に戻ってしまい、閉じた意味がなくなります。
 * パスとクエリは触りません — 消すと利用側のルーティングが飛びます。
 */
export function clearHash(): void {
  const { pathname, search } = window.location;
  window.history.replaceState({}, "", `${pathname}${search}`);
}

/** ハッシュの変化を購読する。戻り値を呼ぶと解除する */
export function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);

  return () => window.removeEventListener("hashchange", onChange);
}

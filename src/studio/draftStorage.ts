const PREFIX = "as-studio-draft";

/**
 * 下書きの保存先キー（spec §9）。
 *
 * `vite dev` はどのプロジェクトでも既定で同じオリジンを使い、localStorage は
 * オリジン単位です。`storageKey` で分けないと複数プロジェクトの下書きが混ざります。
 */
export function draftKey(storageKey = "default"): string {
  return `${PREFIX}:${storageKey}`;
}

/** 下書きを保存する。localStorage が使えない環境でも落とさない */
export function saveDraft(storageKey: string | undefined, raw: string): void {
  try {
    localStorage.setItem(draftKey(storageKey), raw);
  } catch {
    // プライベートブラウジングや容量超過。保存できないだけで執筆は続けられる
  }
}

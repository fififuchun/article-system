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

/**
 * 下書きを読む。保存が無ければ `null`。
 *
 * **空文字と未保存を区別します。** spec §9 は「Ctrl+A で全消しして空になっても
 * テンプレートは自動で再挿入しない」と定めており、空文字を「下書きなし」と
 * 扱うと意図的に消したものが戻ってしまいます。
 */
export function loadDraft(storageKey?: string): string | null {
  try {
    return localStorage.getItem(draftKey(storageKey));
  } catch {
    return null;
  }
}

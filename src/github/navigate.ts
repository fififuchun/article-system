/**
 * 認可画面へ遷移する。
 *
 * 1行ですが関数に分けているのは、テストで実際に遷移させないためです
 * （jsdom はページ遷移を実装していません）。
 */
export function redirectTo(url: string): void {
  window.location.assign(url);
}

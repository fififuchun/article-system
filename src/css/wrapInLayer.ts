/**
 * 層ありの CSS を組み立てる（spec §10）。
 *
 * Tailwind v4 は自分の CSS をすべてカスケードレイヤーに入れます。層に
 * 入っていない CSS は層の中に必ず勝つため、ライブラリが層の外にいると
 * **利用側が classNames で渡したユーティリティにまで勝ってしまいます**。
 * それを避けるため、v4 向けには `components` の層に入った版を配ります。
 */

/** 入る層の名前。v4 が順番を宣言済みなので、利用側の設定が要らない */
export const LAYER_NAME = "components";

/**
 * 層の順番の宣言（spec §10 ★重要）。
 *
 * 層の順番は **最初に出てきた順** で決まります。これを書かないと、
 * ライブラリの CSS が Tailwind より先に読まれたときに `components` が
 * `base` より前に作られ、**リセットに負けます**（実測）。
 *
 * 先に宣言しておけば、どちらの読み込み順でも
 * `theme → base → components → utilities` になります。
 */
export const LAYER_ORDER = "@layer theme, base, components, utilities;";

const HEADER = `/*
 * @fififuchun/article-system デフォルトスタイル（Tailwind v4 向け）
 *
 * styles.css の中身を \`@layer ${LAYER_NAME}\` に入れただけのものです。
 * **Tailwind v4 を使う場合はこちらを読んでください。** リセット（@layer base）
 * には勝ち、利用側のユーティリティ（@layer utilities）には負ける位置に入ります。
 *
 * **Tailwind v3 では使えません。** v3 は \`@layer\` を自分の機能として
 * 扱うため、ビルドが止まります。v3 と Tailwind なしの場合は styles.css を
 * 読んでください。**両方を読み込まないでください**（層なしが勝ち、
 * こちらが無意味になります）。
 */`;

/** どちらの版が読まれているかの印（spec §10）。実行時の警告に使う */
export const MARKER_PLAIN = "--as-stylesheet: plain;";
export const MARKER_LAYER = "--as-stylesheet: layer;";

/** 層なしの CSS を受け取り、層ありの CSS を返す */
export function wrapInLayer(css: string): string {
  if (!css.includes(MARKER_PLAIN)) {
    // 印が無いまま配ると、取り違えを検出できないまま出荷してしまう
    throw new Error(
      `[article-system] styles.css に "${MARKER_PLAIN}" が見つかりません。` +
        `層あり版の印を差し替えられないため、ビルドを止めます。`
    );
  }

  const marked = css.replace(MARKER_PLAIN, MARKER_LAYER);

  return `${HEADER}\n${LAYER_ORDER}\n\n@layer ${LAYER_NAME} {\n${marked}}\n`;
}

/** 層ありの CSS から、包む前の中身を取り出す（テストと検証用） */
export function unwrapLayer(layered: string): string | null {
  const open = `@layer ${LAYER_NAME} {\n`;
  const start = layered.indexOf(open);
  if (start === -1) return null;
  if (!layered.endsWith("}\n")) return null;

  return layered.slice(start + open.length, layered.length - "}\n".length);
}

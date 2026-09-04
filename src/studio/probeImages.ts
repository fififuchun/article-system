import { resolveImageSrc } from "../resolveImageSrc";

/**
 * 画像を実際に読み込んでみて、見つからなかった名前を返す（spec §6）。
 *
 * SPA のフォールバック設定によっては存在しないパスでも `index.html` が 200 で
 * 返るため、ステータスコードではなく読み込みの成否で判定します。
 *
 * **ダウンロードボタンを押したときにだけ呼びます。** 執筆中に確かめると、
 * ファイル名を1文字打つたびに存在しないパスへの要求が飛びます（spec §9）。
 */
export async function findMissingImages(
  names: string[],
  imageBasePath: string
): Promise<string[]> {
  const results = await Promise.all(
    names.map(
      (name) =>
        new Promise<string | null>((resolve) => {
          const image = new Image();
          image.onload = () => resolve(null);
          image.onerror = () => resolve(name);
          image.src = resolveImageSrc(name, imageBasePath);
        })
    )
  );

  return results.filter((name): name is string => name !== null);
}

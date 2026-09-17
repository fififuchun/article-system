/**
 * アイコン共通の props（spec §11）。
 *
 * サイズは CSS で指定するため width / height は受け取りません。
 * 色は `fill="currentColor"` により CSS の `color` で変わります。
 */
export interface IconProps {
  className?: string;
}

/**
 * falsy を除いてクラス名を空白で連結する。
 * `as-` のデフォルトクラスと利用側の classNames を重ねるために使う（spec §10）。
 */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter((className): className is string => Boolean(className)).join(" ");
}

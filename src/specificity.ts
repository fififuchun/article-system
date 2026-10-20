/** CSS セレクタの詳細度（spec §10）。a=id, b=クラス相当, c=型セレクタ */
export interface Specificity {
  a: number;
  b: number;
  c: number;
}

/** `:where()` は0、`:is()` / `:not()` / `:has()` は引数の最大を取る */
const FUNCTIONAL = /:(where|is|not|has)\(/;

/** セレクタリストをトップレベルのカンマで割る */
export function splitSelectorList(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of list) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (char === "," && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);

  return out.map((part) => part.trim()).filter((part) => part.length > 0);
}

/**
 * セレクタ1つの詳細度を数える（spec §10）。
 *
 * 完全な CSS パーサではありません。**このライブラリが書く範囲**
 * （型・クラス・属性・疑似クラス・疑似要素・`:where()`）だけを対象にします。
 */
export function specificity(selector: string): Specificity {
  let a = 0;
  let b = 0;
  let c = 0;
  let i = 0;

  const isName = (char: string) => /[\w-]/.test(char);

  while (i < selector.length) {
    const rest = selector.slice(i);
    const functional = FUNCTIONAL.exec(rest);

    if (functional && functional.index === 0) {
      // 対応する閉じ括弧まで取る
      let depth = 0;
      let j = i + functional[0].length - 1;
      for (; j < selector.length; j += 1) {
        if (selector[j] === "(") depth += 1;
        else if (selector[j] === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      const inner = selector.slice(i + functional[0].length, j);

      if (functional[1] !== "where") {
        let best: Specificity = { a: 0, b: 0, c: 0 };
        for (const part of splitSelectorList(inner)) {
          const found = specificity(part);
          if (compare(found, best) > 0) best = found;
        }
        a += best.a;
        b += best.b;
        c += best.c;
      }

      i = j + 1;
      continue;
    }

    const char = selector[i];

    if (char === "#") {
      a += 1;
      i += 1;
      while (i < selector.length && isName(selector[i])) i += 1;
      continue;
    }

    if (char === ".") {
      b += 1;
      i += 1;
      while (i < selector.length && isName(selector[i])) i += 1;
      continue;
    }

    if (char === "[") {
      b += 1;
      while (i < selector.length && selector[i] !== "]") i += 1;
      i += 1;
      continue;
    }

    if (char === ":") {
      if (selector[i + 1] === ":") {
        c += 1;
        i += 2;
      } else {
        b += 1;
        i += 1;
      }
      while (i < selector.length && isName(selector[i])) i += 1;
      continue;
    }

    if (/[a-zA-Z]/.test(char)) {
      c += 1;
      while (i < selector.length && isName(selector[i])) i += 1;
      continue;
    }

    i += 1;
  }

  return { a, b, c };
}

/** 詳細度を比べる。CSS と同じく a → b → c の順に見る */
export function compare(left: Specificity, right: Specificity): number {
  if (left.a !== right.a) return left.a - right.a;
  if (left.b !== right.b) return left.b - right.b;
  return left.c - right.c;
}

export const format = ({ a, b, c }: Specificity) => `${a}.${b}.${c}`;

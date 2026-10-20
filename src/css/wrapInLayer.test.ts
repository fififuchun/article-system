import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  LAYER_NAME,
  LAYER_ORDER,
  MARKER_LAYER,
  MARKER_PLAIN,
  wrapInLayer,
  unwrapLayer,
} from "./wrapInLayer";

const plain = readFileSync(
  fileURLToPath(new URL("../styles.css", import.meta.url)),
  "utf8"
);

/** 印だけを持つ最小の CSS。印が無いと wrapInLayer は例外を投げる */
const tiny = `:where(:root) { ${MARKER_PLAIN} }\n`;

describe("wrapInLayer", () => {
  it("components の層に入れる", () => {
    expect(wrapInLayer(tiny)).toContain("@layer components {\n");
  });

  // 書かないと、読み込み順で base より前に作られて負ける（spec §10）
  it("層の順番を宣言する", () => {
    expect(wrapInLayer(tiny)).toContain(LAYER_ORDER);
  });

  it("順番の宣言を層のブロックより前に置く", () => {
    const out = wrapInLayer(tiny);

    expect(out.indexOf(LAYER_ORDER)).toBeLessThan(out.indexOf(`@layer ${LAYER_NAME} {`));
  });

  it("base より後、utilities より前の順番にする", () => {
    const names = LAYER_ORDER.replace("@layer ", "").replace(";", "").split(", ");

    expect(names.indexOf("base")).toBeLessThan(names.indexOf(LAYER_NAME));
    expect(names.indexOf(LAYER_NAME)).toBeLessThan(names.indexOf("utilities"));
  });

  // 中身を2つ管理しないための不変条件。違うのは印の1行だけ
  it("印以外は1バイトも変えない", () => {
    expect(unwrapLayer(wrapInLayer(plain))).toBe(
      plain.replace(MARKER_PLAIN, MARKER_LAYER)
    );
  });

  it("印を layer に差し替える", () => {
    const out = wrapInLayer(plain);

    expect(out).toContain(MARKER_LAYER);
    expect(out).not.toContain(MARKER_PLAIN);
  });

  // 印が無いまま配ると取り違えを検出できない
  it("印が無ければ例外を投げる", () => {
    expect(() => wrapInLayer("a{b:c}\n")).toThrow(/--as-stylesheet/);
  });

  it("層になっていない CSS は unwrap できない", () => {
    expect(unwrapLayer(plain)).toBeNull();
  });

  it("v3 向けの styles.css には @layer が無い", () => {
    expect(plain).not.toContain("@layer");
  });
});

// ビルド手順が実際に走っているかを見る。src ではなく dist どうしを比べるので、
// 「src を変えたがまだビルドしていない」状態では落ちない（pre-commit が別に止める）
describe("dist の層あり版", () => {
  const dist = (name: string) =>
    readFileSync(fileURLToPath(new URL(`../../dist/${name}`, import.meta.url)), "utf8");

  it("層なし版を包んだものになっている（違うのは印だけ）", () => {
    expect(unwrapLayer(dist("styles.layer.css"))).toBe(
      dist("styles.css").replace(MARKER_PLAIN, MARKER_LAYER)
    );
  });

  it("印が layer になっている", () => {
    expect(dist("styles.layer.css")).toContain(MARKER_LAYER);
    expect(dist("styles.css")).toContain(MARKER_PLAIN);
  });

  it("順番の宣言が入っている", () => {
    expect(dist("styles.layer.css")).toContain(LAYER_ORDER);
  });

  it("層なし版には @layer が入っていない", () => {
    expect(dist("styles.css")).not.toContain("@layer");
  });
});

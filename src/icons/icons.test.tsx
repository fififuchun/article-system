// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ClockIcon } from "./ClockIcon";
import { PersonIcon } from "./PersonIcon";
import { TagIcon } from "./TagIcon";

afterEach(cleanup);

const icons = [
  ["ClockIcon", ClockIcon],
  ["PersonIcon", PersonIcon],
  ["TagIcon", TagIcon],
] as const;

describe("アイコンの共通仕様（spec §11）", () => {
  it.each(icons)("%s は className を svg に付ける", (_name, Icon) => {
    const { container } = render(<Icon className="my-icon" />);

    expect(container.querySelector("svg")?.getAttribute("class")).toBe("my-icon");
  });

  it.each(icons)("%s は className 未指定でも描画できる", (_name, Icon) => {
    const { container } = render(<Icon />);

    expect(container.querySelector("svg")).not.toBeNull();
  });

  // CSS の color で色が変わるようにする
  it.each(icons)("%s は fill に currentColor を使う", (_name, Icon) => {
    const { container } = render(<Icon />);

    expect(container.querySelector("svg")?.getAttribute("fill")).toBe("currentColor");
  });

  // サイズは CSS で指定するため、width/height は持たせない
  it.each(icons)("%s は viewBox を持ち width/height を持たない", (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("viewBox")).toBeTruthy();
    expect(svg?.getAttribute("width")).toBeNull();
    expect(svg?.getAttribute("height")).toBeNull();
  });

  // 常にテキストと並べて使う装飾なので支援技術からは隠す
  it.each(icons)("%s は aria-hidden で支援技術から隠す", (_name, Icon) => {
    const { container } = render(<Icon />);

    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

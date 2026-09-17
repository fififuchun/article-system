import { isAbsoluteImageSrc } from "../resolveImageSrc";

/** md の画像記法。![alt](名前) の名前部分を取る */
const IMAGE_SYNTAX = /!\[[^\]]*\]\(([^)]*)\)/g;

/**
 * md とサムネイルから、実在を確かめるべき画像名を集める（spec §6）。
 *
 * ドロップした画像（blob）と外部URLは除きます。前者はサーバーに無いのが
 * 当然で、後者は imageBasePath の配下ではないためです。
 */
export function collectImageNames(markdown: string, thumbnail: string): string[] {
  const names = [...markdown.matchAll(IMAGE_SYNTAX)].map((match) => match[1]);

  return [...new Set([...names, thumbnail])].filter(
    (name) => name !== "" && !isAbsoluteImageSrc(name)
  );
}

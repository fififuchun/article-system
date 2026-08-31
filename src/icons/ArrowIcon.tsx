import type { IconProps } from "./types";

/** 右向き。他の向きは CSS の transform: rotate() で作る */
export function ArrowIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 11h12.17l-3.58-3.59L14 6l6 6-6 6-1.41-1.41L16.17 13H4z" />
    </svg>
  );
}

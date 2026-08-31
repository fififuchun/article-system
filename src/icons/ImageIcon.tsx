import type { IconProps } from "./types";

export function ImageIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path fillRule="evenodd" d="M2 4h20v16H2V4zm2 2v12h16V6H4z" />
      <circle cx="8" cy="10" r="1.75" />
      <path d="M5 17l4-5 3 3.5L15 12l4 5H5z" />
    </svg>
  );
}

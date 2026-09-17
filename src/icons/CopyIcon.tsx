import type { IconProps } from "./types";

export function CopyIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 2h10a2 2 0 012 2v10h-2V4H8z" />
      <path fillRule="evenodd" d="M4 6h12v14H4V6zm2 2v10h8V8z" />
    </svg>
  );
}

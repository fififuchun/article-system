import type { IconProps } from "./types";

export function TagIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M4 3h7.17c.53 0 1.04.21 1.41.59l8.83 8.83a2 2 0 0 1 0 2.83l-6.17 6.17a2 2 0 0 1-2.83 0L3.59 12.58A2 2 0 0 1 3 11.17V4a1 1 0 0 1 1-1zm3.25 2.5a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5z"
      />
    </svg>
  );
}

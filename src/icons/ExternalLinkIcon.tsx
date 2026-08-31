import type { IconProps } from "./types";

export function ExternalLinkIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M14 3h7v7h-2V6.41l-8.29 8.3-1.42-1.42L17.59 5H14z" />
      <path d="M19 13v6H5V5h6V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-6z" />
    </svg>
  );
}

import type { IconProps } from "./types";

export function PersonIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="7.5" r="3.75" />
      <path d="M12 13.5c-4.14 0-7.5 2.35-7.5 5.25V20h15v-1.25c0-2.9-3.36-5.25-7.5-5.25z" />
    </svg>
  );
}

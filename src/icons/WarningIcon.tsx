import type { IconProps } from "./types";

export function WarningIcon({ className }: IconProps) {
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
        d="M12 2l11 19H1L12 2zm-1 7v6h2V9h-2zm0 8v2h2v-2h-2z"
      />
    </svg>
  );
}

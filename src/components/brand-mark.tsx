import type { SVGProps } from "react";

type BrandMarkProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

export function BrandMark({ title, ...props }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <rect x="3" y="3" width="42" height="42" rx="14" fill="#155E63" />
      <path
        d="M13.5 17.7C13.5 15.1 15.6 13 18.2 13h11.6c2.6 0 4.7 2.1 4.7 4.7v6.1c0 2.6-2.1 4.7-4.7 4.7h-5.2L18 34v-5.5c-2.5-.1-4.5-2.2-4.5-4.7v-6.1Z"
        fill="#FFF8EA"
      />
      <path
        d="M18.2 23.4h5.1l2-4.7 2.2 8.7 2.2-4h5.1"
        stroke="#155E63"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M29.8 13.6 33.7 10"
        stroke="#F47A2F"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="36" cy="8.5" r="2.4" fill="#F47A2F" />
    </svg>
  );
}

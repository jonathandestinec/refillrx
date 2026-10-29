import Link from "next/link";

type BrandMarkProps = {
  href?: string;
  className?: string;
};

export function MedicineMark() {
  return (
    <span className="medicine-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" role="presentation">
        <circle cx="16" cy="16" r="14" fill="#d8f16d" />
        <g transform="rotate(-45 16 16)">
          <rect x="8" y="11" width="16" height="10" rx="5" fill="#111111" />
          <path d="M16 11v10" stroke="#d8f16d" strokeWidth="1.5" />
        </g>
      </svg>
    </span>
  );
}

export default function BrandMark({ href = "/", className = "" }: BrandMarkProps) {
  return (
    <Link
      className={`brand-mark ${className}`.trim()}
      href={href}
      aria-label="RefillRx home"
    >
      <MedicineMark />
      <span>refill</span><span>rx</span>
    </Link>
  );
}

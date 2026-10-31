// Charie mark: a loop arrow (the autonomous loop, always circling back)
// on the brand violet tile. One SVG, every size.

export function CharieMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="#6d5ef0" />
      <path
        d="M20.6 12.6 A7.6 7.6 0 1 0 21.2 17.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M21.4 13.4v3.8h-3.8"
        fill="none"
        stroke="#fff"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

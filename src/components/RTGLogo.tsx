"use client";

// R2G2-style logo: 4 colored circles in a 2x2 grid
export function RTGLogo({ size = 28 }: { size?: number }) {
  const r = size * 0.22; // circle radius
  const gap = size * 0.28; // distance from center
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Top-left: Red */}
      <circle cx={cx - gap} cy={cy - gap} r={r} fill="#E4002B" />
      {/* Top-right: Blue */}
      <circle cx={cx + gap} cy={cy - gap} r={r} fill="#0033A0" />
      {/* Bottom-left: Gold/Yellow */}
      <circle cx={cx - gap} cy={cy + gap} r={r} fill="#C9A95C" />
      {/* Bottom-right: Blue */}
      <circle cx={cx + gap} cy={cy + gap} r={r} fill="#0033A0" />
    </svg>
  );
}

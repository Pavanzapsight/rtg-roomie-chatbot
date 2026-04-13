"use client";

// R2G2 logo: 4 colored circles (red, yellow, green, blue) in a 2x2 grid
// on a dark navy circular background — matches the official RTG chat widget
export function RTGLogo({ size = 28 }: { size?: number }) {
  const dotR = size * 0.16; // dot radius
  const gap = size * 0.21; // distance from center to dot center
  const cx = size / 2;
  const cy = size / 2;
  const bgR = size / 2; // background circle radius

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Dark navy background circle */}
      <circle cx={cx} cy={cy} r={bgR} fill="#1B3668" />
      {/* Top-left: Red */}
      <circle cx={cx - gap} cy={cy - gap} r={dotR} fill="#E4002B" />
      {/* Top-right: Yellow/Gold */}
      <circle cx={cx + gap} cy={cy - gap} r={dotR} fill="#F2C75C" />
      {/* Bottom-left: Green */}
      <circle cx={cx - gap} cy={cy + gap} r={dotR} fill="#4CAF50" />
      {/* Bottom-right: Blue */}
      <circle cx={cx + gap} cy={cy + gap} r={dotR} fill="#3B7DD8" />
    </svg>
  );
}

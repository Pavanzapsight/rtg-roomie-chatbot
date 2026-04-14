"use client";

/**
 * Stylized "ROOMS TO GO" wordmark — approximates the official RTG brand logo.
 *
 * - Heavy condensed sans-serif typeface
 * - Yellow dot replaces one of the O's in ROOMS
 * - Red-with-green-play-arrow replaces the final O in GO
 */
export function RTGTextLogo({
  color = "white",
  height = 22,
}: {
  color?: string;
  height?: number;
}) {
  // We render "R" + yellow-O + "OMS TO G" + red-O-with-arrow
  // Measurements tuned for the provided height.
  const circleR = height * 0.42;

  return (
    <div
      className="flex items-center"
      style={{
        fontFamily: '"Arial Black", "Helvetica Neue", Impact, sans-serif',
        fontWeight: 900,
        fontSize: height,
        lineHeight: 1,
        letterSpacing: "0.02em",
        color,
        whiteSpace: "nowrap",
      }}
    >
      <span>R</span>
      {/* Yellow circle replacing the first O in ROOMS */}
      <span
        className="inline-block align-middle"
        style={{
          width: circleR * 2,
          height: circleR * 2,
          borderRadius: "50%",
          backgroundColor: "#F2C75C",
          margin: "0 1px",
        }}
        aria-hidden="true"
      />
      <span>OMS&nbsp;T</span>
      {/* Gap before next element */}
      <span style={{ width: 2 }} />
      <span>O</span>
      <span>&nbsp;G</span>
      {/* Red circle with green play-arrow, replacing final O */}
      <span
        className="relative inline-flex items-center justify-center align-middle"
        style={{
          width: circleR * 2,
          height: circleR * 2,
          borderRadius: "50%",
          backgroundColor: "#E4002B",
          margin: "0 1px",
        }}
        aria-hidden="true"
      >
        <svg
          width={circleR * 1.2}
          height={circleR * 1.2}
          viewBox="0 0 10 10"
          style={{ position: "absolute" }}
        >
          <polygon points="3.5,2 3.5,8 8,5" fill="#4CAF50" />
        </svg>
      </span>
    </div>
  );
}

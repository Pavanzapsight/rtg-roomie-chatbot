"use client";

import Image from "next/image";
import type { WidgetBranding, WidgetTheme } from "@/lib/widget-config";

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function WidgetAvatar({
  size = 28,
  branding,
  theme,
}: {
  size?: number;
  branding: WidgetBranding;
  theme: WidgetTheme;
}) {
  if (branding.logoMode === "none") return null;

  const sharedStyle = {
    width: size,
    height: size,
    borderRadius: "999px",
    flexShrink: 0,
  } as const;

  if (branding.logoMode === "image" && branding.logoUrl) {
    return (
      <Image
        src={branding.logoUrl}
        alt={branding.logoAlt || branding.headerTitle}
        width={size}
        height={size}
        unoptimized
        style={sharedStyle}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center text-[11px] font-semibold uppercase tracking-[0.08em]"
      style={{
        ...sharedStyle,
        backgroundColor: theme.accent,
        color: theme.accentText,
      }}
    >
      {getInitials(branding.assistantName)}
    </div>
  );
}
